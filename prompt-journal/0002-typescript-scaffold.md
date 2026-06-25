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

Accepted or rejected — No

Why — There

# Entry 5

Asked — Configure ESLint and Prettier so one command runs both with no warnings, wire Vitest through the documented test script, include a rule for floating promises and unhandled rejections, verify the skeleton passes, and commit the configuration files.

Produced — Added shared ESLint, Prettier, TypeScript ESLint, Vitest, and ignore configuration; installed pinned npm dependencies; verified `npm run check`, `npm test`, and `npm run build` pass cleanly; and committed the configuration and scaffold files.

Accepted or rejected — Pending engineer review.

Why —
