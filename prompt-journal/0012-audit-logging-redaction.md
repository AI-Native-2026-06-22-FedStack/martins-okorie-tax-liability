# Prompt Journal: Week 3 · Day 3 Audit Logging & Redaction

## Entry 1

Asked — Setup helper file with instructions and initialize new journal.

Produced — Created `helper/week-3-day-3-audit-logging-redaction.md` and initialized this journal.

Accepted or rejected — Accepted.

Why — Lesson instructions stored in helper and new journal initialized for this segment.

## Entry 2

Asked — Install logging packages, implement and wire the correlation ID middleware in both Node (Express) and Python (FastAPI), expose the Express integration route, and write unit/integration tests to verify propagation.

Produced — Installed `pino`/`pino-http` in `apps/api` and `structlog` in `services/compute`. Implemented custom `correlationMiddleware` in `apps/api/src/logging/correlation.ts` using outer-inner middleware mapping to ensure response headers are populated early. Wired middleware in `apps/api/src/app.ts` and registered `POST /cycles/:id/compute` in `apps/api/src/routes/cycle.routes.ts` forwarding headers and request context. Implemented `CorrelationIdMiddleware` in `services/compute/app/correlation.py` and `configure_logging` in `services/compute/app/logging_config.py`. Wired both in `services/compute/app/main.py`. Added comprehensive tests in `apps/api/test/logging/correlation.test.ts` and `services/compute/tests/test_trust_domain.py`.

Accepted or rejected — Accepted.

Why — Correlation ID propagation and structured JSON logging are fully implemented, verified, and test suites are green across both Node and Python runtimes.

## Entry 3

Asked — Implement boundary logging redaction driven by a shared config in both Express (Node) and FastAPI (Python), and verify with tests on success and error paths.

Produced — Created a shared `shared/redaction-config.json` defining sensitive paths. Created `apps/api/src/logging/redaction-config.ts` exporting paths for pino's redact option. Implemented recursive `redact_processor` inside `services/compute/app/logging_config.py` using repository-root parent directory parsing to dynamically load config keys. Wrote redaction tests in `apps/api/test/logging/redaction.test.ts` and `services/compute/tests/test_redaction.py`. Verified that removing a key from the list causes tests to fail in both runtimes and restoring it passes.

Accepted or rejected — Accepted.

Why — Centralized boundary redaction works flawlessly across both runtimes, and the regression tests prove that sensitive data is censored correctly.


