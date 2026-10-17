import { notFound, redirect } from "next/navigation";

import { MessageComposer } from "~/app/messages/composer";
import { fullName } from "~/lib/chart";
import { canViewPatient, viewerRecord } from "~/server/access";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

const timeFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export async function MessageThread({ patientId }: { patientId: string }) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");

  const viewer = await viewerRecord(session.user.id, session.user.role);
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      primaryProviderId: true,
      primaryProvider: { select: { firstName: true, lastName: true, credentials: true } },
    },
  });
  if (!patient) notFound();
  const allowed = canViewPatient({
    role: session.user.role,
    ownPatientId: viewer.patient?.id ?? null,
    ownProviderId: viewer.provider?.id ?? null,
    patient,
  });
  if (!allowed) redirect("/");

  const messages = await db.clinicMessage.findMany({
    where: { patientId: patient.id, providerId: patient.primaryProviderId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } } },
  });
  const providerName = `${patient.primaryProvider.firstName} ${patient.primaryProvider.lastName}`;

  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fullName(patient)} and {providerName}
        </p>
      </div>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      ) : (
        <ul className="grid gap-3">
          {messages.map((message) => (
            <li key={message.id} className="rounded-lg border px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {message.author.name ?? "Clinic"} · {timeFormat.format(message.createdAt)}
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{message.body}</p>
            </li>
          ))}
        </ul>
      )}
      <MessageComposer patientId={session.user.role === "patient" ? undefined : patient.id} />
    </main>
  );
}
