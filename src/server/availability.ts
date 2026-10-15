import "server-only";

import { Prisma } from "../../generated/prisma";

import {
  addCalendarDays,
  CLINIC_TIME_ZONE,
  weekdayOf,
  zonedParts,
  zonedTimeToUtc,
} from "~/lib/clinic-time";
import { db } from "~/server/db";

const HORIZON_DAYS = 21;
const LEAD_MS = 2 * 60 * 60 * 1000;
const LOOKBACK_MS = 8 * 60 * 60 * 1000;

type SlotDb = Prisma.TransactionClient | typeof db;

export type OpenSlot = {
  start: Date;
  end: Date;
};

export type SlotGroup = {
  dayKey: string;
  label: string;
  slots: { start: string; label: string }[];
};

function overlaps(start: Date, end: Date, otherStart: Date, otherEnd: Date) {
  return start < otherEnd && end > otherStart;
}

export async function listOpenFollowUpSlots(
  input: {
    providerId: string;
    patientId: string;
    now?: Date;
    database?: SlotDb;
  },
) {
  const database = input.database ?? db;
  const now = input.now ?? new Date();
  const today = zonedParts(now);
  const lastDay = addCalendarDays(today.year, today.month, today.day, HORIZON_DAYS);
  const rangeEnd = zonedTimeToUtc(lastDay.year, lastDay.month, lastDay.day, 0);
  const rangeStart = new Date(now.getTime() - LOOKBACK_MS);

  const [blocks, appointments] = await Promise.all([
    database.providerScheduleBlock.findMany({
      where: { providerId: input.providerId, kind: "follow-up" },
    }),
    database.appointment.findMany({
      where: {
        scheduledAt: { gte: rangeStart, lt: rangeEnd },
        OR: [
          {
            status: { in: ["scheduled", "completed"] },
            OR: [{ providerId: input.providerId }, { nurseId: input.providerId }],
          },
          { patientId: input.patientId, status: "scheduled" },
        ],
      },
    }),
  ]);

  const busy = appointments.map((row) => ({
    start: row.scheduledAt,
    end: new Date(row.scheduledAt.getTime() + row.durationMinutes * 60 * 1000),
  }));

  const slots: OpenSlot[] = [];
  let cursor = { year: today.year, month: today.month, day: today.day };
  for (let day = 0; day < HORIZON_DAYS; day += 1) {
    const weekday = weekdayOf(cursor.year, cursor.month, cursor.day);
    for (const block of blocks) {
      if (block.dayOfWeek !== weekday) continue;
      const step = block.slotMinutes;
      for (let minute = block.startMinute; minute + step <= block.endMinute; minute += step) {
        const start = zonedTimeToUtc(cursor.year, cursor.month, cursor.day, minute);
        const end = new Date(start.getTime() + step * 60 * 1000);
        if (start.getTime() < now.getTime() + LEAD_MS) continue;
        if (busy.some((item) => overlaps(start, end, item.start, item.end))) continue;
        slots.push({ start, end });
      }
    }
    cursor = addCalendarDays(cursor.year, cursor.month, cursor.day, 1);
  }

  slots.sort((left, right) => left.start.getTime() - right.start.getTime());
  return slots;
}

export function groupOpenSlots(slots: OpenSlot[]): SlotGroup[] {
  const dayFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeFormat = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  const groups: SlotGroup[] = [];

  for (const slot of slots) {
    const parts = zonedParts(slot.start);
    const dayKey = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    let group = groups.find((item) => item.dayKey === dayKey);
    if (!group) {
      group = { dayKey, label: dayFormat.format(slot.start), slots: [] };
      groups.push(group);
    }
    group.slots.push({
      start: slot.start.toISOString(),
      label: timeFormat.format(slot.start),
    });
  }

  return groups;
}
