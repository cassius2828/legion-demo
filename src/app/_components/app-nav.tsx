import { auth, signIn, signOut } from "~/server/auth";

export async function AppNav() {
  const session = await auth();
  const name = session?.user?.name;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#15162c] text-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="text-sm font-semibold tracking-tight">Legion demo</span>
        <div className="flex items-center gap-3">
          {session?.user ? (
            <>
              <p className="text-sm">Welcome, {name}</p>
              <form action={signOutUser}>
                <button
                  type="submit"
                  className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium transition hover:bg-white/20"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-[#15162c] transition hover:bg-white/90"
              >
                Sign up with Google
              </button>
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
