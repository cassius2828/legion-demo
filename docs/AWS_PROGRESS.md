# Legion demo — AWS progress

Status date: October 17, 2026 (America/Los_Angeles).
This is a conversation-based checkpoint, not a fresh inspection. Latest user-reported blockers are authoritative here; no later success is assumed.

## Current position

The app runs on ECS Fargate, its ALB target is healthy, and the ALB's HTTP URL loads. RDS migrations completed successfully and the user reported completion of the seed step. Production HTTPS remains blocked at certificate issuance/CAA authorization. GitHub automation remains blocked by OIDC issues affecting reliable ECR publication/deployment.

## Completed or reported complete

- [x] Local Docker PostgreSQL and application setup.
- [x] VPC with public/private subnets across two AZs.
- [x] Private RDS PostgreSQL instance; SQL database legion created.
- [x] Secrets Manager configuration and ECS execution-role read permission configured.
- [x] Application image published manually to ECR.
- [x] ECS cluster and task definition created.
- [x] Outbound network troubleshooting progressed beyond image initialization failures.
- [x] ECR API/DKR, Logs, and S3 endpoints reported available; NAT routing added.
- [x] Prisma password URL encoding issue identified and corrected sufficiently for migration success.
- [x] Migration logs confirmed all migrations applied successfully.
- [x] Seed task completion reported; retain seed logs/exit status as verification evidence.
- [x] ALB/target group and ECS service configured; healthy target and working HTTP page confirmed.
- [x] Subdomain and ACM validation CNAME additions reported in Vercel DNS.
- [x] GitHub OIDC provider/role creation reported.
- [x] Summary deterministic test workflow appeared on GitHub at last inspection.

## Blocker 1 — ACM / CAA / production HTTPS

Observed: certificate request failed with a Certification Authority Authorization error.
Action provided: add root CAA value 0 issue "amazon.com", preserving existing authorities; request a new DNS-validated certificate in us-west-1.
Current state: waiting for CAA authorization/certificate issuance to be resolved. DNS visibility and the new certificate's status have not been independently confirmed.

Next checks:

1. Confirm Vercel is the authoritative DNS provider and the Amazon CAA record is published.
2. Confirm legion CNAME targets the ALB rather than a Vercel app; inspect effective CAA resolution if failure persists.
3. Confirm new ACM request has the exact validation CNAME published.
4. Require certificate status Issued; do not wait for the old Failed request to recover.
5. Attach certificate to ALB HTTPS 443, permit intended sources, test TLS, then redirect HTTP to HTTPS.
6. Set AUTH_URL and the Google callback, deploy configuration, and verify login.

## Blocker 2 — GitHub Actions OIDC / ECR / deployment

Desired behavior: pushing main passes checks, publishes a commit-SHA image, runs migrations successfully, and updates ECS to that same image.
Current state: user reports OIDC issues blocking correct ECR publication/deployment. Exact latest error/run URL is not available in this checkpoint. Do not infer whether the failure is token issuance, role assumption, ECR authorization, or ECS deployment.

Next checks:

1. Capture failed workflow URL, commit SHA, step name, and redacted error.
2. Confirm role-to-assume points to the created role in the correct account.
3. Confirm job grants id-token: write and contents: read.
4. Confirm trust provider and audience sts.amazonaws.com.
5. Match the actual OIDC subject. Branch job: repo:cassius2828/legion-demo:ref:refs/heads/main. A job using environment: production uses repo:cassius2828/legion-demo:environment:production unless subject customization changes it. Restrict environment deployment branches appropriately.
6. If role assumption succeeds, check ECR repository-scoped push permissions. If publication succeeds but ECS fails, check ECS permissions and iam:PassRole separately.
7. Keep secrets in ECS ValueFrom references; do not fix deployment by adding production DB credentials to GitHub test jobs.
8. Gate migration success, then deployment stability. Serialize deployments. No automatic seeding.

Publishing to ECR and deploying ECS are distinct milestones. Neither a successful Docker build nor a green unit test proves the running service uses the new image.

## App testing work independent of blockers

- Deterministic tests should run without API credentials.
- Database integration checks use disposable PostgreSQL, never production RDS.
- Live model evals use synthetic data and a dedicated API key; keep them manually triggered initially.
- Save per-case results and report passed/failed/errored/skipped separately.
- Rebuild local app and verify authenticated summary generation, correction, approval, reload, and stale-draft handling.
- Record unexecuted tests honestly; do not claim CI/CD or HTTPS completion while blocked.

## Remaining after blockers

- [ ] Confirm HTTPS and production Google OAuth login.
- [ ] Verify core workflows on the deployed version and persistence after task replacement.
- [ ] Finish dependable image publishing and ECS deployment automation.
- [ ] Verify all runtime secrets are references, with no stale plaintext overrides.
- [ ] Complete deployment/runbook documentation and cost review.
- [ ] Later scope: autonomous reminders, realtime notifications, optional model-provider changes, production security/compliance work.

## Evidence to retain

Migration and seed exit codes/logs; image digest/commit tag; task-definition revision; ECS deployment health; certificate status; redacted failing OIDC step; test/eval reports. Do not include credentials, tokens, sensitive chart content, or private account information in interview exports.
