# Accounts and dev admin

Sign-in is Google OAuth. The session role is `patient`, `psychiatrist`, or `nurse`. A new account chooses that role on `/onboarding`. `/profile` edits the signed-in user: name, email, primary insurance, secondary insurance, and organization. Role is chosen at signup and is not edited later. `saveProfile` writes only that session user.

Insurance values are the names in `src/lib/profile.ts`. Primary and secondary are stored on `User`. Organizations are the health systems in the `Organization` table (Kaiser Permanente, Sutter Health, and the other seeded systems). The dev-admin screen labels those rows Providers.

`/dev-admin` is limited to `isDevAdmin` in `src/lib/admin.ts`. Everyone else is redirected home. The directory can be filtered to all people, psychiatrists, nurses, or patients, and it can be searched. Person cards link to `/dev-admin/people/[kind]/[id]`. Organization cards are not links.

The person page uses the same admin check and is read-only. A patient id loads that chart: name, email, role, insurance, primary clinician, completed visits, and medications. A psychiatrist or nurse id loads that provider: name, email, role, organization, credentials, and specialty. A user id that is not linked to a chart shows the account fields that exist. An unknown kind or id is not found. This route is separate from `canViewPatient`, which still limits `/patients/[id]` to the patient and their primary clinician.
