# Prompt Journal: Forms, Tables & Dashboards

## Entry 1

Asked — Copy the attached Week 5 Day 4 "Forms, Tables & Dashboards" helper into the repository and create a new prompt journal.

Produced — Saved `helper/week-5-day-4-forms-tables-dashboards.md` from the provided lesson text and initialized `prompt-journal/0022-forms-tables-dashboards.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 5 Day 4 helper lesson material is saved in the repository helper directory and prompt journal 0022 is initialized for the new forms, tables, and dashboards work.

## Entry 2

Asked — Create the new Task 1 Scenario Planner form and test files.

Produced — Added a shared zod create-cycle schema, wired `ScenarioPlannerForm` with `react-hook-form` and `zodResolver`, added a create-cycle TanStack Query mutation that posts through `apiRequest` and invalidates the queue, routed `/cycles/new`, added form/mutation/router tests, and recorded evidence.

Accepted or rejected — Accepted.

Why — The web suite passed 65/65 tests across 17 files, typecheck completed with 0 errors, the form imports the schema from `@capstone/shared-schemas`, and grep confirmed no local `z.object` or mixed built-in validators in the form component.

## Entry 3

Asked — Complete Task 2 by turning the scenario results/income list into a working accessible table with `@tanstack/react-table` v8.

Produced — Added `ScenarioResultsTable` driven by the Deliverable 3 `usePlanCycleQueue` query, configured TanStack Table row models for sorting, filtering, and pagination, rendered semantic table markup with scoped headers and `aria-sort`, added row action buttons, routed the table under `/cycles/results`, and added RTL coverage for semantic DOM, sort, filter, pagination, keyboard reachability, and row actions.

Accepted or rejected — Accepted.

Why — The focused table tests passed 5/5, the full web suite passed 70/70 tests across 18 files, typecheck completed with 0 errors, and grep confirmed direct `fetch(` remains isolated to `apiClient.ts`.

## Entry 4

Asked — Implement Task 3 by building dashboard KPI cards and four Chart.js charts from real Deliverable 3 query data, with accessible text alternatives.

Produced — Added `chart.js` and `react-chartjs-2`, replaced the static dashboard route with a query-backed `Dashboard`, registered Chart.js elements, mapped plan-cycle query rows into quarterly, stage, priority/overdue, and year charts, added visible data-table alternatives for every chart, and added focused dashboard tests.

Accepted or rejected — Accepted.

Why — The focused dashboard tests passed 5/5, the full web suite passed 75/75 tests across 19 files, typecheck completed with 0 errors, and grep confirmed Chart.js registration plus direct `fetch(` isolation in `apiClient.ts`.
