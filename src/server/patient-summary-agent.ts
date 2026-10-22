import "server-only";

import OpenAI from "openai";

import { env } from "~/env";
import { formatDate } from "~/lib/chart";
import type { PatientSummary } from "~/lib/patient-summary";
import { canViewPatient } from "~/server/access";
import { db } from "~/server/db";
import {
  assembleSummary,
  diagnosisLines,
  medicationFacts,
  taskLine,
  type SummaryRetrieval,
} from "~/server/summary-assembly";

const MODEL = "gpt-4.1-mini";

const overviewSchema = {
  type: "object",
  properties: {
    overview: { type: "string" },
  },
  required: ["overview"],
  additionalProperties: false,
} as const;

export type PatientSummaryResult =
  { ok: true; summary: PatientSummary } | { ok: false; error: string };

function logSummaryFailure(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  console.error("patientSummary", name);
}

async function loadRetrieval(
  patientId: string,
): Promise<
  { ok: true; retrieval: SummaryRetrieval; facts: unknown } | { ok: false }
> {
  try {
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
        include: {
          appointment: { select: { appointmentType: true } },
          notes: { select: { noteType: true, content: true } },
        },
      }),
      db.medication.findMany({
        where: { patientId },
        orderBy: { medicationName: "asc" },
        select: { medicationName: true, dosage: true, status: true },
      }),
      db.task.findMany({
        where: { patientId, status: "open" },
        orderBy: { dueDate: "asc" },
        select: {
          title: true,
          description: true,
          priority: true,
          status: true,
          dueDate: true,
        },
      }),
    ]);
    if (!chart) return { ok: false };

    const diagnoses = diagnosisLines(chart);
    const medication = medicationFacts(medications);
    const taskLines = tasks.map((task) =>
      taskLine({
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDateLabel: formatDate(task.dueDate),
      }),
    );
    return {
      ok: true,
      retrieval: {
        medications: { state: "ok", value: medication },
        visits: {
          state: "ok",
          value: {
            diagnoses,
            latestClinicalSummary: visits[0]?.clinicalSummary ?? null,
            visitCount: visits.length,
          },
        },
        tasks: { state: "ok", value: taskLines },
      },
      facts: {
        medications: medications.map((row) => ({
          name: row.medicationName,
          dosage: row.dosage,
          status: row.status,
        })),
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
        tasks: tasks.map((task) => ({
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          dueDate: formatDate(task.dueDate),
        })),
      },
    };
  } catch (error) {
    logSummaryFailure(error);
    return { ok: false };
  }
}

function readOverview(content: string | null | undefined) {
  if (!content) return "";
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || !("overview" in parsed))
      return "";
    const overview = (parsed as { overview: unknown }).overview;
    return typeof overview === "string" ? overview : "";
  } catch {
    return "";
  }
}

async function writeOverview(
  facts: unknown,
  correction?: { note: string; draft: PatientSummary },
) {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const correctionText = correction
    ? `The provider corrected the current draft. Apply this correction only to the wording of overview: ${correction.note}
Current overview: ${correction.draft.overview}
Do not add medications, diagnoses, or tasks that are not in the retrieved facts.`
    : "Write the overview from the retrieved facts.";
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "summary_overview",
        strict: true,
        schema: overviewSchema,
      },
    },
    messages: [
      {
        role: "system",
        content: `Write a short review for the provider. Use only the retrieved facts in the user message.
Return JSON with a single string field named overview.
Do not invent medications, diagnoses, visits, or tasks.
The server replaces every list and the last-visit line from the database.`,
      },
      {
        role: "user",
        content: `${correctionText}
Retrieved facts:
${JSON.stringify(facts)}`,
      },
    ],
  });
  return readOverview(completion.choices[0]?.message.content);
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

  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: { id: true, primaryProviderId: true },
  });
  if (!patient) return { ok: false, error: "A summary could not be prepared." };
  const allowed = canViewPatient({
    role: input.role,
    ownPatientId: null,
    ownProviderId: input.providerId,
    patient,
  });
  if (!allowed) return { ok: false, error: "Not authorized for that patient." };

  const loaded = await loadRetrieval(input.patientId);
  if (!loaded.ok)
    return { ok: false, error: "A summary could not be prepared." };

  let overview = "";
  try {
    overview = await writeOverview(loaded.facts, input.correction);
  } catch (error) {
    logSummaryFailure(error);
  }

  const assembled = assembleSummary({
    patientId: input.patientId,
    overview,
    retrieval: loaded.retrieval,
  });
  if (!assembled.approvable) return { ok: false, error: assembled.error };
  return { ok: true, summary: assembled.summary };
}
