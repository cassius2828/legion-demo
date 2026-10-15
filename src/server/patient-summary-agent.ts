import "server-only";

import { Agent, run, setTracingDisabled, tool } from "@openai/agents";
import { z } from "zod";

import { env } from "~/env";
import { formatDate } from "~/lib/chart";
import { patientSummarySchema, type PatientSummary } from "~/lib/patient-summary";
import { canViewPatient } from "~/server/access";
import { db } from "~/server/db";

setTracingDisabled(true);

const RETRIEVAL_FAILED = "Retrieval failed.";
const patientIdSchema = z.object({
  patientId: z.string().describe("The patient id from the request."),
});

const summarySchema = patientSummarySchema;

type MedicationFacts = {
  active: string[];
  discontinued: string[];
};

type VisitFacts = {
  diagnoses: string[];
  latestClinicalSummary: string | null;
  visitCount: number;
};

type Retrieval<T> = { state: "missing" } | { state: "failed" } | { state: "ok"; value: T };

type SummaryContext = {
  patientId: string;
  providerId: string;
  role: string;
  medications: Retrieval<MedicationFacts>;
  visits: Retrieval<VisitFacts>;
  tasks: Retrieval<string[]>;
};

export type PatientSummaryResult =
  | { ok: true; summary: PatientSummary }
  | { ok: false; error: string };

function readContext(context: { context: unknown } | undefined) {
  const value = context?.context;
  if (!value || typeof value !== "object" || !("patientId" in value)) return null;
  return value as SummaryContext;
}

function logToolFailure(toolName: string, error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  console.error(toolName, name);
}

function medicationLine(row: { medicationName: string; dosage: string }) {
  return `${row.medicationName}, ${row.dosage}`;
}

async function authorize(booking: SummaryContext | null, patientId: string) {
  if (!booking || patientId !== booking.patientId) {
    return { ok: false as const, error: "Not authorized for that patient." };
  }
  const patient = await db.patient.findUnique({
    where: { id: booking.patientId },
    select: { id: true, primaryProviderId: true },
  });
  if (!patient) return { ok: false as const, error: "Not authorized for that patient." };
  const allowed = canViewPatient({
    role: booking.role,
    ownPatientId: null,
    ownProviderId: booking.providerId,
    patient,
  });
  if (!allowed) return { ok: false as const, error: "Not authorized for that patient." };
  return { ok: true as const };
}

const getPatientMedications = tool({
  name: "getPatientMedications",
  description:
    "Load this patient's medications already split into active, discontinued, and any other status. Do not reclassify them.",
  parameters: patientIdSchema,
  execute: async (input, runContext) => {
    const summary = readContext(runContext);
    const access = await authorize(summary, input.patientId);
    if (!access.ok || !summary) return { error: access.ok ? RETRIEVAL_FAILED : access.error };

    try {
      const rows = await db.medication.findMany({
        where: { patientId: summary.patientId },
        orderBy: { medicationName: "asc" },
        select: { medicationName: true, dosage: true, status: true },
      });
      const active = rows.filter((row) => row.status === "active");
      const discontinued = rows.filter((row) => row.status === "discontinued");
      const other = rows.filter((row) => row.status !== "active" && row.status !== "discontinued");
      const facts = {
        active: active.map(medicationLine),
        discontinued: discontinued.map(medicationLine),
      };
      summary.medications = { state: "ok", value: facts };
      return {
        active: active.map((row) => ({
          name: row.medicationName,
          dosage: row.dosage,
          status: "active" as const,
        })),
        discontinued: discontinued.map((row) => ({
          name: row.medicationName,
          dosage: row.dosage,
          status: "discontinued" as const,
        })),
        other: other.map((row) => ({
          name: row.medicationName,
          dosage: row.dosage,
          status: row.status,
        })),
      };
    } catch (error) {
      logToolFailure("getPatientMedications", error);
      summary.medications = { state: "failed" };
      return { error: RETRIEVAL_FAILED };
    }
  },
});

const getPreviousVisits = tool({
  name: "getPreviousVisits",
  description:
    "Load recent completed visits, recorded conditions, and the chart psychiatric history. The visit with latest true is the last visit.",
  parameters: patientIdSchema,
  execute: async (input, runContext) => {
    const summary = readContext(runContext);
    const access = await authorize(summary, input.patientId);
    if (!access.ok || !summary) return { error: access.ok ? RETRIEVAL_FAILED : access.error };

    try {
      const [chart, visits] = await Promise.all([
        db.patient.findUnique({
          where: { id: summary.patientId },
          select: {
            psychiatricHistory: true,
            conditions: { orderBy: { description: "asc" }, select: { description: true } },
          },
        }),
        db.visit.findMany({
          where: { patientId: summary.patientId, status: "completed" },
          orderBy: { visitDate: "desc" },
          take: 5,
          include: {
            appointment: { select: { appointmentType: true } },
            notes: { select: { noteType: true, content: true } },
          },
        }),
      ]);
      if (!chart) {
        summary.visits = { state: "failed" };
        return { error: RETRIEVAL_FAILED };
      }

      const diagnoses = chart.conditions.map((condition) => condition.description);
      const history = chart.psychiatricHistory.trim();
      if (history) diagnoses.push(history);

      summary.visits = {
        state: "ok",
        value: {
          diagnoses,
          latestClinicalSummary: visits[0]?.clinicalSummary ?? null,
          visitCount: visits.length,
        },
      };

      return {
        diagnoses,
        visits: visits.map((visit, index) => ({
          latest: index === 0,
          date: formatDate(visit.visitDate),
          appointmentType: visit.appointment.appointmentType,
          chiefComplaint: visit.chiefComplaint,
          clinicalSummary: visit.clinicalSummary,
          followUpInstructions: visit.followUpInstructions,
          notes: visit.notes.map((note) => ({
            noteType: note.noteType,
            content: note.content,
          })),
        })),
      };
    } catch (error) {
      logToolFailure("getPreviousVisits", error);
      summary.visits = { state: "failed" };
      return { error: RETRIEVAL_FAILED };
    }
  },
});

const getOutstandingTasks = tool({
  name: "getOutstandingTasks",
  description: "Load unfinished follow-ups. Only open tasks are returned.",
  parameters: patientIdSchema,
  execute: async (input, runContext) => {
    const summary = readContext(runContext);
    const access = await authorize(summary, input.patientId);
    if (!access.ok || !summary) return { error: access.ok ? RETRIEVAL_FAILED : access.error };

    try {
      const rows = await db.task.findMany({
        where: { patientId: summary.patientId, status: "open" },
        orderBy: { dueDate: "asc" },
        select: {
          title: true,
          description: true,
          priority: true,
          status: true,
          dueDate: true,
        },
      });
      const lines = rows.map(
        (row) =>
          `${row.title} (${row.priority}, due ${formatDate(row.dueDate)}): ${row.description}`,
      );
      summary.tasks = { state: "ok", value: lines };
      return {
        tasks: rows.map((row) => ({
          title: row.title,
          description: row.description,
          priority: row.priority,
          status: row.status,
          dueDate: formatDate(row.dueDate),
        })),
      };
    } catch (error) {
      logToolFailure("getOutstandingTasks", error);
      summary.tasks = { state: "failed" };
      return { error: RETRIEVAL_FAILED };
    }
  },
});

const summaryAgent = new Agent<SummaryContext, typeof summarySchema>({
  name: "Patient summary",
  model: "gpt-4.1-mini",
  instructions: `Prepare a chart draft for the patient id in the request.
Call getPatientMedications, getPreviousVisits, and getOutstandingTasks before you answer.
Use only those results. Do not invent medications, diagnoses, visits, or tasks.
Active and discontinued medications are already separated. Do not move a drug from one list to the other.
Write recentVisitSummary from the visit marked latest.
If a tool returns an error, say the information could not be retrieved.
overview is a short review for the provider. Do not add facts that the tools did not return.`,
  tools: [getPatientMedications, getPreviousVisits, getOutstandingTasks],
  outputType: summarySchema,
});

function readText(output: unknown, key: "overview" | "recentVisitSummary") {
  if (!output || typeof output !== "object") return "";
  const value = (output as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

function listFrom<T>(retrieval: Retrieval<T>, lines: (value: T) => string[]) {
  if (retrieval.state === "ok") return lines(retrieval.value);
  return [RETRIEVAL_FAILED];
}

export async function summarizePatient(input: {
  patientId: string;
  providerId: string;
  role: string;
  correction?: { note: string; draft: PatientSummary };
}): Promise<PatientSummaryResult> {
  if (!env.OPENAI_API_KEY) {
    return { ok: false, error: "A summary needs an OpenAI API key." };
  }

  const context: SummaryContext = {
    patientId: input.patientId,
    providerId: input.providerId,
    role: input.role,
    medications: { state: "missing" },
    visits: { state: "missing" },
    tasks: { state: "missing" },
  };

  let overview = "";
  let recentVisitSummary = "";
  const prompt = input.correction
    ? `Prepare a summary for patient ${input.patientId}.
The provider corrected the current draft. Apply this correction to the wording of overview and recentVisitSummary: ${input.correction.note}
Current overview: ${input.correction.draft.overview}
Current last visit: ${input.correction.draft.recentVisitSummary}
Do not add or remove medications, diagnoses, or tasks. Those lists come from the tools.`
    : `Prepare a summary for patient ${input.patientId}.`;
  try {
    const result = await run(summaryAgent, prompt, {
      context,
      maxTurns: 8,
    });
    overview = readText(result.finalOutput, "overview");
    recentVisitSummary = readText(result.finalOutput, "recentVisitSummary");
  } catch (error) {
    logToolFailure("patientSummary", error);
    const anyFacts =
      context.medications.state === "ok" ||
      context.visits.state === "ok" ||
      context.tasks.state === "ok";
    if (!anyFacts) {
      return { ok: false, error: "A summary could not be prepared." };
    }
  }

  const latest =
    context.visits.state === "ok" ? context.visits.value.latestClinicalSummary : null;
  const visitCount = context.visits.state === "ok" ? context.visits.value.visitCount : 0;

  return {
    ok: true,
    summary: {
      patientId: context.patientId,
      overview: overview || "Review the lists below before approving this draft.",
      diagnoses: listFrom(context.visits, (value) => value.diagnoses),
      currentMedications: listFrom(context.medications, (value) => value.active),
      discontinuedMedications: listFrom(context.medications, (value) => value.discontinued),
      recentVisitSummary:
        context.visits.state === "ok"
          ? recentVisitSummary ||
            latest ||
            (visitCount === 0 ? "No completed visits recorded." : RETRIEVAL_FAILED)
          : RETRIEVAL_FAILED,
      outstandingTasks: listFrom(context.tasks, (value) => value),
    },
  };
}
