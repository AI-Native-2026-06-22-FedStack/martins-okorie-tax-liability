# Evidence: Week 5 Day 4 — Forms, Tables & Dashboards

## Task 1: Scenario Planner Form

### 1. Shared Schema Validation

- `packages/shared-schemas/src/index.ts` exports `createPlanCycleSchema` and `CreatePlanCycleInput`.
- `apps/web/src/screens/ScenarioPlannerForm.tsx` imports `createPlanCycleSchema` from `@capstone/shared-schemas`.
- The form uses `useForm({ resolver: zodResolver(createPlanCycleSchema) })`.
- The component does not declare a local `z.object` and does not mix built-in `required` or `min` validators into `register`.

### 2. Mutation and Cache Invalidation

- `useCreatePlanCycle(auth)` posts to `/v1/cycles` through `apiRequest`.
- On success, the mutation invalidates the exact scoped queue key from `planCycleKeys.queue(...)`.
- The queue route exposes a keyboard-accessible `New Plan Cycle` action and `/cycles/new` renders inside the guarded workspace shell.

### 3. Accessibility

- Every form input has a real associated label.
- Field errors render from `formState.errors`.
- Error messages are tied back to their inputs with `aria-describedby`.
- The form is keyboard reachable from first field through submit.

## Verification Outputs

### Focused form/mutation/router tests

```text
$ npm run test --workspace=apps/web -- --reporter=dot src/test/ScenarioPlannerForm.test.tsx src/test/usePlanCycles.test.tsx src/test/router.test.tsx
Test Files  3 passed (3)
Tests       17 passed (17)
```

### Full web suite

```text
$ npm run test --workspace=apps/web -- --reporter=dot
Test Files  17 passed (17)
Tests       65 passed (65)
```

### TypeScript typecheck

```text
$ npm run typecheck --workspace=apps/web
(0 errors)
```

### Shared-schema drift and fetch scan

```text
$ rg "z\.object|required:|min:" apps/web/src/screens/ScenarioPlannerForm.tsx -n
(no matches)

$ rg "axios|fetch\(" apps/web/src -n
apps/web/src/api/apiClient.ts:86:  return fetch(`${API_BASE_URL}${path}`, {
```

## Task 3: Dashboard Charts

### 1. Real Query Data Mapping

- `apps/web/src/screens/Dashboard.tsx` maps `usePlanCycleQueue(auth)` data into dashboard KPIs and charts.
- No hard-coded chart arrays are used for displayed values; `buildDashboardModel(rows)` derives all values from queue rows.
- Because the current API shape does not expose real income/tax dollar amounts, the charts use honest operational counts from real plan-cycle rows:
  - due-date quarter counts
  - workflow stage counts
  - priority/overdue counts
  - due-date year counts

### 2. Chart.js Registration and Accessibility

- `ChartJS.register(...)` registers `ArcElement`, `BarElement`, `CategoryScale`, `Legend`, `LineElement`, `LinearScale`, `PointElement`, and `Tooltip`.
- The dashboard renders Bar, Doughnut, and Line charts through `react-chartjs-2`.
- Every chart has an `aria-label` summary and a keyboard-reachable data table with the same values.
- Values are represented with labels and data tables, so color is not the only signal.

### Focused dashboard tests

```text
$ npm run test --workspace=apps/web -- --reporter=dot src/test/Dashboard.test.tsx
Test Files  1 passed (1)
Tests       5 passed (5)
```

### Full web suite after Task 3

```text
$ npm run test --workspace=apps/web -- --reporter=dot
Test Files  19 passed (19)
Tests       75 passed (75)
```

### TypeScript typecheck after Task 3

```text
$ npm run typecheck --workspace=apps/web
(0 errors)
```

### Chart registration and fetch ownership scan

```text
$ rg "react-chartjs-2|ChartJS.register|ArcElement|BarElement|LineElement" apps/web/src/screens apps/web/src/test -n
apps/web/src/test/Dashboard.test.tsx:14:vi.mock("react-chartjs-2", () => ({
apps/web/src/screens/Dashboard.tsx:2:  ArcElement,
apps/web/src/screens/Dashboard.tsx:3:  BarElement,
apps/web/src/screens/Dashboard.tsx:7:  LineElement,
apps/web/src/screens/Dashboard.tsx:13:import { Bar, Doughnut, Line } from "react-chartjs-2";
apps/web/src/screens/Dashboard.tsx:22:ChartJS.register(
apps/web/src/screens/Dashboard.tsx:23:  ArcElement,
apps/web/src/screens/Dashboard.tsx:24:  BarElement,
apps/web/src/screens/Dashboard.tsx:27:  LineElement,

$ rg "axios|fetch\(" apps/web/src -n
apps/web/src/api/apiClient.ts:86:  return fetch(`${API_BASE_URL}${path}`, {
```

## Task 2: Scenario Results Table

### 1. Headless TanStack Table

- `apps/web` now depends on `@tanstack/react-table`.
- `apps/web/src/screens/ScenarioResultsTable.tsx` uses `useReactTable` with:
  - `getCoreRowModel`
  - `getSortedRowModel`
  - `getFilteredRowModel`
  - `getPaginationRowModel`
- Table data comes from `usePlanCycleQueue(auth)`, the Deliverable 3 query hook, with no separate fetch.

### 2. Accessible Semantic Markup

- The table renders a real `<table>`, `<thead>`, `<th scope="col">`, and `<tbody>`.
- Sortable headers expose `aria-sort`.
- The client filter is labeled and keyboard reachable.
- Row actions are keyboard reachable buttons for Open, Edit, and Remove.

### Focused table tests

```text
$ npm run test --workspace=apps/web -- --reporter=dot src/test/ScenarioResultsTable.test.tsx
Test Files  1 passed (1)
Tests       5 passed (5)
```

### Full web suite after Task 2

```text
$ npm run test --workspace=apps/web -- --reporter=dot
Test Files  18 passed (18)
Tests       70 passed (70)
```

### TypeScript typecheck after Task 2

```text
$ npm run typecheck --workspace=apps/web
(0 errors)
```

### Table and fetch ownership scan

```text
$ rg "@tanstack/react-table|useReactTable|getCoreRowModel|getSortedRowModel|getFilteredRowModel|getPaginationRowModel|aria-sort|scope=\"col\"" apps/web/src/screens/ScenarioResultsTable.tsx apps/web/src/test/ScenarioResultsTable.test.tsx -n
apps/web/src/screens/ScenarioResultsTable.tsx:6:  getCoreRowModel,
apps/web/src/screens/ScenarioResultsTable.tsx:7:  getFilteredRowModel,
apps/web/src/screens/ScenarioResultsTable.tsx:8:  getPaginationRowModel,
apps/web/src/screens/ScenarioResultsTable.tsx:9:  getSortedRowModel,
apps/web/src/screens/ScenarioResultsTable.tsx:10:  useReactTable,
apps/web/src/screens/ScenarioResultsTable.tsx:11:} from "@tanstack/react-table";
apps/web/src/screens/ScenarioResultsTable.tsx:101:  const table = useReactTable({
apps/web/src/screens/ScenarioResultsTable.tsx:104:    getCoreRowModel: getCoreRowModel(),
apps/web/src/screens/ScenarioResultsTable.tsx:105:    getFilteredRowModel: getFilteredRowModel(),
apps/web/src/screens/ScenarioResultsTable.tsx:106:    getPaginationRowModel: getPaginationRowModel(),
apps/web/src/screens/ScenarioResultsTable.tsx:107:    getSortedRowModel: getSortedRowModel(),
apps/web/src/screens/ScenarioResultsTable.tsx:162:                      aria-sort={canSort ? sortLabel(sortState) : undefined}
apps/web/src/screens/ScenarioResultsTable.tsx:164:                      scope="col"

$ rg "axios|fetch\(" apps/web/src -n
apps/web/src/api/apiClient.ts:86:  return fetch(`${API_BASE_URL}${path}`, {
```
