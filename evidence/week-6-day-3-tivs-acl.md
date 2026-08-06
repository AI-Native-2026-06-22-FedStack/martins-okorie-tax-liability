# Week 6 Day 3 TIVS ACL Evidence

## Verified WSDL

- ADR-0015 records the WSDL contract verified directly from source.
- Verified operations: `VerifyTaxpayer` and `GetTaxpayerStatus`.
- Verified fault: `GetTaxpayerStatus` declares `TaxpayerNotFoundFault`; `VerifyTaxpayer` declares no fault.

## Breaker

- Opossum breaker is configured with `volumeThreshold: 5`, `errorThresholdPercentage: 50`, `resetTimeout: 15000`, and timeout from `TIVS_TIMEOUT_MS`.
- This avoids opening on a single transient failure while still failing fast after a real failure rate.
- `tivsAcl.provider.pact.test.ts` proves the breaker stays closed after the first synthetic failure and opens after the configured failure volume.

## Audit

- ACL server writes an audit line for success and failure paths.
- Audit lines include operation, correlation id, outcome, duration, and redacted taxpayer identifier.
- Taxpayer identifiers are masked to last four digits.
- `tivsAcl.provider.pact.test.ts` proves audit redaction preserves only the last four digits.

## Pact Provider

- `services/tivs-acl/test/tivsAcl.provider.pact.test.ts` verifies the ACL as the provider for the Core Case Service consumer contract.
- Provider verification passed.
- A deliberate DTO drift was tested during implementation and failed provider verification before restoration.

## Commands

- `npm run typecheck` at repo root: passed.
- `npm run typecheck` in `services/tivs-acl`: passed.
- `npm run build` in `services/tivs-acl`: passed.
- `npm test` in `services/tivs-acl`: passed with 2 test files and 6 tests.
