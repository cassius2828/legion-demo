import { redirect } from "next/navigation";

import { acceptShare } from "~/app/transfers/actions";
import { Button } from "~/components/ui/button";
import { fullName } from "~/lib/chart";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function TransfersPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");

  const provider = await db.provider.findUnique({ where: { userId: session.user.id } });
  if (!provider) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-lg font-semibold">Transfers</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No provider chart is linked to this account.
        </p>
      </main>
    );
  }

  const requests = await db.shareRequest.findMany({
    where: {
      OR: [{ fromProviderId: provider.id }, { toProviderId: provider.id }],
    },
    include: { patient: true, fromProvider: true, toProvider: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-lg font-semibold">Transfers</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Requests to share a patient with another provider.
      </p>
      {requests.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No transfer requests.</p>
      ) : (
        <ul className="mt-4 divide-y border-y">
          {requests.map((request) => {
            const incoming = request.toProviderId === provider.id;
            return (
              <li key={request.id} className="flex items-center justify-between gap-3 px-2 py-3 text-sm">
                <div className="flex items-start gap-2">
                  <ShareIcon />
                  <div>
                    <p>{fullName(request.patient)}</p>
                    <p className="text-muted-foreground">
                      {fullName(request.fromProvider)} to {fullName(request.toProvider)}
                    </p>
                  </div>
                </div>
                {incoming && request.status === "pending" ? (
                  <form action={acceptShare}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <Button type="submit">Accept</Button>
                  </form>
                ) : (
                  <span className="text-muted-foreground capitalize">{request.status}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5 15.4 17.5" />
      <path d="M15.4 6.5 8.6 10.5" />
    </svg>
  );
}
