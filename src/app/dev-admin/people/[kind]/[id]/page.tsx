import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ClinicalHistory } from "~/app/_components/clinical-history";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  isDirectoryKind,
  patientChartProfile,
  providerProfile,
  unlinkedClinicianProfile,
  unlinkedPatientProfile,
} from "~/lib/admin-profile";
import { isDevAdmin } from "~/lib/admin";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function AdminPersonPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!isDevAdmin(session.user.email)) redirect("/");

  const { kind, id } = await params;
  if (!isDirectoryKind(kind)) notFound();

  const profile =
    kind === "patient"
      ? await patientProfile(id)
      : await clinicianProfile(id, kind);
  if (!profile) notFound();

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <p>
        <Link
          href="/dev-admin"
          className="text-primary text-sm hover:underline"
        >
          Back to Dev admin
        </Link>
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{profile.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            {profile.fields.map((field) => (
              <div key={field.label} className="grid gap-0.5">
                <dt className="text-muted-foreground text-xs">{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      {profile.history ? (
        <ClinicalHistory
          visits={profile.history.visits}
          medications={profile.history.medications}
        />
      ) : null}
    </main>
  );
}

async function patientProfile(id: string) {
  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      primaryProvider: true,
      user: true,
      visits: {
        where: { status: "completed" },
        orderBy: { visitDate: "desc" },
        include: { appointment: { select: { appointmentType: true } } },
      },
      medications: { orderBy: { startDate: "desc" } },
    },
  });
  if (patient) return patientChartProfile(patient);

  const user = await db.user.findUnique({ where: { id } });
  return unlinkedPatientProfile(user);
}

async function clinicianProfile(id: string, kind: "psychiatrist" | "nurse") {
  const provider = await db.provider.findUnique({
    where: { id },
    include: { organization: true, user: { include: { organization: true } } },
  });
  if (provider) return providerProfile(provider, kind);

  const user = await db.user.findUnique({
    where: { id },
    include: { organization: true },
  });
  return unlinkedClinicianProfile(user, kind);
}
