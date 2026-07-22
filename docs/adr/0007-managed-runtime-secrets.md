# ADR-0007: Managed Runtime Secrets

- Status: Proposed

## Context

TaxPulse needs the Core Case Service to use a database password and RS256 signing keys without committing those values to source control, examples, tests, logs, or generated documentation. A malformed endpoint, missing SecretId, missing secret value, or invalid key payload should fail before the service accepts traffic.

The local development and verification target for this sprint is AWS Secrets Manager through LocalStack. The deployment model should still align with managed cloud access rather than `.env` secret values.

## Decision

The Node Core Case Service loads runtime secrets from AWS Secrets Manager using `@aws-sdk/client-secrets-manager`. In local development the client points at the configured LocalStack endpoint via `AWS_ENDPOINT`; deployed environments will use the normal AWS endpoint and runtime identity.

The remaining non-secret configuration is validated at startup with a strict Zod schema. Required non-secret values include the AWS endpoint and region, HTTP port, database host, database port, database name, database user, database SSL mode, and the SecretIds for the database password and JWT signing keys. Importing the startup path parses this configuration before Express starts listening.

The service preloads all required secrets at boot instead of fetching lazily on first request. This makes missing or malformed secrets a deployment failure, not a user-request failure. The required startup secrets are:

- `DB_SECRET_ID`: the database password SecretString.
- `JWT_SECRET_ID`: a JSON SecretString with `privateKey`, `publicKey`, and optional `keyId`.

The service caches loaded secrets in memory and refreshes them every 5 minutes (`SECRETS_REFRESH_MS=300000`) so rotated secrets are picked up without a redeploy. Initial load is fail-fast. Refresh failures after a successful boot keep the last known good cached values and log the refresh failure.

Secret values must not be read from `.env`, `.env.example`, committed fixtures, or committed configuration files. `.env.example` files may contain only non-secret configuration and SecretId references.

The intended least-privilege deployment model is an IAM task role scoped to `secretsmanager:GetSecretValue` for only the specific database-password and JWT-signing-key SecretIds used by the service. That IAM role is previewed by this decision but not shipped this sprint.

## Consequences

- A missing LocalStack secret or malformed JWT key payload prevents the API from booting with a clear error.
- Secret rotation can be adopted without redeploying the service, subject to the 5-minute refresh interval.
- Developers must seed LocalStack Secrets Manager before starting the API locally.
- Tests that need signing behavior use ephemeral in-memory keys created only under the test runner; runtime startup never falls back to generated or env-provided signing keys.

## Alternatives Considered

- Store secrets directly in `.env`: Rejected. It invites accidental commits and lets local behavior drift from deployed behavior.
- Lazy-load secrets on first request: Rejected. It would turn configuration mistakes into user-facing request failures instead of startup failures.
- Generate JWT keys at runtime for local development: Rejected for service startup. It can invalidate tokens unexpectedly and hides missing managed-store configuration.
- Refresh only on redeploy: Rejected. It prevents routine secret rotation from being picked up by a running service.
