import {
  startLocalTraces,
  writeEvalRun,
  type EvalCheck,
} from "./eval-run-log";
import { formatDate, fullName } from "~/lib/chart";
import { CLINIC_TIME_ZONE } from "~/lib/clinic-time";
import { listOpenFollowUpSlots } from "~/server/availability";
import {
  bookingRefusal,
  expectedOpenStart,
  UPCOMING_APPOINTMENT_ERROR,
  usualWeekdayAndTime,
} from "~/server/booking-choice";
import { scheduleWithAgent } from "~/server/booking-agent";
import { db } from "~/server/db";
import { summarizePatient } from "~/server/patient-summary-agent";
import {
  diagnosisLines,
  medicationFacts,
  RETRIEVAL_FAILED,
  taskLine,
  visitSummaryLine,
  type SummaryLists,
} from "~/server/summary-assembly";

const PATIENT_ID = "pat_16";
const PROVIDER_ID = "prv_04";
const CORRECTION_PHRASE = "Confirm the October evaluation time";
const INVENTED_MEDICATIONS = [
  "sertraline",
  "fluoxetine",
  "alprazolam",
  "lithium",
];

const weekdayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TIME_ZONE,
  weekday: "long",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const failures: string[] = [];
const checks: EvalCheck[] = [];
const log: string[] = [];
const startedAt = new Date();
const traces = startLocalTraces();

function note(check: string) {
  failures.push(check);
}

function logLine(message: string) {
  log.push(`${new Date().toISOString()} ${message}`);
}

async function runCase(name: string, body: () => Promise<void>) {
  const before = failures.length;
  logLine(`${name} started`);
  await body();
  const caseFailures = failures.slice(before);
  checks.push({
    name,
    passed: caseFailures.length === 0,
    failures: caseFailures,
  });
  logLine(
    caseFailures.length === 0
      ? `${name} passed`
      : `${name} failed: ${caseFailures.join("; ")}`,
  );
}

function sameLists(left: SummaryLists, right: SummaryLists) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function projectChart(patientId: string): Promise<SummaryLists | null> {
  const [chart, visits, medications, tasks] = await Promise.all([
    db.patient.findUnique({
      where: { id: patientId },
      select: {
        psychiatricHistory: true,
        conditions: {
          orderBy: { description: "asc" },
          select: { description: true },
        },
      },
    }),
    db.visit.findMany({
      where: { patientId, status: "completed" },
      orderBy: { visitDate: "desc" },
      take: 5,
      select: { clinicalSummary: true },
    }),
    db.medication.findMany({
      where: { patientId },
      orderBy: { medicationName: "asc" },
      select: { medicationName: true, dosage: true, status: true },
    }),
    db.task.findMany({
      where: { patientId, status: "open" },
      orderBy: { dueDate: "asc" },
      select: { title: true, description: true, priority: true, dueDate: true },
    }),
  ]);
  if (!chart) return null;
  const visitFacts = {
    diagnoses: diagnosisLines(chart),
    latestClinicalSummary: visits[0]?.clinicalSummary ?? null,
    visitCount: visits.length,
  };
  const recentVisitSummary = visitSummaryLine(visitFacts);
  if (!recentVisitSummary) return null;
  const medication = medicationFacts(medications);
  return {
    diagnoses: visitFacts.diagnoses,
    currentMedications: medication.active,
    discontinuedMedications: medication.discontinued,
    recentVisitSummary,
    outstandingTasks: tasks.map((task) =>
      taskLine({
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDateLabel: formatDate(task.dueDate),
      }),
    ),
  };
}

function overviewNamesMissingMedication(
  overview: string,
  medicationNames: string[],
) {
  const known = medicationNames.map((name) => name.toLowerCase());
  const text = overview.toLowerCase();
  return INVENTED_MEDICATIONS.some(
    (name) => text.includes(name) && !known.some((row) => row.includes(name)),
  );
}

async function evaluateSummary() {
  const medications = await db.medication.findMany({
    where: { patientId: PATIENT_ID },
    select: { medicationName: true },
  });
  const projected = await projectChart(PATIENT_ID);
  if (!projected) {
    note("summary: chart projection missing");
    return;
  }

  let prepared: Awaited<ReturnType<typeof summarizePatient>>;
  try {
    prepared = await summarizePatient({
      patientId: PATIENT_ID,
      providerId: PROVIDER_ID,
      role: "psychiatrist",
    });
  } catch {
    note("summary: agent call failed");
    return;
  }
  if (!prepared.ok) {
    note("summary: draft was not approvable");
    return;
  }

  const lists = {
    diagnoses: prepared.summary.diagnoses,
    currentMedications: prepared.summary.currentMedications,
    discontinuedMedications: prepared.summary.discontinuedMedications,
    recentVisitSummary: prepared.summary.recentVisitSummary,
    outstandingTasks: prepared.summary.outstandingTasks,
  };
  if (!sameLists(lists, projected))
    note("summary: lists did not match the chart");
  const overview = prepared.summary.overview.trim();
  if (
    overview.length === 0 ||
    overview.length > 1200 ||
    overview.includes(RETRIEVAL_FAILED)
  ) {
    note("summary: overview was empty, too long, or not retrieved");
  }
  if (
    overviewNamesMissingMedication(
      overview,
      medications.map((row) => row.medicationName),
    )
  ) {
    note("summary: overview named a medication that is not on the chart");
  }

  let corrected: Awaited<ReturnType<typeof summarizePatient>>;
  try {
    corrected = await summarizePatient({
      patientId: PATIENT_ID,
      providerId: PROVIDER_ID,
      role: "psychiatrist",
      correction: {
        note: `The overview must include the exact phrase: ${CORRECTION_PHRASE}.`,
        draft: prepared.summary,
      },
    });
  } catch {
    note("summary: correction call failed");
    return;
  }
  if (!corrected.ok) {
    note("summary: corrected draft was not approvable");
    return;
  }
  const correctedLists = {
    diagnoses: corrected.summary.diagnoses,
    currentMedications: corrected.summary.currentMedications,
    discontinuedMedications: corrected.summary.discontinuedMedications,
    recentVisitSummary: corrected.summary.recentVisitSummary,
    outstandingTasks: corrected.summary.outstandingTasks,
  };
  if (!sameLists(correctedLists, projected))
    note("summary: correction changed the chart lists");
  if (!corrected.summary.overview.includes(CORRECTION_PHRASE)) {
    note("summary: correction phrase was missing");
  }
}

async function scheduledIds() {
  const rows = await db.appointment.findMany({
    where: { patientId: PATIENT_ID, status: "scheduled" },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

async function deleteUnexpected(before: string[]) {
  const extra = (await scheduledIds()).filter((id) => !before.includes(id));
  if (extra.length === 0) return;
  await db.appointment.deleteMany({ where: { id: { in: extra } } });
}

async function evaluateNewBooking(patientName: string) {
  const before = await scheduledIds();
  try {
    const result = await scheduleWithAgent({
      patientId: PATIENT_ID,
      providerId: PROVIDER_ID,
      patientName,
      reason: "Scheduling check",
    });
    const after = await scheduledIds();
    if (after.length !== before.length)
      note("new-booking: scheduled count changed");
    if (result.ok || result.error !== UPCOMING_APPOINTMENT_ERROR) {
      note("new-booking: missing upcoming explanation");
    }
  } catch {
    note("new-booking: agent call failed");
  } finally {
    await deleteUnexpected(before);
  }
}

async function evaluateMove(patientName: string) {
  const appointment = await db.appointment.findFirst({
    where: {
      patientId: PATIENT_ID,
      status: "scheduled",
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
  });
  if (!appointment) {
    note("move: no upcoming visit");
    return;
  }

  const visits = await db.visit.findMany({
    where: { appointmentId: appointment.id },
    select: { id: true, visitDate: true },
  });
  const before = await scheduledIds();
  const futureBefore = await db.appointment.count({
    where: {
      patientId: PATIENT_ID,
      status: "scheduled",
      scheduledAt: { gte: new Date() },
    },
  });
  const others = await db.appointment.findMany({
    where: {
      patientId: PATIENT_ID,
      status: "scheduled",
      NOT: { id: appointment.id },
    },
    select: { scheduledAt: true },
  });
  const [openSlots, history] = await Promise.all([
    listOpenFollowUpSlots({
      providerId: PROVIDER_ID,
      patientId: PATIENT_ID,
      ignoreAppointmentId: appointment.id,
    }),
    db.appointment.findMany({
      where: {
        patientId: PATIENT_ID,
        status: { in: ["completed", "scheduled"] },
      },
      orderBy: { scheduledAt: "asc" },
      take: 40,
      select: { scheduledAt: true, status: true },
    }),
  ]);
  const expected = expectedOpenStart({
    slots: openSlots.map((slot) => ({
      start: slot.start,
      weekday: weekdayFormat.format(slot.start),
      time: timeFormat.format(slot.start),
    })),
    usual: usualWeekdayAndTime(
      history.map((row) => ({
        weekday: weekdayFormat.format(row.scheduledAt),
        time: timeFormat.format(row.scheduledAt),
        status: row.status,
      })),
    ),
    excludeStart: appointment.scheduledAt,
    otherScheduled: others,
  });
  if (!expected) {
    note("move: no legal open slot");
    return;
  }

  try {
    const result = await scheduleWithAgent({
      patientId: PATIENT_ID,
      providerId: PROVIDER_ID,
      patientName,
      reason: appointment.reasonForVisit,
      movingAppointmentId: appointment.id,
      excludeStart: appointment.scheduledAt.toISOString(),
    });
    if (!result.ok) {
      note("move: not booked");
    } else {
      if (result.appointmentId !== appointment.id)
        note("move: appointment id changed");
      const saved = await db.appointment.findUnique({
        where: { id: appointment.id },
        select: { scheduledAt: true },
      });
      if (!saved || saved.scheduledAt.getTime() !== expected.getTime()) {
        note("move: start was not the expected open slot");
      }
      if (
        saved &&
        bookingRefusal(others, saved.scheduledAt, true) === "same-day"
      ) {
        note("move: same clinic day as another visit");
      }
      const future = await db.appointment.count({
        where: {
          patientId: PATIENT_ID,
          status: "scheduled",
          scheduledAt: { gte: new Date() },
        },
      });
      if (future !== futureBefore) note("move: future scheduled count changed");
      const summary = result.summary.trim();
      if (summary.length === 0 || summary.length > 400) {
        note("move: summary was empty or too long");
      }
    }
  } catch {
    note("move: agent call failed");
  } finally {
    await deleteUnexpected(before);
    await db.appointment.update({
      where: { id: appointment.id },
      data: {
        scheduledAt: appointment.scheduledAt,
        durationMinutes: appointment.durationMinutes,
        title: appointment.title,
      },
    });
    for (const visit of visits) {
      await db.visit.update({
        where: { id: visit.id },
        data: { visitDate: visit.visitDate },
      });
    }
  }
}

try {
  const patient = await db.patient.findUnique({
    where: { id: PATIENT_ID },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      primaryProviderId: true,
    },
  });
  if (!patient || patient.primaryProviderId !== PROVIDER_ID) {
    note("seeded chart is not available");
    checks.push({
      name: "seeded-chart",
      passed: false,
      failures: ["seeded chart is not available"],
    });
    logLine("seeded chart is not available");
  } else {
    const patientName = fullName(patient);
    await runCase("summary", () => evaluateSummary());
    await runCase("new-booking", () => evaluateNewBooking(patientName));
    await runCase("move", () => evaluateMove(patientName));
  }
} catch {
  note("live-agents: run failed");
  checks.push({
    name: "live-agents",
    passed: false,
    failures: ["live-agents: run failed"],
  });
  logLine("live-agents failed");
} finally {
  await db.$disconnect();
  const files = await writeEvalRun({
    purpose: "live-agents",
    startedAt,
    finishedAt: new Date(),
    checks,
    log,
    traces,
  });
  console.log(`Results: ${files.results}`);
  console.log(`Log: ${files.log}`);
  console.log(`Traces: ${files.traces}`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Live agent evals passed.");
