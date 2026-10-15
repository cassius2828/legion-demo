import { redirect } from "next/navigation";

import { fullName } from "~/lib/chart";
import { isDevAdmin } from "~/lib/admin";
import { roleLabel } from "~/lib/profile";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function DevAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isDevAdmin(session.user.email)) redirect("/");

  const [users, providers, patients] = await Promise.all([
    db.user.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }] }),
    db.provider.findMany({
      orderBy: { lastName: "asc" },
      include: { user: { select: { email: true } } },
    }),
    db.patient.findMany({
      orderBy: { lastName: "asc" },
      include: { primaryProvider: true },
    }),
  ]);

  const groups = [
    { id: "psychiatrist", title: "Psychiatrists" },
    { id: "nurse", title: "Nurses" },
    { id: "patient", title: "Patients" },
    { id: "", title: "No role yet" },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dev admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every login and clinical record in this demo.
      </p>

      {groups.map((group) => {
        const rows = users.filter((user) => (user.role ?? "") === group.id);
        if (rows.length === 0) return null;
        return (
          <section key={group.id || "none"} className="mt-8">
            <h2 className="text-sm font-semibold">{group.title}</h2>
            <ul className="mt-2 divide-y border-y">
              {rows.map((user) => (
                <li key={user.id} className="px-2 py-3 text-sm">
                  <p className="font-medium">{user.name ?? "No name"}</p>
                  <p>{user.email ?? "No email"}</p>
                  {user.role === "patient" ? (
                    <p className="text-muted-foreground">
                      {user.primaryInsurance ?? "No primary insurance"}
                      {user.secondaryInsurance ? ` · ${user.secondaryInsurance}` : ""}
                    </p>
                  ) : null}
                  {user.role === "psychiatrist" || user.role === "nurse" ? (
                    <p className="text-muted-foreground">{user.organization ?? "No organization"}</p>
                  ) : null}
                  <p className="text-muted-foreground">{user.role ? roleLabel(user.role) : "Unset"}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Clinical providers</h2>
        <ul className="mt-2 divide-y border-y">
          {providers.map((provider) => (
            <li key={provider.id} className="px-2 py-3 text-sm">
              <p className="font-medium">{fullName(provider)}</p>
              <p>{provider.email}</p>
              <p className="text-muted-foreground">
                Login {provider.user?.email ?? "not linked"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold">Clinical patients</h2>
        <ul className="mt-2 divide-y border-y">
          {patients.map((patient) => (
            <li key={patient.id} className="px-2 py-3 text-sm">
              <p className="font-medium">{fullName(patient)}</p>
              <p>{patient.email}</p>
              <p className="text-muted-foreground">{fullName(patient.primaryProvider)}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
