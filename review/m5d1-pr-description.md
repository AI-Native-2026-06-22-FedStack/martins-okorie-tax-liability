## Summary

Scaffolds `apps/web` as a React 18 + Vite + strict-TS Single-Page Application and builds the typed, presentational component library from the Plan Cycle Queue wireframe:

1. **Design System Layout**: Organized `apps/web/src` into `atoms/`, `components/`, `screens/`, `styles/`, and `test/`.
2. **ADR-0011** ([docs/adr/ADR-0011-styling-strategy-css-modules.md](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/ADR-0011-styling-strategy-css-modules.md)): Documents the decision to use CSS Modules with centralized design tokens in `apps/web/src/styles/tokens.css`, weighing `vanilla-extract` as the type-safe alternative.
3. **Presentational Component Library**:
   - `Badge` atom with a discriminated union variant (`"draft" | "submitted" | "in_review" | "approved" | "overdue"`).
   - `KpiCard` atom rendering Open / Awaiting Review / Overdue / Presented metrics with tone variants.
   - `QueueStates` atoms rendering loading skeleton (`QueueSkeleton`), empty queue (`QueueEmpty`), and error state with retry affordance (`QueueError`).
   - `DataTable<T>` generic reusable table component rendering any row type `<T>` safely.
   - `Sidebar` component presenting Workspace, Plan Tools, and Firm navigation groups.
   - `AppShell` component framing topbar (with View-as role switcher) and sidebar layout.
   - `PlanCycleQueueTable` component rendering case ID, client, stage, owner, priority, due date, and overdue badges.
   - `PlanCycleQueueScreen` composing the shell, KPI cards, and queue table.
4. **Strict TypeScript & Behavioral Testing**: Banned `any` in props; added 16 behavioral Vitest + React Testing Library tests in `apps/web/src/test/` asserting accessible roles, text, and component states without snapshot testing.

## Testing & Verification Output

### 1. Vitest Behavioral Test Suite (`apps/web`)

```text
$ npm run test --workspace=apps/web

> web@0.0.0 test
> vitest run

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/web

 ✓ src/test/Badge.test.tsx (3 tests)
 ✓ src/test/QueueStates.test.tsx (3 tests)
 ✓ src/test/PlanCycleQueueScreen.test.tsx (4 tests)
 ✓ src/test/DataTable.test.tsx (3 tests)
 ✓ src/test/AppShell.test.tsx (1 test)
 ✓ src/test/PlanCycleQueueTable.test.tsx (2 tests)

 Test Files  6 passed (6)
      Tests  16 passed (16)
   Start at  08:36:17
   Duration  1.92s
```

### 2. TypeScript Typecheck Output

```text
$ npm run typecheck --workspace=apps/web

> web@0.0.0 typecheck
> tsc --noEmit
(0 errors)
```

## AI-tool reflection

I accepted Codex's proposal to organize `apps/web/src` into a design-system directory layout (`atoms/`, `components/`, `screens/`, `styles/`) and use a generic `DataTable<T>` for table rendering, because it enforces a clean separation between reusable primitive UI elements and page composition. I rejected an early suggestion to include inline data-fetching hooks (`useEffect`) inside the presentational components; keeping `PlanCycleQueueScreen` and `PlanCycleQueueTable` as pure functions of typed props ensures they are trivial to test with React Testing Library and remain completely decoupled from backend data sources.

## PR routing

- Assignees: self-assign this PR (`@martins-okorie`).
- Reviewers: request `Isaiah Muli` as the ES reviewer.

## Deliverables checklist

- [x] Design System Layout & ADR-0011: `apps/web` laid out as `atoms/`, `components/`, `screens/`, `styles/`. Design tokens live in `styles/tokens.css` consumed via `var(--token)`. ADR-0011 recorded in `docs/adr/ADR-0011-styling-strategy-css-modules.md`.
- [x] Strict TypeScript & no `any`: `strict: true` enabled in `tsconfig.app.json`. `any` appears nowhere in props.
- [x] Discriminated Union Variant: `Badge` component uses `variant: "draft" | "submitted" | "in_review" | "approved" | "overdue"`.
- [x] Reusable Generic Component: `DataTable<T>` renders any row type `<T>` via typed props and is tested with two distinct row types.
- [x] Presentational Components & States: `PlanCycleQueueTable`, `KpiCard`s, and `QueueStates` (`QueueSkeleton`, `QueueEmpty`, `QueueError` with retry handler) implemented as pure presentational components.
- [x] Behavioral Testing: 16 Vitest + React Testing Library tests query by accessible role/text and test behavior across states without snapshot assertions.
