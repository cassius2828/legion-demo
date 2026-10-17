# Legion demo — AWS setup

Last documented: October 17, 2026 (America/Los_Angeles).
Source: the setup performed and reported in this conversation. This is not a fresh AWS inventory. Confirm current resource settings before changing them. This environment uses synthetic clinical data; deployment is not a claim of HIPAA compliance.

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
| Planned public URL | https://legion.cassiusreynolds.com |

Revision 3 was used for a successful migration; always verify the latest intended revision rather than assuming revision 3 remains current. The AWS account ID and full secret ARN are intentionally omitted here; retrieve them from your own console.

## Network and security groups

- VPC spans two availability zones with two public and two private subnets.
- ALB belongs in public subnets. App tasks run in private subnets with public IP disabled.
- RDS is private. Its security group allows PostgreSQL 5432 from legion-app-sg.
- legion-app-sg accepts TCP 3000 from legion-alb-sg only.
- ALB initially allowed HTTP 80 from the operator's IP. Add HTTPS 443 for the intended audience when the certificate is issued. An IP-restricted rule prevents interview reviewers outside that IP from reaching the demo.
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
| AUTH_URL | https://legion.cassiusreynolds.com (configure when HTTPS is ready) |

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

The last inspected Dockerfile still ran migrations before npm start. Once deployment reliably runs migrations separately, change startup to CMD ["npm", "start"]. Do not silently assume that change has already shipped.

## HTTPS and DNS

In Vercel DNS, legion CNAME points to the ALB hostname (no URL scheme). ACM in us-west-1 issues the certificate for legion.cassiusreynolds.com using a separate validation CNAME. Preserve that record for renewal.

The first certificate failed with a CAA error. Authorize Amazon with a root CAA record:

```text
Name: @
Type: CAA
Value: 0 issue "amazon.com"
```

Preserve existing authorities such as letsencrypt.org for the existing Vercel site. Request a new ACM certificate after fixing DNS; the failed request does not recover automatically. If it fails again, inspect the effective CAA records, CNAME chain, and authoritative DNS rather than repeatedly retrying.

After Issued: add ALB HTTPS 443 listener with the certificate, forward to legion-app-tg, permit intended HTTPS sources, test the subdomain, then redirect HTTP 80 to HTTPS. Configure AUTH_URL and Google callback, deploy the new task revision, and test login.

## GitHub Actions

The intended publishing flow uses GitHub OIDC to assume github-legion-ecr-push, logs into ECR, builds the image, and pushes a commit-SHA tag. No permanent AWS access keys are required.

Trust must match provider token.actions.githubusercontent.com, audience sts.amazonaws.com, and the actual repository/branch. For a job without a GitHub environment, the expected subject is:

```text
repo:cassius2828/legion-demo:ref:refs/heads/main
```

A job with environment: production uses an environment-based subject instead; align the trust policy with that claim and restrict allowed deployment branches through GitHub environment settings. Confirm repository name/case and any customized OIDC subject configuration.

Publishing permissions: ecr:GetAuthorizationToken on *, plus upload/image actions scoped to interviews/legion-demo. Deployment additionally requires ECS describe/register/run/update permissions and restricted iam:PassRole for the ECS roles.

Desired deployment ordering: checks -> build/push -> register revision -> standalone migration -> verify exit 0 -> update service -> wait for stability -> health verification. A separate workflow's green status does not automatically gate publication/deployment. Serialize deployments without cancelling a running migration. Do not seed in CD.

## Troubleshooting evidence

| Error | Interpretation / resolution |
|---|---|
| ECR GetAuthorizationToken timeout | Network path failed before container start; review actual task subnet, routes, NAT/endpoints, outbound 443 |
| Prisma P1013 invalid port | Malformed DATABASE_URL; encode password special characters |
| Exit 1 | Inspect container logs; stopped status alone is not success |
| Exit 0 + migration success | One-off migration completed |
| Healthy target, HTTP works, HTTPS fails | App path works; inspect certificate, 443 listener, DNS, and ALB security group |
| Windows Docker credential helper error | Local credential storage issue; separate from AWS role authorization |

## Completion checks

Verify HTTPS, authenticated login/logout, provider/patient access restrictions, chart read, messaging, summary generation/approval, booking, and visit completion. Confirm data survives app task replacement. Keep query bodies, tokens, and clinical content out of operational logs. Review costs for NAT, interface endpoints, ALB, RDS, and Fargate; budgets notify but do not cap spending.

References: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html ; https://docs.aws.amazon.com/acm/latest/userguide/troubleshooting-caa.html ; https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws
