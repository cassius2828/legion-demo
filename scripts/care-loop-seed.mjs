const HOUR_MS = 60 * 60 * 1000;

export async function seedCareLoop(db) {
  const patient = await db.patient.findUnique({
    where: { id: "pat_16" },
    include: { preferredPharmacy: true },
  });
  const provider = await db.provider.findUnique({ where: { id: "prv_04" } });
  const visit = await db.visit.findFirst({
    where: { patientId: "pat_16", status: "completed" },
    orderBy: { visitDate: "desc" },
  });
  const medication = await db.medication.findFirst({
    where: { patientId: "pat_16", genericName: "escitalopram", status: "active" },
  });
  if (!patient?.preferredPharmacy || !provider?.userId || !visit || !medication) {
    return { orders: 0 };
  }

  const pharmacy = patient.preferredPharmacy;
  const orderId = "ord_pat_16_escitalopram";
  const base = {
    visitId: visit.id,
    appointmentId: visit.appointmentId,
    patientId: patient.id,
    prescribingProviderId: provider.id,
    pharmacyId: pharmacy.id,
    medicationName: medication.medicationName,
    genericName: medication.genericName,
    dosage: medication.dosage,
    route: medication.route,
    frequency: medication.frequency,
    quantity: 30,
    refills: 3,
    sig: `${medication.dosage} ${medication.route}, ${medication.frequency}`,
    action: "refill",
    status: "accepted",
    statusDetail: "Accepted by the pharmacy.",
    allergyOverrideReason: null,
    medicationId: medication.id,
    createdAt: visit.visitDate,
  };
  await db.prescriptionOrder.upsert({
    where: { id: orderId },
    update: base,
    create: { id: orderId, ...base },
  });

  const steps = [
    ["order.queued", "Queued for transmission."],
    ["order.sent", "Sent to the pharmacy."],
    ["order.accepted", "Accepted by the pharmacy."],
  ];
  for (const [index, [type, detail]] of steps.entries()) {
    const id = `evt_${orderId}_${index + 1}`;
    const data = {
      patientId: patient.id,
      actorUserId: provider.userId,
      type,
      payload: JSON.stringify({
        medicationName: medication.medicationName,
        pharmacyId: pharmacy.id,
        detail,
      }),
      visitId: visit.id,
      appointmentId: visit.appointmentId,
      orderId,
      createdAt: new Date(visit.visitDate.getTime() + index * 1000),
    };
    await db.clinicalEvent.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
  }

  const upcoming = await db.appointment.findFirst({
    where: { patientId: "pat_16", status: "scheduled", joinToken: { not: null } },
    orderBy: { scheduledAt: "asc" },
    include: { provider: true },
  });
  if (upcoming) {
    const when = upcoming.scheduledAt.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const providerName = `${upcoming.provider.firstName} ${upcoming.provider.lastName}, ${upcoming.provider.credentials}`;
    const reminders = [
      {
        id: "rem_pat_16_due",
        dueAt: new Date(Date.now() - 60 * 1000),
        kind: "upcoming",
        body: `Your visit is ${when} with ${providerName}. Complete intake and use your visit link.`,
      },
      {
        id: "rem_pat_16_hour",
        dueAt: new Date(upcoming.scheduledAt.getTime() - HOUR_MS),
        kind: "hour-before",
        body: `Your visit starts in about an hour, ${when}, with ${providerName}. Use your visit link when you are ready.`,
      },
    ];
    for (const reminder of reminders) {
      const data = {
        appointmentId: upcoming.id,
        patientId: patient.id,
        dueAt: reminder.dueAt,
        channel: "portal",
        kind: reminder.kind,
        status: "scheduled",
        body: reminder.body,
        sentAt: null,
      };
      await db.reminder.upsert({
        where: { id: reminder.id },
        update: data,
        create: { id: reminder.id, ...data },
      });
    }
  }

  return { orders: 1 };
}
