import Link from "next/link";

import { SendReminders } from "~/app/_components/send-reminders";
import { requestShare } from "~/app/transfers/actions";
import { Button } from "~/components/ui/button";
import { formatDate, fullName, providerLabel } from "~/lib/chart";
import { clinicDayBounds, formatClinicWhen } from "~/lib/clinic-time";
import { db } from "~/server/db";

export async function ProviderHome({ userId }: { userId: string }) {
  const provider = await db.provider.findUnique({
    where: { userId },
    include: {
      patients: {
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        include: {
          appointments: {
            where: { status: "completed" },
            orderBy: { scheduledAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  const bounds = clinicDayBounds();
  const scheduleWhere = provider
    ? { OR: [{ providerId: provider.id }, { nurseId: provider.id }] }
    : null;
  const today = scheduleWhere
    ? await db.appointment.findMany({
        where: {
          ...scheduleWhere,
          status: "scheduled",
          scheduledAt: { gte: bounds.start, lt: bounds.end },
        },
        orderBy: { scheduledAt: "asc" },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          intake: { select: { id: true } },
        },
      })
    : [];
  const upcoming =
    provider && today.length === 0 && scheduleWhere
      ? await db.appointment.findMany({
          where: {
            ...scheduleWhere,
            status: "scheduled",
            scheduledAt: { gte: new Date() },
          },
          orderBy: { scheduledAt: "asc" },
          take: 6,
          include: {
            patient: { select: { id: true, firstName: true, lastName: true } },
            intake: { select: { id: true } },
          },
        })
      : [];
  const others = provider
    ? await db.provider.findMany({
        where: { NOT: { id: provider.id } },
        orderBy: { lastName: "asc" },
      })
    : [];

  if (!provider) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-lg font-semibold">Your patients</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          No provider chart is linked to this account.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">
            {today.length > 0 ? "Today" : "Next visits"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {providerLabel(provider)}
          </p>
        </div>
        <SendReminders />
      </div>
      {(today.length > 0 ? today : upcoming).length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">
          No visits are scheduled.
        </p>
      ) : (
        <ul className="mt-4 divide-y border-y">
          {(today.length > 0 ? today : upcoming).map((appointment) => (
            <li
              key={appointment.id}
              className="grid gap-1 px-2 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div>
                <Link
                  href={`/visits/${appointment.id}`}
                  className="hover:text-primary font-medium"
                >
                  {formatClinicWhen(appointment.scheduledAt)} ·{" "}
                  {fullName(appointment.patient)}
                </Link>
                <p className="text-muted-foreground">
                  {appointment.reasonForVisit}
                  {" · "}
                  {appointment.intake ? "Intake done" : "Intake missing"}
                </p>
              </div>
              <Link
                href={`/patients/${appointment.patient.id}`}
                className="text-muted-foreground hover:text-primary"
              >
                Chart
              </Link>
            </li>
          ))}
        </ul>
      )}
      <h2 className="mt-8 text-lg font-semibold">Your patients</h2>
      {provider.patients.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-sm">
          No patients are on your panel.
        </p>
      ) : (
        <ul className="mt-4 divide-y border-y">
          {provider.patients.map((patient) => (
            <li
              key={patient.id}
              className="grid gap-2 px-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <Link
                href={`/patients/${patient.id}`}
                className="hover:text-primary flex items-baseline justify-between gap-3 text-sm"
              >
                <span>
                  {fullName(patient)}
                  {patient.appointments[0] ? (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      Last visit{" "}
                      {formatDate(patient.appointments[0].scheduledAt)} ·{" "}
                      {patient.appointments[0].appointmentType}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground">
                  {formatDate(patient.dateOfBirth)}
                </span>
              </Link>
              {others.length > 0 ? (
                <form action={requestShare} className="flex items-center gap-2">
                  <input type="hidden" name="patientId" value={patient.id} />
                  <select
                    name="toProviderId"
                    required
                    className="bg-background h-8 rounded-lg border px-2 text-sm"
                  >
                    <option value="">Transfer to</option>
                    {others.map((other) => (
                      <option key={other.id} value={other.id}>
                        {providerLabel(other)}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline">
                    Share
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
