import { bumpChartVersions } from "./chart-version.mjs";

export const TASKS = [
  {
    id: "tsk_pat_16_eval",
    patientId: "pat_16",
    assignedProviderId: "prv_04",
    title: "Confirm the October evaluation time",
    description: "Keep the usual afternoon appointment the week of the evaluation.",
    priority: "high",
    status: "open",
    dueDate: new Date("2026-10-20T00:00:00.000Z"),
    createdAt: new Date("2026-09-07T00:00:00.000Z"),
  },
  {
    id: "tsk_pat_16_propranolol",
    patientId: "pat_16",
    assignedProviderId: "prv_04",
    title: "Review propranolol timing",
    description: "Propranolol stays about an hour before a performance, not on quiet weeks.",
    priority: "normal",
    status: "open",
    dueDate: new Date("2026-11-02T00:00:00.000Z"),
    createdAt: new Date("2026-08-26T00:00:00.000Z"),
  },
  {
    id: "tsk_pat_16_intake",
    patientId: "pat_16",
    assignedProviderId: "prv_04",
    title: "Send intake paperwork",
    description: "Intake packet was returned at the first visit.",
    priority: "low",
    status: "done",
    dueDate: new Date("2026-01-20T00:00:00.000Z"),
    createdAt: new Date("2026-01-14T00:00:00.000Z"),
  },
  {
    id: "tsk_pat_29_eval",
    patientId: "pat_29",
    assignedProviderId: "prv_04",
    title: "Check sleep before the next teaching evaluation",
    description: "Ask whether daytime drowsiness returned after trazodone was stopped.",
    priority: "normal",
    status: "open",
    dueDate: new Date("2026-10-28T00:00:00.000Z"),
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
  },
  {
    id: "tsk_pat_01_refill",
    patientId: "pat_01",
    assignedProviderId: "prv_01",
    title: "Confirm the antidepressant refill",
    description: "Refill was requested and has not been charted as sent.",
    priority: "normal",
    status: "open",
    dueDate: new Date("2026-10-22T00:00:00.000Z"),
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
  },
];

export async function seedTasks(db) {
  for (const task of TASKS) {
    const data = {
      patientId: task.patientId,
      assignedProviderId: task.assignedProviderId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
    };
    await db.task.upsert({
      where: { id: task.id },
      update: data,
      create: { id: task.id, ...data },
    });
  }
  await bumpChartVersions(
    db,
    TASKS.map((task) => task.patientId),
  );
  return TASKS.length;
}

const isDirect = process.argv[1]?.replaceAll("\\", "/").endsWith("clinic-tasks.mjs");
if (isDirect) {
  const { PrismaClient } = await import("../generated/prisma/index.js");
  const db = new PrismaClient();
  const count = await seedTasks(db);
  console.log(`Seeded ${count} tasks`);
  await db.$disconnect();
}
