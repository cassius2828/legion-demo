export const RETRIEVAL_FAILED = "Retrieval failed.";

const EMPTY_VISIT = "No completed visits recorded.";
const OVERVIEW_FALLBACK = "Review the lists below before approving this draft.";

export type Retrieval<T> =
  { state: "missing" } | { state: "failed" } | { state: "ok"; value: T };

export type MedicationFacts = {
  active: string[];
  discontinued: string[];
};

export type VisitFacts = {
  diagnoses: string[];
  latestClinicalSummary: string | null;
  visitCount: number;
};

export type SummaryRetrieval = {
  medications: Retrieval<MedicationFacts>;
  visits: Retrieval<VisitFacts>;
  tasks: Retrieval<string[]>;
};

export type AssembledSummary = {
  patientId: string;
  overview: string;
  diagnoses: string[];
  currentMedications: string[];
  discontinuedMedications: string[];
  recentVisitSummary: string;
  outstandingTasks: string[];
};

export type SummaryLists = {
  diagnoses: string[];
  currentMedications: string[];
  discontinuedMedications: string[];
  recentVisitSummary: string;
  outstandingTasks: string[];
};

export function toolPatientMatches(
  contextPatientId: string | null,
  requestedPatientId: string,
) {
  return contextPatientId !== null && contextPatientId === requestedPatientId;
}

export function medicationLine(row: {
  medicationName: string;
  dosage: string;
}) {
  return `${row.medicationName}, ${row.dosage}`;
}

export function medicationFacts(
  rows: { medicationName: string; dosage: string; status: string }[],
): MedicationFacts {
  return {
    active: rows.filter((row) => row.status === "active").map(medicationLine),
    discontinued: rows
      .filter((row) => row.status === "discontinued")
      .map(medicationLine),
  };
}

export function diagnosisLines(chart: {
  psychiatricHistory: string;
  conditions: { description: string }[];
}) {
  const diagnoses = chart.conditions.map((condition) => condition.description);
  const history = chart.psychiatricHistory.trim();
  if (history) diagnoses.push(history);
  return diagnoses;
}

export function taskLine(row: {
  title: string;
  description: string;
  priority: string;
  dueDateLabel: string;
}) {
  return `${row.title} (${row.priority}, due ${row.dueDateLabel}): ${row.description}`;
}

export function visitSummaryLine(facts: VisitFacts) {
  const latest = facts.latestClinicalSummary?.trim() ?? "";
  if (latest) return latest;
  if (facts.visitCount === 0) return EMPTY_VISIT;
  return null;
}

function sameList(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function containsRetrievalFailure(summary: AssembledSummary) {
  const fields = [
    summary.overview,
    summary.recentVisitSummary,
    ...summary.diagnoses,
    ...summary.currentMedications,
    ...summary.discontinuedMedications,
    ...summary.outstandingTasks,
  ];
  return fields.some((field) => field.includes(RETRIEVAL_FAILED));
}

export function assembleSummary(input: {
  patientId: string;
  overview: string;
  retrieval: SummaryRetrieval;
}):
  | { approvable: true; summary: AssembledSummary }
  | { approvable: false; error: string } {
  const { retrieval } = input;
  if (
    retrieval.medications.state !== "ok" ||
    retrieval.visits.state !== "ok" ||
    retrieval.tasks.state !== "ok"
  ) {
    return { approvable: false, error: "A summary could not be prepared." };
  }

  const recentVisitSummary = visitSummaryLine(retrieval.visits.value);
  if (!recentVisitSummary) {
    return { approvable: false, error: "A summary could not be prepared." };
  }

  const overview = input.overview.trim().slice(0, 1200);
  return {
    approvable: true,
    summary: {
      patientId: input.patientId,
      overview:
        overview && !overview.includes(RETRIEVAL_FAILED)
          ? overview
          : OVERVIEW_FALLBACK,
      diagnoses: retrieval.visits.value.diagnoses,
      currentMedications: retrieval.medications.value.active,
      discontinuedMedications: retrieval.medications.value.discontinued,
      recentVisitSummary,
      outstandingTasks: retrieval.tasks.value,
    },
  };
}

export function approvalDecision(input: {
  summary: AssembledSummary;
  draftFingerprint: string;
  currentFingerprint: string;
  current: SummaryLists;
}): { ok: true } | { ok: false; error: string } {
  if (!input.draftFingerprint || containsRetrievalFailure(input.summary)) {
    return { ok: false, error: "A summary could not be prepared." };
  }
  if (input.draftFingerprint !== input.currentFingerprint) {
    return {
      ok: false,
      error: "The chart changed. Prepare the summary again.",
    };
  }
  const listsMatch =
    sameList(input.summary.diagnoses, input.current.diagnoses) &&
    sameList(
      input.summary.currentMedications,
      input.current.currentMedications,
    ) &&
    sameList(
      input.summary.discontinuedMedications,
      input.current.discontinuedMedications,
    ) &&
    sameList(input.summary.outstandingTasks, input.current.outstandingTasks) &&
    input.summary.recentVisitSummary === input.current.recentVisitSummary;
  if (!listsMatch) {
    return { ok: false, error: "That summary does not match the chart." };
  }
  return { ok: true };
}
