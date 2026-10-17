import Link from "next/link";
import { redirect } from "next/navigation";

import { MessageThread } from "~/app/messages/thread";
import { fullName } from "~/lib/chart";
import { viewerRecord } from "~/server/access";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");

  const viewer = await viewerRecord(session.user.id, session.user.role);
  if (viewer.patient) return <MessageThread patientId={viewer.patient.id} />;
  if (!viewer.provider) redirect("/");

  const patients = viewer.provider.patients;
  const latest = await db.clinicMessage.findMany({
    where: {
      providerId: viewer.provider.id,
      patientId: { in: patients.map((patient) => patient.id) },
    },
    orderBy: { createdAt: "desc" },
    select: { patientId: true, body: true, createdAt: true },
  });
  const preview = new Map<string, { body: string; createdAt: Date }>();
  for (const message of latest) {
    if (!preview.has(message.patientId)) preview.set(message.patientId, message);
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      <p className="mt-2 text-sm text-muted-foreground">Conversations with patients on your panel.</p>
      {patients.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No patients are on your panel.</p>
      ) : (
        <ul className="mt-6 divide-y border-y">
          {patients.map((patient) => {
            const note = preview.get(patient.id);
            return (
              <li key={patient.id}>
                <Link href={`/messages/${patient.id}`} className="block px-2 py-3 text-sm hover:text-primary">
                  <span className="font-medium">{fullName(patient)}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {note ? note.body : "No messages yet"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
