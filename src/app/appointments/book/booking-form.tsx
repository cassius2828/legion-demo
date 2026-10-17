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
import { sendClinicMessage } from "~/app/messages/actions";
import { Button } from "~/components/ui/button";
import type { UpcomingVisit } from "~/lib/booking";

type SlotGroup = {
  dayKey: string;
  label: string;
  slots: { start: string; label: string }[];
};

export function BookingForm({
  providerLabel,
  groups,
  upcoming,
}: {
  providerLabel: string;
  groups: SlotGroup[];
  upcoming: UpcomingVisit | null;
}) {
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState(bookFollowUp, null);
  const [booking, setBooking] = useState<AgentBooking | null>(null);
  const [held, setHeld] = useState<UpcomingVisit | null>(upcoming);
  const [conflict, setConflict] = useState(false);
  const [panel, setPanel] = useState<"choose" | "cancel" | "reach">("choose");
  const [cancelReason, setCancelReason] = useState("");
  const [reachBody, setReachBody] = useState("");
  const [sent, setSent] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [task, setTask] = useState<"book" | "move" | "cancel" | "message" | null>(null);
  const [isPending, startTransition] = useTransition();
  const ready = reason.trim().length > 0;
  const busy = pending || isPending || task !== null;

  function openConflict() {
    setModalError(null);
    setPanel("choose");
    setConflict(true);
  }

  function findTime() {
    if (held) {
      openConflict();
      return;
    }
    setAgentError(null);
    setNotice(null);
    setTask("book");
    startTransition(async () => {
      const result = await requestAgentBooking(reason);
      setTask(null);
      if (!result.ok) {
        if (result.upcoming) {
          setHeld(result.upcoming);
          setConflict(true);
          return;
        }
        setAgentError(result.error);
        return;
      }
      setModalError(null);
      setBooking(result.booking);
    });
  }

  function reschedule() {
    const appointmentId = held?.appointmentId ?? booking?.appointmentId;
    if (!appointmentId) return;
    setModalError(null);
    setTask("move");
    startTransition(async () => {
      const result = await rescheduleWithAgent(appointmentId);
      setTask(null);
      if (!result.ok) {
        setModalError(result.error);
        return;
      }
      if (held) {
        setHeld({
          ...held,
          appointmentId: result.booking.appointmentId,
          dateLabel: result.booking.dateLabel,
          timeLabel: result.booking.timeLabel,
        });
        return;
      }
      setBooking(result.booking);
    });
  }

  function cancel() {
    const appointmentId = held?.appointmentId ?? booking?.appointmentId;
    if (!appointmentId) return;
    if (cancelReason.trim().length === 0) {
      setModalError("Explain why you are cancelling.");
      return;
    }
    setModalError(null);
    setTask("cancel");
    startTransition(async () => {
      const result = await cancelAgentBooking(appointmentId, cancelReason);
      setTask(null);
      if (!result.ok) {
        setModalError(result.error);
        return;
      }
      setBooking(null);
      setHeld(null);
      setConflict(false);
      setCancelReason("");
      setNotice("That appointment was cancelled.");
    });
  }

  function reachOut() {
    if (reachBody.trim().length === 0) {
      setModalError("Write a message first.");
      return;
    }
    setModalError(null);
    setTask("message");
    startTransition(async () => {
      const result = await sendClinicMessage({ body: reachBody });
      setTask(null);
      if (!result.ok) {
        setModalError(result.error);
        return;
      }
      setSent(true);
      setReachBody("");
    });
  }

  return (
    <>
      <form action={action} className="mt-8 grid gap-6">
        <p className="text-sm text-muted-foreground">With {providerLabel}</p>
        {held ? (
          <p className="text-sm">
            You already have an appointment on {held.dateLabel} at {held.timeLabel}. A new visit is
            not booked until that one is moved or cancelled.
          </p>
        ) : null}
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
        {held ? null : ready ? (
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
      {conflict && held ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="conflict-title"
            className="w-full max-w-md rounded-xl border bg-background p-6 shadow-lg"
          >
            <h2 id="conflict-title" className="text-lg font-semibold">
              You already have an appointment
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">With {held.providerLabel}</p>
            <p className="mt-4 text-sm">
              {held.dateLabel} at {held.timeLabel}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              A new visit is not booked yet. Reschedule this one, cancel it, or send your provider a
              message.
            </p>
            {panel === "cancel" ? (
              <label className="mt-4 grid gap-1 text-sm">
                Why are you cancelling?
                <textarea
                  required
                  maxLength={1000}
                  rows={3}
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  className="rounded-lg border bg-background px-3 py-2"
                />
              </label>
            ) : null}
            {panel === "reach" ? (
              <label className="mt-4 grid gap-1 text-sm">
                Message to your provider
                <textarea
                  required
                  maxLength={1000}
                  rows={3}
                  value={reachBody}
                  onChange={(event) => setReachBody(event.target.value)}
                  className="rounded-lg border bg-background px-3 py-2"
                />
              </label>
            ) : null}
            {sent ? (
              <p className="mt-3 text-sm">
                Message sent.{" "}
                <Link href="/messages" className="text-primary hover:underline">
                  Open the conversation
                </Link>
              </p>
            ) : null}
            {modalError ? <p className="mt-3 text-sm text-destructive">{modalError}</p> : null}
            <div className="mt-6 flex flex-wrap gap-2">
              {panel === "cancel" ? (
                <Button type="button" variant="destructive" onClick={cancel} disabled={busy}>
                  {task === "cancel" ? "Cancelling..." : "Confirm cancel"}
                </Button>
              ) : (
                <Button type="button" variant="destructive" onClick={() => setPanel("cancel")} disabled={busy}>
                  Cancel
                </Button>
              )}
              <Button type="button" onClick={reschedule} disabled={busy}>
                {task === "move" ? "Looking for another time..." : "Reschedule"}
              </Button>
              {panel === "reach" ? (
                <Button type="button" onClick={reachOut} disabled={busy}>
                  {task === "message" ? "Sending..." : "Send"}
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => setPanel("reach")} disabled={busy}>
                  Reach out to your provider
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setConflict(false)} disabled={busy}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
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
            {panel === "cancel" ? (
              <label className="mt-4 grid gap-1 text-sm">
                Why are you cancelling?
                <textarea
                  required
                  maxLength={1000}
                  rows={3}
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  className="rounded-lg border bg-background px-3 py-2"
                />
              </label>
            ) : null}
            {modalError ? <p className="mt-3 text-sm text-destructive">{modalError}</p> : null}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" onClick={reschedule} disabled={busy}>
                {task === "move" ? "Looking for another time..." : "Reschedule"}
              </Button>
              {panel === "cancel" ? (
                <Button type="button" variant="destructive" onClick={cancel} disabled={busy}>
                  {task === "cancel" ? "Cancelling..." : "Confirm cancel"}
                </Button>
              ) : (
                <Button type="button" variant="destructive" onClick={() => setPanel("cancel")} disabled={busy}>
                  Cancel
                </Button>
              )}
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
