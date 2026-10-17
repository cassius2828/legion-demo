import "server-only";

import type { CalendarEvent } from "~/lib/calendar-dates";
import { commitFollowUp } from "~/server/booking-agent";
import { db } from "~/server/db";
import { viewerRecord } from "~/server/access";

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
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      provider: { select: { firstName: true, lastName: true, credentials: true } },
      nurse: { select: { firstName: true, lastName: true, credentials: true } },
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
      appointment: {
        patientId: row.patient.id,
        patientName: `${row.patient.firstName} ${row.patient.lastName}`,
        providerName: staffName(row.provider),
        nurseName: row.nurse ? staffName(row.nurse) : null,
        appointmentType: row.appointmentType,
        status: row.status,
        reasonForVisit: row.reasonForVisit,
        description: row.description,
        durationMinutes: row.durationMinutes,
      },
    } satisfies CalendarEvent;
  });
}

function staffName(person: { firstName: string; lastName: string; credentials: string }) {
  return `${person.firstName} ${person.lastName}, ${person.credentials}`;
}

function canEditAppointment(
  viewer: Awaited<ReturnType<typeof viewerRecord>>,
  appointment: { patientId: string; providerId: string; nurseId: string | null },
) {
  return (
    viewer.patient?.id === appointment.patientId ||
    viewer.provider?.id === appointment.providerId ||
    (appointment.nurseId !== null && viewer.provider?.id === appointment.nurseId)
  );
}

function isUpcoming(appointment: { status: string; scheduledAt: Date }, now = new Date()) {
  return appointment.status === "scheduled" && appointment.scheduledAt.getTime() >= now.getTime();
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
  if (!appointment || !isUpcoming(appointment) || !canEditAppointment(viewer, appointment)) {
    return { ok: false as const, error: "Could not move that appointment." };
  }

  const saved = await commitFollowUp({
    patientId: appointment.patientId,
    providerId: appointment.providerId,
    patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
    reason: appointment.reasonForVisit,
    start: input.start,
    movingAppointmentId: appointment.id,
  });
  if (!saved.ok) {
    return {
      ok: false as const,
      error:
        saved.error === "same-day"
          ? "That day already has an appointment."
          : "That time is not open.",
    };
  }
  return { ok: true as const };
}

export async function cancelClinicAppointment(
  userId: string,
  role: string,
  input: { id: string; reason: string },
) {
  const reason = input.reason.trim();
  if (reason.length === 0 || reason.length > 1000) {
    return { ok: false as const, error: "Explain why you are cancelling." };
  }

  const viewer = await viewerRecord(userId, role);
  const appointment = await db.appointment.findUnique({ where: { id: input.id } });
  if (!appointment || !isUpcoming(appointment) || !canEditAppointment(viewer, appointment)) {
    return { ok: false as const, error: "That appointment is no longer scheduled." };
  }

  await db.appointment.update({
    where: { id: appointment.id },
    data: { status: "cancelled", cancellationReason: reason },
  });
  return { ok: true as const };
}
