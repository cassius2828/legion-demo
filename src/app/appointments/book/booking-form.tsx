"use client";

import { useActionState, useState } from "react";

import { bookFollowUp } from "~/app/appointments/book/actions";
import { Button } from "~/components/ui/button";

type SlotGroup = {
  dayKey: string;
  label: string;
  slots: { start: string; label: string }[];
};

export function BookingForm({
  providerLabel,
  groups,
}: {
  providerLabel: string;
  groups: SlotGroup[];
}) {
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(bookFollowUp, null);
  const ready = reason.trim().length > 0;

  return (
    <form action={action} className="mt-8 grid gap-6">
      <p className="text-sm text-muted-foreground">With {providerLabel}</p>
      <label className="grid gap-1 text-sm">
        What do you want to discuss?
        <textarea
          name="reason"
          required
          maxLength={1000}
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="rounded-lg border bg-background px-3 py-2"
        />
      </label>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {ready ? (
        groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No openings in the next three weeks.</p>
        ) : (
          <div className="grid gap-5">
            {groups.map((group) => (
              <section key={group.dayKey}>
                <h2 className="text-sm font-medium">{group.label}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.slots.map((slot) => (
                    <Button
                      key={slot.start}
                      type="submit"
                      name="start"
                      value={slot.start}
                      variant="outline"
                      disabled={pending}
                    >
                      {slot.label}
                    </Button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Describe the issue to see open times. Times are Pacific.
        </p>
      )}
    </form>
  );
}
