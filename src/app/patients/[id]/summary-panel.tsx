"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";

import {
  approvePatientSummary,
  preparePatientSummary,
} from "~/app/patients/[id]/actions";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type {
  PatientSummary,
  SavedPatientSummary,
} from "~/lib/patient-summary";

export function SummaryPanel({
  patientId,
  saved,
}: {
  patientId: string;
  saved: SavedPatientSummary | null;
}) {
  const [stored, setStored] = useState(saved);
  const [draft, setDraft] = useState<{
    summary: PatientSummary;
    fingerprint: string;
  } | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStored(saved);
  }, [saved]);

  function prepare() {
    setError(null);
    startTransition(async () => {
      const result = await preparePatientSummary(patientId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCorrecting(false);
      setNote("");
      setDraft({ summary: result.summary, fingerprint: result.fingerprint });
    });
  }

  function approve() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const result = await approvePatientSummary(
        draft.summary,
        draft.fingerprint,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStored(result.saved);
      setDraft(null);
      setCorrecting(false);
      setNote("");
    });
  }

  function applyCorrection() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const result = await preparePatientSummary(patientId, {
        note,
        draft: draft.summary,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft({ summary: result.summary, fingerprint: result.fingerprint });
      setCorrecting(false);
      setNote("");
    });
  }

  const prepareButton = (
    <Button type="button" size="sm" onClick={prepare} disabled={isPending}>
      {isPending && !draft ? "Preparing summary..." : "Prepare summary"}
    </Button>
  );

  return (
    <section className="grid gap-4">
      {error ? <p className="text-destructive">{error}</p> : null}
      {draft ? (
        <SummaryCard title="Summary draft" action={prepareButton}>
          <SummaryBody summary={draft.summary} />
          {correcting ? (
            <label className="mt-4 grid gap-1 text-sm">
              What should change?
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                rows={3}
                className="bg-background rounded-lg border px-3 py-2"
              />
            </label>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={approve} disabled={isPending}>
              Approve
            </Button>
            {correcting ? (
              <Button
                type="button"
                variant="outline"
                onClick={applyCorrection}
                disabled={isPending || note.trim().length === 0}
              >
                {isPending ? "Updating draft..." : "Regenerate"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCorrecting(true)}
                disabled={isPending}
              >
                Modify
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(null);
                setCorrecting(false);
                setNote("");
              }}
              disabled={isPending}
            >
              Dismiss
            </Button>
          </div>
        </SummaryCard>
      ) : null}
      {stored ? (
        <SummaryCard
          title="Approved summary"
          meta={
            <span className={stored.outdated ? "text-destructive" : undefined}>
              {stored.approvedLabel}
              {stored.outdated ? " · Outdated summary" : null}
            </span>
          }
          action={draft ? null : prepareButton}
        >
          <SummaryBody summary={stored.summary} />
        </SummaryCard>
      ) : null}
      {!draft && !stored ? (
        <SummaryCard title="Summary" action={prepareButton}>
          <p className="text-muted-foreground">No approved summary yet.</p>
        </SummaryCard>
      ) : null}
    </section>
  );
}

function SummaryCard({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {meta ? <CardDescription>{meta}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SummaryBody({ summary }: { summary: PatientSummary }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <p className="leading-6 xl:col-span-2">{summary.overview}</p>
      <FactList title="Diagnoses" items={summary.diagnoses} />
      <FactList
        title="Current medications"
        items={summary.currentMedications}
      />
      <FactList
        title="Discontinued medications"
        items={summary.discontinuedMedications}
      />
      <FactList title="Outstanding tasks" items={summary.outstandingTasks} />
      <div className="xl:col-span-2">
        <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Last visit
        </h3>
        <p className="mt-1 leading-6">{summary.recentVisitSummary}</p>
      </div>
    </div>
  );
}

function FactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground mt-1">None recorded</p>
      ) : (
        <ul className="mt-1 list-disc pl-5 leading-6">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
