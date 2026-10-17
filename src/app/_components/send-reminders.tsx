"use client";

import { useState, useTransition } from "react";

import { sendDueReminders } from "~/app/reminders/actions";
import { Button } from "~/components/ui/button";

export function SendReminders() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setMessage(null);
    startTransition(async () => {
      const result = await sendDueReminders();
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(
        result.sent === 0
          ? "No reminders are due."
          : `Sent ${result.sent} reminder${result.sent === 1 ? "" : "s"}.`,
      );
    });
  }

  return (
    <div className="grid justify-items-start gap-1">
      <Button type="button" variant="outline" onClick={send} disabled={pending}>
        {pending ? "Sending..." : "Send due reminders"}
      </Button>
      {message ? (
        <p className="text-muted-foreground text-xs">{message}</p>
      ) : null}
    </div>
  );
}
