# Prompt Journal: Hooks & State Management

## Entry 1

Asked — Save the attached Week 5 Day 2 "Hooks & State Management" lesson into the helper folder and start a new prompt journal.

Produced — Saved `helper/week-5-day-2-hooks-state-management.md` from the provided lesson text and initialized `prompt-journal/0020-hooks-state-management.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 5 Day 2 helper lesson material is saved in the repository helper directory and prompt journal 0020 is initialized for Week 5 Day 2 work on branch `m5d2-implementation`.

## Entry 2

Asked — Execute Task 1: Build the auth/session custom hook (`useAuthSession.ts`) and minimal sign-in surface (`SignInScreen.tsx`), holding access/refresh tokens with a justified storage strategy (`sessionStorage`), returning a typed interface without `any`, tearing down refresh timers in cleanup to avoid `StrictMode` leaks, calling all hooks at top level, and driving credentials, MFA challenge, and mock reset views strictly from hook state.

Produced — Created `apps/web/src/hooks/useAuthSession.ts` with `sessionStorage` token persistence rationale, `useReducer` for state transitions, top-level hook calls, and a `useEffect` token refresh cleanup function tearing down pending timers. Implemented `SignInScreen.tsx` + `SignInScreen.module.css` driven by `auth.step` (`"credentials" | "mfa" | "authenticated"`). Added `useAuthSession.test.ts` isolation test suite (`renderHook`) and `SignInScreen.test.tsx` component suite.

Accepted or rejected — Accepted.

Why — `npm run test --workspace=apps/web` passed 26/26 tests across 8 test files, confirming token storage restoration, top-level hook invocation, timer cleanup on unmount, and MFA state step progression without `any` or snapshot assertions.

## Entry 3

Asked — Execute Task 2: Extract reusable custom hooks `useDebounce<T>(value, delayMs)` and `usePagination<T>(items, pageSize)`, test each in isolation via `renderHook`, integrate search debouncing and queue table pagination into `PlanCycleQueueScreen.tsx`, and record ADR-0012 (`docs/adr/ADR-0012-local-state-vs-store.md`) classifying state into Local vs Server vs Shared Client state and rejecting premature global store additions (Redux/Zustand).

Produced — Created `apps/web/src/hooks/useDebounce.ts` with timer cleanup and `apps/web/src/hooks/usePagination.ts` with boundary protection. Added `useDebounce.test.ts` (3 tests) and `usePagination.test.ts` (4 tests) isolation test suites using `renderHook`. Integrated search input and pagination controls in `PlanCycleQueueScreen.tsx`. Recorded `docs/adr/ADR-0012-local-state-vs-store.md` (linked in `docs/adr/README.md`).

Accepted or rejected — Accepted.

Why — `npm run test --workspace=apps/web` passed 33/33 tests across 10 test files, confirming search debouncing delay, timer cleanup, pagination bounds math, and ADR-0012 state classification.

## Entry 4

Asked — Build the Plan Cycle Detail client logic as a reusable custom hook (`usePlanCycleDetail.ts`), test it in isolation (`usePlanCycleDetail.test.ts`), and render the tabbed detail screen (`PlanCycleDetailScreen.tsx`). The hook must track the active tab (`overview | comments | audit`) and stage stepper position, and PRESERVE unsaved comment input across tab switches.

Produced — Created `apps/web/src/hooks/usePlanCycleDetail.ts` composing built-in React hooks (`useState`, `useMemo`), maintaining tab state, stepper steps calculation, comments list, and draft comment retention. Added `usePlanCycleDetail.test.ts` isolation test suite verifying tab transitions, stepper calculations, and draft comment retention across tab switches using `renderHook` and `act()`. Built `PlanCycleDetailScreen.tsx` + `PlanCycleDetailScreen.module.css` and added `PlanCycleDetailScreen.test.tsx`.

Accepted or rejected — Accepted.

Why — `npm run test --workspace=apps/web` passed 40/40 tests across 12 test files, confirming stage stepper highlighting, tab switching, and unsaved draft comment retention across tab transitions without `any` or snapshot assertions.

## Entry 5

Asked — Execute Task 3: Record ADR-0012 in `docs/adr/ADR-0012-state-management.md` (MADR format) classifying state (queue list -> server state for D3, detail tab/stepper & sign-in step -> local, auth session -> shared client via hook), choosing built-in hooks by default, naming the bar a store must clear and weighing Zustand as alternative, and applying exactly one targeted performance fix with a named re-render cost note.

Produced — Created `docs/adr/ADR-0012-state-management.md` (linked in `docs/adr/README.md`) capturing state classification, global store bar, and Zustand alternative. Applied `useMemo` in `PlanCycleQueueScreen.tsx` caching filtered queue rows with an explicit code comment naming the search keystroke re-render cost. Verified behavior remains unchanged upon removal.

Accepted or rejected — Accepted.

Why — ADR-0012 documents the 3-bucket state classification and Zustand store bar, `npm run test --workspace=apps/web` passed 40/40 tests across 12 files, and the `useMemo` performance fix is backed by a named cost comment.




