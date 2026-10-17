import "server-only";

import { randomUUID } from "node:crypto";

import { Agent, run, setTracingDisabled, tool } from "@openai/agents";
import { z } from "zod";

import type { Prisma } from "../../generated/prisma";

import { env } from "~/env";
import { CLINIC_TIME_ZONE } from "~/lib/clinic-time";
import { listOpenFollowUpSlots } from "~/server/availability";
import {
  SAME_DAY_APPOINTMENT_ERROR,
  UPCOMING_APPOINTMENT_ERROR,
  usualWeekdayAndTime,
} from "~/server/booking-choice";
import { db } from "~/server/db";
import { bookingBlock, otherScheduledVisits } from "~/server/follow-up";

setTracingDisabled(true);

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

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

const weekdayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TIME_ZONE,
  weekday: "long",
});

const summarySchema = z.object({
  summary: z
    .string()
    .describe(
      "One sentence on why this weekday and time fits the patient's usual visits.",
    ),
});

type BookedSlot = {
  appointmentId: string;
  dateLabel: string;
  timeLabel: string;
};

type BookingContext = {
  patientId: string;
  providerId: string;
  patientName: string;
  reason: string;
  movingAppointmentId: string | null;
  excludeStart: string | null;
  booked: BookedSlot | null;
  refusal: string | null;
};

export type AgentBookingResult =
  | {
      ok: true;
      appointmentId: string;
      dateLabel: string;
      timeLabel: string;
      summary: string;
    }
  | { ok: false; error: string };

function minuteLabel(minute: number) {
  const clock = new Date(
    Date.UTC(2026, 0, 1, Math.floor(minute / 60), minute % 60),
  );
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(clock);
}

function sameInstant(left: string | null, right: Date) {
  if (!left) return false;
  const parsed = new Date(left);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.getTime() === right.getTime()
  );
}

function readContext(context: { context: unknown } | undefined) {
  const value = context?.context;
  if (!value || typeof value !== "object" || !("patientId" in value))
    return null;
  return value as BookingContext;
}

function logAgentFailure(error: unknown) {
  const name = error instanceof Error ? error.name : "AgentError";
  const message = error instanceof Error ? error.message : "";
  if (/sk-|api[_-]?key/i.test(message)) {
    console.error(name);
    return;
  }
  console.error(name, message.slice(0, 300));
}

type FollowUpDb = Prisma.TransactionClient;

export async function commitFollowUp(input: {
  patientId: string;
  providerId: string;
  patientName: string;
  reason: string;
  start: Date;
  movingAppointmentId?: string | null;
}) {
  return db.$transaction((tx) => commitFollowUpIn(tx, input));
}

export async function commitFollowUpIn(
  tx: FollowUpDb,
  input: {
    patientId: string;
    providerId: string;
    patientName: string;
    reason: string;
    start: Date;
    movingAppointmentId?: string | null;
  },
) {
  const moving = Boolean(input.movingAppointmentId);
  const others = await otherScheduledVisits(
    tx,
    input.patientId,
    input.movingAppointmentId,
  );
  const blocked = bookingBlock(others, input.start, moving);
  if (blocked) return { ok: false as const, error: blocked };

  const open = await listOpenFollowUpSlots({
    providerId: input.providerId,
    patientId: input.patientId,
    database: tx,
    ignoreAppointmentId: input.movingAppointmentId ?? undefined,
  });
  const match = open.find(
    (slot) => slot.start.getTime() === input.start.getTime(),
  );
  if (!match) return { ok: false as const, error: "taken" as const };

  const titleTime = timeFormat.format(input.start);
  const durationMinutes = Math.round(
    (match.end.getTime() - match.start.getTime()) / 60000,
  );
  const title = `${input.patientName}, ${titleTime}`;

  if (input.movingAppointmentId) {
    const existing = await tx.appointment.findFirst({
      where: {
        id: input.movingAppointmentId,
        patientId: input.patientId,
        status: "scheduled",
      },
    });
    if (!existing) return { ok: false as const, error: "taken" as const };
    const moved = await tx.appointment.update({
      where: { id: existing.id },
      data: { scheduledAt: input.start, durationMinutes, title },
    });
    await tx.visit.updateMany({
      where: { appointmentId: existing.id },
      data: { visitDate: input.start },
    });
    return { ok: true as const, appointment: moved };
  }

  const created = await tx.appointment.create({
    data: {
      patientId: input.patientId,
      providerId: input.providerId,
      scheduledAt: input.start,
      durationMinutes,
      appointmentType: "Follow-up",
      status: "scheduled",
      title,
      description: `Upcoming follow-up for ${input.patientName}. ${input.reason}`,
      reasonForVisit: input.reason,
      joinToken: randomUUID(),
      createdAt: new Date(),
    },
  });
  return { ok: true as const, appointment: created };
}

const checkProviderSchedule = tool({
  name: "check_provider_schedule",
  description:
    "List this provider's weekly follow-up hours and the open appointment starts in America/Los_Angeles. Book only a start from openSlots.",
  parameters: z.object({}),
  execute: async (_input, runContext) => {
    const booking = readContext(runContext);
    if (!booking) return { error: "Missing patient context." };

    const [blocks, slots] = await Promise.all([
      db.providerScheduleBlock.findMany({
        where: { providerId: booking.providerId, kind: "follow-up" },
        orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      }),
      listOpenFollowUpSlots({
        providerId: booking.providerId,
        patientId: booking.patientId,
        ignoreAppointmentId: booking.movingAppointmentId ?? undefined,
      }),
    ]);

    return {
      timeZone: CLINIC_TIME_ZONE,
      weeklyFollowUp: blocks.map((block) => ({
        weekday: WEEKDAYS[block.dayOfWeek] ?? "Unknown",
        from: minuteLabel(block.startMinute),
        to: minuteLabel(block.endMinute),
        slotMinutes: block.slotMinutes,
      })),
      openSlots: slots
        .filter((slot) => !sameInstant(booking.excludeStart, slot.start))
        .map((slot) => ({
          start: slot.start.toISOString(),
          weekday: weekdayFormat.format(slot.start),
          date: dateFormat.format(slot.start),
          time: timeFormat.format(slot.start),
        })),
    };
  },
});

const checkPatientHistory = tool({
  name: "check_patient_schedule_history",
  description:
    "List this patient's past and upcoming appointment weekdays and times in America/Los_Angeles. Use usualWeekdayAndTime when choosing a slot.",
  parameters: z.object({}),
  execute: async (_input, runContext) => {
    const booking = readContext(runContext);
    if (!booking) return { error: "Missing patient context." };

    const rows = await db.appointment.findMany({
      where: {
        patientId: booking.patientId,
        status: { in: ["completed", "scheduled"] },
      },
      orderBy: { scheduledAt: "asc" },
      take: 40,
      select: { scheduledAt: true, appointmentType: true, status: true },
    });

    const visits = rows.map((row) => ({
      weekday: weekdayFormat.format(row.scheduledAt),
      date: dateFormat.format(row.scheduledAt),
      time: timeFormat.format(row.scheduledAt),
      appointmentType: row.appointmentType,
      status: row.status,
    }));

    return {
      timeZone: CLINIC_TIME_ZONE,
      usualWeekdayAndTime: usualWeekdayAndTime(visits),
      visits,
    };
  },
});

const bookCompatibleTime = tool({
  name: "book_compatible_time",
  description:
    "Book one open start for this patient, or move the appointment already being rescheduled. Call this once.",
  parameters: z.object({
    start: z
      .string()
      .describe(
        "ISO-8601 start copied from check_provider_schedule.openSlots.",
      ),
  }),
  execute: async (input, runContext) => {
    const booking = readContext(runContext);
    if (!booking) return { booked: false, error: "Missing patient context." };
    if (booking.booked) {
      return { booked: true, alreadyBooked: true, ...booking.booked };
    }

    const start = new Date(input.start);
    if (Number.isNaN(start.getTime())) {
      return { booked: false, error: "That start is not a valid time." };
    }
    if (sameInstant(booking.excludeStart, start)) {
      return { booked: false, error: "Choose a different open start." };
    }

    const saved = await commitFollowUp({
      patientId: booking.patientId,
      providerId: booking.providerId,
      patientName: booking.patientName,
      reason: booking.reason,
      start,
      movingAppointmentId: booking.movingAppointmentId,
    });
    if (!saved.ok) {
      const error =
        saved.error === "same-day"
          ? SAME_DAY_APPOINTMENT_ERROR
          : saved.error === "upcoming"
            ? UPCOMING_APPOINTMENT_ERROR
            : "That start is not open. Pick another start from check_provider_schedule.";
      if (saved.error === "same-day" || saved.error === "upcoming") {
        booking.refusal = error;
      }
      return { booked: false, error };
    }

    booking.booked = {
      appointmentId: saved.appointment.id,
      dateLabel: dateFormat.format(saved.appointment.scheduledAt),
      timeLabel: timeFormat.format(saved.appointment.scheduledAt),
    };
    return { booked: true, ...booking.booked };
  },
});

const scheduler = new Agent<BookingContext, typeof summarySchema>({
  name: "Clinic scheduler",
  model: "gpt-4.1-mini",
  instructions: `You book one follow-up in America/Los_Angeles.
Call check_provider_schedule and check_patient_schedule_history before booking.
Prefer usualWeekdayAndTime when that start is open. If it is not, pick the nearest open slot on that weekday, then the earliest opening.
Book only a start string returned by check_provider_schedule.
Call book_compatible_time exactly once.
When told to avoid a start, do not book that start.
The summary is one sentence about the weekday and time, not a clinical assessment.`,
  tools: [checkProviderSchedule, checkPatientHistory, bookCompatibleTime],
  outputType: summarySchema,
});

function readSummary(output: unknown) {
  if (
    output &&
    typeof output === "object" &&
    "summary" in output &&
    typeof output.summary === "string"
  ) {
    return output.summary.trim().slice(0, 400);
  }
  return "";
}

export async function scheduleWithAgent(input: {
  patientId: string;
  providerId: string;
  patientName: string;
  reason: string;
  movingAppointmentId?: string | null;
  excludeStart?: string | null;
}): Promise<AgentBookingResult> {
  if (!env.OPENAI_API_KEY) {
    return {
      ok: false,
      error: "Automatic booking needs an OpenAI API key. Choose a time below.",
    };
  }

  const context: BookingContext = {
    patientId: input.patientId,
    providerId: input.providerId,
    patientName: input.patientName,
    reason: input.reason,
    movingAppointmentId: input.movingAppointmentId ?? null,
    excludeStart: input.excludeStart ?? null,
    booked: null,
    refusal: null,
  };

  const prompt = input.movingAppointmentId
    ? `Reschedule the current follow-up. Do not book ${input.excludeStart}. Reason for the visit: ${input.reason}`
    : `Book a new follow-up. Reason for the visit: ${input.reason}`;

  try {
    const result = await run(scheduler, prompt, { context, maxTurns: 8 });
    if (!context.booked) {
      return {
        ok: false,
        error:
          context.refusal ??
          "A time could not be booked automatically. Choose a time below.",
      };
    }
    return {
      ok: true,
      ...context.booked,
      summary:
        readSummary(result.finalOutput) ||
        "This time is open and fits the days and times you usually come in.",
    };
  } catch (error) {
    logAgentFailure(error);
    if (context.booked) {
      return {
        ok: true,
        ...context.booked,
        summary:
          "This time is open and fits the days and times you usually come in.",
      };
    }
    return {
      ok: false,
      error:
        context.refusal ??
        "A time could not be booked automatically. Choose a time below.",
    };
  }
}
