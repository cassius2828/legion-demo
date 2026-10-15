import { redirect } from "next/navigation";

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
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] px-4 text-white">
      <form action={saveRole} className="w-full max-w-md rounded-2xl bg-white/10 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Finish sign up</h1>
        <p className="mt-2 text-sm text-white/70">
          Choose the role for {session.user.name ?? session.user.email}. You can sign in with this Google account next time.
        </p>
        <fieldset className="mt-6 grid gap-2">
          <legend className="sr-only">Role</legend>
          {ROLES.map((role) => (
            <label
              key={role.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10 has-checked:bg-white/15"
            >
              <input type="radio" name="role" value={role.id} required className="size-4" />
              <span>{role.label}</span>
            </label>
          ))}
        </fieldset>
        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-white px-4 py-2 text-sm font-medium text-[#15162c] hover:bg-white/90"
        >
          Continue
        </button>
      </form>
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
