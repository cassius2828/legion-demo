import "server-only";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { Prisma } from "../../generated/prisma";

import {
  pharmacyLabel,
  prescriptionMessage,
  projectMedication,
  transmissionDecision,
  followUpResult,
} from "~/lib/care-loop-rules";
import { formatClinicWhen } from "~/lib/clinic-time";
import { canViewPatient, viewerRecord } from "~/server/access";
import { auth } from "~/server/auth";
import { commitFollowUpIn } from "~/server/booking-agent";
import { db } from "~/server/db";
import { listOpenFollowUpSlots } from "~/server/availability";
import {
  deliverDueReminders,
  reminderProviderName,
  reminderRows,
} from "~/server/reminders";

type Database = Prisma.TransactionClient;

const FOLLOW_UP_LEAD_MS = 13 * 24 * 60 * 60 * 1000;

const encounterInclude = {
  patient: {
    include: {
      allergies: { orderBy: { substance: "asc" as const } },
      medications: {
        where: { status: "active" },
        orderBy: { medicationName: "asc" as const },
      },
      preferredPharmacy: true,
    },
  },
  provider: true,
  intake: { include: { pharmacy: true } },
  visit: { include: { notes: { orderBy: { updatedAt: "desc" as const } } } },
  orders: {
    orderBy: { createdAt: "asc" as const },
    include: {
      pharmacy: true,
      events: { orderBy: { createdAt: "asc" as const } },
    },
  },
  events: { orderBy: { createdAt: "desc" as const }, take: 12 },
} satisfies Prisma.AppointmentInclude;

export type EncounterRecord = Prisma.AppointmentGetPayload<{
  include: typeof encounterInclude;
}>;

function refreshChart(patientId: string, appointmentId: string) {
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/messages");
  revalidatePath(`/messages/${patientId}`);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/visits/${appointmentId}`);
  revalidatePath("/appointments/book");
}

async function providerAccess(appointmentId: string) {
  const session = await auth();
  if (!session?.user?.role || session.user.role === "patient") {
    return {
      ok: false as const,
      error: "Sign in as a provider to open this visit.",
    };
  }
  const viewer = await viewerRecord(session.user.id, session.user.role);
  if (!viewer.provider) {
    return {
      ok: false as const,
      error: "No provider chart is linked to this account.",
    };
  }
  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      patient: { select: { id: true, primaryProviderId: true } },
    },
  });
  if (!appointment)
    return { ok: false as const, error: "That visit is not available." };
  const allowed = canViewPatient({
    role: session.user.role,
    ownPatientId: null,
    ownProviderId: viewer.provider.id,
    patient: appointment.patient,
  });
  if (!allowed)
    return { ok: false as const, error: "That visit is not available." };
  return {
    ok: true as const,
    userId: session.user.id,
    providerId: viewer.provider.id,
  };
}

async function appendEvent(
  tx: Database,
  input: {
    patientId: string;
    actorUserId: string;
    type: string;
    payload: Record<string, unknown>;
    visitId?: string | null;
    appointmentId?: string | null;
    orderId?: string | null;
    id?: string;
  },
) {
  await tx.clinicalEvent.create({
    data: {
      id: input.id,
      patientId: input.patientId,
      actorUserId: input.actorUserId,
      type: input.type,
      payload: JSON.stringify(input.payload),
      visitId: input.visitId ?? null,
      appointmentId: input.appointmentId ?? null,
      orderId: input.orderId ?? null,
    },
  });
}

async function ensureOpenVisit(
  tx: Database,
  appointment: {
    id: string;
    patientId: string;
    providerId: string;
    scheduledAt: Date;
    reasonForVisit: string;
    status: string;
    joinToken: string | null;
  },
  actorUserId: string,
) {
  if (!appointment.joinToken) {
    await tx.appointment.update({
      where: { id: appointment.id },
      data: { joinToken: randomUUID() },
    });
  }
  if (appointment.status !== "scheduled") return;
  const visit = await tx.visit.upsert({
    where: { appointmentId: appointment.id },
    create: {
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      providerId: appointment.providerId,
      visitDate: appointment.scheduledAt,
      chiefComplaint: appointment.reasonForVisit,
      clinicalSummary: "",
      followUpInstructions: "",
      status: "open",
    },
    update: {},
  });
  await tx.clinicalEvent.upsert({
    where: { id: `evt_open_${appointment.id}` },
    create: {
      id: `evt_open_${appointment.id}`,
      patientId: appointment.patientId,
      actorUserId,
      type: "visit.opened",
      payload: JSON.stringify({ appointmentId: appointment.id }),
      appointmentId: appointment.id,
      visitId: visit.id,
    },
    update: {},
  });
}

export async function openEncounter(appointmentId: string) {
  const access = await providerAccess(appointmentId);
  if (!access.ok) return access;

  await db.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) return;
    await ensureOpenVisit(tx, appointment, access.userId);
  });

  const appointment = await db.appointment.findUnique({
    where: { id: appointmentId },
    include: encounterInclude,
  });
  if (!appointment)
    return { ok: false as const, error: "That visit is not available." };
  return { ok: true as const, appointment };
}

async function projectOntoMedication(
  tx: Database,
  order: {
    id: string;
    patientId: string;
    prescribingProviderId: string;
    medicationName: string;
    genericName: string;
    dosage: string;
    route: string;
    frequency: string;
    action: string;
    sig: string;
  },
) {
  const projection = projectMedication({
    action: order.action,
    accepted: true,
  });
  if (projection === "unchanged") return;

  const rows = await tx.medication.findMany({
    where: { patientId: order.patientId },
  });
  const generic = order.genericName.toLowerCase();
  const existing =
    rows.find(
      (row) =>
        row.genericName.toLowerCase() === generic && row.status === "active",
    ) ??
    rows.find((row) => row.genericName.toLowerCase() === generic) ??
    null;

  const now = new Date();
  let medicationId: string;
  if (projection === "discontinued") {
    if (existing) {
      await tx.medication.update({
        where: { id: existing.id },
        data: { status: "discontinued", endDate: now },
      });
      medicationId = existing.id;
    } else {
      const created = await tx.medication.create({
        data: {
          patientId: order.patientId,
          prescribingProviderId: order.prescribingProviderId,
          medicationName: order.medicationName,
          genericName: order.genericName,
          dosage: order.dosage,
          route: order.route,
          frequency: order.frequency,
          status: "discontinued",
          startDate: now,
          endDate: now,
          notes: order.sig,
        },
      });
      medicationId = created.id;
    }
  } else if (existing) {
    await tx.medication.update({
      where: { id: existing.id },
      data: {
        status: "active",
        medicationName: order.medicationName,
        genericName: order.genericName,
        dosage: order.dosage,
        route: order.route,
        frequency: order.frequency,
        endDate: null,
        prescribingProviderId: order.prescribingProviderId,
        startDate:
          existing.status === "active" && order.action !== "new"
            ? existing.startDate
            : now,
      },
    });
    medicationId = existing.id;
  } else {
    const created = await tx.medication.create({
      data: {
        patientId: order.patientId,
        prescribingProviderId: order.prescribingProviderId,
        medicationName: order.medicationName,
        genericName: order.genericName,
        dosage: order.dosage,
        route: order.route,
        frequency: order.frequency,
        status: "active",
        startDate: now,
        notes: order.sig,
      },
    });
    medicationId = created.id;
  }

  await tx.prescriptionOrder.update({
    where: { id: order.id },
    data: { medicationId },
  });
}

async function transmitRecord(
  tx: Database,
  orderId: string,
  actorUserId: string,
) {
  const order = await tx.prescriptionOrder.findUnique({
    where: { id: orderId },
    include: {
      pharmacy: true,
      patient: { include: { allergies: true } },
    },
  });
  if (!order)
    return { ok: false as const, error: "That prescription is not available." };
  if (order.status === "accepted" || order.status === "rejected") {
    return { ok: true as const, status: order.status };
  }

  const decision = transmissionDecision({
    medicationName: order.medicationName,
    genericName: order.genericName,
    allergies: order.patient.allergies.map((allergy) => allergy.substance),
    overrideReason: order.allergyOverrideReason,
  });

  await tx.prescriptionOrder.update({
    where: { id: order.id },
    data: { status: "queued", statusDetail: "Queued for transmission." },
  });
  await appendEvent(tx, {
    patientId: order.patientId,
    actorUserId,
    type: "order.queued",
    appointmentId: order.appointmentId,
    visitId: order.visitId,
    orderId: order.id,
    payload: {
      medicationName: order.medicationName,
      pharmacyId: order.pharmacyId,
    },
  });

  await tx.prescriptionOrder.update({
    where: { id: order.id },
    data: { status: "sent", statusDetail: "Sent to the pharmacy." },
  });
  await appendEvent(tx, {
    patientId: order.patientId,
    actorUserId,
    type: "order.sent",
    appointmentId: order.appointmentId,
    visitId: order.visitId,
    orderId: order.id,
    payload: { medicationName: order.medicationName },
  });

  if (decision.override && decision.substance) {
    await appendEvent(tx, {
      patientId: order.patientId,
      actorUserId,
      type: "order.allergy_override",
      appointmentId: order.appointmentId,
      visitId: order.visitId,
      orderId: order.id,
      payload: {
        substance: decision.substance,
        reason: order.allergyOverrideReason,
      },
    });
  }

  await tx.prescriptionOrder.update({
    where: { id: order.id },
    data: {
      status: decision.status,
      statusDetail: decision.detail,
    },
  });
  await appendEvent(tx, {
    patientId: order.patientId,
    actorUserId,
    type: decision.status === "accepted" ? "order.accepted" : "order.rejected",
    appointmentId: order.appointmentId,
    visitId: order.visitId,
    orderId: order.id,
    payload: { medicationName: order.medicationName, detail: decision.detail },
  });

  if (decision.status === "accepted") {
    await projectOntoMedication(tx, order);
  }

  await tx.clinicMessage.create({
    data: {
      patientId: order.patientId,
      providerId: order.patient.primaryProviderId,
      authorUserId: actorUserId,
      body: prescriptionMessage({
        medicationName: order.medicationName,
        pharmacyLabel: pharmacyLabel(order.pharmacy),
        status: decision.status,
        detail: decision.detail,
      }),
    },
  });

  return { ok: true as const, status: decision.status };
}

export async function signVisitNote(input: {
  appointmentId: string;
  summary: string;
  followUp: string;
}) {
  const summary = input.summary.trim();
  const followUp = input.followUp.trim();
  if (
    summary.length === 0 ||
    summary.length > 4000 ||
    followUp.length === 0 ||
    followUp.length > 1000
  ) {
    return {
      ok: false as const,
      error: "Write the visit summary and the follow-up plan.",
    };
  }

  const access = await providerAccess(input.appointmentId);
  if (!access.ok) return access;

  const saved = await db.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
    });
    if (!appointment || appointment.status !== "scheduled") {
      return { ok: false as const, error: "This visit is already closed." };
    }
    await ensureOpenVisit(tx, appointment, access.userId);
    const visit = await tx.visit.findUnique({
      where: { appointmentId: appointment.id },
    });
    if (!visit)
      return { ok: false as const, error: "That visit is not available." };

    const noteBody = `${summary}\n\nFollow-up: ${followUp}`;
    const existing = await tx.clinicalNote.findFirst({
      where: { visitId: visit.id, noteType: "progress" },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    const note = existing
      ? await tx.clinicalNote.update({
          where: { id: existing.id },
          data: { content: noteBody, status: "signed", updatedAt: now },
        })
      : await tx.clinicalNote.create({
          data: {
            visitId: visit.id,
            patientId: appointment.patientId,
            providerId: access.providerId,
            noteType: "progress",
            content: noteBody,
            status: "signed",
            createdAt: now,
            updatedAt: now,
          },
        });
    await tx.visit.update({
      where: { id: visit.id },
      data: {
        clinicalSummary: summary,
        followUpInstructions: followUp,
        status: "completed",
      },
    });
    await appendEvent(tx, {
      patientId: appointment.patientId,
      actorUserId: access.userId,
      type: "note.signed",
      appointmentId: appointment.id,
      visitId: visit.id,
      payload: { noteId: note.id },
    });
    return { ok: true as const, patientId: appointment.patientId };
  });

  if (saved.ok) refreshChart(saved.patientId, input.appointmentId);
  return saved.ok ? { ok: true as const } : saved;
}

export async function transmitOrder(input: {
  appointmentId: string;
  medicationName: string;
  genericName: string;
  dosage: string;
  route: string;
  frequency: string;
  quantity: number;
  refills: number;
  action: "new" | "refill" | "change" | "discontinue";
  pharmacyConfirmed: boolean;
  overrideReason: string;
}) {
  const actions = new Set(["new", "refill", "change", "discontinue"]);
  if (!actions.has(input.action)) {
    return {
      ok: false as const,
      error: "Choose what this prescription should do.",
    };
  }
  if (!input.pharmacyConfirmed) {
    return {
      ok: false as const,
      error: "Confirm the pharmacy before sending.",
    };
  }
  if (
    !Number.isInteger(input.quantity) ||
    !Number.isInteger(input.refills) ||
    input.quantity < 0 ||
    input.refills < 0 ||
    input.refills > 12
  ) {
    return { ok: false as const, error: "Check the quantity and refills." };
  }
  const fields = [
    input.medicationName,
    input.genericName,
    input.dosage,
    input.route,
    input.frequency,
  ].map((value) => value.trim());
  if (
    fields.some((value) => value.length === 0) ||
    input.quantity < 0 ||
    input.refills < 0
  ) {
    return {
      ok: false as const,
      error: "Complete the prescription before sending.",
    };
  }

  const access = await providerAccess(input.appointmentId);
  if (!access.ok) return access;

  const saved = await db.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: input.appointmentId },
      include: {
        intake: true,
        patient: { select: { preferredPharmacyId: true } },
      },
    });
    if (!appointment || appointment.status !== "scheduled") {
      return { ok: false as const, error: "This visit is already closed." };
    }
    const pharmacyId =
      appointment.intake?.pharmacyId ?? appointment.patient.preferredPharmacyId;
    if (!pharmacyId) {
      return {
        ok: false as const,
        error: "Confirm a pharmacy on the intake before sending.",
      };
    }
    await ensureOpenVisit(tx, appointment, access.userId);
    const visit = await tx.visit.findUnique({
      where: { appointmentId: appointment.id },
    });
    if (!visit)
      return { ok: false as const, error: "That visit is not available." };

    const [medicationName, genericName, dosage, route, frequency] = fields;
    if (!medicationName || !genericName || !dosage || !route || !frequency) {
      return {
        ok: false as const,
        error: "Complete the prescription before sending.",
      };
    }
    const created = await tx.prescriptionOrder.create({
      data: {
        visitId: visit.id,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        prescribingProviderId: access.providerId,
        pharmacyId,
        medicationName,
        genericName,
        dosage,
        route,
        frequency,
        quantity: input.quantity,
        refills: input.refills,
        sig: `${dosage} ${route}, ${frequency}`,
        action: input.action,
        status: "draft",
        statusDetail: "Draft.",
        allergyOverrideReason: input.overrideReason.trim() || null,
      },
    });
    const transmitted = await transmitRecord(tx, created.id, access.userId);
    if (!transmitted.ok) return transmitted;
    return {
      ok: true as const,
      patientId: appointment.patientId,
      status: transmitted.status,
    };
  });

  if (saved.ok) refreshChart(saved.patientId, input.appointmentId);
  return saved.ok ? { ok: true as const, status: saved.status } : saved;
}

export async function closeVisit(appointmentId: string) {
  const access = await providerAccess(appointmentId);
  if (!access.ok) return access;

  const saved = await db.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        provider: true,
        visit: { include: { notes: true } },
      },
    });
    if (!appointment || appointment.status !== "scheduled") {
      return { ok: false as const, error: "This visit is already closed." };
    }
    const signed = appointment.visit?.notes.some(
      (note) => note.status === "signed",
    );
    if (!signed || !appointment.visit) {
      return {
        ok: false as const,
        error: "Sign the note before closing the visit.",
      };
    }

    const drafts = await tx.prescriptionOrder.findMany({
      where: { appointmentId, status: "draft" },
      select: { id: true },
    });
    for (const draft of drafts) {
      const transmitted = await transmitRecord(tx, draft.id, access.userId);
      if (!transmitted.ok) return transmitted;
    }

    await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: "completed" },
    });

    const reason =
      appointment.visit.followUpInstructions.trim().slice(0, 500) ||
      "Follow-up";
    const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
    const slots = await listOpenFollowUpSlots({
      providerId: appointment.providerId,
      patientId: appointment.patientId,
      database: tx,
      ignoreAppointmentId: appointment.id,
    });
    const earliest = Date.now() + FOLLOW_UP_LEAD_MS;
    const slot =
      slots.find((item) => item.start.getTime() >= earliest) ??
      slots.at(-1) ??
      null;

    const booked = slot
      ? await commitFollowUpIn(tx, {
          patientId: appointment.patientId,
          providerId: appointment.providerId,
          patientName,
          reason,
          start: slot.start,
        })
      : { ok: false as const, error: "taken" as const };

    const block = booked.ok ? null : booked.error;
    if (followUpResult(block) === "task") {
      await tx.task.create({
        data: {
          patientId: appointment.patientId,
          assignedProviderId: appointment.providerId,
          title: "Book follow-up",
          description: `${reason} The next visit was not booked (${block ?? "no opening"}).`,
          priority: "high",
          status: "open",
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
      });
      await appendEvent(tx, {
        patientId: appointment.patientId,
        actorUserId: access.userId,
        type: "follow_up.task_created",
        appointmentId: appointment.id,
        visitId: appointment.visit.id,
        payload: { block: block ?? "no opening" },
      });
      if (appointment.provider.userId) {
        await tx.clinicMessage.create({
          data: {
            patientId: appointment.patientId,
            providerId: appointment.patient.primaryProviderId,
            authorUserId: appointment.provider.userId,
            body: "We still need to schedule your follow-up. The clinic will book it.",
          },
        });
      }
      await deliverDueReminders(appointment.providerId, tx);
      return {
        ok: true as const,
        patientId: appointment.patientId,
        followUp: "task" as const,
        whenLabel: null,
      };
    }

    const followUp = booked.ok ? booked.appointment : null;
    if (!followUp) {
      return {
        ok: false as const,
        error: "The follow-up could not be booked.",
      };
    }
    const whenLabel = formatClinicWhen(followUp.scheduledAt);
    for (const reminder of reminderRows({
      scheduledAt: followUp.scheduledAt,
      providerName: reminderProviderName(appointment.provider),
    })) {
      await tx.reminder.create({
        data: {
          appointmentId: followUp.id,
          patientId: appointment.patientId,
          dueAt: reminder.dueAt,
          channel: "portal",
          kind: reminder.kind,
          status: "scheduled",
          body: reminder.body,
        },
      });
    }
    await appendEvent(tx, {
      patientId: appointment.patientId,
      actorUserId: access.userId,
      type: "follow_up.booked",
      appointmentId: appointment.id,
      visitId: appointment.visit.id,
      payload: {
        appointmentId: followUp.id,
        start: followUp.scheduledAt.toISOString(),
      },
    });
    await deliverDueReminders(appointment.providerId, tx);
    return {
      ok: true as const,
      patientId: appointment.patientId,
      followUp: "appointment" as const,
      whenLabel,
    };
  });

  if (saved.ok) refreshChart(saved.patientId, appointmentId);
  return saved.ok
    ? {
        ok: true as const,
        followUp: saved.followUp,
        whenLabel: saved.whenLabel,
      }
    : saved;
}

export async function completeIntake(input: {
  userId: string;
  appointmentId: string;
  phq9Score: number;
  gad7Score: number;
  safetyConcern: boolean;
  safetyNote: string;
  medicationChangesNote: string;
  pharmacyId: string;
}) {
  if (
    !Number.isInteger(input.phq9Score) ||
    input.phq9Score < 0 ||
    input.phq9Score > 27 ||
    !Number.isInteger(input.gad7Score) ||
    input.gad7Score < 0 ||
    input.gad7Score > 21
  ) {
    return { ok: false as const, error: "Check the questionnaire scores." };
  }
  const safetyNote = input.safetyNote.trim();
  if (input.safetyConcern && safetyNote.length === 0) {
    return {
      ok: false as const,
      error: "Add a note about the safety concern.",
    };
  }

  const patient = await db.patient.findUnique({
    where: { userId: input.userId },
  });
  if (!patient)
    return { ok: false as const, error: "No chart is linked to this account." };
  const appointment = await db.appointment.findFirst({
    where: {
      id: input.appointmentId,
      patientId: patient.id,
      status: "scheduled",
    },
  });
  if (!appointment)
    return { ok: false as const, error: "That visit is not open for intake." };
  const pharmacy = await db.pharmacy.findUnique({
    where: { id: input.pharmacyId },
  });
  if (!pharmacy)
    return { ok: false as const, error: "Choose a pharmacy from the list." };

  await db.$transaction(async (tx) => {
    const data = {
      patientId: patient.id,
      phq9Score: input.phq9Score,
      gad7Score: input.gad7Score,
      safetyConcern: input.safetyConcern,
      safetyNote: safetyNote || null,
      medicationChangesNote: input.medicationChangesNote.trim() || null,
      pharmacyId: pharmacy.id,
      completedAt: new Date(),
    };
    await tx.intake.upsert({
      where: { appointmentId: appointment.id },
      create: { appointmentId: appointment.id, ...data },
      update: data,
    });
    await tx.patient.update({
      where: { id: patient.id },
      data: { preferredPharmacyId: pharmacy.id },
    });
    await appendEvent(tx, {
      patientId: patient.id,
      actorUserId: input.userId,
      type: "intake.completed",
      appointmentId: appointment.id,
      payload: {
        phq9Score: input.phq9Score,
        gad7Score: input.gad7Score,
        pharmacyId: pharmacy.id,
        safetyConcern: input.safetyConcern,
      },
    });
  });

  revalidatePath("/");
  revalidatePath(`/patients/${patient.id}`);
  revalidatePath(`/appointments/${appointment.id}/intake`);
  revalidatePath(`/visits/${appointment.id}`);
  return { ok: true as const };
}
