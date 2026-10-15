import Link from "next/link";

import { Button } from "~/components/ui/button";
import { isDevAdmin } from "~/lib/admin";
import { auth, signIn, signOut } from "~/server/auth";

export async function AppNav() {
  const session = await auth();
  const name = session?.user?.name;

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Legion demo
          </Link>
          {session?.user ? (
            <>
              <Link href="/calendar" className="text-sm font-medium hover:text-primary">
                Calendar
              </Link>
              {session.user.role === "psychiatrist" || session.user.role === "nurse" ? (
                <Link href="/transfers" className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary">
                  <ShareIcon />
                  Transfers
                </Link>
              ) : null}
              <Link href="/profile" className="text-sm font-medium hover:text-primary">
                Profile
              </Link>
              {isDevAdmin(session.user.email) ? (
                <Link href="/dev-admin" className="text-sm font-medium hover:text-primary">
                  Admin
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <p className="text-sm text-muted-foreground">Welcome, {name}</p>
              <form action={signOutUser}>
                <Button type="submit" variant="outline">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <form action={signInWithGoogle}>
              <Button type="submit">Sign up with Google</Button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
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

async function signInWithGoogle() {
  "use server";
  await signIn("google");
}

async function signOutUser() {
  "use server";
  await signOut();
}
