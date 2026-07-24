Week 5 · Day 1
"React, Vite & a Typed Component Library"
Read the provided wireframe into a typed component library — React 18 fundamentals and composition, strict TypeScript props with no any, a Vite + CSS Modules design-system layout, and behavioral component tests with Vitest and React Testing Library.

1
Topic 1 of 5
React fundamentals — components, props, composition
Why Do I Need to Know This?
Your live polyglot backend has no face — every demo so far has been curl and test output. This week it gets a React single-page app, and everything in that app is built from components. Before hooks, data, or forms, you need the core model: a component is a function of its props that returns markup, and screens are composed from small components. Get this foundation right and the rest of the week is tractable; get it wrong and you end up rewriting screens.

Scenario
Your team has a wireframe of the capstone’s filing-list screen and an API with no UI. Rather than build one giant FilingListScreen component, the team builds small presentational pieces first — a Badge, a Button, a FilingCard — each a pure function of its props, and composes the screen from them. No data fetching yet; just the shapes the wireframe shows.

Theory
A component is a function of its props
A React component is a function that takes props and returns JSX. Rendering is driven by those props (and later, state): pass different props, get different output.

Composition over configuration
You build a screen by nesting small components and passing children, not by writing one component with a dozen boolean flags. A Card that renders children can hold a filing summary on one screen and a chart on another; a FilingCard composes a Badge and a Button. Composition keeps each piece small and reusable, where a single configurable mega-component grows unmaintainable.

Presentational components are pure
A presentational component is a pure function of its props: given the same props, it renders the same output, with no side effects. That purity is why it is trivial to test (render with props, assert output) and reuse (drop it anywhere with the right props). Data and effects come in 5.2 — Hooks & State Management, through hooks — keeping them out of presentational components is deliberate.

A screen composed from nested components
The filing-list screen is a tree: the page composes a list, the list composes cards, each card composes atoms — props flow down.

FilingListPage

FilingList

FilingCard

Badge (status)

Button (open)

Example
a composed, typed filingcard
type FilingCardProps = { id: string; status: "draft" | "submitted"; onOpen: (id: string) => void };

// (1) a pure function of its props — no fetching, no state
function FilingCard({ id, status, onOpen }: FilingCardProps) {
  return (
    <article>
      <Badge status={status} ></Badge>                         {/* (2) composed from a smaller component */}
      <span>Filing {id}</span>
      <Button onClick={() => onOpen(id)}>Open</Button>  {/* (3) children passed in */}
    </article>
  );
}

Annotation (1) — FilingCard is a pure function of its typed props; the same props always render the same card.
Annotation (2) — it composes a Badge rather than re-implementing a status pill, so the atom is reused everywhere a status shows.
Annotation (3) — Button receives its label as children and an onClick handler as a prop; the card does not fetch or hold state.
AI Practice
Prompt it
Have Codex build a presentational component from the wireframe, then verify it is a pure function of its props.

From this wireframe snippet for a filing card, build a React 18 + TypeScript
presentational component. It must be a pure function of typed props (id, status,
an onOpen callback), compose a Badge and a Button rather than inlining them, and
do no data fetching or state. Show the component and its prop type.

Watch out
Codex often reaches ahead — adding a useEffect to fetch data or useState inside a component that should be purely presentational, which couples it to a data source and makes it hard to reuse and test. It may also inline a badge instead of composing one. Confirm the component takes all its data via props, holds no state, fetches nothing, and composes the smaller atoms.

Verify
Render the component with two different prop sets and confirm the output changes accordingly and is otherwise identical — proof it is a pure function of props. Confirm it imports and composes Badge and Button rather than duplicating them, and that it contains no useEffect/useState/fetch. Record any premature data or state Codex added in your prompt journal.

Knowledge Check
1. What drives what a presentational React component renders?
A global configuration object the component reads on each render.
Its props — it is a function of the props it receives.
The order in which components are declared in the file.
The CSS class names applied to its root element.
2. Why prefer composing small components over one configurable component?
Because React refuses to render a component past a certain size.
Because configurable components cannot accept any props at all.
Small composed pieces stay reusable; a mega-component does not.
Because only composed components can be styled with CSS Modules.
3. What makes a presentational component easy to test and reuse?
It is a pure function of its props, so the same input always renders the same output.
It fetches its own data so a test needs no setup.
It stores its state globally so tests can read it.
It renders different output each time it is called.
4. Where should data fetching live, if not in a presentational component?
Inline in the component’s JSX return statement.
In the CSS Module file alongside the component’s styles.
Nowhere — presentational components must fetch their own data.
In hooks, keeping the presentational component pure.
2
Topic 2 of 5
Strict TypeScript in React — typed props, no `any`
Why Do I Need to Know This?
A component’s props are its contract with every caller, and an any-typed prop is a runtime error waiting for the wrong shape to be passed. The program’s rule is no any in React props, because TypeScript should catch a misused component at compile time — not in the browser during the demo. Precise prop types are what make a large component library safe to refactor.

Scenario
A teammate types a card’s props as any to move fast, and a caller passes { state: "submitted" } where the component reads status — a bug that only shows as a blank badge at runtime. The team types props precisely: a discriminated union for the badge’s variants, a generic for the reusable list. Now the wrong shape is a red squiggle in the editor, not a silent failure.

Theory
Props are a typed contract
A component’s props are a typed interface, and that type is its contract: callers must pass the right shape or the code does not compile. Typing props is not ceremony — it is what turns "passed the wrong field" from a runtime mystery into a compile error. The rule across the library is no any in props (AGENTS.md), so every component states exactly what it accepts.

Discriminated unions model variants
When a component has variants — a badge that is draft, submitted, or error — a discriminated union models them so invalid combinations cannot be expressed. A loose status: string lets a typo like "submited" through; status: "draft" | "submitted" | "error" rejects it at compile time. The type encodes the real set of valid states.

Generics keep reusable components type-safe
A component meant to work across data types — a List<T> that renders any kind of row — uses a generic so it stays type-safe for each use. List<Filing> knows its items are filings; List<Payment> knows they are payments. One reusable component, no any, full checking at every call site.

An 'any' prop fails late; a typed prop fails at compile time
The same mistake — passing the wrong field — slips through with any and surfaces in the browser, but is caught by the compiler with a typed prop.

props: any  →  caller passes {state:"submitted"} (wrong field)
compiler: silent  →  blank badge at runtime (found in the demo)
status: "draft" | "submitted"  →  caller passes {state:"submitted"}
compiler: error — missing 'status' (found in the editor)
Example
a discriminated-union prop and a generic list
// (1) discriminated union: only these statuses are valid
type BadgeProps = { status: "draft" | "submitted" | "error" };
function Badge({ status }: BadgeProps) { /* ... */ }

// (2) generic component: type-safe for any row type
type ListProps<T> = { items: T[]; renderItem: (item: T) => React.ReactNode };
function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map((it, i) => <li key={i}>{renderItem(it)}</li>)}</ul>;
}

// (3) used with a concrete type — fully checked, no `any`
<List items={filings} renderItem={(f) => <FilingCard {...f} onOpen={openFiling} ></FilingCard>} />;

Annotation (1) — the union restricts status to the real set of values, so a typo or wrong field is a compile error.
Annotation (2) — List<T> is generic over its item type, so it works for filings, payments, or anything else while staying type-checked.
Annotation (3) — at the call site T is inferred as the filing type, so renderItem is checked against it — reuse without any.
AI Practice
Prompt it
Have Codex type a component’s props precisely, then confirm there is no any and variants are a union.

Type the props for these React components with no `any`: a Badge with a status
that can only be draft, submitted, or error (use a discriminated/literal union),
and a reusable List that renders any item type (use a generic). Show the prop
types and one typed usage of each.

Watch out
Codex frequently types a variant prop as a loose string (allowing typos) or falls back to any/React.FC<any> for a "flexible" component, defeating the type check. It may also widen a generic to any instead of a real type parameter. Confirm the variant is a literal union, the reusable component uses a real generic <T>, and any appears nowhere in the props.

Verify
Pass an invalid status (e.g., "submited") and confirm the compiler rejects it; pass the wrong field name and confirm it errors, not renders blank. Use the generic list with two different item types and confirm each is type-checked at the call site. Grep the props for any and confirm there is none. Record any loose string or any Codex used in your prompt journal.

Knowledge Check
1. Why is any banned in React props?
Because any props make a component render more slowly.
Because TypeScript cannot compile a component that uses any.
It loses the compile-time check; bad shapes fail at runtime.
Because any forces every caller to pass every prop.
2. What does a discriminated (literal) union prop prevent?
An invalid variant value, like a typo’d status.
A component from accepting more than one prop.
The component from rendering until all variants are handled.
CSS Modules from styling the different variants.
3. What problem does a generic component (List<T>) solve?
It lets the component skip type checking for speed.
It forces every list to hold exactly one item type forever.
One reusable component stays type-safe across data types.
It converts the items to any so any data fits.
4. A teammate types a variant prop as status: string. What is the risk?
None — string is the correct type for a status value.
The component will refuse to render any status at all.
CSS Modules cannot target a string-typed status.
Invalid values like a typo pass the compiler silently.
3
Topic 3 of 5
Reading a wireframe into a typed component tree
Why Do I Need to Know This?
The skill that makes the whole week fast is decomposing the provided wireframe into a hierarchy of typed components with clear responsibilities, laid out in a Vite project structured as a design system. Skip this and you get one sprawling screen component; do it well and most components are small, named, and obvious to build.

Scenario
The team takes the provided capstone wireframe HTML — which already ships as semantic CSS classes and design-token custom properties — and marks it into a tree: the page, its sections, the repeated filing cards, the shared atoms. They name each component by its role, set up the Vite project with a design-system folder layout, and port the wireframe’s CSS into CSS Modules so styles are scoped per component.

Theory
Decompose the wireframe into a tree
Reading a wireframe means spotting structure: the repeated units (cards, table rows), the shared atoms (the smallest reusable pieces — button, badge, input), and the page that composes them. Each becomes a named component, and the nesting becomes the component tree. Naming by role — FilingCard, not Div3 — is what makes the tree legible and the work parallelizable across the team.

A Vite design-system layout
The library needs a consistent home. A Vite + TypeScript project laid out as a design system — atoms/, components/, screens/ — gives every component a predictable place, so anyone can find the Badge or add a new Card. Vite is the program’s build tool for this project, with CSS Modules support built in and no extra configuration.

Styling with CSS Modules and design tokens
The program styles components with CSS Modules: a FilingCard.module.css whose classes are scoped to that component, imported as a styles object. The wireframe’s design tokens (its ---prefixed custom properties) live in one :root and are consumed via var(...), and there are no inline styles outside those tokens (AGENTS.md). Because the prototypes already use semantic CSS plus token custom properties, they port into CSS Modules with almost no rewrite.

Note
Why CSS Modules here. The capstone prototypes ship as plain semantic CSS with design-token custom properties, which drop into .module.css directly. CSS Modules is "just CSS, scoped" — one small new idea on top of an already-heavy React week — which is why it is the program default (ADR-0011 weighs vanilla-extract as the type-safe alternative).

A wireframe decomposed into a component tree
The wireframe’s regions map one-to-one onto named, typed components from the page down to the atoms.

Wireframe: filing-list screen

FilingListPage (screen)

PageHeader

FilingList

FilingCard (component)

Badge (atom)

Button (atom)

Example
the design-system layout and a css-module component
// src/
//   atoms/      Button.tsx + Button.module.css, Badge.tsx + Badge.module.css
//   components/ FilingCard.tsx + FilingCard.module.css
//   screens/    FilingListPage.tsx
//   styles/     tokens.css   (the wireframe's --custom-properties in :root)

import styles from "./FilingCard.module.css";   // (1) scoped class names
function FilingCard({ id, status, onOpen }: FilingCardProps) {
  return <article className={styles.card}>{/* ... */}</article>;  // (2) styles.card is local
}
// FilingCard.module.css:  .card { padding: var(--space-3); border: 1px solid var(--border); } // (3) tokens

Annotation (1) — importing the .module.css gives a styles object whose class names are scoped to this component, so .card cannot collide with another component’s .card.
Annotation (2) — className={styles.card} applies the locally-scoped class; there are no global class-name clashes to manage.
Annotation (3) — the rule uses the wireframe’s design tokens via var(--space-3); no hard-coded values or inline styles outside the tokens.
AI Practice
Prompt it
Have Codex decompose the wireframe into a component tree, then verify the tree matches it and components are named by role.

Here is the capstone wireframe HTML for the filing-list screen. Decompose it into
a React component tree: identify the screen, the repeated units, and the shared
atoms, and name each component by its role (e.g., FilingCard, Badge), not by
markup (e.g., Div3). Propose the Vite design-system folder layout (atoms /
components / screens) and which CSS Module each component gets.

Watch out
Codex tends to under-decompose (one big screen component) or over-decompose (a component per <div>), and to name components after markup rather than role. It may also propose inline styles or a global stylesheet instead of CSS Modules with tokens. Confirm the tree has sensible, role-named components matching the wireframe, a clean atoms/components/screens layout, and CSS Modules consuming the design tokens.

Verify
Check that each region of the wireframe maps to a named component (by role, not markup) and that repeated units are a single reused component, not duplicated. Confirm the folder layout separates atoms/components/screens and each component has a .module.css using var(--token) values, with no inline styles. Record any over- or under-decomposition in your prompt journal for the ADR-0011 styling decision.

Knowledge Check
1. What is the first step in turning a wireframe into components?
Identify repeated units, shared atoms, and the composing page.
Write the CSS Modules for every region before any component.
Fetch the screen’s data so the components have something to show.
Choose a state-management library for the whole screen.
2. Why name a component FilingCard rather than Div3?
Because React rejects component names that start with Div.
A role name makes the tree legible and the work shareable.
Because markup-based names break CSS Modules scoping.
Because the wireframe tool requires role-based names.
3. How do CSS Modules prevent class-name collisions?
By forbidding two components from using the same CSS file.
By requiring every class name to be globally unique by hand.
Each .module.css class name is automatically scoped to the component that imports it.
By converting all class names into inline styles at build time.
4. How should the wireframe’s design tokens be used in the components?
Hard-coded as literal values in each component’s CSS.
As inline style attributes on each element.
Copied into every CSS Module so each has its own palette.
As var(--token) references to shared tokens.
4
Topic 4 of 5
Behavioral component tests with Vitest + React Testing Library
Why Do I Need to Know This?
A component library is only trustworthy if its behavior is tested, and the program forbids snapshot tests because they assert markup, not behavior — they pass trivially and break on cosmetic change. React Testing Library tests what the user sees and does, using the same Vitest runner as the backend, so a test failing means real behavior broke, not that a class name moved.

Scenario
A teammate adds a snapshot test for the Button; it passes the moment it is written and catches nothing afterward. The team replaces it with React Testing Library tests that render the button, query it by its accessible role, and assert behavior across states — that the disabled button cannot be clicked, that the error variant shows its message — the behavior a user actually depends on.

Theory
React Testing Library tests behavior, not markup
React Testing Library queries the rendered output the way a user perceives it — by role, label, and text — and asserts behavior rather than implementation. getByRole("button", { name: /open/i }) finds the button a user would, so the test survives a refactor that changes the markup but not the behavior. Querying by role also ties tests to accessibility, which 5.5 — UI Integration Gate: Sprint 3 enforces with axe and Lighthouse in CI.

Snapshot tests are forbidden
A snapshot test records the component’s markup and fails when it changes. It passes trivially when first written, breaks on a harmless cosmetic change, and catches few real regressions — asserting structure, not what the component does. The program forbids them; use behavioral assertions about what the user can see and do.

Test the states a component actually has
A component is not just "renders" — it has states: default, disabled, error, loading. The tests assert each meaningful state: the disabled button is not clickable, the error badge shows its message. With Vitest (the backend’s runner) plus React Testing Library and jest-dom matchers (toBeDisabled, toBeInTheDocument), each state is verified for behavior, not appearance.

Snapshot vs behavioral test
A snapshot asserts the markup and catches little; a behavioral test asserts what the user can do.

Snapshot test — records markup; passes on creation; breaks on cosmetic change; catches few real bugs. Forbidden.
Behavioral test (RTL) — queries by role/text; asserts the disabled button does not fire; survives refactors.
Example
a behavioral test for the disabled button
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

test("a disabled Button does not fire onClick", async () => {
  const onClick = vi.fn();
  render(<Button disabled onClick={onClick}>Open</Button>);   // (1) render with the disabled state

  const button = screen.getByRole("button", { name: /open/i }); // (2) query as a user would
  expect(button).toBeDisabled();                                // (3) jest-dom matcher
  await userEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();                       // (4) assert behavior, not markup
});

Annotation (1) — the test renders the component in the specific state it checks (disabled), not just a default render.
Annotation (2) — getByRole("button", { name: /open/i }) finds the button the way a user (and a screen reader) would, so it survives markup refactors.
Annotation (3) and (4) — toBeDisabled and the click assertion test behavior — the disabled button does not call onClick — rather than snapshotting the HTML.
AI Practice
Prompt it
Have Codex write behavioral tests for a component’s states, then confirm no snapshot tests slipped in.

Write Vitest + React Testing Library tests for my Button component covering its
states: default (click fires onClick), disabled (click does not fire), and an
error variant (its message is shown). Query by accessible role and text, assert
behavior with jest-dom matchers, and use userEvent for interaction. Do not write
any snapshot tests.

Watch out
Codex sometimes adds a toMatchSnapshot() test "for coverage," which the program forbids, or queries by test id / CSS class instead of by accessible role — coupling the test to markup. It may also test only the default render and skip the disabled and error states. Confirm the tests query by role/text, assert behavior across the real states, and contain no snapshot assertions.

Verify
Run the tests and confirm they query by role/text (not test ids or classes) and assert behavior — the disabled button does not fire, the error message shows. Grep for toMatchSnapshot and confirm there is none. Change the component’s markup without changing behavior and confirm the tests still pass, proving they are behavioral. Record any snapshot or markup-coupled test Codex wrote in your prompt journal.

Knowledge Check
1. How does React Testing Library encourage you to query elements?
By their CSS class names, to match the styling.
By their position in the rendered DOM tree.
By a unique test id attached to every element.
By role, label, and text — as a user would.
2. Why does the program forbid snapshot tests?
They assert markup and catch few real bugs.
They run too slowly to include in the test suite.
They cannot be written with the Vitest test runner.
They require a separate build step to generate the snapshot.
3. What should a component’s tests cover beyond "it renders"?
The exact HTML structure of its default output.
Its real states — disabled, error, loading — and their behavior.
The CSS custom-property values applied to it.
The number of times it re-renders during a test.
4. What proves a test is behavioral rather than markup-coupled?
It fails whenever any class name in the component changes.
It records the rendered output and compares it on each run.
It queries elements by their position in the DOM.
It still passes when markup changes but behavior does not.
