# ADR-0012: State Management Strategy and Targeted Performance Optimization

- **Status**: Accepted
- **Deciders**: TaxPulse Core Team
- **Date**: 2026-07-24

## Context and Problem Statement

With state added across the Single-Page Application (`apps/web`) — including authentication sessions, sign-in steps, plan cycle queue filters, and tabbed case detail views — the team must decide where each piece of state lives. Reaching for a global client store library (e.g., Zustand or Redux Toolkit) out of habit introduces indirection and boilerplate for state that built-in React hooks handle better.

Additionally, user interactions such as search box keystrokes trigger frequent component re-renders. We must apply targeted performance optimizations backed by specific named re-render costs, avoiding blanket memoization on sight.

## Decision Drivers

- **Simplicity & Predictability**: Default to built-in React hooks (`useState`, `useReducer`, custom hooks) and React Context.
- **Strict State Classification**: Clearly separate Server State (API data) from Local UI State and Shared Client State.
- **No Premature Stores**: Enforce an explicit bar before adding any global client store library to the repository.
- **Cost-Backed Performance Fixes**: Require every `useMemo`, `useCallback`, `memo`, or `useTransition` to target a named, measured re-render cost.

## State Classification & Placement Decision

We classify all state across the TaxPulse SPA into three explicit buckets:

| State Surface | Bucket Classification | Managing Mechanism | Rationale & Ownership |
| --- | --- | --- | --- |
| **Plan Cycle Queue List** | **Server State** | Data-fetching layer (Deliverable 3: TanStack Query) | Cached API data belonging to the server; must NOT be placed in a client store. |
| **Detail Tab & Stepper** | **Local Component State** | `usePlanCycleDetail` custom hook (`useState`) | UI navigation state owned strictly by the Plan Cycle Detail view hierarchy. |
| **Sign-In / MFA Step** | **Local Component State** | `useAuthSession` custom hook (`useReducer`) | Form step state (`"credentials"` \| `"mfa"`) owned by the sign-in surface. |
| **Auth Session & Tokens** | **Shared Client State** | `useAuthSession` hook / React Context | Global identity (access/refresh tokens, user role, tenant) read by topbar and router. |

## Alternatives Considered & Global Store Bar

### Alternative: Zustand / Redux Toolkit Global Store
We weighed introducing **Zustand** as a lightweight global store for UI search queries, active tabs, and session state.

### The Bar a Global Store Must Clear
To introduce Zustand or Redux Toolkit into TaxPulse, a feature must demonstrate **specific client state shared by distant, un-nested components that cannot be cleanly passed via React Context**.

### Why Zustand Is Not Justified Yet
- The auth session is cleanly shared via the `useAuthSession` hook and React Context.
- The queue search query, tab index, and stepper step are local to single screen hierarchies.
- Placing the API-backed Plan Cycle Queue list in a global client store would duplicate server state and complicate cache invalidation.

Therefore, premature global stores (Zustand / Redux) are **rejected**.

---

## Targeted Performance Optimization & Named Re-Render Cost

### Identified Re-Render Cost
In `PlanCycleQueueScreen.tsx`, every keystroke in the search box triggers a component re-render. Recomputing the array filtering over the queue rows on every render creates unnecessary CPU overhead as the queue grows.

### Applied Performance Fix
We applied **`useMemo`** to cache the derived filtered queue list:

```typescript
// PERFORMANCE FIX (ADR-0012): Cache filtered queue rows with useMemo to prevent recomputing filtering on every search keystroke render.
const filteredRows = useMemo(() => {
  if (!debouncedQuery.trim()) return rows;
  const q = debouncedQuery.toLowerCase();
  return rows.filter((r) => r.clientName.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
}, [rows, debouncedQuery]);
```

Removing this `useMemo` leaves component behavior unchanged (proving it guards a real computation cost rather than altering functionality).

---

## Consequences

### Positive
- Zero boilerplate or indirection for local UI state across screens.
- Clear separation between server state (D3 query layer) and local React hook state.
- Measured performance optimization targeting a specific re-render cost.

### Negative / Mitigated
- Re-evaluating state placement when new cross-screen wizard workflows are introduced (will require a new ADR if the store bar is met).
