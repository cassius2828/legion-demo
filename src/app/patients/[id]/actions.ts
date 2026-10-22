"use server";

import { revalidatePath } from "next/cache";

import type { Prisma } from "../../../../generated/prisma";

import { formatDate } from "~/lib/chart";
import {
  allowedMedicationNames,
  OFF_CHART_OVERVIEW_ERROR,
  overviewMedications,
} from "~/lib/overview-medications";
import {
  patientSummarySchema,
  type PatientSummary,
  type SavedPatientSummary,
} from "~/lib/patient-summary";
import { auth } from "~/server/auth";
import {
  canViewPatient,
  providerMayPrepareSummary,
  viewerRecord,
} from "~/server/access";
import { db } from "~/server/db";
import { summarizePatient } from "~/server/patient-summary-agent";
import { loadSavedSummary } from "~/server/chart-version";
import {
  approvalDecision,
  diagnosisLines,
  medicationFacts,
  taskLine,
  visitSummaryLine,
} from "~/server/summary-assembly";

export type SummaryActionResult =
  | { ok: true; summary: PatientSummary; chartVersion: number }
  | { ok: false; error: string };

async function authorizedPatient(patientId: string) {
  const session = await auth();
  if (!session?.user?.role || !providerMayPrepareSummary(session.user.role)) {
    return {
      ok: false as const,
      error: "Sign in as a provider to prepare a summary.",
    };
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
  if (!allowed)
    return { ok: false as const, error: "That chart is not available." };

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

  const prepared = await summarizePatient({
    patientId: access.patientId,
    providerId: access.providerId,
    role: access.role,
    correction: correction ? { note, draft: correction.draft } : undefined,
  });
  if (!prepared.ok) return prepared;

  const chart = await db.patient.findUnique({
    where: { id: access.patientId },
    select: { chartVersion: true },
  });
  if (!chart) return { ok: false, error: "That chart is not available." };
  return {
    ok: true,
    summary: prepared.summary,
    chartVersion: chart.chartVersion,
  };
}

async function currentSummaryLists(
  patientId: string,
  database: Prisma.TransactionClient,
) {
  const [chart, visits, medications, tasks] = await Promise.all([
    database.patient.findUnique({
      where: { id: patientId },
      select: {
        psychiatricHistory: true,
        conditions: {
          orderBy: { description: "asc" },
          select: { description: true },
        },
      },
    }),
    database.visit.findMany({
      where: { patientId, status: "completed" },
      orderBy: { visitDate: "desc" },
      take: 5,
      select: { clinicalSummary: true },
    }),
    database.medication.findMany({
      where: { patientId },
      orderBy: { medicationName: "asc" },
      select: {
        medicationName: true,
        genericName: true,
        dosage: true,
        status: true,
      },
    }),
    database.task.findMany({
      where: { patientId, status: "open" },
      orderBy: { dueDate: "asc" },
      select: { title: true, description: true, priority: true, dueDate: true },
    }),
  ]);
  if (!chart) return null;

  const visitFacts = {
    diagnoses: diagnosisLines(chart),
    latestClinicalSummary: visits[0]?.clinicalSummary ?? null,
    visitCount: visits.length,
  };
  const recentVisitSummary = visitSummaryLine(visitFacts);
  if (!recentVisitSummary) return null;
  const medication = medicationFacts(medications);
  return {
    diagnoses: visitFacts.diagnoses,
    currentMedications: medication.active,
    discontinuedMedications: medication.discontinued,
    recentVisitSummary,
    outstandingTasks: tasks.map((task) =>
      taskLine({
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDateLabel: formatDate(task.dueDate),
      }),
    ),
    allowedMedicationNames: allowedMedicationNames(medications),
  };
}

export async function approvePatientSummary(
  summary: PatientSummary,
  draftVersion: number,
): Promise<
  { ok: true; saved: SavedPatientSummary } | { ok: false; error: string }
> {
  const parsed = patientSummarySchema.safeParse(summary);
  if (!parsed.success)
    return { ok: false, error: "That summary could not be saved." };

  const access = await authorizedPatient(parsed.data.patientId);
  if (!access.ok) return access;

  const decision = await db.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({
      where: { id: access.patientId },
      select: { chartVersion: true },
    });
    const current = patient
      ? await currentSummaryLists(access.patientId, tx)
      : null;
    if (!patient || !current) {
      return {
        ok: false as const,
        error: "That summary does not match the chart.",
      };
    }

    const verdict = approvalDecision({
      summary: parsed.data,
      draftVersion,
      currentVersion: patient.chartVersion,
      current,
    });
    if (!verdict.ok) return verdict;
    const overview = overviewMedications(
      parsed.data.overview,
      current.allowedMedicationNames,
    );
    if (overview.unmatched.length > 0) {
      return { ok: false as const, error: OFF_CHART_OVERVIEW_ERROR };
    }

    const data = {
      approvedByProviderId: access.providerId,
      approvedAt: new Date(),
      overview: parsed.data.overview,
      recentVisitSummary: parsed.data.recentVisitSummary,
      diagnoses: JSON.stringify(parsed.data.diagnoses),
      currentMedications: JSON.stringify(parsed.data.currentMedications),
      discontinuedMedications: JSON.stringify(
        parsed.data.discontinuedMedications,
      ),
      outstandingTasks: JSON.stringify(parsed.data.outstandingTasks),
      chartVersion: patient.chartVersion,
    };
    await tx.patientSummaryRecord.upsert({
      where: { patientId: access.patientId },
      update: data,
      create: { patientId: access.patientId, ...data },
    });
    return { ok: true as const };
  });
  if (!decision.ok) return decision;

  revalidatePath(`/patients/${access.patientId}`);
  const saved = await loadSavedSummary(access.patientId);
  if (!saved) return { ok: false, error: "That summary could not be saved." };
  return { ok: true, saved };
}
