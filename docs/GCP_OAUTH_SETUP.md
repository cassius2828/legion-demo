# Legion demo — Google Cloud OAuth setup

Last documented: October 17, 2026. GCP means Google Cloud Platform. This guide reflects the application code and conversation; project ID, client ID, consent-screen status, and production callback completion were not verified in Google Cloud.

## Purpose and flow

NextAuth uses Google OAuth for identity and requests Calendar access. The browser redirects to Google, Google redirects to the application's callback, and the server establishes the app session. OAuth tokens are stored through the Prisma account adapter; the server refreshes Google access tokens when necessary.

Recorded scopes in the application:

- openid
- email
- profile
- https://www.googleapis.com/auth/calendar.events

The code requests access_type=offline and prompt=consent. Calendar authorization does not automatically mean clinical appointments are synchronized bidirectionally; verify the actual application operations.

## Google Cloud configuration

1. Select the dedicated project in Google Cloud Console. Record the non-secret project ID in internal documentation.
2. Enable Google Calendar API for the project.
3. Configure the Google Auth Platform branding, support/contact information, and audience. Use testing with explicitly listed test users while developing, or complete applicable publishing/verification requirements before wider use. Verification requirements depend on requested scopes and audience.
4. Create or locate an OAuth client of type Web application.
5. Configure the exact authorized redirect URIs:
   ```text
   http://localhost:3000/api/auth/callback/google
   https://legion.cassiusreynolds.com/api/auth/callback/google
   ```
   Keep the local URI for local development. Add production only for the domain you control. Scheme, hostname, path, and any port must match.
6. If JavaScript origins are required by another Google browser integration, use http://localhost:3000 and https://legion.cassiusreynolds.com. Server-side NextAuth OAuth primarily depends on the redirect URI; do not treat origins as a substitute.
7. Store GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in local .env for local use and in AWS Secrets Manager for deployed use. Never commit the secret.

## Application configuration

For AWS ECS, configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as ValueFrom references to their keys in legion-demo-secrets. Use a stable AUTH_SECRET and set:

```text
AUTH_URL=https://legion.cassiusreynolds.com
AUTH_TRUST_HOST=true
```

Trust forwarded host headers only behind the intended trusted proxy/load-balancer configuration. Update the ECS service to the revision containing the configuration. Changing a secret does not update already-running containers that received it at startup; launch replacement tasks.

HTTPS must work on the production hostname before testing production login. The ALB's amazonaws.com hostname is not the intended production OAuth origin.

## Verification

1. Open the HTTPS production subdomain with a permitted test account.
2. Start Google sign-in and inspect the redirect hostname and callback URL without recording tokens.
3. Complete consent. Confirm the user returns to the app and receives the appropriate role/access; Google identity alone does not authorize access to every chart.
4. Confirm Calendar connection and perform a synthetic event read/create/move as supported by the app.
5. Verify refresh behavior without exposing token contents.
6. Confirm sign-out and unauthorized chart access behavior.

## Troubleshooting

| Symptom | Check |
|---|---|
| redirect_uri_mismatch | Exact callback in Google versus AUTH_URL/proxy-derived URL |
| Access denied during testing | OAuth audience and test-user list |
| Calendar permission missing | Calendar API, consent scopes, and stored granted scopes |
| Refresh fails | Refresh token exists, client credentials match, grant has not expired/revoked; testing-mode token restrictions may apply |
| Local works, AWS fails | ECS secret mapping, task replacement, NAT/external egress, HTTPS callback configuration |
| Wrong day/time | Clinic timezone/date-only conversion rather than changing OAuth settings |

Google OAuth token columns are credentials: restrict database access and avoid token logging. Clinical information placed in Google Calendar requires its own data-handling and contractual review before real patient use; AWS deployment does not cover that integration automatically.

## Open items

- Confirm actual Google Cloud project/client and API enablement.
- Confirm consent audience, test accounts, and scope verification requirements.
- Add/confirm production callback once certificate issuance is resolved.
- Verify production sign-in, token refresh, Calendar access, and role authorization.

References: https://developers.google.com/identity/protocols/oauth2/web-server ; https://developers.google.com/calendar/api/auth
