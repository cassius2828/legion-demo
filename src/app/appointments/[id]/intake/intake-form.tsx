"use client";

import { useActionState } from "react";

import { saveIntake } from "~/app/appointments/[id]/intake/actions";
import { Button } from "~/components/ui/button";
import { pharmacyLabel } from "~/lib/care-loop-rules";

const fieldClass = "h-9 rounded-lg border bg-background px-3";

type PharmacyOption = {
  id: string;
  name: string;
  street: string;
  city: string;
  state: string;
};

export function IntakeForm({
  appointmentId,
  pharmacies,
  defaults,
}: {
  appointmentId: string;
  pharmacies: PharmacyOption[];
  defaults: {
    phq9: number;
    gad7: number;
    safetyConcern: boolean;
    safetyNote: string;
    medicationChanges: string;
    pharmacyId: string;
  };
}) {
  const [state, action, pending] = useActionState(saveIntake, null);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <label className="grid gap-1 text-sm">
        PHQ-9 total (0–27)
        <input
          name="phq9"
          type="number"
          min={0}
          max={27}
          required
          defaultValue={defaults.phq9}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-sm">
        GAD-7 total (0–21)
        <input
          name="gad7"
          type="number"
          min={0}
          max={21}
          required
          defaultValue={defaults.gad7}
          className={fieldClass}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="safetyConcern"
          defaultChecked={defaults.safetyConcern}
        />
        There is a safety concern to tell the clinician
      </label>
      <label className="grid gap-1 text-sm">
        Safety note
        <textarea
          name="safetyNote"
          rows={3}
          defaultValue={defaults.safetyNote}
          className="bg-background rounded-lg border px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Medication changes since the last visit
        <textarea
          name="medicationChanges"
          rows={3}
          defaultValue={defaults.medicationChanges}
          className="bg-background rounded-lg border px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Pharmacy
        <select
          name="pharmacyId"
          required
          defaultValue={defaults.pharmacyId}
          className={fieldClass}
        >
          <option value="">Choose a pharmacy</option>
          {pharmacies.map((pharmacy) => (
            <option key={pharmacy.id} value={pharmacy.id}>
              {pharmacyLabel(pharmacy)}
            </option>
          ))}
        </select>
      </label>
      {state?.error ? (
        <p className="text-destructive text-sm">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Submit intake"}
      </Button>
    </form>
  );
}
