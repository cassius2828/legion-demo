import "server-only";

import type { Prisma } from "../../generated/prisma";

import { providerLabel } from "~/lib/chart";
import { CLINIC_TIME_ZONE, zonedParts } from "~/lib/clinic-time";
import type { UpcomingVisit } from "~/lib/booking";
import { db } from "~/server/db";

type Database = Prisma.TransactionClient | typeof db;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TIME_ZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

export function clinicDayKey(date: Date) {
  const parts = zonedParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export async function otherScheduledVisits(
  database: Database,
  patientId: string,
  ignoreAppointmentId?: string | null,
) {
  return database.appointment.findMany({
    where: {
      patientId,
      status: "scheduled",
      ...(ignoreAppointmentId ? { NOT: { id: ignoreAppointmentId } } : {}),
    },
    select: { scheduledAt: true },
  });
}

export function bookingBlock(
  visits: { scheduledAt: Date }[],
  start: Date,
  moving: boolean,
  now = new Date(),
) {
  if (!moving && visits.some((visit) => visit.scheduledAt.getTime() >= now.getTime())) {
    return "upcoming" as const;
  }
  const day = clinicDayKey(start);
  if (visits.some((visit) => clinicDayKey(visit.scheduledAt) === day)) {
    return "same-day" as const;
  }
  return null;
}

export async function loadUpcomingVisit(patientId: string): Promise<UpcomingVisit | null> {
  const row = await db.appointment.findFirst({
    where: {
      patientId,
      status: "scheduled",
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      provider: { select: { firstName: true, lastName: true, credentials: true } },
    },
  });
  if (!row) return null;
  return {
    appointmentId: row.id,
    dateLabel: dateFormat.format(row.scheduledAt),
    timeLabel: timeFormat.format(row.scheduledAt),
    providerLabel: providerLabel(row.provider),
  };
}
