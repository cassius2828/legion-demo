import Link from "next/link";

import { requestShare } from "~/app/transfers/actions";
import { Button } from "~/components/ui/button";
import { formatDate, fullName, providerLabel } from "~/lib/chart";
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
        <p className="mt-2 text-sm text-muted-foreground">
          No provider chart is linked to this account.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-lg font-semibold">Your patients</h1>
      <p className="mt-1 text-sm text-muted-foreground">{providerLabel(provider)}</p>
      {provider.patients.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No patients are on your panel.</p>
      ) : (
        <ul className="mt-4 divide-y border-y">
          {provider.patients.map((patient) => (
            <li key={patient.id} className="grid gap-2 px-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <Link href={`/patients/${patient.id}`} className="flex items-baseline justify-between gap-3 text-sm hover:text-primary">
                <span>
                  {fullName(patient)}
                  {patient.appointments[0] ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Last visit {formatDate(patient.appointments[0].scheduledAt)} · {patient.appointments[0].appointmentType}
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground">{formatDate(patient.dateOfBirth)}</span>
              </Link>
              {others.length > 0 ? (
                <form action={requestShare} className="flex items-center gap-2">
                  <input type="hidden" name="patientId" value={patient.id} />
                  <select name="toProviderId" required className="h-8 rounded-lg border bg-background px-2 text-sm">
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
