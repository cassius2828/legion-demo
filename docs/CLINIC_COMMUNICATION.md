# Messages, reminders, and transfers

These are records in the clinic database. They are not email, SMS, or an outside chat product.

## Messages

`/messages` is open to a patient, a psychiatrist, and a nurse. A patient sees their own thread. A provider sees patients on their panel and can open `/messages/[patientId]`. A provider can read a thread only when `canViewPatient` allows that chart. Message bodies are `ClinicMessage` rows.

## Reminders

A follow-up stores a day-before reminder and an hour-before reminder. They stay scheduled until a clinician delivers the ones whose time has arrived. Delivery inserts a clinic message into the patient's thread and marks the reminder sent. The provider home has the control that sends due reminders.

## Transfers

`/transfers` is for psychiatrists and nurses. The current primary provider can request a transfer to another provider. The receiving provider accepts it from the same page. Accepting sets `primaryProviderId` to the receiving provider and marks the `ShareRequest` accepted. Chart access follows that primary provider, so the accepting clinician can then open the chart and the previous primary provider cannot.
