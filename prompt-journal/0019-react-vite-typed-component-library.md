# Prompt Journal: React, Vite & a Typed Component Library

## Entry 1

Asked — Save the attached Week 5 Day 1 "React, Vite & a Typed Component Library" lesson into the helper folder and start a new prompt journal.

Produced — Saved `helper/week-5-day-1-react-vite-typed-component-library.md` from the provided lesson text and initialized `prompt-journal/0019-react-vite-typed-component-library.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 5 Day 1 helper lesson material is saved in the repository helper directory and prompt journal 0019 is initialized for Week 5 Day 1 work.

## Entry 2

Asked — Scaffold `apps/web` with Vite's `react-ts` template, configure strict TypeScript (`strict: true`, `noImplicitAny: true`, `jsx: "react-jsx"`), configure Vitest with jsdom environment and testing-library jest-dom matchers setup, and verify dev and test commands.

Produced — Scaffolded `apps/web` React 18 + TypeScript SPA using Vite. Installed `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, and `vitest`. Configured `apps/web/tsconfig.json`, `apps/web/tsconfig.app.json`, `apps/web/vite.config.ts`, and `apps/web/vitest.setup.ts`.

Accepted or rejected — Accepted.

Why — `npm run typecheck --workspace=apps/web` passed cleanly and `npm run test --workspace=apps/web` executed Vitest without errors.

## Entry 3

Asked — Execute Task 1: Shape `apps/web/src` into a design-system folder layout (`atoms/`, `components/`, `screens/`, `styles/`), port the wireframe custom properties into `src/styles/tokens.css` consumed via `var(--token)`, configure CSS Modules for scoped styles without inline styles or global CSS-in-JS libraries, and record ADR-0011 styling strategy.

Produced — Created `apps/web/src/styles/tokens.css` with centralized `:root` custom properties and imported it in `apps/web/src/index.css`. Created `docs/adr/ADR-0011-styling-strategy-css-modules.md` (linked in `docs/adr/README.md`) capturing CSS Modules decision ("just CSS, scoped") and weighing `vanilla-extract` as the type-safe alternative.

Accepted or rejected — Accepted.

Why — `apps/web/src` is shaped as a design system, CSS Modules scope component styles cleanly with zero inline styles outside design tokens, and ADR-0011 documents the styling decision.

## Entry 4

Asked — Execute Task 2: Build the typed, presentational component library from the wireframe in `apps/web/src` (`atoms/`, `components/`, `screens/`), ensuring all components are pure functions of props (no fetching, no state), using a discriminated union for `Badge` variants, building one generic component `DataTable<T>`, building `QueueStates` (skeleton, empty, error with retry), and rendering `PlanCycleQueueScreen` with KPI cards and table.

Produced — Implemented `Badge` (discriminated union variant `draft | submitted | in_review | approved | overdue`), `KpiCard`, `QueueStates` (loading/empty/error atoms), `DataTable<T>` (reusable generic table shell), `Sidebar` (Workspace / Plan Tools / Firm), `AppShell` (topbar with View-as switcher + sidebar frame), `PlanCycleQueueTable` (concrete `<T>` table use with overdue badge), and `PlanCycleQueueScreen`. Added behavioral Vitest + React Testing Library tests in `apps/web/src/test/`.

Accepted or rejected — Accepted.

Why — `npm run test --workspace=apps/web` passed 16/16 behavioral tests across 6 test files, proving generic `DataTable<T>` type safety over two distinct row types, proper badge variant rendering, and error retry affordances without `any` or snapshot assertions.



