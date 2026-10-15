import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { PatientHome } from "~/app/_components/patient-home";
import { ProviderHome } from "~/app/_components/provider-home";
import { Button } from "~/components/ui/button";
import { auth, signIn } from "~/server/auth";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user && !session.user.role) redirect("/onboarding");

  if (!session?.user) {
    const { error } = await searchParams;
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Legion demo</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Sign in with Google, or with your email. The dev password is 123.
        </p>
        <form action={signInWithPassword} className="mt-6 grid max-w-sm gap-3">
          <label className="grid gap-1 text-sm">
            Email
            <input name="email" type="email" required className="h-9 rounded-lg border bg-background px-3" />
          </label>
          <label className="grid gap-1 text-sm">
            Password
            <input name="password" type="password" required className="h-9 rounded-lg border bg-background px-3" />
          </label>
          {error === "credentials" ? (
            <p className="text-sm text-destructive">That email and password did not match.</p>
          ) : null}
          <Button type="submit">Sign in</Button>
        </form>
      </main>
    );
  }

  if (session.user.role === "patient") {
    return <PatientHome userId={session.user.id} />;
  }

  return <ProviderHome userId={session.user.id} />;
}

async function signInWithPassword(formData: FormData) {
  "use server";

  const email = formData.get("email");
  const password = formData.get("password");
  try {
    await signIn("credentials", {
      email: typeof email === "string" ? email : "",
      password: typeof password === "string" ? password : "",
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) redirect("/?error=credentials");
    throw error;
  }
}
