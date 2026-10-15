import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { ageInYears, fullName } from "~/lib/chart";
import { db } from "~/server/db";

export async function PatientHome({ userId }: { userId: string }) {
  const patient = await db.patient.findUnique({
    where: { userId },
    include: { primaryProvider: true },
  });

  if (!patient) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">Your chart</h1>
        <p className="mt-2 text-muted-foreground">No chart is linked to this account.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Your chart</h1>
      <p className="mt-2 text-muted-foreground">Only your record is available here.</p>
      <Link href={`/patients/${patient.id}`} className="mt-8 block">
        <Card className="transition hover:ring-primary/40">
          <CardHeader>
            <CardTitle className="text-lg">{fullName(patient)}</CardTitle>
            <CardDescription>{ageInYears(patient.dateOfBirth)} years</CardDescription>
            <p className="text-sm text-muted-foreground">{fullName(patient.primaryProvider)}</p>
          </CardHeader>
        </Card>
      </Link>
    </main>
  );
}
