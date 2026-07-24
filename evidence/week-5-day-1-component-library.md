# Evidence: Week 5 Day 1 — React, Vite & Typed Component Library

## Wireframe Component Decomposition

The Plan Cycle Queue wireframe is decomposed into a clean, typed presentational component hierarchy under `apps/web/src/`:

```text
PlanCycleQueueScreen (screens/PlanCycleQueueScreen.tsx)
├── AppShell (components/AppShell.tsx)
│   ├── Sidebar (components/Sidebar.tsx)
│   │   ├── Workspace Group ("Plan Cycle Queue", "Active Clients", "Action Items")
│   │   ├── Plan Tools Group ("Scenario Modeler", "Tax Bracket Tables", "Liability Calculator")
│   │   └── Firm Group ("Firm Settings", "Team Members", "Audit Logs")
│   └── Topbar (Title + View-as Role Switcher + User Badge)
├── KpiCard Grid (atoms/KpiCard.tsx)
│   ├── "Open Cycles" Card
│   ├── "Awaiting Review" Card
│   ├── "Overdue Cycles" Card (danger tone)
│   └── "Presented This Week" Card (success tone)
├── QueueStates Atoms (atoms/QueueStates.tsx)
│   ├── QueueSkeleton (Loading skeleton UI)
│   ├── QueueEmpty (Empty state UI)
│   └── QueueError (Error state with onRetry affordance)
└── PlanCycleQueueTable (components/PlanCycleQueueTable.tsx)
    └── DataTable<PlanCycleQueueRow> (components/DataTable.tsx — Generic Component)
        └── Badge Atom (atoms/Badge.tsx — Discriminated Union Variant)
```

## Component Contracts & Types

### 1. Discriminated Union Variant (`Badge`)
```typescript
export type BadgeVariant =
  | "draft"
  | "submitted"
  | "in_review"
  | "approved"
  | "overdue";
```

### 2. Generic Component (`DataTable<T>`)
```typescript
export type ColumnDef<T> = {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
};

export type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  ariaLabel?: string;
};
```

---

## Test Execution Output

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

## TypeScript Typecheck Output

```text
$ npm run typecheck --workspace=apps/web

> web@0.0.0 typecheck
> tsc --noEmit
(0 errors)
```
