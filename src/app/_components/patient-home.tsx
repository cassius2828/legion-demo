import Link from "next/link";

import { pharmacyLabel, orderEventLabel } from "~/lib/care-loop-rules";
import { fullName, providerLabel } from "~/lib/chart";
import { formatClinicWhen } from "~/lib/clinic-time";
import { db } from "~/server/db";

export async function PatientHome({ userId }: { userId: string }) {
  const patient = await db.patient.findUnique({
    where: { userId },
    include: {
      primaryProvider: true,
      preferredPharmacy: true,
      appointments: {
        where: { status: "scheduled" },
        orderBy: { scheduledAt: "asc" },
        include: { intake: true, provider: true },
      },
      orders: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: {
          pharmacy: true,
          events: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!patient) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Your care</h1>
        <p className="text-muted-foreground mt-2">
          No chart is linked to this account.
        </p>
      </main>
    );
  }

  const upcoming = patient.appointments.find(
    (appointment) => appointment.scheduledAt.getTime() >= Date.now(),
  );
  const order = patient.orders[0];
  const receipt =
    order?.events.filter((event) => event.type.startsWith("order.")) ?? [];

  return (
    <main className="mx-auto grid max-w-xl gap-4 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your care</h1>
        <p className="text-muted-foreground mt-2">
          {providerLabel(patient.primaryProvider)}
        </p>
      </div>

      <section className="rounded-xl border px-4 py-4">
        <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Next visit
        </h2>
        {upcoming ? (
          <div className="mt-2 grid gap-2 text-sm">
            <p className="text-base font-medium">
              {formatClinicWhen(upcoming.scheduledAt)}
            </p>
            <p>{upcoming.reasonForVisit}</p>
            <p className="text-muted-foreground">
              {providerLabel(upcoming.provider)}
            </p>
            <p>
              {upcoming.intake ? "Intake is done." : "Intake is still due."}
            </p>
            <div className="flex flex-wrap gap-3">
              {upcoming.intake ? null : (
                <Link
                  href={`/appointments/${upcoming.id}/intake`}
                  className="text-primary font-medium"
                >
                  Complete intake
                </Link>
              )}
              {upcoming.joinToken ? (
                <Link
                  href={`/visits/join/${upcoming.joinToken}`}
                  className="text-primary font-medium"
                >
                  Visit link
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-2 grid gap-2 text-sm">
            <p className="text-muted-foreground">No visit is scheduled.</p>
            <Link
              href="/appointments/book"
              className="text-primary font-medium"
            >
              Request an appointment
            </Link>
          </div>
        )}
      </section>

      <section className="rounded-xl border px-4 py-4">
        <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Pharmacy
        </h2>
        <p className="mt-2 text-sm">
          {patient.preferredPharmacy
            ? pharmacyLabel(patient.preferredPharmacy)
            : "No pharmacy selected yet."}
        </p>
      </section>

      <section className="rounded-xl border px-4 py-4">
        <h2 className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Latest prescription
        </h2>
        {order ? (
          <div className="mt-2 grid gap-2 text-sm">
            <p className="font-medium">
              {order.medicationName} {order.dosage}
              <span className="text-muted-foreground font-normal">
                {" "}
                · {order.status}
              </span>
            </p>
            <p>{pharmacyLabel(order.pharmacy)}</p>
            <p className="text-muted-foreground">{order.statusDetail}</p>
            {receipt.length > 0 ? (
              <ol className="text-muted-foreground grid gap-1">
                {receipt.map((event) => (
                  <li key={event.id}>
                    {orderEventLabel(event.type)} ·{" "}
                    {formatClinicWhen(event.createdAt)}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            No prescription has been sent.
          </p>
        )}
      </section>

      <div className="flex gap-4 text-sm">
        <Link
          href={`/patients/${patient.id}`}
          className="text-primary font-medium"
        >
          {fullName(patient)}&apos;s chart
        </Link>
        <Link href="/messages" className="text-primary font-medium">
          Messages
        </Link>
      </div>
    </main>
  );
}
