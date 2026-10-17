import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "../generated/prisma/index.js";
import { coverageFor } from "./coverage.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const providers = JSON.parse(readFileSync(path.join(root, "src/data/providers.json"), "utf8"));
const patients = JSON.parse(readFileSync(path.join(root, "src/data/patients.json"), "utf8"));
const schedules = JSON.parse(readFileSync(path.join(root, "src/data/schedules.json"), "utf8"));
const db = new PrismaClient();

async function organizationIdFor(name) {
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
  return coverage;
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

const newPatients = patients.filter((patient) => Number(patient.id.replace(/\D/g, "")) >= 37);
for (const patient of newPatients) {
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
      data: patient.allergies.map((substance) => ({ patientId: patient.id, substance })),
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

await db.providerScheduleBlock.deleteMany({ where: { providerId: "prv_05" } });
await db.providerScheduleBlock.createMany({
  data: schedules.filter((block) => block.providerId === "prv_05"),
});

const chartPatients = await db.patient.findMany({
  select: { id: true, firstName: true, lastName: true, email: true, dateOfBirth: true },
});
const buckets = { none: 0, primary: 0, both: 0 };
for (const patient of chartPatients) {
  const coverage = await ensurePatientUser(patient);
  if (!coverage.primaryInsurance) buckets.none += 1;
  else if (!coverage.secondaryInsurance) buckets.primary += 1;
  else buckets.both += 1;
}

const clinicians = await db.provider.findMany({
  select: { credentials: true, organizationId: true },
});
const psychs = clinicians.filter((item) => item.credentials !== "PMHNP");
console.log(
  JSON.stringify({
    nurses: clinicians.length - psychs.length,
    psychs: psychs.length,
    psychsWithoutProvider: psychs.filter((item) => !item.organizationId).length,
    patients: chartPatients.length,
    insurance: buckets,
  }),
);
await db.$disconnect();
