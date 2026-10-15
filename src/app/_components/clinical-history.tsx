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
      <Card>
        <CardHeader>
          <CardTitle>Past visits</CardTitle>
        </CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <p className="text-muted-foreground">No past visits yet.</p>
          ) : (
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
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {visit.followUpInstructions}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
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
              <Badge variant={medication.status === "active" ? "secondary" : "outline"} className="mt-2">
                {medication.status === "active" ? "Current" : "Discontinued"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
