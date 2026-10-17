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

`preparePatientSummary` returns the draft and a SHA-256 fingerprint of the chart rows that the summary depends on. The panel sends that fingerprint back with Approve.

`approvePatientSummary` recomputes the fingerprint and the current lists. It does not write a `PatientSummaryRecord` when the fingerprint differs, when a list or the last-visit line differs, or when any section still says retrieval failed. A matching save stores the fingerprint from that moment. Opening the chart later marks the saved summary outdated when the current fingerprint no longer matches.

The fingerprint covers psychiatric history, conditions, the latest completed visit, medications, open tasks, and the latest prescription orders. It does not cover allergies or note bodies. An order change can mark a summary outdated even though the agent tools do not list orders.

## Who can open a chart

`canViewPatient` allows a patient to open their own chart and allows a psychiatrist or nurse only when their provider id is the patient's `primaryProviderId`. The summary actions check that again and also reject the patient role before a draft is prepared.
