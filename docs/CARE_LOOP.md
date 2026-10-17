# Care loop

A visit in this demo is a short sequence: the patient completes intake, the clinician records the encounter, a local prescription decision updates the medication list, and the next step is either a booked follow-up or a task to book one. Nothing here transmits a prescription to a pharmacy. The order status is a local record.

## Intake

The patient home shows whether intake is still due for the next scheduled visit. The form is `/appointments/[id]/intake`. It stores one `Intake` row for that appointment.

## Encounter

`/visits/[appointmentId]` is the clinician's visit workspace. The encounter note is saved on the visit. A join link at `/visits/join/[token]` is the patient entry for that appointment.

## Prescription decision

The formulary and the allergy check live in `src/lib/care-loop-rules.ts`. An order is rejected when the medication matches an allergy and the clinician has not recorded an override. An accepted discontinue marks the medication discontinued. An accepted refill or new order leaves it active. A rejected order does not change the medication list.

Those outcomes are stored as a `PrescriptionOrder` plus `ClinicalEvent` rows. The patient home shows the latest order and its events.

## Follow-up

After the visit, the clinician either books the next appointment or leaves a task. Booking is refused when the patient already has an upcoming visit, when the chosen start is on a clinic day that already has one of their scheduled visits, or when the slot is no longer open. Those rules are `bookingBlock` in `src/server/follow-up.ts`. The appointment proposer uses the same rules. See [SCHEDULING.md](SCHEDULING.md).

## Reminders

Creating a follow-up also creates two `Reminder` rows: one day before the visit and one hour before. They are not sent until a clinician delivers the ones that are due. Delivery writes a clinic message. See [CLINIC_COMMUNICATION.md](CLINIC_COMMUNICATION.md).

## Seeded check

`node scripts/eval-care-loop.mjs` checks the allergy, medication, and follow-up decisions without a database or a model. `node scripts/seed-clinical.mjs` loads the synthetic panel, including patient `pat_16`, which the live evals use.
