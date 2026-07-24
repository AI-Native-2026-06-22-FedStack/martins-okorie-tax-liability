## Summary

Gives the `apps/web` React 18 Single-Page Application stateful logic through custom hooks, rules-of-hooks compliance, explicit state classification, and targeted performance optimizations:

1. **`useAuthSession` Custom Hook & Sign-In Surface**:
   - `useAuthSession` ([apps/web/src/hooks/useAuthSession.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/hooks/useAuthSession.ts)) manages access/refresh tokens with a justified storage strategy (`sessionStorage` to mitigate XSS while persisting across tab reloads).
   - Invokes all hooks unconditionally at top level. Token refresh `useEffect` returns a cleanup function (`clearTimeout(timer)`) preventing double-firing or leaks under React 18 `StrictMode`.
   - Returns a typed interface without `any`.
   - `SignInScreen` ([apps/web/src/screens/SignInScreen.tsx](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/screens/SignInScreen.tsx)) steps through credentials, MFA TOTP challenge, and UI-only mock password reset driven strictly by `auth.step`.

2. **Custom Utility Hooks**:
   - `useDebounce<T>` ([apps/web/src/hooks/useDebounce.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/hooks/useDebounce.ts)): Generic hook delaying value updates until typing pauses, with timer cleanup.
   - `usePagination<T>` ([apps/web/src/hooks/usePagination.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/hooks/usePagination.ts)): Generic hook calculating page slices and navigation controls with safe bounds math.

3. **ADR-0012 State Classification**:
   - Recorded [docs/adr/ADR-0012-local-state-vs-store.md](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/ADR-0012-local-state-vs-store.md) (linked in `docs/adr/README.md`) classifying state into Local Component State, Server State, and Shared Client State, rejecting premature global stores (Redux/Zustand) for UI state.

4. **Targeted Performance Hooks**:
   - `useTransition` for non-urgent search input query updates.
   - `useMemo` for filtered queue rows.
   - `useCallback` for item selection handlers.
   - `React.memo` for `PlanCycleQueueTable` and column definitions to skip unchanged row renders.

---

## Testing & Verification Output

### 1. Vitest Behavioral & Isolation Test Suite (`apps/web`)

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

### 2. TypeScript Workspace Typecheck Output

```text
$ npm run typecheck --workspace=apps/web

> web@0.0.0 typecheck
> tsc --noEmit
(0 errors)
```

### 3. Vite Dev Server Shell Rendering Output

```text
$ npm run dev --workspace=apps/web

  VITE v6.0.3  ready in 218 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  Result: Dev server starts cleanly, rendering SignInScreen when unauthenticated and PlanCycleQueueScreen when authenticated.
```

### 4. Zero Snapshot Test Verification

```text
$ grep -r toMatchSnapshot apps/web
(0 matches)
```

---

## AI-tool reflection

I accepted Codex's recommendation to extract search debouncing and list pagination into generic custom hooks (`useDebounce<T>` and `usePagination<T>`) and test them in isolation via `renderHook`, because packaging stateful logic behind named custom hooks eliminates duplicate timer logic across screens and allows logic to be verified once in isolation. I rejected an early suggestion to introduce a Zustand global store for search and pagination state; as documented in ADR-0012, UI search inputs and list pagination belong in local component state (`useState` / custom hooks) and adding a global store would introduce indirection and boilerplate without benefit.

---

## PR routing

- **Assignees**: Self-assigned (`@martins-okorie`).
- **Reviewers**: Request `Isaiah Muli` as the ES reviewer.

---

## Deliverables checklist

- [x] **`useAuthSession` Custom Hook & Justified Storage**: `useAuthSession` holds session state, restores state across reloads via `sessionStorage` (justified in a top-of-file comment), exposes a typed interface with no `any`, calls every hook at top level, and tears down refresh timers in cleanup to avoid `StrictMode` leaks.
- [x] **State-Driven Sign-in & MFA Surface**: `SignInScreen` presents credentials, 6-digit TOTP MFA challenge, and UI-only mocked password reset views driven strictly by `auth.step`.
- [x] **Custom Hooks & Isolation Tests**: `useDebounce<T>` and `usePagination<T>` extracted as generic custom hooks, tested in isolation via `renderHook` asserting initial states, transitions, and timer cleanup.
- [x] **ADR-0012 State Classification**: `docs/adr/ADR-0012-local-state-vs-store.md` recorded and linked in `docs/adr/README.md`, classifying state into Local vs Server vs Shared Client state and rejecting premature global store additions.
- [x] **Targeted Performance Optimization**: Applied `useTransition`, `useMemo`, `useCallback`, and `React.memo` to target real rendering costs in the queue table during search filtering.
- [x] **Testing & Verification**: 33 Vitest tests passing across 10 test files, 0 typecheck errors, 0 snapshot tests.
