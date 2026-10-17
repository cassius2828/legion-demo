"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canViewPatient, viewerRecord } from "~/server/access";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

const bodySchema = z.string().trim().min(1).max(1000);

export async function sendClinicMessage(input: { body: string; patientId?: string }) {
  const session = await auth();
  if (!session?.user?.role) return { ok: false as const, error: "Sign in to send a message." };

  const parsed = bodySchema.safeParse(input.body);
  if (!parsed.success) return { ok: false as const, error: "Write a message first." };

  const viewer = await viewerRecord(session.user.id, session.user.role);
  let patientId: string;
  let providerId: string;

  if (session.user.role === "patient") {
    if (!viewer.patient) return { ok: false as const, error: "No chart is linked to this account." };
    patientId = viewer.patient.id;
    providerId = viewer.patient.primaryProviderId;
  } else if (viewer.provider && input.patientId) {
    const patient = await db.patient.findUnique({
      where: { id: input.patientId },
      select: { id: true, primaryProviderId: true },
    });
    if (
      !patient ||
      !canViewPatient({
        role: session.user.role,
        ownPatientId: null,
        ownProviderId: viewer.provider.id,
        patient,
      })
    ) {
      return { ok: false as const, error: "That conversation is not available." };
    }
    patientId = patient.id;
    providerId = viewer.provider.id;
  } else {
    return { ok: false as const, error: "That conversation is not available." };
  }

  await db.clinicMessage.create({
    data: {
      patientId,
      providerId,
      authorUserId: session.user.id,
      body: parsed.data,
    },
  });
  revalidatePath("/messages");
  revalidatePath(`/messages/${patientId}`);
  return { ok: true as const };
}
