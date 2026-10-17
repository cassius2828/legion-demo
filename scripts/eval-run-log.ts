import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  setTraceProcessors,
  setTracingDisabled,
  type TracingProcessor,
} from "@openai/agents";

const ROOT = path.join(process.cwd(), "eval-runs");

export type EvalCheck = {
  name: string;
  passed: boolean;
  failures: string[];
};

function pad(value: number, width = 2) {
  return String(value).padStart(width, "0");
}

export function evalTimestamp(date = new Date()) {
  return (
    [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(
      "-",
    ) +
    "_" +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(
      "-",
    ) +
    `-${pad(date.getMilliseconds(), 3)}`
  );
}

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const record: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (/api[-_]?key/i.test(key)) continue;
      record[key] = redact(item);
    }
    return record;
  }
  return value;
}

export function startLocalTraces() {
  const events: unknown[] = [];
  const processor: TracingProcessor = {
    async onTraceStart(trace) {
      const serialized = trace.toJSON();
      if (serialized)
        events.push({ event: "trace.start", trace: redact(serialized) });
    },
    async onTraceEnd(trace) {
      const serialized = trace.toJSON();
      if (serialized)
        events.push({ event: "trace.end", trace: redact(serialized) });
    },
    async onSpanStart(span) {
      const serialized = span.toJSON();
      if (serialized)
        events.push({ event: "span.start", span: redact(serialized) });
    },
    async onSpanEnd(span) {
      const serialized = span.toJSON();
      if (serialized)
        events.push({ event: "span.end", span: redact(serialized) });
    },
    async shutdown() {},
    async forceFlush() {},
  };
  setTraceProcessors([processor]);
  setTracingDisabled(false);
  return events;
}

export async function writeEvalRun(input: {
  purpose: string;
  startedAt: Date;
  finishedAt: Date;
  checks: EvalCheck[];
  log: string[];
  traces: unknown[];
}) {
  const stamp = evalTimestamp(input.startedAt);
  await mkdir(ROOT, { recursive: true });
  const files = {
    results: path.join(ROOT, `${input.purpose}-results-${stamp}.json`),
    log: path.join(ROOT, `${input.purpose}-log-${stamp}.txt`),
    traces: path.join(ROOT, `${input.purpose}-traces-${stamp}.json`),
  };
  const passed = input.checks.every((check) => check.passed);
  await writeFile(
    files.results,
    JSON.stringify(
      {
        purpose: input.purpose,
        startedAt: input.startedAt.toISOString(),
        finishedAt: input.finishedAt.toISOString(),
        passed,
        checks: input.checks,
      },
      null,
      2,
    ),
  );
  await writeFile(files.log, `${input.log.join("\n")}\n`);
  await writeFile(files.traces, JSON.stringify(input.traces, null, 2));
  return files;
}
