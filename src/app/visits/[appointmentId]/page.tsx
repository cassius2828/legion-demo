import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  CloseVisitForm,
  NoteForm,
  PrescribeForm,
} from "~/app/visits/[appointmentId]/encounter-forms";
import { MedicationScanTable } from "~/app/_components/clinical-history";
import { pharmacyLabel, orderEventLabel } from "~/lib/care-loop-rules";
import { fullName, providerLabel } from "~/lib/chart";
import { formatClinicWhen } from "~/lib/clinic-time";
import { auth } from "~/server/auth";
import { openEncounter } from "~/server/care-loop";

export default async function EncounterPage({
  params,
}: {
  params: Promise<{ appointmentId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");
  if (session.user.role === "patient") redirect("/");

  const { appointmentId } = await params;
  const opened = await openEncounter(appointmentId);
  if (!opened.ok) notFound();

  const appointment = opened.appointment;
  const closed = appointment.status !== "scheduled";
  const note = appointment.visit?.notes.find(
    (item) => item.noteType === "progress",
  );
  const signed = note?.status === "signed";
  const summary = appointment.visit?.clinicalSummary ?? "";
  const followUp = appointment.visit?.followUpInstructions ?? "";
  const pharmacy =
    appointment.intake?.pharmacy ?? appointment.patient.preferredPharmacy;
  const active = appointment.patient.medications.filter(
    (medication) => medication.status === "active",
  );

  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-4 py-6 text-sm sm:px-6">
      <Link href="/" className="text-muted-foreground hover:text-foreground">
        Back
      </Link>
      <header>
        <h1 className="text-xl font-semibold">
          {fullName(appointment.patient)}
        </h1>
        <p className="text-muted-foreground mt-1">
          {formatClinicWhen(appointment.scheduledAt)} ·{" "}
          {appointment.appointmentType}
          {closed ? " · Closed" : null}
        </p>
        <p className="mt-2">{appointment.reasonForVisit}</p>
        <p className="text-muted-foreground mt-1">
          {providerLabel(appointment.provider)}
        </p>
      </header>

      <section
        className={
          appointment.patient.allergies.length > 0
            ? "border-destructive/40 bg-destructive/10 rounded-lg border px-3 py-2"
            : "text-muted-foreground rounded-lg border px-3 py-2"
        }
      >
        Allergies:{" "}
        {appointment.patient.allergies.length > 0
          ? appointment.patient.allergies
              .map((allergy) => allergy.substance)
              .join(", ")
          : "none recorded"}
      </section>

      <section className="rounded-lg border px-3 py-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Intake
        </h2>
        {appointment.intake ? (
          <div className="mt-2 grid gap-1 leading-6">
            <p>
              PHQ-9 {appointment.intake.phq9Score} · GAD-7{" "}
              {appointment.intake.gad7Score}
            </p>
            <p>
              {appointment.intake.safetyConcern
                ? `Safety concern: ${appointment.intake.safetyNote}`
                : "No safety concern reported."}
            </p>
            {appointment.intake.medicationChangesNote ? (
              <p>
                Medication changes: {appointment.intake.medicationChangesNote}
              </p>
            ) : null}
            <p>Pharmacy {pharmacyLabel(appointment.intake.pharmacy)}</p>
          </div>
        ) : (
          <p className="text-muted-foreground mt-2">
            Intake has not been completed.
          </p>
        )}
      </section>

      <section className="rounded-lg border px-3 py-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Active medications
        </h2>
        <div className="mt-2">
          <MedicationScanTable medications={active} />
        </div>
      </section>

      <section className="rounded-lg border px-3 py-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Note
        </h2>
        <div className="mt-3">
          {signed ? (
            <p className="text-muted-foreground mb-3">Signed.</p>
          ) : null}
          <NoteForm
            appointmentId={appointment.id}
            summary={summary}
            followUp={followUp}
            closed={closed}
          />
        </div>
      </section>

      <section className="rounded-lg border px-3 py-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Prescription
        </h2>
        <div className="mt-3">
          <PrescribeForm
            appointmentId={appointment.id}
            allergies={appointment.patient.allergies.map(
              (allergy) => allergy.substance,
            )}
            active={active.map((medication) => ({
              medicationName: medication.medicationName,
              genericName: medication.genericName,
              dosage: medication.dosage,
              route: medication.route,
              frequency: medication.frequency,
              source: "active" as const,
            }))}
            pharmacyLabel={pharmacy ? pharmacyLabel(pharmacy) : null}
            closed={closed}
          />
        </div>
        {appointment.orders.length > 0 ? (
          <ul className="mt-4 grid gap-3 border-t pt-3">
            {appointment.orders.map((order) => (
              <li key={order.id}>
                <p className="font-medium">
                  {order.medicationName} {order.dosage}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {order.status}
                  </span>
                </p>
                <p className="text-muted-foreground">{order.statusDetail}</p>
                <p className="text-muted-foreground">
                  {pharmacyLabel(order.pharmacy)}
                </p>
                <ol className="text-muted-foreground mt-1 grid gap-1">
                  {order.events
                    .filter((event) => event.type.startsWith("order."))
                    .map((event) => (
                      <li key={event.id}>
                        {orderEventLabel(event.type)} ·{" "}
                        {formatClinicWhen(event.createdAt)}
                      </li>
                    ))}
                </ol>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {closed ? <FollowUpResult events={appointment.events} /> : null}
      <CloseVisitForm
        appointmentId={appointment.id}
        signed={Boolean(signed)}
        closed={closed}
      />
      <Link
        href={`/patients/${appointment.patient.id}`}
        className="text-muted-foreground hover:text-foreground"
      >
        Open chart
      </Link>
    </main>
  );
}

function FollowUpResult({
  events,
}: {
  events: { id: string; type: string; payload: string }[];
}) {
  const booked = events.find((event) => event.type === "follow_up.booked");
  if (booked) {
    let when = "";
    try {
      const payload: unknown = JSON.parse(booked.payload);
      if (
        payload &&
        typeof payload === "object" &&
        "start" in payload &&
        typeof payload.start === "string"
      ) {
        when = formatClinicWhen(new Date(payload.start));
      }
    } catch {
      when = "";
    }
    return <p>Follow-up booked{when ? ` for ${when}` : ""}.</p>;
  }
  if (events.some((event) => event.type === "follow_up.task_created")) {
    return <p>Follow-up was not booked. A task is on the chart.</p>;
  }
  return null;
}
