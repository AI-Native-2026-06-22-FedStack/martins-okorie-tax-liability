# ADR-0013: Data Fetching Pattern for Server State and Navigation

- **Status**: Accepted
- **Deciders**: TaxPulse Core Team
- **Date**: 2026-07-28

## Context

The TaxPulse SPA now needs one reliable path to the frozen Core Case Service API. API-backed plan-cycle data is server state: it can go stale underneath the browser and needs cache invalidation, retry-aware errors, and consistent loading/empty/error states. The SPA also needs authenticated requests to attach bearer tokens and correlation IDs without repeating auth code in every screen.

React Router can fetch data through loaders and actions, but using Router data APIs alongside TanStack Query would create two data ownership models and two cache stories.

## Decision

TanStack Query owns server state for the SPA: queries, mutations, cache entries, invalidation, optimistic updates, and reconciliation after writes. React Router owns navigation only: route matching, guarded routes, nested layouts, and contained route errors. Router loaders/actions must not fetch API data.

All SPA calls to the Core Case Service go through one fetch-based auth-aware client. That client attaches the bearer token from `useAuthSession`, sets `X-Correlation-Id`, maps RFC 9457 Problem+JSON responses into a typed `ApiError`, and handles `401` by refreshing once, retrying the original request exactly once, sharing a single in-flight refresh across concurrent `401`s, then returning the user to login if access still fails.

## Consequences

- Server data has one owner and one cache.
- Auth, correlation IDs, error mapping, and refresh retry behavior are centralized.
- Screens render typed API failures instead of parsing backend errors themselves.
- Logout and failed refresh can clear client session state from one place.
- A future live `/auth/refresh` endpoint can be wired inside `useAuthSession.refreshSession` without changing API callers.

## Alternatives considered

- **axios**: Rejected because the workbook rule requires browser `fetch`, and an HTTP library would create a second request abstraction.
- **Fetching in Router loaders/actions**: Rejected because it creates a second cache beside TanStack Query and splits invalidation rules across navigation and server-state layers.
- **Per-screen fetch/refresh logic**: Rejected because it invites missing bearer headers, missing correlation IDs, refresh stampedes, and inconsistent Problem+JSON mapping.
