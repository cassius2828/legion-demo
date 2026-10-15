"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { CLINIC_TIME_ZONE } from "~/lib/clinic-time";
import { auth } from "~/server/auth";
import { listOpenFollowUpSlots } from "~/server/availability";
import { db } from "~/server/db";

const reasonSchema = z.string().trim().min(1).max(1000);

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

  const booked = await db.$transaction(async (tx) => {
    const open = await listOpenFollowUpSlots({
      providerId: patient.primaryProviderId,
      patientId: patient.id,
      database: tx,
    });
    const match = open.find((slot) => slot.start.getTime() === start.getTime());
    if (!match) return null;

    const titleTime = new Intl.DateTimeFormat("en-US", {
      timeZone: CLINIC_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
    }).format(start);
    const durationMinutes = Math.round((match.end.getTime() - match.start.getTime()) / 60000);

    return tx.appointment.create({
      data: {
        patientId: patient.id,
        providerId: patient.primaryProviderId,
        scheduledAt: start,
        durationMinutes,
        appointmentType: "Follow-up",
        status: "scheduled",
        title: `${patient.firstName} ${patient.lastName}, ${titleTime}`,
        description: `Upcoming follow-up for ${patient.firstName} ${patient.lastName}. ${reason.data}`,
        reasonForVisit: reason.data,
        createdAt: new Date(),
      },
    });
  });

  if (!booked) {
    return { error: "That time was just taken. Choose another opening." };
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  redirect("/calendar");
}
