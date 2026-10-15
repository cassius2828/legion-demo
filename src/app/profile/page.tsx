import { redirect } from "next/navigation";

import { ClinicalHistory } from "~/app/_components/clinical-history";
import { ProfileForm } from "~/app/_components/profile-form";
import { saveProfile } from "~/app/profile/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { isRole, roleLabel } from "~/lib/profile";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user?.role || !isRole(user.role)) redirect("/onboarding");

  const chart =
    user.role === "patient"
      ? await db.patient.findUnique({
          where: { userId: user.id },
          include: {
            visits: {
              where: { status: "completed" },
              orderBy: { visitDate: "desc" },
              include: { appointment: { select: { appointmentType: true } } },
            },
            medications: { orderBy: { startDate: "desc" } },
          },
        })
      : null;

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-10">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Profile</CardTitle>
          <CardDescription>
            {roleLabel(user.role)}. Update the details you use to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            action={saveProfile}
            mode="edit"
            defaults={{
              name: user.name ?? "",
              email: user.email ?? "",
              role: user.role,
              primaryInsurance: user.primaryInsurance ?? "",
              secondaryInsurance: user.secondaryInsurance ?? "",
              organization: user.organization ?? "",
            }}
          />
        </CardContent>
      </Card>
      {chart ? <ClinicalHistory visits={chart.visits} medications={chart.medications} /> : null}
    </main>
  );
}
