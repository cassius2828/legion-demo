import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { ageFromDate } from "~/lib/dates";
import { db } from "~/server/db";

export async function PatientDirectory() {
  const patients = await db.patient.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { primaryProvider: true },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight">Charts</h1>
        <p className="mt-2 text-muted-foreground">
          The clinic’s patient charts. Open one to see the history, allergies, and emergency contact.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {patients.map((patient) => (
          <Link key={patient.id} href={`/patients/${patient.id}`} className="block">
            <Card className="h-full transition-shadow hover:ring-primary/30">
              <CardHeader>
                <CardTitle className="text-lg">
                  {patient.firstName} {patient.lastName}
                </CardTitle>
                <CardDescription>
                  {ageFromDate(patient.dateOfBirth)} years old
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {patient.primaryProvider.firstName}{" "}
                  {patient.primaryProvider.lastName},{" "}
                  {patient.primaryProvider.credentials}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
