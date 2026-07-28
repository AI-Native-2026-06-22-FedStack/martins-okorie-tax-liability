# Prompt Journal: Server State, TanStack Query & Router

## Entry 1

Asked — Copy the attached Week 5 Day 3 "Server State: TanStack Query & Router" helper into the repository and create a new prompt journal.

Produced — Saved `helper/week-5-day-3-server-state-tanstack-query-router.md` from the provided lesson text and initialized `prompt-journal/0021-server-state-tanstack-query-router.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 5 Day 3 helper lesson material is saved in the repository helper directory and prompt journal 0021 is initialized for the new server-state, TanStack Query, and Router work.

## Entry 2

Asked — Implement Task 1 from the Week 5 Day 3 plan: align `apps/web` to React 18, build the one fetch-based auth-aware API client with typed Problem+JSON errors, add `useAuthSession.refreshSession`, record ADR-0013, add evidence, and verify tests/typecheck/grep.

Produced — Downgraded the web app to React 18-compatible dependencies, added `apps/web/src/api/apiError.ts` and `apps/web/src/api/apiClient.ts`, extended `useAuthSession` with `refreshSession`, added focused `apiClient` and auth refresh tests, recorded `docs/adr/ADR-0013-data-fetching.md`, linked it from the ADR index, and created `evidence/week-5-day-3-server-state-tanstack-query-router.md`.

Accepted or rejected — Accepted.

Why — `npm run test --workspace=apps/web` passed 46/46 tests across 13 files and `npm run typecheck --workspace=apps/web` completed with 0 errors, confirming the typed fetcher, single refresh retry, refresh stampede guard, logout-on-persistent-401 behavior, and React 18 dependency alignment.
