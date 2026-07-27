## Summary

Gives the `apps/web` React 18 Single-Page Application stateful logic through custom hooks, rules-of-hooks compliance, explicit state classification, and targeted performance optimizations:

1. **`useAuthSession` Custom Hook & Sign-In Surface**:
   - `useAuthSession` ([apps/web/src/hooks/useAuthSession.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/hooks/useAuthSession.ts)) manages access/refresh tokens with a justified storage strategy (`sessionStorage` to mitigate XSS while persisting across tab reloads).
   - Invokes all hooks unconditionally at top level. Token refresh `useEffect` returns a cleanup function (`clearTimeout(timer)`) preventing double-firing or leaks under React 18 `StrictMode`.
   - Returns a typed interface without `any`.
   - `SignInScreen` ([apps/web/src/screens/SignInScreen.tsx](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/screens/SignInScreen.tsx)) steps through credentials, MFA TOTP challenge, and UI-only mock password reset driven strictly by `auth.step`.

2. **Reusable `usePlanCycleDetail` Custom Hook & Tabbed Screen**:
   - `usePlanCycleDetail` ([apps/web/src/hooks/usePlanCycleDetail.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/hooks/usePlanCycleDetail.ts)) tracks active tab (`"overview" | "comments" | "audit"`), stage stepper steps, comments list, and **preserves unsaved draft comments across tab switches**.
   - Tested in isolation in [usePlanCycleDetail.test.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/test/usePlanCycleDetail.test.ts) verifying tab transitions and draft comment retention.
   - `PlanCycleDetailScreen` ([apps/web/src/screens/PlanCycleDetailScreen.tsx](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/screens/PlanCycleDetailScreen.tsx)) renders the tabbed detail view driven by the hook.

3. **Custom Utility Hooks**:
   - `useDebounce<T>` ([apps/web/src/hooks/useDebounce.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/hooks/useDebounce.ts)): Generic hook delaying value updates until typing pauses, with timer cleanup.
   - `usePagination<T>` ([apps/web/src/hooks/usePagination.ts](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web/src/hooks/usePagination.ts)): Generic hook calculating page slices and navigation controls with safe bounds math.

4. **ADR-0012 State Classification**:
   - Recorded [docs/adr/ADR-0012-state-management.md](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/ADR-0012-state-management.md) (linked in `docs/adr/README.md`) classifying state into Server State (queue list), Local Component State (detail tab/stepper, sign-in step), and Shared Client State (auth session), rejecting premature global stores (Redux/Zustand) for UI state.

5. **Targeted Performance Hooks**:
   - `useMemo` caching filtered queue rows in `PlanCycleQueueScreen.tsx` with an explicit code comment naming the search keystroke re-render cost.

---

## Testing & Verification Output

### 1. Vitest Behavioral & Isolation Test Suite (`apps/web`)

```text
$ npm run test --workspace=apps/web

> web@0.0.0 test
> vitest run

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web

 ✓ src/test/usePlanCycleDetail.test.ts (4 tests)
 ✓ src/test/useDebounce.test.ts (3 tests)
 ✓ src/test/useAuthSession.test.ts (6 tests)
 ✓ src/test/usePagination.test.ts (4 tests)
 ✓ src/test/DataTable.test.tsx (3 tests)
 ✓ src/test/SignInScreen.test.tsx (4 tests)
 ✓ src/test/PlanCycleDetailScreen.test.tsx (3 tests)
 ✓ src/test/PlanCycleQueueScreen.test.tsx (4 tests)
 ✓ src/test/AppShell.test.tsx (1 test)
 ✓ src/test/QueueStates.test.tsx (3 tests)
 ✓ src/test/Badge.test.tsx (3 tests)
 ✓ src/test/PlanCycleQueueTable.test.tsx (2 tests)

 Test Files  12 passed (12)
      Tests  40 passed (40)
   Start at  10:16:58
   Duration  2.99s
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

I accepted Codex's recommendation to extract search debouncing, list pagination, and tabbed detail state into generic custom hooks (`useDebounce<T>`, `usePagination<T>`, `usePlanCycleDetail`) and test them in isolation via `renderHook`, because packaging stateful logic behind named custom hooks eliminates duplicate timer and tab logic across screens and allows logic to be verified once in isolation. I rejected an early suggestion to introduce a Zustand global store for search and pagination state; as documented in ADR-0012, UI search inputs, list pagination, and detail tabs belong in local component state (`useState` / custom hooks) and adding a global store would introduce indirection and boilerplate without benefit.

---

## PR routing

- **Assignees**: Self-assigned (`@martins-okorie`).
- **Reviewers**: Request `Isaiah Muli` as the ES reviewer.

---

## Deliverables checklist

- [x] **`useAuthSession` Custom Hook & Justified Storage**: `useAuthSession` holds session state, restores state across reloads via `sessionStorage` (justified in a top-of-file comment), exposes a typed interface with no `any`, calls every hook at top level, and tears down refresh timers in cleanup to avoid `StrictMode` leaks.
- [x] **State-Driven Sign-in & MFA Surface**: `SignInScreen` presents credentials, 6-digit TOTP MFA challenge, and UI-only mocked password reset views driven strictly by `auth.step`.
- [x] **Reusable Plan Cycle Detail Hook & Screen**: `usePlanCycleDetail` composes built-in hooks to track active tab and stage stepper steps while preserving unsaved draft comments across tab switches. `usePlanCycleDetail.test.ts` asserts transitions and draft retention via `renderHook` and `act()`.
- [x] **ADR-0012 State Classification**: `docs/adr/ADR-0012-state-management.md` recorded and linked in `docs/adr/README.md`, classifying state into Server State (queue list), Local Component State (detail tab/stepper, sign-in step), and Shared Client State (auth session), rejecting premature global store additions.
- [x] **Targeted Performance Optimization**: Applied `useMemo` in `PlanCycleQueueScreen.tsx` caching filtered queue rows with an explicit code comment naming the search keystroke re-render cost.
- [x] **Testing & Verification**: 40 Vitest tests passing across 12 test files, 0 typecheck errors, 0 snapshot tests.
