# Legion demo

A clinic demo for a small psychiatric practice. Patients and clinicians sign in with Google, then work through scheduling, chart review, a visit, and the follow-up that comes after it. The data is synthetic. Running this app is not a claim of HIPAA compliance.

Clinic time is America/Los_Angeles.

## What you can do

Patients see their next visit, complete intake, book or move a follow-up, read clinic messages, and open a visit link. Psychiatrists and nurses see their panel and today's schedule, open a chart, write the visit, record a local prescription decision, and send due reminders as clinic messages. A chart summary can be drafted by a model and saved only after the clinician approves it.

| Area | Where it lives |
| --- | --- |
| Care loop: intake, visit, prescription, follow-up, reminders | [docs/CARE_LOOP.md](docs/CARE_LOOP.md) |
| Chart summary draft and approval | [docs/PATIENT_SUMMARY.md](docs/PATIENT_SUMMARY.md) |
| Calendar and the appointment proposer | [docs/SCHEDULING.md](docs/SCHEDULING.md) |
| Messages, reminders, and transfers | [docs/CLINIC_COMMUNICATION.md](docs/CLINIC_COMMUNICATION.md) |
| Deterministic tests and live agent evals | [docs/EVALS.md](docs/EVALS.md) |
| Google sign-in and Calendar scope | [docs/GCP_OAUTH_SETUP.md](docs/GCP_OAUTH_SETUP.md) |
| AWS layout and current deploy notes | [docs/AWS_SETUP.md](docs/AWS_SETUP.md), [docs/AWS_PROGRESS.md](docs/AWS_PROGRESS.md) |

Roles are `patient`, `psychiatrist`, and `nurse`. A new Google account chooses a role on `/onboarding`. Charts are visible to the patient and to that patient's primary provider.

## Images


## Local use

Copy `.env.example` to `.env` and fill in `AUTH_SECRET`, the Google OAuth client, and `OPENAI_API_KEY` if you want appointment proposals and chart-summary overviews. `DATABASE_URL` in the example points at Postgres on `127.0.0.1:15432`.

```bash
docker compose up -d postgres
npm install
npx prisma migrate deploy
node scripts/seed-clinical.mjs
npm run dev
```

The app is at `http://127.0.0.1:3000`. `GET /api/health` checks the database. `docker compose up` also builds the app container, which uses the same host port.

`npm test` typechecks the project and runs the deterministic summary and scheduling cases. It does not call the model or start Postgres. `npm run eval:live` prepares a chart summary and runs the scheduling agent against the seeded chart, then writes a timestamped results file, log, and trace under `eval-runs/`. That folder is gitignored.

## Stack

Next.js, Prisma, PostgreSQL 18.3, Auth.js with Google, the OpenAI client for the chart-summary overview, and the OpenAI Agents SDK for scheduling. The local database and the app image are defined in `docker-compose.yml`.
