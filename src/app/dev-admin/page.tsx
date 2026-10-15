import { redirect } from "next/navigation";

import { AdminDirectory, type DirectoryPerson } from "~/app/dev-admin/directory";
import { fullName, providerLabel } from "~/lib/chart";
import { isDevAdmin } from "~/lib/admin";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function DevAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isDevAdmin(session.user.email)) redirect("/");

  const [users, clinicians, patients, organizations] = await Promise.all([
    db.user.findMany({
      orderBy: { email: "asc" },
      include: { organization: true },
    }),
    db.provider.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { organization: true, user: { include: { organization: true } } },
    }),
    db.patient.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { primaryProvider: true, user: true },
    }),
    db.organization.findMany({ orderBy: { name: "asc" } }),
  ]);

  const seenUsers = new Set<string>();
  const people: DirectoryPerson[] = [];

  for (const clinician of clinicians) {
    if (clinician.userId) seenUsers.add(clinician.userId);
    const role = clinician.user?.role;
    const kind = role === "nurse" || clinician.credentials === "PMHNP" ? "nurse" : "psychiatrist";
    people.push({
      id: clinician.id,
      kind,
      name: fullName(clinician),
      email: clinician.user?.email ?? clinician.email,
      organization: clinician.organization?.name ?? clinician.user?.organization?.name ?? null,
      clinician: null,
      note: `${clinician.credentials} · ${clinician.specialty}`,
    });
  }

  for (const patient of patients) {
    if (patient.userId) seenUsers.add(patient.userId);
    const insurance = [patient.user?.primaryInsurance, patient.user?.secondaryInsurance]
      .filter((value): value is string => Boolean(value))
      .join(" · ");
    people.push({
      id: patient.id,
      kind: "patient",
      name: fullName(patient),
      email: patient.user?.email ?? patient.email,
      organization: null,
      clinician: providerLabel(patient.primaryProvider),
      note: insurance || null,
    });
  }

  for (const user of users) {
    if (seenUsers.has(user.id)) continue;
    if (user.role !== "psychiatrist" && user.role !== "nurse" && user.role !== "patient") continue;
    const insurance = [user.primaryInsurance, user.secondaryInsurance]
      .filter((value): value is string => Boolean(value))
      .join(" · ");
    people.push({
      id: user.id,
      kind: user.role,
      name: user.name ?? "No name",
      email: user.email ?? "No email",
      organization: user.organization?.name ?? null,
      clinician: null,
      note: user.role === "patient" ? insurance || null : null,
    });
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dev admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Logins, clinicians, and the organizations they belong to.
      </p>
      <AdminDirectory
        people={people}
        providers={organizations.map((organization) => ({
          id: organization.id,
          name: organization.name,
        }))}
      />
    </main>
  );
}
