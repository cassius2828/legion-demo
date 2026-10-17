import { redirect } from "next/navigation";

export const maxDuration = 60;

import { BookingForm } from "~/app/appointments/book/booking-form";
import { providerLabel } from "~/lib/chart";
import { auth } from "~/server/auth";
import { groupOpenSlots, listOpenFollowUpSlots } from "~/server/availability";
import { db } from "~/server/db";
import { loadUpcomingVisit } from "~/server/follow-up";

export default async function BookAppointmentPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (!session.user.role) redirect("/onboarding");
  if (session.user.role !== "patient") redirect("/");

  const patient = await db.patient.findUnique({
    where: { userId: session.user.id },
    include: { primaryProvider: true },
  });

  if (!patient) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Request an appointment</h1>
        <p className="mt-2 text-muted-foreground">No chart is linked to this account.</p>
      </main>
    );
  }

  const [slots, upcoming] = await Promise.all([
    listOpenFollowUpSlots({
      providerId: patient.primaryProviderId,
      patientId: patient.id,
    }),
    loadUpcomingVisit(patient.id),
  ]);

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Request an appointment</h1>
      <BookingForm
        providerLabel={providerLabel(patient.primaryProvider)}
        groups={groupOpenSlots(slots)}
        upcoming={upcoming}
      />
    </main>
  );
}
