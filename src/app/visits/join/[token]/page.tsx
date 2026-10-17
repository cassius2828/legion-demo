import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { providerLabel } from "~/lib/chart";
import { formatClinicWhen } from "~/lib/clinic-time";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function JoinVisitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");

  const { token } = await params;
  const appointment = await db.appointment.findUnique({
    where: { joinToken: token },
    include: {
      patient: { select: { userId: true, firstName: true } },
      provider: true,
    },
  });
  if (!appointment) notFound();

  if (
    session.user.role !== "patient" ||
    appointment.patient.userId !== session.user.id
  ) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Visit link</h1>
        <p className="text-muted-foreground mt-3">
          This link is for the patient on the appointment.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <p className="text-primary text-sm font-medium tracking-wide uppercase">
        Visit link
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {formatClinicWhen(appointment.scheduledAt)}
      </h1>
      <p className="text-muted-foreground mt-3">
        {providerLabel(appointment.provider)}
      </p>
      <p className="mt-4 text-sm leading-6">{appointment.reasonForVisit}</p>
      <p className="mt-4 text-sm leading-6">
        {appointment.patient.firstName}, you are in the right place for this
        visit. Stay on this page until {providerLabel(appointment.provider)}{" "}
        joins you.
      </p>
      <Link
        href="/"
        className="text-primary mt-6 inline-block text-sm font-medium"
      >
        Back to your care
      </Link>
    </main>
  );
}
