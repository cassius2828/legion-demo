import Link from "next/link";

import { formatDate, fullName, providerLabel } from "~/lib/chart";
import { db } from "~/server/db";

export async function ProviderHome({
  selectedProviderId,
}: {
  selectedProviderId?: string;
}) {
  const providers = await db.provider.findMany({
    orderBy: { lastName: "asc" },
    include: {
      patients: { orderBy: [{ lastName: "asc" }, { firstName: "asc" }] },
    },
  });
  const selected =
    providers.find((provider) => provider.id === selectedProviderId) ??
    providers[0];

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-lg font-semibold">Providers</h1>
      <ul className="mt-3 divide-y border-y">
        {providers.map((provider) => {
          const active = provider.id === selected?.id;
          return (
            <li key={provider.id}>
              <Link
                href={`/?provider=${provider.id}`}
                className={`flex items-baseline justify-between px-2 py-2 text-sm hover:bg-muted ${active ? "font-medium text-primary" : ""}`}
                aria-current={active ? "true" : undefined}
              >
                <span>{fullName(provider)}</span>
                <span className="text-muted-foreground">{provider.credentials}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {selected ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium">{providerLabel(selected)}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {selected.patients.length} patients
          </p>
          <ul className="mt-2 divide-y border-y">
            {selected.patients.map((patient) => (
              <li key={patient.id}>
                <Link
                  href={`/patients/${patient.id}`}
                  className="flex items-baseline justify-between px-2 py-2 text-sm hover:bg-muted"
                >
                  <span>{fullName(patient)}</span>
                  <span className="text-muted-foreground">
                    {formatDate(patient.dateOfBirth)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
