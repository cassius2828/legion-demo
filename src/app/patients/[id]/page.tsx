import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import {
  ClinicalHistory,
  MedicationScanTable,
  PastVisitNotes,
} from "~/app/_components/clinical-history";
import { SummaryPanel } from "~/app/patients/[id]/summary-panel";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { ageInYears, formatDate, fullName, providerLabel } from "~/lib/chart";
import { formatClinicWhen } from "~/lib/clinic-time";
import type { SavedPatientSummary } from "~/lib/patient-summary";
import { canViewPatient, viewerRecord } from "~/server/access";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { loadSavedSummary } from "~/server/chart-version";
import type { Prisma } from "../../../../generated/prisma";

export const maxDuration = 60;

const chartInclude = {
  primaryProvider: true,
  allergies: { orderBy: { substance: "asc" } },
  conditions: { orderBy: { description: "asc" } },
  emergencyContact: true,
  visits: {
    where: { status: "completed" },
    orderBy: { visitDate: "desc" },
    include: { appointment: { select: { appointmentType: true } } },
  },
  medications: { orderBy: { startDate: "desc" } },
  appointments: {
    where: { status: "scheduled" },
    orderBy: { scheduledAt: "asc" },
  },
  tasks: {
    where: { status: "open" },
    orderBy: { dueDate: "asc" },
    include: {
      assignedProvider: {
        select: { firstName: true, lastName: true, credentials: true },
      },
    },
  },
} satisfies Prisma.PatientInclude;

type Chart = Prisma.PatientGetPayload<{ include: typeof chartInclude }>;

export default async function PatientChartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");

  const { id } = await params;
  const viewer = await viewerRecord(session.user.id, session.user.role);
  const patient = await db.patient.findUnique({
    where: { id },
    include: chartInclude,
  });
  if (!patient) notFound();
  const allowed = canViewPatient({
    role: session.user.role,
    ownPatientId: viewer.patient?.id ?? null,
    ownProviderId: viewer.provider?.id ?? null,
    patient,
  });
  if (!allowed) notFound();

  if (session.user.role === "patient") {
    return <SleekChart patient={patient} />;
  }

  const saved = await loadSavedSummary(patient.id);
  return <PlainChart patient={patient} saved={saved} />;
}

function PlainChart({
  patient,
  saved,
}: {
  patient: Chart;
  saved: SavedPatientSummary | null;
}) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 text-sm sm:px-6">
      <Link href="/" className="text-muted-foreground hover:text-foreground">
        Back
      </Link>
      <header className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div>
          <h1 className="text-xl font-semibold">{fullName(patient)}</h1>
          <p className="text-muted-foreground mt-1">
            {ageInYears(patient.dateOfBirth)} years · Born{" "}
            {formatDate(patient.dateOfBirth)}
          </p>
        </div>
        <p className="text-muted-foreground">
          {patient.phone} · {patient.email}
          <span className="mt-1 block">
            {fullName(patient.primaryProvider)},{" "}
            {patient.primaryProvider.credentials}
          </span>
        </p>
      </header>
      <ChartGlance patient={patient} />
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-[16rem_minmax(0,1.25fr)_minmax(18rem,0.9fr)]">
        <div className="min-w-0 xl:col-start-2">
          <SummaryPanel patientId={patient.id} saved={saved} />
        </div>
        <div className="min-w-0 xl:col-start-3">
          <PastVisitNotes visits={patient.visits} panel />
        </div>
        <aside className="grid content-start gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-4 xl:col-span-1 xl:col-start-1 xl:row-start-1 xl:grid-cols-1">
          <ChartFacts patient={patient} />
        </aside>
      </div>
    </main>
  );
}

function ChartGlance({ patient }: { patient: Chart }) {
  const nextVisit = patient.appointments.find(
    (appointment) => appointment.scheduledAt.getTime() >= Date.now(),
  );
  const lastVisit = patient.visits[0];

  return (
    <section className="mt-5 grid gap-3">
      <div
        className={
          patient.allergies.length > 0
            ? "border-destructive/40 bg-destructive/10 rounded-lg border px-3 py-2"
            : "text-muted-foreground rounded-lg border px-3 py-2"
        }
      >
        Allergies:{" "}
        {patient.allergies.length > 0
          ? patient.allergies.map((allergy) => allergy.substance).join(", ")
          : "none recorded"}
      </div>
      <div className="rounded-lg border px-3 py-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Medications
        </h2>
        <div className="mt-2">
          <MedicationScanTable medications={patient.medications} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border px-3 py-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Next visit
          </h2>
          {nextVisit ? (
            <p className="mt-2 leading-6">
              {formatClinicWhen(nextVisit.scheduledAt)} ·{" "}
              {nextVisit.appointmentType}
              <span className="mt-1 block">{nextVisit.reasonForVisit}</span>
              <Link
                href={`/visits/${nextVisit.id}`}
                className="text-primary mt-2 inline-block font-medium"
              >
                Open visit
              </Link>
            </p>
          ) : (
            <p className="text-muted-foreground mt-2">No visit scheduled.</p>
          )}
        </div>
        <div className="rounded-lg border px-3 py-3">
          <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Last plan
          </h2>
          {lastVisit ? (
            <p className="mt-2 leading-6">
              {formatDate(lastVisit.visitDate)} ·{" "}
              {lastVisit.followUpInstructions}
            </p>
          ) : (
            <p className="text-muted-foreground mt-2">
              No completed visit yet.
            </p>
          )}
        </div>
      </div>
      <div className="rounded-lg border px-3 py-3">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Open tasks
        </h2>
        {patient.tasks.length === 0 ? (
          <p className="text-muted-foreground mt-2">No open tasks.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {patient.tasks.map((task) => (
              <li key={task.id} className="leading-6">
                {task.title}
                <span className="text-muted-foreground">
                  {" "}
                  · due {formatDate(task.dueDate)} ·{" "}
                  {providerLabel(task.assignedProvider)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ChartFacts({ patient }: { patient: Chart }) {
  return (
    <>
      <FactCard title="Psychiatric history">
        <p className="leading-6">{patient.psychiatricHistory}</p>
      </FactCard>
      <FactCard title="Conditions">
        {patient.conditions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {patient.conditions.map((condition) => (
              <Badge key={condition.id} variant="secondary">
                {condition.description}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">None recorded</p>
        )}
      </FactCard>
      <FactCard title="Allergies">
        {patient.allergies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {patient.allergies.map((allergy) => (
              <Badge key={allergy.id}>{allergy.substance}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">None recorded</p>
        )}
      </FactCard>
      <FactCard title="Emergency contact">
        {patient.emergencyContact ? (
          <p className="leading-6">
            {patient.emergencyContact.name}
            <span className="text-muted-foreground">
              {" "}
              · {patient.emergencyContact.relationship} ·{" "}
              {patient.emergencyContact.phone}
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">None recorded</p>
        )}
      </FactCard>
    </>
  );
}

function FactCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SleekChart({ patient }: { patient: Chart }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        All charts
      </Link>
      <header className="mt-6">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">
          Chart
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          {fullName(patient)}
        </h1>
        <p className="text-muted-foreground mt-3 text-lg">
          {ageInYears(patient.dateOfBirth)} years · Born{" "}
          {formatDate(patient.dateOfBirth)}
        </p>
        <p className="text-muted-foreground mt-1">
          {patient.phone} · {patient.email}
        </p>
        <p className="mt-4 text-sm">
          Provider {fullName(patient.primaryProvider)},{" "}
          {patient.primaryProvider.credentials}
        </p>
      </header>
      <Separator className="my-8" />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Psychiatric history</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-7">{patient.psychiatricHistory}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conditions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {patient.conditions.length > 0 ? (
              patient.conditions.map((condition) => (
                <Badge key={condition.id} variant="secondary">
                  {condition.description}
                </Badge>
              ))
            ) : (
              <p className="text-muted-foreground">None recorded</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Allergies</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {patient.allergies.length > 0 ? (
              patient.allergies.map((allergy) => (
                <Badge key={allergy.id}>{allergy.substance}</Badge>
              ))
            ) : (
              <p className="text-muted-foreground">None recorded</p>
            )}
          </CardContent>
        </Card>
        <ClinicalHistory
          visits={patient.visits}
          medications={patient.medications}
        />
        <Card>
          <CardHeader>
            <CardTitle>Emergency contact</CardTitle>
          </CardHeader>
          <CardContent>
            {patient.emergencyContact ? (
              <p className="text-base leading-7">
                {patient.emergencyContact.name}
                <span className="text-muted-foreground">
                  {" "}
                  · {patient.emergencyContact.relationship} ·{" "}
                  {patient.emergencyContact.phone}
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground">None recorded</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
