import { redirect } from "next/navigation";

import { ProfileForm } from "~/app/_components/profile-form";
import { saveSignup } from "~/app/profile/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role) redirect("/");

  const organizations = await db.organization.findMany({
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Finish sign up</CardTitle>
          <CardDescription>
            Add your name and email, then choose how you will use the clinic.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            action={saveSignup}
            mode="signup"
            defaults={{
              name: session.user.name ?? "",
              email: session.user.email ?? "",
              role: null,
              primaryInsurance: "",
              secondaryInsurance: "",
              organization: "",
            }}
            organizations={organizations.map((item) => item.name)}
          />
        </CardContent>
      </Card>
    </main>
  );
}
