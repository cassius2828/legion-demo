import Link from "next/link";

import { Button } from "~/components/ui/button";
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
            <Link href="/calendar" className="text-sm font-medium hover:text-primary">
              Calendar
            </Link>
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

async function signInWithGoogle() {
  "use server";
  await signIn("google");
}

async function signOutUser() {
  "use server";
  await signOut();
}
