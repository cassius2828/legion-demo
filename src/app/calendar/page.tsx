import { redirect } from "next/navigation";

import { CalendarBoard } from "~/app/calendar/calendar-board";
import { connectCalendar } from "~/app/calendar/actions";
import { Button } from "~/components/ui/button";
import { parseDateParam, parseViewParam, visibleBounds } from "~/lib/calendar-dates";
import { auth } from "~/server/auth";
import { listCalendarEvents } from "~/server/calendar";
import { listClinicEvents } from "~/server/clinic-appointments";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");

  const params = await searchParams;
  const view = parseViewParam(params.view);
  const date = parseDateParam(params.date);
  const bounds = visibleBounds(view, date);
  const [clinic, result] = await Promise.all([
    listClinicEvents(session.user.id, session.user.role ?? "", bounds),
    listCalendarEvents(session.user.id, bounds),
  ]);

  if (!result.connected && clinic.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="mt-3 text-muted-foreground">
          Connect Google Calendar to schedule appointments on the account you used to sign in.
          Sign out and sign in once if Google has not granted calendar access yet.
        </p>
        <form action={connectCalendar} className="mt-6">
          <Button type="submit">Connect Google Calendar</Button>
        </form>
      </main>
    );
  }

  const googleEvents = result.connected && !("error" in result) ? result.events : [];
  const note = result.connected
    ? "Clinic appointments and Google Calendar. Drag a clinic appointment to change its day or time."
    : "Clinic appointments saved for this demo. Drag one to change its day or time.";

  return (
    <CalendarBoard
      view={view}
      date={date}
      events={[...clinic, ...googleEvents]}
      note={note}
      loadError={result.connected && "error" in result ? result.error : undefined}
    />
  );
}
