"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import {
  bookFollowUp,
  cancelAgentBooking,
  requestAgentBooking,
  rescheduleWithAgent,
  type AgentBooking,
} from "~/app/appointments/book/actions";
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
  const [booking, setBooking] = useState<AgentBooking | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [task, setTask] = useState<"book" | "move" | "cancel" | null>(null);
  const [isPending, startTransition] = useTransition();
  const ready = reason.trim().length > 0;
  const busy = pending || isPending || task !== null;

  function findTime() {
    setAgentError(null);
    setNotice(null);
    setTask("book");
    startTransition(async () => {
      const result = await requestAgentBooking(reason);
      setTask(null);
      if (!result.ok) {
        setAgentError(result.error);
        return;
      }
      setModalError(null);
      setBooking(result.booking);
    });
  }

  function reschedule() {
    if (!booking) return;
    setModalError(null);
    setTask("move");
    startTransition(async () => {
      const result = await rescheduleWithAgent(booking.appointmentId);
      setTask(null);
      if (!result.ok) {
        setModalError(result.error);
        return;
      }
      setBooking(result.booking);
    });
  }

  function cancel() {
    if (!booking) return;
    setModalError(null);
    setTask("cancel");
    startTransition(async () => {
      const result = await cancelAgentBooking(booking.appointmentId);
      setTask(null);
      if (!result.ok) {
        setModalError(result.error);
        return;
      }
      setBooking(null);
      setNotice("That appointment was cancelled.");
    });
  }

  return (
    <>
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
            disabled={busy || booking !== null}
            className="rounded-lg border bg-background px-3 py-2"
          />
        </label>
        <Button type="button" onClick={findTime} disabled={!ready || busy || booking !== null}>
          {task === "book" ? "Checking schedules..." : "Find a time for me"}
        </Button>
        {agentError ? <p className="text-sm text-destructive">{agentError}</p> : null}
        {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {ready ? (
          groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No openings in the next three weeks.</p>
          ) : (
            <div className="grid gap-5">
              <h2 className="text-sm font-medium">Or choose a time yourself</h2>
              {groups.map((group) => (
                <section key={group.dayKey}>
                  <h3 className="text-sm font-medium">{group.label}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.slots.map((slot) => (
                      <Button
                        key={slot.start}
                        type="submit"
                        name="start"
                        value={slot.start}
                        variant="outline"
                        disabled={busy || booking !== null}
                      >
                        {slot.label}
                      </Button>
                    ))}
                  </div>
                </section>
              ))}
              <p className="text-sm text-muted-foreground">Times are Pacific.</p>
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            Describe the issue, then we will book a time that fits your usual schedule. Times are
            Pacific.
          </p>
        )}
      </form>
      {booking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
            className="w-full max-w-md rounded-xl border bg-background p-6 shadow-lg"
          >
            <h2 id="booking-title" className="text-lg font-semibold">
              You&apos;re booked
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">With {providerLabel}</p>
            <p className="mt-4 text-sm">
              {booking.dateLabel} at {booking.timeLabel}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{booking.summary}</p>
            {modalError ? <p className="mt-3 text-sm text-destructive">{modalError}</p> : null}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" onClick={reschedule} disabled={busy}>
                {task === "move" ? "Looking for another time..." : "Reschedule"}
              </Button>
              <Button type="button" variant="destructive" onClick={cancel} disabled={busy}>
                {task === "cancel" ? "Cancelling..." : "Cancel"}
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/calendar" />}
                variant="outline"
                disabled={busy}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
