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

export {
  canViewPatient,
  providerMayPrepareSummary,
} from "~/server/chart-access";
