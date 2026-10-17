import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "../generated/prisma/index.js";
import { coverageFor } from "./coverage.mjs";
import { seedClinicHistory, seedMedications } from "./clinic-history.mjs";
import { seedTasks } from "./clinic-tasks.mjs";
import { seedCareLoop } from "./care-loop-seed.mjs";
import { PHARMACIES, seedPharmacies } from "./pharmacies.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const providers = JSON.parse(
  readFileSync(path.join(root, "src/data/providers.json"), "utf8"),
);
const patients = JSON.parse(
  readFileSync(path.join(root, "src/data/patients.json"), "utf8"),
);
const schedules = JSON.parse(
  readFileSync(path.join(root, "src/data/schedules.json"), "utf8"),
);

const db = new PrismaClient();

await seedPharmacies(db);

async function organizationIdFor(name) {
  if (!name) return null;
  const organization = await db.organization.upsert({
    where: { name },
    create: { name },
    update: {},
    select: { id: true },
  });
  return organization.id;
}

async function ensureClinicianUser(provider, organizationId) {
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const email = provider.email;
  let login = users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  const data = {
    name: `${provider.firstName} ${provider.lastName}`,
    email,
    role: provider.credentials === "PMHNP" ? "nurse" : "psychiatrist",
    organizationId,
    primaryInsurance: null,
    secondaryInsurance: null,
  };
  if (!login) {
    login = await db.user.create({ data, select: { id: true, email: true } });
  } else {
    await db.user.update({ where: { id: login.id }, data });
  }
  await db.provider.update({
    where: { id: provider.id },
    data: { userId: login.id, organizationId },
  });
}

async function ensurePatientUser(patient) {
  const users = await db.user.findMany({ select: { id: true, email: true } });
  const email = patient.email;
  let login = users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  const coverage = coverageFor(patient.id, patient.dateOfBirth);
  const data = {
    name: `${patient.firstName} ${patient.lastName}`,
    email,
    role: "patient",
    primaryInsurance: coverage.primaryInsurance,
    secondaryInsurance: coverage.secondaryInsurance,
  };
  if (!login) {
    login = await db.user.create({ data, select: { id: true, email: true } });
  } else {
    await db.user.update({ where: { id: login.id }, data });
  }
  await db.patient.update({ where: { id: patient.id }, data: { userId: login.id } });
}

async function linkLogin(email, role, name, kind, recordId) {
  const match = await db.user.findMany({ select: { id: true, email: true } });
  const login = match.find((item) => item.email?.toLowerCase() === email.toLowerCase());
  if (!login) return;
  await db.user.update({ where: { id: login.id }, data: { role, name } });
  if (kind === "provider") {
    await db.provider.updateMany({
      where: { userId: login.id, NOT: { id: recordId } },
      data: { userId: null },
    });
    await db.provider.update({ where: { id: recordId }, data: { userId: login.id } });
    return;
  }
  await db.patient.updateMany({
    where: { userId: login.id, NOT: { id: recordId } },
    data: { userId: null },
  });
  await db.patient.update({ where: { id: recordId }, data: { userId: login.id } });
}

for (const provider of providers) {
  const organizationId = await organizationIdFor(provider.organization);
  const data = {
    firstName: provider.firstName,
    lastName: provider.lastName,
    credentials: provider.credentials,
    specialty: provider.specialty,
    email: provider.email,
    organizationId,
  };
  await db.provider.upsert({
    where: { id: provider.id },
    update: data,
    create: { id: provider.id, ...data },
  });
  await ensureClinicianUser(provider, organizationId);
}

for (const [index, patient] of patients.entries()) {
  const data = {
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: new Date(`${patient.dateOfBirth}T00:00:00.000Z`),
    gender: patient.gender,
    email: patient.email,
    phone: patient.phone,
    psychiatricHistory: patient.psychiatricHistory,
    primaryProviderId: patient.primaryProviderId,
    preferredPharmacyId: PHARMACIES[index % PHARMACIES.length].id,
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
  await ensurePatientUser(patient);
}

await db.providerScheduleBlock.deleteMany({
  where: { providerId: { in: providers.map((provider) => provider.id) } },
});
await db.providerScheduleBlock.createMany({ data: schedules });

await linkLogin("cassius2828@gmail.com", "psychiatrist", "Muhammad Ali", "provider", "prv_04");
await linkLogin(
  "cassius.reynolds.dev@gmail.com",
  "patient",
  "Derrick Rose",
  "patient",
  "pat_16",
);

const history = await seedClinicHistory(db, patients);
const medicationCount = await seedMedications(db, patients);
const taskCount = await seedTasks(db);
const careLoop = await seedCareLoop(db);
const [providerCount, patientCount] = await Promise.all([
  db.provider.count(),
  db.patient.count(),
]);
console.log(
  `Seeded ${providerCount} providers, ${patientCount} patients, ${schedules.length} schedule blocks, ${history.appointments} appointments, ${history.visits} visits, ${history.notes} notes, ${medicationCount} medications, ${taskCount} tasks, ${PHARMACIES.length} pharmacies, and ${careLoop.orders} historical orders`,
);
await db.$disconnect();
