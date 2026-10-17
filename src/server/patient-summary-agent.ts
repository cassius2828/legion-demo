import "server-only";

import { Agent, run, setTracingDisabled, tool } from "@openai/agents";
import { z } from "zod";

import { env } from "~/env";
import { formatDate } from "~/lib/chart";
import {
  patientSummarySchema,
  type PatientSummary,
} from "~/lib/patient-summary";
import { canViewPatient } from "~/server/access";
import { db } from "~/server/db";
import {
  assembleSummary,
  diagnosisLines,
  medicationFacts,
  RETRIEVAL_FAILED,
  taskLine,
  toolPatientMatches,
  type SummaryRetrieval,
} from "~/server/summary-assembly";

setTracingDisabled(true);

const patientIdSchema = z.object({
  patientId: z.string().describe("The patient id from the request."),
});

const summarySchema = patientSummarySchema;

type SummaryContext = SummaryRetrieval & {
  patientId: string;
  providerId: string;
  role: string;
};

export type PatientSummaryResult =
  { ok: true; summary: PatientSummary } | { ok: false; error: string };

function readContext(context: { context: unknown } | undefined) {
  const value = context?.context;
  if (!value || typeof value !== "object" || !("patientId" in value))
    return null;
  return value as SummaryContext;
}

function logToolFailure(toolName: string, error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  console.error(toolName, name);
}

async function authorize(booking: SummaryContext | null, patientId: string) {
  if (!booking || !toolPatientMatches(booking.patientId, patientId)) {
    return { ok: false as const, error: "Not authorized for that patient." };
  }
  const patient = await db.patient.findUnique({
    where: { id: booking.patientId },
    select: { id: true, primaryProviderId: true },
  });
  if (!patient)
    return { ok: false as const, error: "Not authorized for that patient." };
  const allowed = canViewPatient({
    role: booking.role,
    ownPatientId: null,
    ownProviderId: booking.providerId,
    patient,
  });
  if (!allowed)
    return { ok: false as const, error: "Not authorized for that patient." };
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
    if (!access.ok || !summary)
      return { error: access.ok ? RETRIEVAL_FAILED : access.error };

    try {
      const rows = await db.medication.findMany({
        where: { patientId: summary.patientId },
        orderBy: { medicationName: "asc" },
        select: { medicationName: true, dosage: true, status: true },
      });
      const active = rows.filter((row) => row.status === "active");
      const discontinued = rows.filter((row) => row.status === "discontinued");
      const other = rows.filter(
        (row) => row.status !== "active" && row.status !== "discontinued",
      );
      const facts = medicationFacts(rows);
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
    if (!access.ok || !summary)
      return { error: access.ok ? RETRIEVAL_FAILED : access.error };

    try {
      const [chart, visits] = await Promise.all([
        db.patient.findUnique({
          where: { id: summary.patientId },
          select: {
            psychiatricHistory: true,
            conditions: {
              orderBy: { description: "asc" },
              select: { description: true },
            },
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

      const diagnoses = diagnosisLines(chart);

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
    if (!access.ok || !summary)
      return { error: access.ok ? RETRIEVAL_FAILED : access.error };

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
      const lines = rows.map((row) =>
        taskLine({
          title: row.title,
          description: row.description,
          priority: row.priority,
          dueDateLabel: formatDate(row.dueDate),
        }),
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
The server replaces recentVisitSummary and every list from the tools. Write overview only.
If a tool returns an error, say the information could not be retrieved.
overview is a short review for the provider. Do not add facts that the tools did not return.`,
  tools: [getPatientMedications, getPreviousVisits, getOutstandingTasks],
  outputType: summarySchema,
});

function readOverview(output: unknown) {
  if (!output || typeof output !== "object") return "";
  const value = (output as Record<string, unknown>).overview;
  return typeof value === "string" ? value : "";
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
  const prompt = input.correction
    ? `Prepare a summary for patient ${input.patientId}.
The provider corrected the current draft. Apply this correction only to the wording of overview: ${input.correction.note}
Current overview: ${input.correction.draft.overview}
Do not add or remove medications, diagnoses, or tasks. Those lists come from the tools. Do not rewrite the last visit.`
    : `Prepare a summary for patient ${input.patientId}.`;
  try {
    const result = await run(summaryAgent, prompt, {
      context,
      maxTurns: 8,
    });
    overview = readOverview(result.finalOutput);
  } catch (error) {
    logToolFailure("patientSummary", error);
  }

  const assembled = assembleSummary({
    patientId: context.patientId,
    overview,
    retrieval: context,
  });
  if (!assembled.approvable) return { ok: false, error: assembled.error };
  return { ok: true, summary: assembled.summary };
}
