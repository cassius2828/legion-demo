# Legion demo — AWS setup

Last documented: October 21, 2026 (America/Los_Angeles).
Source: the setup performed in this project, plus the October 21 report that the certified subdomain loads and that GitHub Actions publishes the image to ECR. This is not a fresh AWS inventory. Confirm current resource settings before changing them. This environment uses synthetic clinical data; deployment is not a claim of HIPAA compliance.

## Architecture

The browser connects to an internet-facing Application Load Balancer. The ALB forwards to the Next.js container on ECS Fargate in private subnets. Prisma connects to private RDS PostgreSQL. ECR stores application images; Secrets Manager provides runtime configuration through the task execution role. CloudWatch receives container logs. Vercel manages domain DNS, not application hosting.

## Resource inventory

| Resource | Recorded configuration |
|---|---|
| Region | us-west-1 (Northern California) |
| ECR repository | interviews/legion-demo |
| ECS cluster | legion-demo |
| Task definition family | legion-demo-td |
| Container | app, Linux/X86_64, TCP 3000 |
| Task size | 0.5 vCPU, 1 GiB |
| ECS service | legion-demo-app (verify exact current name) |
| ALB | legion-demo-alb |
| ALB DNS | legion-demo-alb-1172628889.us-west-1.elb.amazonaws.com |
| Target group | legion-app-tg, IP targets, HTTP 3000 |
| Health endpoint | /api/health |
| App security group | legion-app-sg |
| ALB security group | legion-alb-sg |
| RDS instance | database-1, PostgreSQL 18.3, db.t4g.micro reported |
| Application database | legion |
| Runtime secret | legion-demo-secrets |
| Execution role | ecsTaskExecutionRole |
| Public URL | https://legion.cassiusreynolds.com |

Revision 3 was used for a successful migration; always verify the latest intended revision rather than assuming revision 3 remains current. The AWS account ID and full secret ARN are intentionally omitted here; retrieve them from your own console.

## Network and security groups

- VPC spans two availability zones with two public and two private subnets.
- ALB belongs in public subnets. App tasks run in private subnets with public IP disabled.
- RDS is private. Its security group allows PostgreSQL 5432 from legion-app-sg.
- legion-app-sg accepts TCP 3000 from legion-alb-sg only.
- HTTPS on https://legion.cassiusreynolds.com loads the app. The ALB listener for 443 uses the issued ACM certificate. Confirm the security group still allows the audience you intend. An IP-restricted rule blocks reviewers outside that address.
- Private application routes require an outbound path for Google/OpenAI calls. NAT was added during troubleshooting; confirm active routing in every subnet used by ECS.
- A regional NAT gateway was suspected from its blank subnet field. Confirm its availability mode rather than treating it as a zonal gateway. Regional gateways do not need a dedicated public subnet; zonal public NAT gateways do.
- Reported endpoints: ecr.api, ecr.dkr, logs, and S3. Endpoints are optional alternatives to NAT for their respective AWS traffic. Secrets Manager still needs reachable networking through NAT or its own interface endpoint. Interface endpoint security groups must allow HTTPS from task security groups.

A successful migration later confirmed that the task could start and reach RDS. It does not establish that every subnet or external integration works.

## Runtime configuration

Ordinary environment variables:

| Name | Value |
|---|---|
| NODE_ENV | production |
| TZ | America/Los_Angeles |
| AUTH_TRUST_HOST | true |
| AUTH_URL | https://legion.cassiusreynolds.com |

Sensitive variables should be ECS secret references: DATABASE_URL, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and OPENAI_API_KEY when enabled. Do not put actual values in task-definition JSON or Git.

For a combined JSON secret, use this ECS format:

```text
arn:aws:secretsmanager:us-west-1:ACCOUNT_ID:secret:legion-demo-secrets-SUFFIX:DATABASE_URL::
```

Select ValueFrom in the task definition; this is not an S3 environment-file ARN. In saved task JSON, references belong under containerDefinitions[].secrets, not environment. IAM permissions alone do not create the mapping.

The task execution role needs AmazonECSTaskExecutionRolePolicy and secretsmanager:GetSecretValue on the exact secret ARN. A customer-managed KMS key also requires appropriate kms:Decrypt permission. A separate task role is for AWS API calls made by application code.

## Database configuration

```text
postgresql://USERNAME:URL_ENCODED_PASSWORD@RDS_ENDPOINT:5432/legion?sslmode=require
```

Encode the password component once, including '?' as '%3F'. Do not encode the entire URL. Use a certificate-verifying TLS configuration and the RDS CA bundle before real-data use; do not assume encryption alone proves server identity verification.

RDS created a managed master-password secret. Retrieve it through the RDS master credentials link in Secrets Manager. The instance identifier database-1 is not the SQL database name. The console's DB name dash means no initial name was supplied; it does not list databases created later.

The legion database was created through a VPC-connected CloudShell environment. Local Docker already used database legion at localhost:15432. Keep local and AWS connection strings separate.

If an RDS-managed password rotates, a copied DATABASE_URL does not update itself. Resolve rotation handling and use a restricted application database user rather than the master user before production use.

## Build, migrate, seed, run

1. Build the application image locally and test it. Exclude node_modules, .next, .git, .env, and .env.* from the Docker context; optionally allow .env.example.
2. Push a Linux/amd64 image to ECR, preferably tagged with its Git commit SHA.
3. Register a task revision with that image and runtime secret references.
4. Run one standalone Fargate task in the configured private subnet/security group. Command override in the console:
   ```text
   npx,prisma,migrate,deploy
   ```
5. Require exit code 0 and successful migration logs identifying legion at RDS.
6. For initial synthetic setup only, run another task:
   ```text
   node,scripts/seed-clinical.mjs
   ```
   This entry point calls supporting seed functions. It replaces some seeded records. Do not run it automatically on every deployment.
7. Run the ECS service with normal application startup, no migration/seed override. Require a healthy ALB target.

The image command is still `npx prisma migrate deploy && npm start`. Every new task runs migrations before the server listens. A separate one-off migration task is still the safer order for a bad migration, because a failing migrate blocks the new tasks from becoming healthy.

## HTTPS and DNS

In Vercel DNS, legion CNAME points to the ALB hostname (no URL scheme). ACM in us-west-1 issues the certificate for legion.cassiusreynolds.com using a separate validation CNAME. Preserve that record for renewal.

The first certificate failed with a CAA error. The root CAA record that unblocked Amazon is:

```text
Name: @
Type: CAA
Value: 0 issue "amazon.com"
```

Preserve existing authorities such as letsencrypt.org for the existing Vercel site. A failed ACM request does not recover on its own; the replacement request reached Issued. The ALB HTTPS listener now serves https://legion.cassiusreynolds.com.

Google sign-in on that host still fails. The OAuth client already lists `https://legion.cassiusreynolds.com/api/auth/callback/google`. See [GCP_OAUTH_SETUP.md](GCP_OAUTH_SETUP.md). A healthy page load does not prove `AUTH_URL`, `AUTH_SECRET`, and the Google client values on the running task.

## GitHub Actions

`.github/workflows/publish-ecr.yaml` runs on every push to `main`. It assumes `github-legion-ecr-push` with GitHub OIDC, logs into ECR, and pushes `interviews/legion-demo:<commit sha>` as `linux/amd64`. That publish succeeds. No permanent AWS access keys are required.

The workflow stops at the image push. It does not register a task definition or update the ECS service. The subdomain can keep running an older image until a task revision points at the new tag and the service is updated.

The working trust subject is the branch claim, because the job does not set a GitHub environment. This repository was created after July 15, 2026, so GitHub Actions puts the owner id and the repository id in `sub`. The name-only form `repo:cassius2828/legion-demo:ref:refs/heads/main` does not match tokens from this repo.

```text
repo:cassius2828@124099580/legion-demo@1420203831:ref:refs/heads/main
```

`124099580` is the cassius2828 account id. `1420203831` is the legion-demo repository id. The provider is token.actions.githubusercontent.com and the audience is sts.amazonaws.com. A job that later adds `environment: production` would send `repo:cassius2828@124099580/legion-demo@1420203831:environment:production` instead, and the role trust would need that subject.

Publishing permissions that are already sufficient for this workflow: ecr:GetAuthorizationToken on *, plus upload and image actions scoped to interviews/legion-demo. Updating ECS is a separate permission set: ECS describe, register, run, and update, plus restricted iam:PassRole for the ECS roles. This workflow does not use those.

A later deploy job should wait until checks pass, push the image, register a revision, run a standalone migration and require exit 0, then update the service and wait until it is stable. Serialize deployments. Do not seed from CI. `npm test` going green does not by itself roll the service.

## Troubleshooting evidence

| Error | Interpretation / resolution |
|---|---|
| ECR GetAuthorizationToken timeout | Network path failed before container start; review actual task subnet, routes, NAT/endpoints, outbound 443 |
| Prisma P1013 invalid port | Malformed DATABASE_URL; encode password special characters |
| Exit 1 | Inspect container logs; stopped status alone is not success |
| Exit 0 + migration success | One-off migration completed |
| Healthy target, HTTP works, HTTPS fails | App path works; inspect certificate, 443 listener, DNS, and ALB security group. The certified subdomain currently loads over HTTPS |
| Subdomain loads, Google sign-in fails | Redirect URI list can already be correct. See [GCP_OAUTH_SETUP.md](GCP_OAUTH_SETUP.md) |
| Windows Docker credential helper error | Local credential storage issue; separate from AWS role authorization |

## Completion checks

HTTPS on the certified subdomain and the ECR image publish are in place. Still confirm authenticated login/logout, then provider/patient access restrictions, chart read, messaging, summary generation/approval, booking, and visit completion on the deployed image. Confirm data survives app task replacement. Keep query bodies, tokens, and clinical content out of operational logs. Review costs for NAT, interface endpoints, ALB, RDS, and Fargate; budgets notify but do not cap spending.

References: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html ; https://docs.aws.amazon.com/acm/latest/userguide/troubleshooting-caa.html ; https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws
