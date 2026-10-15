import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { ageInYears, formatDate, fullName } from "~/lib/chart";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import type { Prisma } from "../../../../generated/prisma";

const chartInclude = {
  primaryProvider: true,
  allergies: { orderBy: { substance: "asc" } },
  conditions: { orderBy: { description: "asc" } },
  emergencyContact: true,
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
  const patient = await db.patient.findUnique({
    where: { id },
    include: chartInclude,
  });
  if (!patient) notFound();

  if (session.user.role === "patient") {
    return <SleekChart patient={patient} />;
  }

  return <PlainChart patient={patient} />;
}

function PlainChart({ patient }: { patient: Chart }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-sm sm:px-6">
      <Link href="/" className="text-muted-foreground hover:text-foreground">
        Back
      </Link>
      <h1 className="mt-3 text-base font-semibold">{fullName(patient)}</h1>
      <dl className="mt-4 grid gap-3">
        <Row label="Date of birth" value={formatDate(patient.dateOfBirth)} />
        <Row label="Phone" value={patient.phone} />
        <Row label="Email" value={patient.email} />
        <Row
          label="Provider"
          value={`${fullName(patient.primaryProvider)}, ${patient.primaryProvider.credentials}`}
        />
        <Row label="Psychiatric history" value={patient.psychiatricHistory} />
        <Row
          label="Conditions"
          value={
            patient.conditions.map((condition) => condition.description).join(", ") ||
            "None recorded"
          }
        />
        <Row
          label="Allergies"
          value={
            patient.allergies.map((allergy) => allergy.substance).join(", ") ||
            "None recorded"
          }
        />
        <Row
          label="Emergency contact"
          value={
            patient.emergencyContact
              ? `${patient.emergencyContact.name} (${patient.emergencyContact.relationship}) ${patient.emergencyContact.phone}`
              : "None recorded"
          }
        />
      </dl>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b py-2 sm:grid-cols-[11rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SleekChart({ patient }: { patient: Chart }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        All charts
      </Link>
      <header className="mt-6">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          Chart
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          {fullName(patient)}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {ageInYears(patient.dateOfBirth)} years · Born {formatDate(patient.dateOfBirth)}
        </p>
        <p className="mt-1 text-muted-foreground">
          {patient.phone} · {patient.email}
        </p>
        <p className="mt-4 text-sm">
          Provider {fullName(patient.primaryProvider)}, {patient.primaryProvider.credentials}
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
                  · {patient.emergencyContact.relationship} · {patient.emergencyContact.phone}
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
