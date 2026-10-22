# Scheduling

The calendar and booking flow use America/Los_Angeles. Follow-up slots come from each provider's weekly schedule blocks and skip times that overlap an existing appointment. The horizon and lead time are in `src/server/availability.ts`.

## Patient booking

A signed-in patient opens `/appointments/book`. They can book a new follow-up or ask the scheduling agent to choose a time. A patient who already has an upcoming visit is told that, and a new booking is not created.

Rescheduling moves the current appointment. The agent is told not to book the current start. `scheduleWithAgent` in `src/server/booking-agent.ts` calls three tools: the provider's open slots, the patient's usual weekday and time, and one booking call. The usual time is the most common completed visit weekday and time. The choice rule, shared with the eval, is in `src/server/booking-choice.ts`:

1. Use the usual weekday and time when that start is open.
2. Otherwise use the nearest open start on that weekday.
3. Otherwise use the earliest open start.

The start being moved is excluded. A start on a clinic day that already has another scheduled visit for that patient is excluded. If the book tool refuses because an upcoming visit exists, or because the day is already taken, that sentence is returned to the caller.

An upcoming visit is status `scheduled` with `scheduledAt` at or after now. While one exists, `/appointments/book` does not create another. The conflict dialog can reschedule that visit, cancel it, or open the clinic message thread. Cancel requires a reason of 1 to 1000 characters, stored on `Appointment.cancellationReason`. Manual slot buttons stay hidden while that upcoming visit is on the page. `commitFollowUp` refuses a second future scheduled visit, and refuses a new start on the same America/Los_Angeles calendar day as another scheduled visit for that patient. The visit being moved is ignored by that day check.

## Calendar

`/calendar` shows clinic appointments and, when the Google account is linked, Google Calendar events. Google Calendar is requested at sign-in. See [GCP_OAUTH_SETUP.md](GCP_OAUTH_SETUP.md) for the scope. A linked calendar does not copy every clinic appointment both ways.

An upcoming scheduled clinic visit can be rescheduled or cancelled from its dialog by the patient on that visit, the visit's provider, or the visit's nurse. Reschedule lists open slots with the days collapsed. One day is open at a time. The same upcoming and same-day rules apply. Cancel stores `cancellationReason` and sets the status to `cancelled`. Completed clinic visits and Google events stay read-only. Dragging a clinic appointment finds the row by appointment id. Seeded rows use `apt_` ids, and later bookings use Prisma ids. Both are appointment ids.
