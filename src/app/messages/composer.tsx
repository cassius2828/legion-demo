"use client";

import { useState, useTransition } from "react";

import { sendClinicMessage } from "~/app/messages/actions";
import { Button } from "~/components/ui/button";

export function MessageComposer({ patientId }: { patientId?: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await sendClinicMessage({ body, patientId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
    });
  }

  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm">
        Message
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={1000}
          rows={3}
          className="rounded-lg border bg-background px-3 py-2"
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" onClick={send} disabled={pending || body.trim().length === 0}>
        {pending ? "Sending..." : "Send"}
      </Button>
    </div>
  );
}
