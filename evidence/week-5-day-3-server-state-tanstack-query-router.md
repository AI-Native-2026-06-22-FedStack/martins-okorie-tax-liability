# Evidence: Week 5 Day 3 — Server State, TanStack Query & Router

## Task 1: Auth-Aware Fetch Client

### 1. React 18 Alignment

- `apps/web` is aligned to React 18 dependencies: `react@18.3.1`, `react-dom@18.3.1`, `@types/react@18.3.18`, and `@types/react-dom@18.3.5`.
- `@testing-library/react` is aligned to `14.3.1` so the React 18 renderer resolves to the same React instance.

### 2. Single Fetch-Based API Client

- `apps/web/src/api/apiClient.ts` exports the single `apiRequest<TResponse>` wrapper around browser `fetch`.
- Every request receives `Authorization: Bearer <token>` from the D2 `useAuthSession` adapter and an `X-Correlation-Id`.
- No `axios` or other HTTP client is introduced.

### 3. Typed Error Mapping

- `apps/web/src/api/apiError.ts` defines `ProblemDetails` and `ApiError`.
- Non-ok RFC 9457 Problem+JSON responses are mapped into typed `ApiError` instances.
- Malformed or missing error bodies fall back to a typed generic Problem Details shape.

### 4. 401 Refresh Behavior

- `apiRequest` refreshes once on `401`, retries the original request exactly once, and logs out on failed refresh or persistent `401`.
- Concurrent `401`s share one module-level in-flight refresh promise.
- `useAuthSession.refreshSession` owns token rotation for this frontend-only task because the frozen backend does not expose a refresh route yet.

### 5. ADR-0013

- `docs/adr/ADR-0013-data-fetching.md` records the decision that TanStack Query owns server state, React Router owns navigation only, and the fetch-based auth-aware client is the single path to the API.
- Rejected alternatives are `axios`, Router loaders/actions for API data, and per-screen fetch/refresh logic.

## Verification Outputs

### Baseline before Task 1 code

```text
$ npm run test --workspace=apps/web
Test Files  12 passed (12)
Tests       40 passed (40)
```

### React 18 dependency tree

```text
$ npm ls react react-dom @testing-library/react --workspace=apps/web
web@0.0.0
├─┬ @testing-library/react@14.3.1
│ ├── react-dom@18.3.1 deduped
│ └── react@18.3.1 deduped
├─┬ react-dom@18.3.1
│ └── react@18.3.1 deduped
└── react@18.3.1
```

### Vitest suite after Task 1

```text
$ npm run test --workspace=apps/web
Test Files  13 passed (13)
Tests       46 passed (46)
```

### TypeScript typecheck

```text
$ npm run typecheck --workspace=apps/web
(0 errors)
```

### Fetch and axios scan

```text
$ rg "axios|fetch\(" apps/web/src
apps/web/src/api/apiClient.ts
```
