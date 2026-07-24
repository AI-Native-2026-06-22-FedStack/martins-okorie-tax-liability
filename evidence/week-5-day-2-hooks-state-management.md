# Evidence: Week 5 Day 2 — Hooks & State Management

## Custom Hooks Architecture & State Decisions

### 1. `useAuthSession` Custom Hook ([apps/web/src/hooks/useAuthSession.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/hooks/useAuthSession.ts))
- **Storage Strategy**: `sessionStorage` isolates access/refresh tokens to the browser session tab context to mitigate XSS exposure while persisting state across tab reloads.
- **Top-Level Hooks & StrictMode Cleanup**: Invokes `useReducer` and `useEffect` unconditionally at the top level. The token refresh effect returns a cleanup function (`clearTimeout(timer)`) so React 18 `StrictMode` double-mounting tears down pending timers cleanly and prevents memory leaks.
- **State-Driven Surface**: `SignInScreen` steps through `"credentials"` -> `"mfa"` -> `"authenticated"` driven strictly by `auth.step`.

### 2. Custom Utility Hooks
- **`useDebounce<T>`** ([apps/web/src/hooks/useDebounce.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/hooks/useDebounce.ts)): Generic hook delaying value updates until user typing pauses, with timer cleanup on prop changes.
- **`usePagination<T>`** ([apps/web/src/hooks/usePagination.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/hooks/usePagination.ts)): Generic hook calculating page slices, total pages, and navigation controls with safe bounds clamping.

### 3. Architecture Decision Record (ADR-0012)
- **ADR-0012** ([docs/adr/ADR-0012-local-state-vs-store.md](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/ADR-0012-local-state-vs-store.md)): Formally classifies state into 3 buckets:
  1. *Local Component State*: `useState` / `useReducer` for UI toggles, search inputs, pagination.
  2. *Server State*: Data layer (TanStack Query) for API data caching.
  3. *Shared Client State*: React Context (`useAuthSession`) for global auth identity.
- Rejects premature addition of global store libraries (Redux / Zustand) for local UI state.

### 4. Targeted Performance Optimization Hooks
- **`useTransition`**: Wraps search query input updates in `startTransition` so urgent typing remains responsive while filtering occurs in background.
- **`useMemo`**: Caches filtered queue rows (`useMemo([rows, debouncedQuery])`).
- **`useCallback`**: Stabilizes item selection handler (`useCallback(onSelectCycle)`).
- **`React.memo`**: Wraps `PlanCycleQueueTable` and column definitions to skip re-rendering unchanged row components.

---

## Verification Outputs

### 1. Vitest Behavioral Test Suite (33 Passed, 0 Failures)

```text
$ npm run test --workspace=apps/web

> web@0.0.0 test
> vitest run

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web

 ✓ src/test/usePagination.test.ts (4 tests)
 ✓ src/test/useAuthSession.test.ts (6 tests)
 ✓ src/test/useDebounce.test.ts (3 tests)
 ✓ src/test/DataTable.test.tsx (3 tests)
 ✓ src/test/PlanCycleQueueScreen.test.tsx (4 tests)
 ✓ src/test/PlanCycleQueueTable.test.tsx (2 tests)
 ✓ src/test/SignInScreen.test.tsx (4 tests)
 ✓ src/test/Badge.test.tsx (3 tests)
 ✓ src/test/QueueStates.test.tsx (3 tests)
 ✓ src/test/AppShell.test.tsx (1 test)

 Test Files  10 passed (10)
      Tests  33 passed (33)
   Start at  10:08:38
   Duration  2.63s
```

### 2. TypeScript Typecheck Output (No `any` in props or hooks)

```text
$ npm run typecheck --workspace=apps/web

> web@0.0.0 typecheck
> tsc --noEmit
(0 errors)
```

### 3. Zero Snapshot Assertions

```text
$ grep -r toMatchSnapshot apps/web
(0 matches)
```
