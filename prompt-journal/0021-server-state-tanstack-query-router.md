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

## Entry 3

Asked — Implement Task 2 from the Week 5 Day 3 plan: wire the Plan Cycle Queue and detail as TanStack Query server state through the Task 1 fetcher, add tenant/role-scoped query keys, add a transition mutation with optimistic update/rollback/exact invalidation, render loading/empty/error states, and verify tests/typecheck/grep.

Produced — Installed `@tanstack/react-query`, wrapped the web app in `QueryClientProvider`, added `apps/web/src/api/usePlanCycles.ts` with queue/detail queries and transition mutation, wired server-backed queue/detail screen wrappers, preserved local UI state for search/pagination/tabs/comments, added hook and server-screen tests, and extended the Week 5 Day 3 evidence file.

Accepted or rejected — Accepted.

Why — `npm run test --workspace=apps/web` passed 53/53 tests across 15 files and `npm run typecheck --workspace=apps/web` completed with 0 errors, confirming scoped query keys, fetcher-only API access, optimistic transition rollback, exact query invalidation, and loading/empty/error rendering on the wired screens.

## Entry 4

Asked — Fix the remaining React `act(...)` warnings from older component tests so the Task 2 verification no longer needs a warning note.

Produced — Updated the Sign In and Plan Cycle Detail component tests to wrap state-changing user interactions in React Testing Library `act` boundaries while preserving their existing behavior coverage.

Accepted or rejected — Accepted.

Why — The focused affected-test run and full web test suite both pass without the prior `act(...)` warning output, and `npm run typecheck --workspace=apps/web` completes with 0 errors.

## Entry 5

Asked — Implement Task 3 from the Week 5 Day 3 plan: route the workspace with React Router, guard internal routes, render route errors inside the shell, clear TanStack Query cache on logout, and verify tests/typecheck/grep.

Produced — Added React Router, created guarded workspace routing with a shared `AppShell` layout and `Outlet`, split queue/detail screens into content and shell wrappers, added a minimal dashboard route, wired queue-to-detail navigation, added a route error element inside the shell, cleared query cache on logout, and added router behavior tests.

Accepted or rejected — Accepted.

Why — `npm run test --workspace=apps/web -- --reporter=dot` passed 58/58 tests across 16 files and `npm run typecheck --workspace=apps/web` completed with 0 errors, confirming guarded redirects, shared-shell routing, route error containment, logout cache clearing, and no Router-owned API fetching.

## Entry 6

Asked — Check whether any other fixes were needed based on the stage changes.

Produced — Updated the Plan Cycle Detail current-stage badge to derive its visual variant from the actual workflow stage instead of always using the Review variant.

Accepted or rejected — Accepted.

Why — The detail stage badge now stays visually consistent with Intake, Data Aggregation, Modeling, Review, Client Approval, Executed, and Archived stages, and the web test suite plus typecheck both pass.
