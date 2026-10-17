import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { IntakeForm } from "~/app/appointments/[id]/intake/intake-form";
import { formatClinicWhen } from "~/lib/clinic-time";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function IntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");
  if (session.user.role !== "patient") redirect("/");

  const { id } = await params;
  const patient = await db.patient.findUnique({
    where: { userId: session.user.id },
    select: { id: true, preferredPharmacyId: true },
  });
  if (!patient) notFound();

  const [appointment, pharmacies] = await Promise.all([
    db.appointment.findFirst({
      where: { id, patientId: patient.id, status: "scheduled" },
      include: { intake: true },
    }),
    db.pharmacy.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!appointment) notFound();

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        Back
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Intake</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {formatClinicWhen(appointment.scheduledAt)}.{" "}
        {appointment.reasonForVisit}
      </p>
      <div className="mt-6">
        <IntakeForm
          appointmentId={appointment.id}
          pharmacies={pharmacies}
          defaults={{
            phq9: appointment.intake?.phq9Score ?? 0,
            gad7: appointment.intake?.gad7Score ?? 0,
            safetyConcern: appointment.intake?.safetyConcern ?? false,
            safetyNote: appointment.intake?.safetyNote ?? "",
            medicationChanges: appointment.intake?.medicationChangesNote ?? "",
            pharmacyId:
              appointment.intake?.pharmacyId ??
              patient.preferredPharmacyId ??
              "",
          }}
        />
      </div>
    </main>
  );
}
