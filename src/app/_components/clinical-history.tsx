import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatDate } from "~/lib/chart";

type VisitSummary = {
  id: string;
  visitDate: Date;
  clinicalSummary: string;
  followUpInstructions: string;
  appointment: { appointmentType: string } | null;
};

type MedicationRow = {
  id: string;
  medicationName: string;
  dosage: string;
  route: string;
  frequency: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  notes: string | null;
};

export function ClinicalHistory({
  visits,
  medications,
}: {
  visits: VisitSummary[];
  medications: MedicationRow[];
}) {
  const current = medications.filter((medication) => medication.status === "active");
  const discontinued = medications.filter((medication) => medication.status !== "active");

  return (
    <div className="grid gap-4">
      <PastVisitNotes visits={visits} />
      <Card>
        <CardHeader>
          <CardTitle>Medications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <MedicationGroup title="Current" medications={current} empty="No current medications." />
          <MedicationGroup
            title="Discontinued"
            medications={discontinued}
            empty="No discontinued medications."
          />
        </CardContent>
      </Card>
    </div>
  );
}

export function PastVisitNotes({
  visits,
  panel = false,
}: {
  visits: VisitSummary[];
  panel?: boolean;
}) {
  return (
    <Card className={panel ? "lg:sticky lg:top-4" : undefined}>
      <CardHeader>
        <CardTitle>Past visits</CardTitle>
      </CardHeader>
      <CardContent className={panel ? "lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" : undefined}>
        <PastVisits visits={visits} expanded={panel} />
      </CardContent>
    </Card>
  );
}

function PastVisits({ visits, expanded = false }: { visits: VisitSummary[]; expanded?: boolean }) {
  if (visits.length === 0) {
    return <p className="text-muted-foreground">No past visits yet.</p>;
  }

  const recent = visits.slice(0, 3);
  const earlier = visits.slice(3);

  return (
    <div className="grid gap-5">
      <VisitList visits={recent} />
      {earlier.length > 0 ? (
        <>
          <details className={expanded ? "group border-t pt-4 lg:hidden" : "group border-t pt-4"}>
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span
                aria-hidden
                className="text-muted-foreground transition-transform group-open:rotate-90"
              >
                ▸
              </span>
              <span className="group-open:hidden">
                Show {earlier.length} earlier {earlier.length === 1 ? "visit" : "visits"}
              </span>
              <span className="hidden group-open:inline">Hide earlier visits</span>
            </summary>
            <div className="mt-4 max-h-64 overflow-y-auto pr-1">
              <VisitList visits={earlier} />
            </div>
          </details>
          {expanded ? (
            <div className="hidden border-t pt-4 lg:block">
              <VisitList visits={earlier} />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function VisitList({ visits }: { visits: VisitSummary[] }) {
  return (
    <ol className="grid gap-5">
      {visits.map((visit) => (
        <li key={visit.id} className="border-b pb-5 last:border-b-0 last:pb-0">
          <p className="text-sm font-medium">
            {formatDate(visit.visitDate)}
            {visit.appointment ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {visit.appointment.appointmentType}
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-sm leading-6">{visit.clinicalSummary}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{visit.followUpInstructions}</p>
        </li>
      ))}
    </ol>
  );
}

function MedicationGroup({
  title,
  medications,
  empty,
}: {
  title: string;
  medications: MedicationRow[];
  empty: string;
}) {
  return (
    <section>
      <h3 className="text-sm font-medium">{title}</h3>
      {medications.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {medications.map((medication) => (
            <li key={medication.id}>
              <p className="text-sm">
                <span className="font-medium">{medication.medicationName}</span> {medication.dosage}
                <span className="text-muted-foreground">
                  {" "}
                  · {medication.route} · {medication.frequency}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Started {formatDate(medication.startDate)}
                {medication.endDate ? ` · Stopped ${formatDate(medication.endDate)}` : null}
              </p>
              {medication.notes ? (
                <p className="mt-1 text-sm leading-6">{medication.notes}</p>
              ) : null}
              <Badge
                variant={medication.status === "active" ? "secondary" : "destructive"}
                className={
                  medication.status === "active"
                    ? "mt-2 border-transparent bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                    : "mt-2"
                }
              >
                {medication.status === "active" ? "Current" : "Discontinued"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
