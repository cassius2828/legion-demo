import { redirect } from "next/navigation";

import { PatientHome } from "~/app/_components/patient-home";
import { ProviderHome } from "~/app/_components/provider-home";
import { auth } from "~/server/auth";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const session = await auth();
  if (session?.user && !session.user.role) redirect("/onboarding");

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Legion demo</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Sign up with Google to open the clinic charts.
        </p>
      </main>
    );
  }

  if (session.user.role === "patient") {
    return <PatientHome />;
  }

  const { provider } = await searchParams;
  return <ProviderHome selectedProviderId={provider} />;
}
