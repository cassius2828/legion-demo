# Legion demo — AWS progress

Status date: October 21, 2026 (America/Los_Angeles).
This checkpoint records what is running and what is still open. It is not a fresh console inventory.

## Current position

https://legion.cassiusreynolds.com loads over HTTPS. The ACM certificate for that name is issued, DNS points the subdomain at the ALB, and the ECS service is serving the app. RDS migrations and the synthetic seed were already completed.

GitHub Actions publishes `interviews/legion-demo:<commit sha>` to ECR on push to `main`. That publish is working. The workflow does not update the ECS service, so a new image sits in ECR until a task revision uses that tag.

Google sign-in on the production host fails. The OAuth client already has the production callback and the localhost callback. The page load and the redirect-URI list are not the remaining problem. See [GCP_OAUTH_SETUP.md](GCP_OAUTH_SETUP.md).

## Completed

- [x] Local Docker PostgreSQL and application setup.
- [x] VPC with public and private subnets across two AZs.
- [x] Private RDS PostgreSQL; SQL database legion created.
- [x] Secrets Manager and ECS execution-role read permission.
- [x] Application image in ECR, including the GitHub Actions publish on `main`.
- [x] ECS cluster, task definition, and service. The ALB target is healthy.
- [x] Outbound path for image pull and logs. NAT and the reported VPC endpoints are in place.
- [x] Prisma migrations applied on RDS. Seed task completion was reported.
- [x] CAA record for Amazon, replacement ACM certificate Issued, HTTPS on legion.cassiusreynolds.com.
- [x] GitHub OIDC role `github-legion-ecr-push` assumes and pushes to ECR.

## Open — production Google sign-in

The certified subdomain loads. Sign-in with Google still returns an error.

Already true: `http://localhost:3000/api/auth/callback/google` and `https://legion.cassiusreynolds.com/api/auth/callback/google` are on the Web client. Adding those URIs again will not change this failure.

Next checks, in order:

1. On the Google account chooser URL, read the `redirect_uri` value. It must be exactly `https://legion.cassiusreynolds.com/api/auth/callback/google`. `http://`, the `elb.amazonaws.com` host, or a trailing slash is a different URI even when the correct one is also registered.
2. On the running task, `AUTH_URL` is `https://legion.cassiusreynolds.com` with no path and no trailing slash, and `AUTH_TRUST_HOST` is `true`. Replace the tasks after changing either value.
3. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `legion-demo-secrets` belong to that same Web client. A matching redirect list with a secret from another client fails at the token exchange. Look for `invalid_client` in CloudWatch. Do not copy the secret into notes.
4. If Google shows "access blocked" or `access_denied` before returning to the app, the consent screen audience or the `calendar.events` scope is the block. Testing mode only allows listed test users. A sensitive Calendar scope can require verification before accounts outside the test list can consent.
5. If the browser returns to the app with `error=OAuthCallback` and the CloudWatch line is a missing state cookie, start sign-in on `https://legion.cassiusreynolds.com` only. The ALB must pass `Host` and `X-Forwarded-Proto: https`. Auth.js marks the state cookie Secure when `AUTH_URL` is https.
6. If the browser returns with `error=Callback` or `error=OAuthAccountNotLinked`, the token exchange succeeded and the Prisma account write failed. Read the container log for that request. Leave token values out of the note.

## Open — roll the published image

ECR has the commit-SHA image. The service keeps its current task definition until someone registers a revision with that tag and updates `legion-demo-app`. Do that after the Google client values on the task are confirmed, then retest sign-in on the new tasks.

## Still to verify on the deployed app

- [ ] Production Google sign-in and sign-out.
- [ ] The running task definition uses the intended ECR tag, with secrets as ValueFrom references.
- [ ] Chart access, messaging, summary prepare/approve, booking, and visit completion on that deployment.
- [ ] Data still present after a task replacement.
- [ ] Cost review for NAT, interface endpoints, ALB, RDS, and Fargate.

## Evidence to retain

Image digest and commit tag, task-definition revision, ECS deployment health, certificate status Issued, and the production sign-in `error` query plus the redacted CloudWatch auth line. Do not keep credentials, tokens, clinical note text, or message bodies.
