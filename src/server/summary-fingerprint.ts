import "server-only";

import { createHash } from "node:crypto";

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

export async function chartFingerprint(patientId: string) {
  const [patient, visit, medications, tasks, orders] = await Promise.all([
    db.patient.findUnique({
      where: { id: patientId },
      select: {
        psychiatricHistory: true,
        conditions: {
          orderBy: { description: "asc" },
          select: { description: true },
        },
      },
    }),
    db.visit.findFirst({
      where: { patientId, status: "completed" },
      orderBy: { visitDate: "desc" },
      select: { id: true, clinicalSummary: true },
    }),
    db.medication.findMany({
      where: { patientId },
      orderBy: [
        { medicationName: "asc" },
        { dosage: "asc" },
        { status: "asc" },
      ],
      select: { medicationName: true, dosage: true, status: true },
    }),
    db.task.findMany({
      where: { patientId, status: "open" },
      orderBy: [{ dueDate: "asc" }, { title: "asc" }],
      select: { title: true, description: true, priority: true, dueDate: true },
    }),
    db.prescriptionOrder.findMany({
      where: { patientId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, status: true, medicationName: true, dosage: true },
    }),
  ]);

  const diagnoses =
    patient?.conditions.map((condition) => condition.description) ?? [];
  const history = patient?.psychiatricHistory.trim();
  if (history) diagnoses.push(history);

  const payload = {
    visit: visit
      ? { id: visit.id, clinicalSummary: visit.clinicalSummary }
      : null,
    medications,
    diagnoses,
    tasks: tasks.map((task) => ({
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate.toISOString(),
    })),
    orders,
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
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
  });
  if (!record) return null;
  const current = await chartFingerprint(patientId);
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
    outdated: current !== record.fingerprint,
    summary,
  };
}
