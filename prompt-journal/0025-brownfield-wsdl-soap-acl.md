# Prompt Journal: Brownfield WSDL SOAP ACL

## Entry 1

Asked — Copy the attached Week 6 Day 3 "Brownfield #1: Reading a WSDL & Building a SOAP ACL" lesson into the helper directory and create a new prompt journal.

Produced — Saved `helper/week-6-day-3-brownfield-reading-wsdl-soap-acl.md` from the provided lesson text and initialized `prompt-journal/0025-brownfield-wsdl-soap-acl.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 6 Day 3 brownfield WSDL and SOAP anti-corruption layer helper lesson is saved in the repository helper directory and prompt journal 0025 is initialized for the new brownfield integration work.

## Entry 2

Asked — Set up the new `services/tivs-acl` SOAP anti-corruption-layer package with pinned dependencies, environment example placeholders, REST/DTO boundary scaffolding, Module 3 redaction reuse, circuit breaker, type-leak test, and Pact provider test placeholder.

Produced — Added the TIVS ACL service package with pinned `soap`, `opossum`, `express`, `@pact-foundation/pact`, `vitest`, and `@types/opossum` dependencies; created config-only `.env.example`; scaffolded the node-soap client behind a narrow interface, clean capstone DTOs, SOAP response/fault translation, audit redaction, Opossum breaker, Express endpoints, type-leak test, Pact provider todo, and service lockfile; verified the live WSDL builds and exposes `VerifyTaxpayer` and `GetTaxpayerStatus` without committing runtime URLs or credentials.

Accepted or rejected — Accepted.

Why — The new ACL service typechecks and its local tests pass, dependencies install with no reported vulnerabilities, and the live WSDL describe smoke confirms the expected operations while keeping hosted connection details out of committed config.

## Entry 3

Asked — Read the TIVS WSDL directly without MCP or expert help, verify both SOAP operations and the declared fault line by line against the WSDL source, name the brownfield smells the ACL must absorb, and begin ADR-0015 with the verified contract and verification trail.

Produced — Fetched the EM-shared WSDL into a temporary file outside the repository, verified `VerifyTaxpayer` and `GetTaxpayerStatus` against `wsdl:message`, `xsd:element`, `wsdl:operation`, and `wsdl:fault` declarations, added `docs/adr/ADR-0015-tivs-wsdl-soap-acl-boundary.md`, and corrected the ACL translator to use the WSDL-confirmed `Standing`, `AsOfDate`, optional `VerifiedName`, and response `TINType` fields. Also added an ACL Vitest config so compiled `dist` tests are not rediscovered after builds.

Accepted or rejected — Accepted.

Why — ADR-0015 now documents the verified operation/message/fault contract with WSDL line references, records the numeric-string `MatchCode`, MMDDYYYY `AsOfDate`, and unknown-TIN code-vs-fault inconsistency, and the ACL service still passes typecheck, tests, and build after the contract corrections.

## Entry 4

Asked — Implement tp-097 by building the TIVS node-soap client inside `services/tivs-acl`, reading the WSDL URL from config, exposing only a narrow interface for `VerifyTaxpayer` and `GetTaxpayerStatus`, keeping the raw SOAP client private, and proving the verification operation is callable.

Produced — Refactored `src/soap/tivsClient.ts` so `createTivsClient()` reads `TIVS_WSDL_URL`, `TIVS_ENDPOINT_URL`, and WS-Security credentials from environment config, builds the generated client with `soap.createClientAsync`, overrides the endpoint, and exposes only `verifyTaxpayer` and `getTaxpayerStatus` through the exported `TivsClient` interface. Moved SOAP response casts out of REST-facing server code into translation, and added a stubbed `tivsClient.test.ts` that proves `verifyTaxpayer` calls `VerifyTaxpayerAsync` through the interface using fictional sample data.

Accepted or rejected — Accepted.

Why — The TIVS client has no hardcoded URL or exported node-soap client/type, the callable interface test passes, and the ACL service passes typecheck, tests, and build.

## Entry 5

Asked — Implement tp-098 and tp-099 by inserting the anti-corruption layer so SOAP responses map to TaxPulse DTOs, `TaxpayerNotFoundFault` maps to a typed domain error, VerifyTaxpayer code `2` uses the same not-found concept, and type-leak regression tests fail if SOAP types reach capstone-facing signatures.

Produced — Reworked the ACL DTOs into TaxPulse vocabulary with `TaxpayerVerificationResult`, `TaxpayerComplianceStatusResult`, and typed `TivsDomainError` subclasses; moved response/fault mapping into `translate.ts`; made the exported TIVS client return DTOs rather than raw SOAP responses; mapped numeric-string match codes into domain decisions, parsed MMDDYYYY dates into `Date`, translated `TaxpayerNotFoundFault` into `TaxpayerIdentifierNotFoundError`, and added translator plus compile-time type-leak tests. Temporarily changed the public verify return type to `unknown` and confirmed `npm run typecheck` fails before restoring the DTO return type.

Accepted or rejected — Accepted.

Why — SOAP field names are confined to the translation boundary and tests, the public client returns only DTOs or throws typed domain errors, and the ACL service passes typecheck, tests, and build.
