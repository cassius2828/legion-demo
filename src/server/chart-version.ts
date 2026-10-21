import "server-only";

import type { Prisma } from "../../generated/prisma";

import { CLINIC_TIME_ZONE } from "~/lib/clinic-time";
import type {
  PatientSummary,
  SavedPatientSummary,
} from "~/lib/patient-summary";
import { db } from "~/server/db";

const approvedDate = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function bumpChartVersion(
  database: Prisma.TransactionClient,
  patientId: string,
) {
  return database.patient.update({
    where: { id: patientId },
    data: { chartVersion: { increment: 1 } },
  });
}

function readList(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export async function loadSavedSummary(
  patientId: string,
): Promise<SavedPatientSummary | null> {
  const record = await db.patientSummaryRecord.findUnique({
    where: { patientId },
    include: { patient: { select: { chartVersion: true } } },
  });
  if (!record) return null;
  const summary: PatientSummary = {
    patientId,
    overview: record.overview,
    recentVisitSummary: record.recentVisitSummary,
    diagnoses: readList(record.diagnoses),
    currentMedications: readList(record.currentMedications),
    discontinuedMedications: readList(record.discontinuedMedications),
    outstandingTasks: readList(record.outstandingTasks),
  };
  return {
    approvedLabel: approvedDate.format(record.approvedAt),
    outdated: record.chartVersion !== record.patient.chartVersion,
    summary,
  };
}
