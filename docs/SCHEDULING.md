# Scheduling

The calendar and booking flow use America/Los_Angeles. Follow-up slots come from each provider's weekly schedule blocks and skip times that overlap an existing appointment. The horizon and lead time are in `src/server/availability.ts`.

## Patient booking

A signed-in patient opens `/appointments/book`. They can book a new follow-up or ask the scheduling agent to choose a time. A patient who already has an upcoming visit is told that, and a new booking is not created.

Rescheduling moves the current appointment. The agent is told not to book the current start. `scheduleWithAgent` in `src/server/booking-agent.ts` calls three tools: the provider's open slots, the patient's usual weekday and time, and one booking call. The usual time is the most common completed visit weekday and time. The choice rule, shared with the eval, is in `src/server/booking-choice.ts`:

1. Use the usual weekday and time when that start is open.
2. Otherwise use the nearest open start on that weekday.
3. Otherwise use the earliest open start.

The start being moved is excluded. A start on a clinic day that already has another scheduled visit for that patient is excluded. If the book tool refuses because an upcoming visit exists, or because the day is already taken, that sentence is returned to the caller.

## Calendar

`/calendar` shows the clinic schedule. Google Calendar is requested at sign-in. See [GCP_OAUTH_SETUP.md](GCP_OAUTH_SETUP.md) for the scope. Calendar access does not by itself mean every clinic appointment is mirrored both ways.
