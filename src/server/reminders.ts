import "server-only";

import type { Prisma } from "../../generated/prisma";

import { formatClinicWhen } from "~/lib/clinic-time";
import { providerLabel } from "~/lib/chart";
import { db } from "~/server/db";

type Database = Prisma.TransactionClient | typeof db;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export function reminderRows(input: {
  scheduledAt: Date;
  providerName: string;
}) {
  const whenLabel = formatClinicWhen(input.scheduledAt);
  return [
    {
      kind: "day-before",
      dueAt: new Date(input.scheduledAt.getTime() - DAY_MS),
      body: `Your visit is tomorrow, ${whenLabel}, with ${input.providerName}. Join from your portal.`,
    },
    {
      kind: "hour-before",
      dueAt: new Date(input.scheduledAt.getTime() - HOUR_MS),
      body: `Your visit starts in about an hour, ${whenLabel}, with ${input.providerName}. Use your visit link when you are ready.`,
    },
  ];
}

export async function deliverDueReminders(
  providerId: string,
  database: Database = db,
) {
  const due = await database.reminder.findMany({
    where: {
      status: "scheduled",
      dueAt: { lte: new Date() },
      appointment: { OR: [{ providerId }, { nurseId: providerId }] },
    },
    include: {
      appointment: {
        select: {
          provider: { select: { userId: true } },
          patient: { select: { primaryProviderId: true } },
        },
      },
    },
    orderBy: { dueAt: "asc" },
  });

  let sent = 0;
  for (const reminder of due) {
    const authorUserId = reminder.appointment.provider.userId;
    if (!authorUserId) continue;
    await database.clinicMessage.create({
      data: {
        patientId: reminder.patientId,
        providerId: reminder.appointment.patient.primaryProviderId,
        authorUserId,
        body: reminder.body,
      },
    });
    await database.reminder.update({
      where: { id: reminder.id },
      data: { status: "sent", sentAt: new Date() },
    });
    sent += 1;
  }
  return sent;
}

export function reminderProviderName(provider: {
  firstName: string;
  lastName: string;
  credentials: string;
}) {
  return providerLabel(provider);
}
