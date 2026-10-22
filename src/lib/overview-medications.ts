import { FORMULARY } from "./care-loop-rules.ts";

export const OFF_CHART_OVERVIEW_ERROR =
  "The overview names a medication that is not on the chart. Prepare the summary again.";

export type OverviewSpan = {
  text: string;
  unmatched: boolean;
};

const vocabulary = [...FORMULARY]
  .flatMap((drug) => [drug.medicationName, drug.genericName])
  .filter((name, index, names) => {
    const key = name.toLowerCase();
    return names.findIndex((item) => item.toLowerCase() === key) === index;
  })
  .sort((left, right) => right.length - left.length);

function boundary(text: string, index: number) {
  if (index < 0 || index >= text.length) return true;
  const character = text[index] ?? "";
  return !/[a-z0-9]/i.test(character);
}

export function allowedMedicationNames(
  rows: { medicationName: string; genericName: string; status: string }[],
) {
  const names: string[] = [];
  for (const row of rows) {
    if (row.status !== "active" && row.status !== "discontinued") continue;
    for (const name of [row.medicationName, row.genericName]) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      if (names.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        continue;
      }
      names.push(trimmed);
    }
  }
  return names;
}

export function overviewMedications(overview: string, allowedNames: string[]) {
  const allowed = new Set(allowedNames.map((name) => name.toLowerCase()));
  const lower = overview.toLowerCase();
  const spans: OverviewSpan[] = [];
  const unmatched: string[] = [];
  let index = 0;
  let plainStart = 0;

  while (index < overview.length) {
    if (!boundary(overview, index - 1)) {
      index += 1;
      continue;
    }
    const name = vocabulary.find((candidate) => {
      const end = index + candidate.length;
      return (
        lower.slice(index, end) === candidate.toLowerCase() &&
        boundary(overview, end)
      );
    });
    if (!name) {
      index += 1;
      continue;
    }
    if (plainStart < index) {
      spans.push({
        text: overview.slice(plainStart, index),
        unmatched: false,
      });
    }
    const offChart = !allowed.has(name.toLowerCase());
    spans.push({
      text: overview.slice(index, index + name.length),
      unmatched: offChart,
    });
    if (
      offChart &&
      !unmatched.some((item) => item.toLowerCase() === name.toLowerCase())
    ) {
      unmatched.push(name);
    }
    index += name.length;
    plainStart = index;
  }

  if (plainStart < overview.length) {
    spans.push({ text: overview.slice(plainStart), unmatched: false });
  }
  return { unmatched, spans };
}
