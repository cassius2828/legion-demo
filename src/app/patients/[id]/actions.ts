"use server";

import { revalidatePath } from "next/cache";

import { patientSummarySchema, type PatientSummary, type SavedPatientSummary } from "~/lib/patient-summary";
import { auth } from "~/server/auth";
import { canViewPatient, viewerRecord } from "~/server/access";
import { db } from "~/server/db";
import { summarizePatient } from "~/server/patient-summary-agent";
import { chartFingerprint, loadSavedSummary } from "~/server/summary-fingerprint";

export type SummaryActionResult =
  | { ok: true; summary: PatientSummary }
  | { ok: false; error: string };

async function authorizedPatient(patientId: string) {
  const session = await auth();
  if (!session?.user?.role || session.user.role === "patient") {
    return { ok: false as const, error: "Sign in as a provider to prepare a summary." };
  }

  const viewer = await viewerRecord(session.user.id, session.user.role);
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: { id: true, primaryProviderId: true },
  });
  if (!patient || !viewer.provider) {
    return { ok: false as const, error: "That chart is not available." };
  }

  const allowed = canViewPatient({
    role: session.user.role,
    ownPatientId: null,
    ownProviderId: viewer.provider.id,
    patient,
  });
  if (!allowed) return { ok: false as const, error: "That chart is not available." };

  return {
    ok: true as const,
    patientId: patient.id,
    providerId: viewer.provider.id,
    role: session.user.role,
  };
}

export async function preparePatientSummary(
  patientId: string,
  correction?: { note: string; draft: PatientSummary },
): Promise<SummaryActionResult> {
  const access = await authorizedPatient(patientId);
  if (!access.ok) return access;

  const note = correction?.note.trim() ?? "";
  if (correction && (note.length === 0 || note.length > 2000)) {
    return { ok: false, error: "Write the correction you want applied." };
  }
  if (correction && correction.draft.patientId !== access.patientId) {
    return { ok: false, error: "That chart is not available." };
  }

  return summarizePatient({
    patientId: access.patientId,
    providerId: access.providerId,
    role: access.role,
    correction: correction ? { note, draft: correction.draft } : undefined,
  });
}

export async function approvePatientSummary(
  summary: PatientSummary,
): Promise<{ ok: true; saved: SavedPatientSummary } | { ok: false; error: string }> {
  const parsed = patientSummarySchema.safeParse(summary);
  if (!parsed.success) return { ok: false, error: "That summary could not be saved." };

  const access = await authorizedPatient(parsed.data.patientId);
  if (!access.ok) return access;

  const fingerprint = await chartFingerprint(access.patientId);
  const data = {
    approvedByProviderId: access.providerId,
    approvedAt: new Date(),
    overview: parsed.data.overview,
    recentVisitSummary: parsed.data.recentVisitSummary,
    diagnoses: JSON.stringify(parsed.data.diagnoses),
    currentMedications: JSON.stringify(parsed.data.currentMedications),
    discontinuedMedications: JSON.stringify(parsed.data.discontinuedMedications),
    outstandingTasks: JSON.stringify(parsed.data.outstandingTasks),
    fingerprint,
  };
  await db.patientSummaryRecord.upsert({
    where: { patientId: access.patientId },
    update: data,
    create: { patientId: access.patientId, ...data },
  });
  revalidatePath(`/patients/${access.patientId}`);
  const saved = await loadSavedSummary(access.patientId);
  if (!saved) return { ok: false, error: "That summary could not be saved." };
  return { ok: true, saved };
}
