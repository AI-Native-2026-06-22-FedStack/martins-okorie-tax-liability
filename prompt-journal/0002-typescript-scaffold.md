# NEntry 1

Asked — Scaffold the TypeScript project at the repository root by filling in strict-stack `tsconfig.json` and `package.json` skeletons.

Produced — Added a strict Node ESM TypeScript configuration and a pinned package manifest with build, lint, format, typecheck, and Vitest test scripts plus Express and zod dependencies.

Accepted or rejected — Accepted.

Why — Sets the base of the dependencies needed to run the project smoothly, a base

# Entry 2

Asked — Create the empty folders and files from the TypeScript scaffold tree that are not yet present.

Produced — Added `vitest.config.ts` and an empty `src/` scaffold containing `index.ts`, `tax-liability.ts`, `tax-liability.schema.ts`, and `tax-liability.test.ts`.

Accepted or rejected — Accepted.

Why — Easier to scaffold and add code when folders and entries are already there

# Entry 3

Asked — Update `AGENTS.md` so new work streams start in a new sequential prompt journal file, and move the TypeScript scaffold entries out of `0001-bootstrap.md`.

Produced — Added the new prompt-journal file guidance to `AGENTS.md`, removed the TypeScript scaffold entries from `prompt-journal/0001-bootstrap.md`, and transferred them into `prompt-journal/0002-typescript-scaffold.md`.

Accepted or rejected — Pending engineer review.

Why — I have a constant automated flow of prompt journals entries after each succesful PR. Simplicity

# Entry 4

Asked — Run a bootstrap smoke test by installing npm dependencies, building under strict TypeScript, and running the compiled entrypoint to confirm the startup line prints.

Produced — Added the async startup entrypoint line needed for the smoke test. The sandboxed `npm install` attempt was stopped after hanging without output, the network-approved retry was denied, and `npm run build` could not run because `tsc` was not installed.

Accepted or rejected — Rejected

Why — There rest of the file was not completed yet, decided to wait to npm install dependencies

# Entry 5

Asked — Configure ESLint and Prettier so one command runs both with no warnings, wire Vitest through the documented test script, include a rule for floating promises and unhandled rejections, verify the skeleton passes, and commit the configuration files.

Produced — Added shared ESLint, Prettier, TypeScript ESLint, Vitest, and ignore configuration; installed pinned npm dependencies; verified `npm run check`, `npm test`, and `npm run build` pass cleanly; and committed the configuration and scaffold files.

Accepted or rejected — Accepted

Why — Crucial for keeping the code clean and eliminating unintended spaces and making the code look visually distracting

# Entry 6

Asked — Build a typed async aggregation client over an in-memory mock source, race each call against a configurable timeout, validate the income/deduction aggregation payload with zod, surface typed errors, and keep lint clean.

Produced — Added the zod income/deduction aggregation schema with inferred type reuse, implemented the typed async mock aggregation client with timeout, validation, and source errors, and added Vitest coverage for success, validation failure, and timeout behavior.

Accepted or rejected — Accepted

Why — This created the first real async boundary for TaxPulse and proved the service can validate untrusted aggregation data, handle slow sources, and report typed failures without weakening strict TypeScript.

# Entry 7

Asked — Write a Vitest suite for the helper covering a happy path and an error path, ensure it runs locally through the documented `npm test` script with no network access, and confirm the single check command ends green.

Produced — Confirmed the existing Vitest suite asserts the helper's successful aggregation path and rejection paths for malformed input and timeout behavior, then ran the documented test and check scripts locally.

Accepted or rejected — Accepted

Why — The tests make the helper behavior reviewable instead of assumed: the happy path verifies the calculation output, and the error paths prove malformed inputs and timeouts fail in controlled ways.

# Entry 8

Asked — Integrate the necessary project-scope information from `02_TaxPulse_Advisory 1.txt` into `AGENTS.md` near the top, keep the entry in the current `0002` journal, and update `AGENTS.md` so a new journal file starts only when explicitly requested.

Produced — Added a `Project Scope` section to `AGENTS.md` covering TaxPulse Advisory's buyer, Tax Plan Cycle case entity, workflow stages, role boundaries, MVP authentication, no-status-field rule, on-hold handling, and audit/workflow enforcement expectations. Updated the prompt-journal instructions so entries continue in the current journal unless the engineer asks for a new file. Removed the unintended `0003` journal file.

Accepted or rejected — Accepted

Why — Keeping the project scope in `AGENTS.md` gives future Codex sessions the same TaxPulse domain boundaries before they generate code, and continuing in `0002` matches the current journal workflow.

# Entry 9

Asked — Refactor the `src` code files to follow the TaxPulse project scope and the Week 1 Day 2 TypeScript, Node, and async fundamentals skills.

Produced — Refactored the TaxPulse source files around the Tax Plan Cycle domain, added zod-validated schemas and derived DTO types, modeled concurrent async source loading with `Promise.allSettled`, added typed timeout/source/validation errors, calculated scenario-level real-time tax-liability results, and expanded Vitest coverage for successful modeling, partial async failure collection, validation failure, and timeout failure. Verified with `npm run typecheck`, `npm test`, `npm run check`, and `npm run build`.

Accepted or rejected — Accepted

Why — The refactor aligned the code with the actual Tax Plan Cycle product model and the Day 2 skills at the same time, so the implementation now demonstrates strict DTO derivation, zod boundary parsing, safe concurrent async work, and typed error handling in the TaxPulse vocabulary.
