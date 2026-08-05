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
