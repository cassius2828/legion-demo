import "server-only";

import type { CalendarEvent } from "~/lib/calendar-dates";
import { db } from "~/server/db";
import { viewerRecord } from "~/server/access";

function titleFor(patient: { firstName: string; lastName: string }, when: Date) {
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(when);
  return `${patient.firstName} ${patient.lastName}, ${time}`;
}

export async function listClinicEvents(
  userId: string,
  role: string,
  range: { start: Date; end: Date },
) {
  const viewer = await viewerRecord(userId, role);
  const scope =
    viewer.role === "patient" && viewer.patient
      ? { patientId: viewer.patient.id }
      : viewer.provider
        ? { OR: [{ providerId: viewer.provider.id }, { nurseId: viewer.provider.id }] }
        : null;
  if (!scope) return [] as CalendarEvent[];

  const rows = await db.appointment.findMany({
    where: {
      ...scope,
      status: { in: ["completed", "scheduled"] },
      scheduledAt: { gte: range.start, lt: range.end },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return rows.map((row) => {
    const start = row.scheduledAt;
    const end = new Date(start.getTime() + row.durationMinutes * 60 * 1000);
    return {
      id: row.id,
      title: row.title,
      start: start.toISOString(),
      end: end.toISOString(),
      allDay: false,
    } satisfies CalendarEvent;
  });
}

export async function moveClinicAppointment(
  userId: string,
  role: string,
  input: { id: string; start: Date },
) {
  const viewer = await viewerRecord(userId, role);
  const appointment = await db.appointment.findUnique({
    where: { id: input.id },
    include: { patient: true },
  });
  if (!appointment) return { ok: false as const, error: "Could not move that appointment." };

  const ownsPatient = viewer.patient?.id === appointment.patientId;
  const ownsProvider = viewer.provider?.id === appointment.providerId;
  const ownsNurse = viewer.provider?.id === appointment.nurseId;
  if (!ownsPatient && !ownsProvider && !ownsNurse) {
    return { ok: false as const, error: "Could not move that appointment." };
  }

  const start = input.start;
  await db.appointment.update({
    where: { id: appointment.id },
    data: {
      scheduledAt: start,
      title: titleFor(appointment.patient, start),
    },
  });
  await db.visit.updateMany({
    where: { appointmentId: appointment.id },
    data: { visitDate: start },
  });
  return { ok: true as const };
}
