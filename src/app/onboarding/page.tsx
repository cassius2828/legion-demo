import { redirect } from "next/navigation";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

const ROLES = [
  { id: "psychiatrist", label: "Psychiatrist" },
  { id: "patient", label: "Patient" },
  { id: "nurse", label: "Nurse" },
] as const;

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role) redirect("/");

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Finish sign up</CardTitle>
          <CardDescription>
            Choose the role for {session.user.name ?? session.user.email}. You can sign in with this Google account next time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveRole}>
            <fieldset className="grid gap-2">
              <legend className="sr-only">Role</legend>
              {ROLES.map((role) => (
                <label
                  key={role.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 has-checked:border-primary has-checked:bg-accent"
                >
                  <input type="radio" name="role" value={role.id} required className="size-4 accent-primary" />
                  <span>{role.label}</span>
                </label>
              ))}
            </fieldset>
            <Button type="submit" className="mt-6 w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

async function saveRole(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/");

  const role = formData.get("role");
  if (role !== "psychiatrist" && role !== "patient" && role !== "nurse") {
    redirect("/onboarding");
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { role },
  });
  redirect("/");
}
