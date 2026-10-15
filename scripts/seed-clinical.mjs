import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "../generated/prisma/index.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const providers = JSON.parse(
  readFileSync(path.join(root, "src/data/providers.json"), "utf8"),
);
const patients = JSON.parse(
  readFileSync(path.join(root, "src/data/patients.json"), "utf8"),
);

const db = new PrismaClient();

for (const provider of providers) {
  const data = {
    firstName: provider.firstName,
    lastName: provider.lastName,
    credentials: provider.credentials,
    specialty: provider.specialty,
    email: provider.email,
  };
  await db.provider.upsert({
    where: { id: provider.id },
    update: data,
    create: { id: provider.id, ...data },
  });
}

for (const patient of patients) {
  const data = {
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: new Date(`${patient.dateOfBirth}T00:00:00.000Z`),
    gender: patient.gender,
    email: patient.email,
    phone: patient.phone,
    psychiatricHistory: patient.psychiatricHistory,
    primaryProviderId: patient.primaryProviderId,
    createdAt: new Date(patient.createdAt),
    updatedAt: new Date(patient.updatedAt),
  };
  await db.patient.upsert({
    where: { id: patient.id },
    update: data,
    create: { id: patient.id, ...data },
  });

  await db.patientAllergy.deleteMany({ where: { patientId: patient.id } });
  await db.patientCondition.deleteMany({ where: { patientId: patient.id } });
  await db.emergencyContact.deleteMany({ where: { patientId: patient.id } });

  if (patient.allergies.length > 0) {
    await db.patientAllergy.createMany({
      data: patient.allergies.map((substance) => ({
        patientId: patient.id,
        substance,
      })),
    });
  }
  if (patient.relevantMedicalHistory.length > 0) {
    await db.patientCondition.createMany({
      data: patient.relevantMedicalHistory.map((description) => ({
        patientId: patient.id,
        description,
      })),
    });
  }
  await db.emergencyContact.create({
    data: {
      patientId: patient.id,
      name: patient.emergencyContact.name,
      relationship: patient.emergencyContact.relationship,
      phone: patient.emergencyContact.phone,
    },
  });
}

const [providerCount, patientCount] = await Promise.all([
  db.provider.count(),
  db.patient.count(),
]);
console.log(`Seeded ${providerCount} providers and ${patientCount} patients`);
await db.$disconnect();
