# Evals

Two kinds of checks exist. `npm test` does not call a model and does not need Postgres. `npm run eval:live` does both.

## Deterministic checks

`npm test` runs `tsc --noEmit`, then the Node test files:

- `src/server/summary-assembly.test.ts` checks that retrieved lists replace model prose, that a missing or failed retrieval cannot be approved, that a changed chart version or a changed list is rejected, and that chart access matches the owning provider, another provider, and the patient role.
- `src/server/booking-choice.test.ts` checks the usual time, the nearest weekday slot, the earliest opening, a same-day refusal, and a new booking blocked by an existing upcoming visit.
- `src/lib/admin-profile.test.ts` checks the dev-admin profile path, the dev-admin gate, patient insurance and visit history, an unlinked account, and psychiatrist and nurse fields. It runs under `tsx` because the profile module uses the `~/` import alias. The other two files run with `node --experimental-strip-types`.

`.github/workflows/summary-checks.yml` runs `npm test` on pull requests and pushes. It has no API key and does not start Postgres.

Two local scripts are separate from `npm test`:

- `node scripts/eval-care-loop.mjs` checks allergy, medication, and follow-up rules.
- `node scripts/eval-patient-summary.mjs` reads the seeded `pat_16` medication and task rows. It does not call the summary completion.

## Live agent eval

`npm run eval:live` needs `OPENAI_API_KEY`, the seeded database, and the Google env vars required to import the app config. It runs three cases for patient `pat_16` and provider `prv_04`:

- The summary lists match a fresh chart projection, the overview does not use a denylisted drug that is absent from the chart, and a correction keeps the lists while adding a required phrase.
- A new booking is refused with "This patient already has an upcoming appointment." and does not add a row.
- The earliest future visit is moved to the expected open slot, not onto another scheduled visit's clinic day. The script then restores that visit.

Each run writes three files under `eval-runs/`. The names include `live-agents`, the purpose (`results`, `log`, or `traces`), and a local timestamp such as `2026-10-17_10-41-07-153`. Older runs stay in the folder. The folder is listed in `.gitignore` and `.dockerignore`. The trace file contains booking-agent spans. The summary path is one completion and does not emit tool spans. Its pass or fail stays in the results and log files. The app itself leaves booking-agent tracing disabled. API keys are removed from the written files.

`.github/workflows/live-agent-evals.yml` runs this command only when started by hand. It starts Postgres 18.3, migrates, seeds, and reads `OPENAI_API_KEY` from the repository secret.
