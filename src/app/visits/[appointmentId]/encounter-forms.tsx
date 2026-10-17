"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  finishVisit,
  sendPrescription,
  signNote,
} from "~/app/visits/[appointmentId]/actions";
import { Button } from "~/components/ui/button";
import {
  drugChoices,
  matchingAllergy,
  type DrugChoice,
} from "~/lib/care-loop-rules";

const fieldClass = "h-9 rounded-lg border bg-background px-3";

export function NoteForm({
  appointmentId,
  summary,
  followUp,
  closed,
}: {
  appointmentId: string;
  summary: string;
  followUp: string;
  closed: boolean;
}) {
  const [note, setNote] = useState(summary);
  const [plan, setPlan] = useState(followUp);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function sign() {
    setError(null);
    startTransition(async () => {
      const result = await signNote({
        appointmentId,
        summary: note,
        followUp: plan,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Visit summary
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={5}
          disabled={closed}
          className="bg-background rounded-lg border px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Follow-up plan
        <textarea
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          rows={2}
          disabled={closed}
          className="bg-background rounded-lg border px-3 py-2"
        />
      </label>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {closed ? null : (
        <Button type="button" onClick={sign} disabled={pending}>
          {pending ? "Signing..." : "Sign note"}
        </Button>
      )}
    </div>
  );
}

export function PrescribeForm({
  appointmentId,
  allergies,
  active,
  pharmacyLabel,
  closed,
}: {
  appointmentId: string;
  allergies: string[];
  active: DrugChoice[];
  pharmacyLabel: string | null;
  closed: boolean;
}) {
  const choices = drugChoices(active);
  const first = choices[0];
  const [key, setKey] = useState(first ? choiceKey(first) : "");
  const selected = choices.find((choice) => choiceKey(choice) === key) ?? first;
  const [dosage, setDosage] = useState(selected?.dosage ?? "");
  const [route, setRoute] = useState(selected?.route ?? "oral");
  const [frequency, setFrequency] = useState(selected?.frequency ?? "");
  const [quantity, setQuantity] = useState(30);
  const [refills, setRefills] = useState(1);
  const [action, setAction] = useState<
    "new" | "refill" | "change" | "discontinue"
  >(selected?.source === "active" ? "refill" : "new");
  const [confirmed, setConfirmed] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const conflict = selected
    ? matchingAllergy(selected.medicationName, selected.genericName, allergies)
    : null;

  function choose(nextKey: string) {
    const next = choices.find((choice) => choiceKey(choice) === nextKey);
    setKey(nextKey);
    if (!next) return;
    setDosage(next.dosage);
    setRoute(next.route);
    setFrequency(next.frequency);
    setAction(next.source === "active" ? "refill" : "new");
  }

  function send() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const result = await sendPrescription({
        appointmentId,
        medicationName: selected.medicationName,
        genericName: selected.genericName,
        dosage,
        route,
        frequency,
        quantity,
        refills,
        action,
        pharmacyConfirmed: confirmed,
        overrideReason,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmed(false);
      router.refresh();
    });
  }

  if (!selected || !pharmacyLabel) {
    return (
      <p className="text-muted-foreground text-sm">
        Confirm a pharmacy on the intake before sending a prescription.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Medication
        <select
          value={choiceKey(selected)}
          onChange={(event) => choose(event.target.value)}
          className={fieldClass}
          disabled={closed}
        >
          {choices.map((choice) => (
            <option key={choiceKey(choice)} value={choiceKey(choice)}>
              {choice.medicationName} ·{" "}
              {choice.source === "active" ? "current" : "formulary"}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          Dose
          <input
            value={dosage}
            onChange={(event) => setDosage(event.target.value)}
            className={fieldClass}
            disabled={closed}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Route
          <input
            value={route}
            onChange={(event) => setRoute(event.target.value)}
            className={fieldClass}
            disabled={closed}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Frequency
          <input
            value={frequency}
            onChange={(event) => setFrequency(event.target.value)}
            className={fieldClass}
            disabled={closed}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm">
          Quantity
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className={fieldClass}
            disabled={closed}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Refills
          <input
            type="number"
            min={0}
            value={refills}
            onChange={(event) => setRefills(Number(event.target.value))}
            className={fieldClass}
            disabled={closed}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Action
          <select
            value={action}
            onChange={(event) => setAction(event.target.value as typeof action)}
            className={fieldClass}
            disabled={closed}
          >
            <option value="new">New</option>
            <option value="refill">Refill</option>
            <option value="change">Change</option>
            <option value="discontinue">Discontinue</option>
          </select>
        </label>
      </div>
      <p className="text-sm">
        Pharmacy <span className="font-medium">{pharmacyLabel}</span>
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={closed}
          className="mt-1"
        />
        This is the pharmacy that should receive the prescription.
      </label>
      {conflict ? (
        <label className="grid gap-1 text-sm">
          Allergy to {conflict}. Override reason
          <textarea
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            rows={2}
            disabled={closed}
            className="bg-background rounded-lg border px-3 py-2"
          />
        </label>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {closed ? null : (
        <Button type="button" onClick={send} disabled={pending || !confirmed}>
          {pending ? "Sending..." : "Send prescription"}
        </Button>
      )}
    </div>
  );
}

export function CloseVisitForm({
  appointmentId,
  signed,
  closed,
}: {
  appointmentId: string;
  signed: boolean;
  closed: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function close() {
    setError(null);
    startTransition(async () => {
      const result = await finishVisit(appointmentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        result.followUp === "appointment" && result.whenLabel
          ? `Follow-up booked for ${result.whenLabel}.`
          : "Follow-up was not booked. A task is on the chart.",
      );
      router.refresh();
    });
  }

  if (closed) return null;

  return (
    <div className="grid gap-2">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {notice ? <p className="text-sm">{notice}</p> : null}
      <Button type="button" onClick={close} disabled={pending || !signed}>
        {pending ? "Closing..." : "Close visit and book follow-up"}
      </Button>
      {signed ? null : (
        <p className="text-muted-foreground text-sm">
          Sign the note before closing the visit.
        </p>
      )}
    </div>
  );
}

function choiceKey(choice: DrugChoice) {
  return `${choice.source}:${choice.genericName}`;
}
