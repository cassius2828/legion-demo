"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createCalendarEvent, moveCalendarEvent } from "~/server/calendar";
import { cancelClinicAppointment, moveClinicAppointment } from "~/server/clinic-appointments";
import { auth, signIn } from "~/server/auth";
import { groupOpenSlots, listOpenFollowUpSlots } from "~/server/availability";
import { db } from "~/server/db";
import { viewerRecord } from "~/server/access";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  start: z.string().datetime(),
  durationMinutes: z.union([z.literal(30), z.literal(60)]),
});

const moveSchema = z.object({
  id: z.string().min(1).max(1024),
  start: z.string().datetime(),
  end: z.string().datetime(),
});

async function signedInUserId() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function scheduleAppointment(input: {
  title: string;
  start: string;
  durationMinutes: 30 | 60;
}) {
  const userId = await signedInUserId();
  if (!userId) return { ok: false as const, error: "Sign in to schedule." };

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Enter a title and time." };

  const start = new Date(parsed.data.start);
  const end = new Date(start.getTime() + parsed.data.durationMinutes * 60 * 1000);
  const result = await createCalendarEvent(userId, {
    title: parsed.data.title,
    start,
    end,
  });
  if (!result.ok) {
    return {
      ok: false as const,
      error:
        result.error === "connect"
          ? "Connect Google Calendar to schedule."
          : result.error,
    };
  }
  revalidatePath("/calendar");
  return { ok: true as const };
}

export async function rescheduleAppointment(input: { id: string; start: string; end: string }) {
  const userId = await signedInUserId();
  if (!userId) return { ok: false as const, error: "Sign in to schedule." };

  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Could not move that appointment." };
  const start = new Date(parsed.data.start);
  const end = new Date(parsed.data.end);
  if (!(end.getTime() > start.getTime())) {
    return { ok: false as const, error: "Could not move that appointment." };
  }

  if (parsed.data.id) {
    const clinic = await db.appointment.findUnique({
      where: { id: parsed.data.id },
      select: { id: true },
    });
    if (clinic) {
      const session = await auth();
      const moved = await moveClinicAppointment(userId, session?.user.role ?? "", {
        id: parsed.data.id,
        start,
      });
      if (!moved.ok) return moved;
      revalidatePath("/calendar");
      return { ok: true as const };
    }
  }

  const result = await moveCalendarEvent(userId, { id: parsed.data.id, start, end });
  if (!result.ok) {
    return {
      ok: false as const,
      error:
        result.error === "connect"
          ? "Connect Google Calendar to schedule."
          : result.error,
    };
  }
  revalidatePath("/calendar");
  return { ok: true as const };
}

export async function connectCalendar() {
  await signIn("google", { redirectTo: "/calendar" });
}

export async function listMoveSlots(appointmentId: string) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Sign in to schedule." };

  const viewer = await viewerRecord(session.user.id, session.user.role ?? "");
  const appointment = await db.appointment.findUnique({ where: { id: appointmentId } });
  if (
    !appointment ||
    appointment.status !== "scheduled" ||
    appointment.scheduledAt.getTime() < Date.now()
  ) {
    return { ok: false as const, error: "That appointment is no longer scheduled." };
  }
  const allowed =
    viewer.patient?.id === appointment.patientId ||
    viewer.provider?.id === appointment.providerId ||
    (appointment.nurseId !== null && viewer.provider?.id === appointment.nurseId);
  if (!allowed) return { ok: false as const, error: "Could not move that appointment." };

  const slots = await listOpenFollowUpSlots({
    providerId: appointment.providerId,
    patientId: appointment.patientId,
    ignoreAppointmentId: appointment.id,
  });
  return { ok: true as const, groups: groupOpenSlots(slots) };
}

export async function cancelCalendarAppointment(input: { id: string; reason: string }) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, error: "Sign in to schedule." };

  const cancelled = await cancelClinicAppointment(session.user.id, session.user.role ?? "", input);
  if (!cancelled.ok) return cancelled;
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/appointments/book");
  return { ok: true as const };
}
