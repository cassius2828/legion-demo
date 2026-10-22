# Patient summary

A psychiatrist or nurse who is the patient's primary provider can prepare a chart draft from the patient chart. The draft is not a saved chart fact until that clinician approves it. Patients cannot prepare or approve a summary.

`summarizePatient` in `src/server/patient-summary-agent.ts` loads medications, the latest completed visits, and open tasks in code. It then makes one `gpt-4.1-mini` completion at temperature 0. That call returns JSON with a single `overview` field. The booking flow is still an agent. Summary tracing is not emitted. The live eval still records booking traces.

## What can be approved

`src/server/summary-assembly.ts` decides the draft after the queries and the overview call.

- Medication, diagnosis, and task lines come from those queries. A drug named only in the model's overview is not added to a list.
- The last-visit line is the latest stored clinical summary, or "No completed visits recorded." when there is no completed visit. The model does not rewrite it.
- The overview can still be the model's wording, trimmed to 1200 characters. It is a narrative, not a medication or diagnosis list. `src/lib/overview-medications.ts` checks formulary names in that paragraph against the patient's active and discontinued brand and generic names. A formulary drug that is not on the chart stays in the overview, is highlighted, and blocks Approve until a new draft is prepared. A word that is not on the formulary is not flagged.
- If a required query throws or the chart row is missing, the draft is not returned and the model is not called. If the completion fails or the overview is empty, the draft still uses "Review the lists below before approving this draft."

## Approval and staleness

`preparePatientSummary` returns the draft and the patient's current `chartVersion`. That value is an integer on `Patient`, starting at 0. The panel sends the same integer back with Approve.

`approvePatientSummary` reads `Patient.chartVersion` again inside the save transaction. It does not write a `PatientSummaryRecord` when that integer differs from the draft, when a list or the last-visit line differs, when any section still says retrieval failed, or when the overview names a formulary drug that is not on the chart. The chart mismatch message is "The chart changed. Prepare the summary again." The overview message is "The overview names a medication that is not on the chart. Prepare the summary again." A matching save stores `chartVersion` equal to the patient row at that moment. Version 0 is a real value.

Opening the chart later marks the saved summary outdated when `PatientSummaryRecord.chartVersion` and `Patient.chartVersion` differ. The date stays red and the label stays "Outdated summary".

`chartVersion` increments by 1 inside the same transaction as these writes:

- Signing the visit note.
- Transmitting a prescription order.
- Closing a visit when draft orders were transmitted, or when the follow-up could not be booked and a follow-up task was created. Both of those in one close still increment once.

Booking or moving a visit, a pharmacy preference, intake scores, and profile or transfer updates leave the version unchanged. Seed scripts that rewrite the signed note, medications, tasks, or transmitted orders call `bumpChartVersions` in `scripts/chart-version.mjs`.

## Who can open a chart

`canViewPatient` allows a patient to open their own chart and allows a psychiatrist or nurse only when their provider id is the patient's `primaryProviderId`. The summary actions check that again and also reject the patient role before a draft is prepared.
