import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { ageInYears, fullName } from "~/lib/chart";
import { db } from "~/server/db";

export async function PatientHome() {
  const patients = await db.patient.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { primaryProvider: true },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Charts</h1>
      <p className="mt-2 text-muted-foreground">
        Open a chart to review history, allergies, and emergency contact.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {patients.map((patient) => (
          <Link key={patient.id} href={`/patients/${patient.id}`} className="block">
            <Card className="h-full transition hover:ring-primary/40">
              <CardHeader>
                <CardTitle className="text-lg">{fullName(patient)}</CardTitle>
                <CardDescription>
                  {ageInYears(patient.dateOfBirth)} years
                </CardDescription>
                <p className="text-sm text-muted-foreground">
                  {fullName(patient.primaryProvider)}
                </p>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
