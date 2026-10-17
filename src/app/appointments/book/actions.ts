"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { UpcomingVisit } from "~/lib/booking";
import { auth } from "~/server/auth";
import { commitFollowUp, scheduleWithAgent } from "~/server/booking-agent";
import { cancelClinicAppointment } from "~/server/clinic-appointments";
import { db } from "~/server/db";
import { loadUpcomingVisit } from "~/server/follow-up";

const reasonSchema = z.string().trim().min(1).max(1000);

export type { UpcomingVisit };

export type AgentBooking = {
  appointmentId: string;
  dateLabel: string;
  timeLabel: string;
  summary: string;
};

type AgentActionResult =
  | { ok: true; booking: AgentBooking }
  | { ok: false; error: string; upcoming?: UpcomingVisit };

async function currentPatient() {
  const session = await auth();
  if (!session?.user || session.user.role !== "patient") return null;
  return db.patient.findUnique({ where: { userId: session.user.id } });
}

function patientName(patient: { firstName: string; lastName: string }) {
  return `${patient.firstName} ${patient.lastName}`;
}

function commitMessage(error: "taken" | "upcoming" | "same-day") {
  if (error === "upcoming") return "You already have an upcoming appointment.";
  if (error === "same-day") return "You already have an appointment that day.";
  return "That time was just taken. Choose another opening.";
}

function refreshBooking() {
  revalidatePath("/calendar");
  revalidatePath("/");
  revalidatePath("/appointments/book");
}

export async function bookFollowUp(
  _previous: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "patient") {
    return { error: "Sign in as a patient to book." };
  }

  const reason = reasonSchema.safeParse(formData.get("reason"));
  const startRaw = formData.get("start");
  const start = new Date(typeof startRaw === "string" ? startRaw : "");
  if (!reason.success || Number.isNaN(start.getTime())) {
    return { error: "Describe the issue and choose a time." };
  }

  const patient = await db.patient.findUnique({
    where: { userId: session.user.id },
  });
  if (!patient) return { error: "No chart is linked to this account." };

  const upcoming = await loadUpcomingVisit(patient.id);
  if (upcoming) return { error: "You already have an upcoming appointment." };

  const booked = await commitFollowUp({
    patientId: patient.id,
    providerId: patient.primaryProviderId,
    patientName: patientName(patient),
    reason: reason.data,
    start,
  });

  if (!booked.ok) return { error: commitMessage(booked.error) };

  refreshBooking();
  redirect("/calendar");
}

export async function requestAgentBooking(reason: string): Promise<AgentActionResult> {
  const patient = await currentPatient();
  if (!patient) return { ok: false, error: "Sign in as a patient to book." };

  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) return { ok: false, error: "Describe the issue first." };

  const upcoming = await loadUpcomingVisit(patient.id);
  if (upcoming) {
    return { ok: false, error: "You already have an upcoming appointment.", upcoming };
  }

  const scheduled = await scheduleWithAgent({
    patientId: patient.id,
    providerId: patient.primaryProviderId,
    patientName: patientName(patient),
    reason: parsed.data,
  });
  if (!scheduled.ok) return scheduled;

  refreshBooking();
  return {
    ok: true,
    booking: {
      appointmentId: scheduled.appointmentId,
      dateLabel: scheduled.dateLabel,
      timeLabel: scheduled.timeLabel,
      summary: scheduled.summary,
    },
  };
}

export async function rescheduleWithAgent(appointmentId: string): Promise<AgentActionResult> {
  const patient = await currentPatient();
  if (!patient) return { ok: false, error: "Sign in as a patient to book." };

  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, patientId: patient.id, status: "scheduled" },
  });
  if (!appointment || appointment.scheduledAt.getTime() < Date.now()) {
    return { ok: false, error: "That appointment is no longer scheduled." };
  }

  const scheduled = await scheduleWithAgent({
    patientId: patient.id,
    providerId: patient.primaryProviderId,
    patientName: patientName(patient),
    reason: appointment.reasonForVisit,
    movingAppointmentId: appointment.id,
    excludeStart: appointment.scheduledAt.toISOString(),
  });
  if (!scheduled.ok) {
    return {
      ok: false,
      error: "Another time could not be booked. This appointment is unchanged.",
    };
  }

  refreshBooking();
  return {
    ok: true,
    booking: {
      appointmentId: scheduled.appointmentId,
      dateLabel: scheduled.dateLabel,
      timeLabel: scheduled.timeLabel,
      summary: scheduled.summary,
    },
  };
}

export async function cancelAgentBooking(
  appointmentId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "patient") {
    return { ok: false, error: "Sign in as a patient to book." };
  }

  const cancelled = await cancelClinicAppointment(session.user.id, session.user.role, {
    id: appointmentId,
    reason,
  });
  if (!cancelled.ok) return cancelled;

  refreshBooking();
  return { ok: true };
}
