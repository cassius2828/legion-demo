import { redirect } from "next/navigation";

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

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <Card>
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
    </main>
  );
}
