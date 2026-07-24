# ADR-0012: Local State vs. Global Store Strategy

- **Status**: Accepted
- **Deciders**: TaxPulse Core Team
- **Date**: 2026-07-24

## Context and Problem Statement

As TaxPulse transitions into a React 18 Single-Page Application (`apps/web`), the team needs a explicit strategy for state management. Defaulting to global client stores (e.g. Redux Toolkit or Zustand) for all application state introduces boilerplate, indirection, and unnecessary re-renders. We need a clear classification framework for where state lives.

## Decision Drivers

- **Simplicity & Maintainability**: Avoid premature over-engineering for state used by a single screen or component.
- **Clear Boundaries**: Separate server state (cached API data) from client UI state.
- **Rule Enforcement**: Require an ADR before introducing any global store library into the workspace.

## Considered Options

1. **Premature Global Store for All State (Redux Toolkit / Zustand)**: Put all UI toggles, search inputs, pagination, and API data into a single global store.
2. **Built-in React Hooks Default with 3-Bucket State Classification**: Default to `useState`, `useReducer`, and custom hooks for local UI state; use server-state data fetching (TanStack Query) for API data; reserve global stores only for genuinely shared client state.

## Decision Outcome

Chosen Option: **Option 2 (Built-in React Hooks Default with 3-Bucket State Classification)**.

We classify all TaxPulse state into three distinct buckets:

| State Bucket | Definition & Scope | Primary Mechanism | Example in TaxPulse |
| --- | --- | --- | --- |
| **1. Local Component State** | UI state isolated to a single component or screen hierarchy. | `useState`, `useReducer`, custom hooks (`useDebounce`, `usePagination`) | Search filter text, modal open flags, pagination page index, active tab |
| **2. Server State** | Data originating from the backend API that is cached and synchronized. | Data-fetching layer (TanStack Query / React Query) | Plan Cycle Queue rows, scenario modeling results, client list |
| **3. Shared Client State** | Client-only state genuinely shared across distant, un-nested screens. | React Context (or lightweight store like Zustand if justified) | User authentication session (`useAuthSession`), global theme |

### Rules of Engagement

- **No Global Store without an ADR**: Introducing Redux, Zustand, or Recoil requires a dedicated ADR naming the specific shared client state that cannot be solved with React Context.
- **Server State Is Not Client State**: API data must not be duplicated into client stores.
- **Custom Hooks Share Logic, Not State**: Reusable logic (`useDebounce`, `usePagination`) is extracted into custom hooks; each invocation maintains its own isolated state.

## Consequences

### Positive
- Zero boilerplate or indirection for local UI features (search, pagination, forms).
- Component testing remains trivial using React Testing Library's `render` and `renderHook`.
- Prevents stale server data bugs by delegating API caching to the data layer.

### Negative / Mitigated
- Deep prop drilling across nested components is avoided by using React Context for global auth session (`useAuthSession`).
