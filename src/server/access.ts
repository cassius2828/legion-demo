import "server-only";

import { db } from "~/server/db";

export async function viewerRecord(userId: string, role: string) {
  if (role === "patient") {
    const patient = await db.patient.findUnique({
      where: { userId },
      include: { primaryProvider: true },
    });
    return { role: "patient" as const, patient, provider: null };
  }

  const provider = await db.provider.findUnique({
    where: { userId },
    include: {
      patients: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
    },
  });
  return { role: "provider" as const, patient: null, provider };
}

export function canViewPatient(input: {
  role: string;
  ownPatientId: string | null;
  ownProviderId: string | null;
  patient: { id: string; primaryProviderId: string };
}) {
  if (input.role === "patient") return input.patient.id === input.ownPatientId;
  if (input.role === "psychiatrist" || input.role === "nurse") {
    return input.ownProviderId !== null && input.patient.primaryProviderId === input.ownProviderId;
  }
  return false;
}
