# Patient summary

A psychiatrist or nurse who is the patient's primary provider can prepare a chart draft from the patient chart. The draft is not a saved chart fact until that clinician approves it. Patients cannot prepare or approve a summary.

The agent is `summarizePatient` in `src/server/patient-summary-agent.ts`. It has three tools: medications, previous visits, and open tasks. Tracing is off in the app. The live eval turns tracing on only for its own process.

## What can be approved

`src/server/summary-assembly.ts` decides the draft after the model run.

- Medication, diagnosis, and task lines come from the tool results. A drug named only in the model's overview is not added to a list.
- The last-visit line is the latest stored clinical summary, or "No completed visits recorded." when there is no completed visit. The model does not rewrite it.
- The overview can still be the model's wording, trimmed to 1200 characters. It is a narrative, not a medication or diagnosis list.
- If a required retrieval is missing or fails, the draft is not returned for approval.

## Approval and staleness

`preparePatientSummary` returns the draft and the patient's current `chartVersion`. That value is an integer on `Patient`, starting at 0. The panel sends the same integer back with Approve.

`approvePatientSummary` reads `Patient.chartVersion` again inside the save transaction. It does not write a `PatientSummaryRecord` when that integer differs from the draft, when a list or the last-visit line differs, or when any section still says retrieval failed. The mismatch message is "The chart changed. Prepare the summary again." A matching save stores `chartVersion` equal to the patient row at that moment. Version 0 is a real value.

Opening the chart later marks the saved summary outdated when `PatientSummaryRecord.chartVersion` and `Patient.chartVersion` differ. The date stays red and the label stays "Outdated summary".

`chartVersion` increments by 1 inside the same transaction as these writes:

- Signing the visit note.
- Transmitting a prescription order.
- Closing a visit when draft orders were transmitted, or when the follow-up could not be booked and a follow-up task was created. Both of those in one close still increment once.

Booking or moving a visit, a pharmacy preference, intake scores, and profile or transfer updates leave the version unchanged. Seed scripts that rewrite the signed note, medications, tasks, or transmitted orders call `bumpChartVersions` in `scripts/chart-version.mjs`.

## Who can open a chart

`canViewPatient` allows a patient to open their own chart and allows a psychiatrist or nurse only when their provider id is the patient's `primaryProviderId`. The summary actions check that again and also reject the patient role before a draft is prepared.
