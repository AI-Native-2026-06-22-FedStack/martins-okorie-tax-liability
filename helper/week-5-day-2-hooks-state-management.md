5.2 Hooks & State Management
🕐 Last Updated: 2026-07-06 18:28:14 UTC
📌 Commit: fb881432
Week 5 · Day 2
"Hooks & State Management"
Give the components logic and decide where state lives — the core hooks and the rules of hooks, custom hooks for reusable logic, the local-state-vs-store decision recorded in an ADR, and the performance hooks that prevent needless re-renders.

1
Topic 1 of 5
Core hooks and the rules of hooks
Why Do I Need to Know This?
The component library from 5.1 — React, Vite & a Typed Component Library is presentational — pure functions of props, no logic of their own. To do anything a user notices, a component needs state and side effects, and hooks are how a function component gets them. Using them correctly, and obeying the rules of hooks, is the line between a UI that behaves predictably and one with intermittent bugs that only appear on some renders.

Scenario
The team’s FilingCard needs to remember whether it is expanded, and to log a view event when it first appears on screen. They reach for useState to hold the toggle and useEffect to run the log on mount. A teammate wraps the useState call in an if to "skip it when collapsed," and the card starts throwing on re-render — a violation of the rules of hooks that the team has to track down and fix.

Theory
useState, useReducer, useEffect
Three hooks cover most component logic. useState holds a single piece of local state — a toggle, an input value, a selected id. useReducer fits state with several related transitions, where a reducer keeps the updates in one place instead of scattering many useState setters. useEffect runs side effects — logging, subscriptions, timers — after render, controlled by a dependency array.

The rules of hooks
Hooks must be called at the top level of a component, unconditionally, in the same order on every render. React tracks hook state by call order, not by name, so wrapping a hook in an if, a loop, or an early return shifts that order between renders and corrupts the state mapping. This is why a conditional hook produces intermittent, hard-to-trace failures rather than a clean error every time. The eslint-plugin-react-hooks rule flags these violations as you type.

Dependencies and cleanup
An effect re-runs whenever a value in its dependency array changes, so the array must list every value the effect reads — a missing dependency means the effect runs with stale data. An effect that subscribes, opens a timer, or adds a listener must return a cleanup function that tears it down, or it leaks and double-fires. In React 18, StrictMode deliberately mounts each component, unmounts it, and mounts it again in development so a missing cleanup shows up immediately as a doubled effect; production runs the effect once.

!
Warning
A doubled network request or log in development is usually not a bug in your effect — it is React 18 StrictMode verifying your cleanup. Fix it by making the effect clean up after itself, not by disabling StrictMode.

Effects run after render and clean up before re-running
On each render the hooks run in order; an effect runs after paint, and its cleanup runs before the next effect or on unmount.

deps change

unmount

Render: hooks run top-level, in order

Commit to screen

useEffect runs (deps changed)

Re-render or unmount?

Cleanup runs, then effect re-runs

Cleanup runs, effect gone

Example
a toggle with state and a cleaned-up effect
import { useState, useEffect } from "react";

function FilingCard({ id }: { id: string }) {
  const [expanded, setExpanded] = useState(false);   // (1) local state, top level

  useEffect(() => {
    const sent = logView(id);                         // (2) side effect on mount / id change
    return () => sent.cancel();                        // (3) cleanup tears it down
  }, [id]);                                            // (4) deps: re-run only when id changes

  return (
    <article>
      <button onClick={() => setExpanded((e) => !e)}>{expanded ? "Hide" : "Show"}</button>
      {expanded && <FilingDetail id={id} ></FilingDetail>}
    </article>
  );
}

Annotation (1) — useState is called at the top level, never inside a condition, so its slot is stable across renders.
Annotation (2) — the effect runs the side effect after render; it is not in the render body, where side effects do not belong.
Annotation (3) — the returned cleanup cancels the in-flight log, so a fast unmount or an id change does not leak or double-send.
Annotation (4) — the dependency array lists id, the only value the effect reads, so it re-runs exactly when id changes.

AI Practice
Prompt it
Have Codex build a component with state and a side effect, then verify the dependency array and cleanup.

Build a React 18 + TypeScript FilingCard that holds an expanded/collapsed toggle
with useState and logs a view event with useEffect when it mounts or when its id
prop changes. The effect must return a cleanup that cancels the in-flight log.
Call all hooks at the top level. Show the component.

Watch out
Codex often leaves the dependency array empty [] when the effect actually reads a prop (stale data), or omits the cleanup entirely so the effect leaks and double-fires under StrictMode. It may also "fix" a doubled request by adding a ref guard or disabling StrictMode instead of writing real cleanup. Confirm the dependency array lists every value the effect reads, that cleanup tears down whatever the effect started, and that no hook sits inside a condition.

Verify
Run the component under React 18 StrictMode and confirm the effect fires and cleans up without leaking — a doubled log in development with a working cleanup is expected, not a bug. Change the id prop and confirm the effect re-runs. Remove the cleanup temporarily and observe the leak, then restore it. Record any empty dependency array or missing cleanup Codex produced in your prompt journal.

Knowledge Check
1. Why must hooks be called at the top level, never inside a condition?
React tracks hook state by call order, which a condition can shift.
2. An effect reads the id prop but its dependency array is []. What happens?
It keeps using the first id and ignores later changes.
3. In React 18 development, an effect’s network call fires twice. What is the likely cause?
StrictMode mounts, unmounts, and remounts to test cleanup.
4. When does an effect need to return a cleanup function?
When it subscribes, opens a timer, or otherwise needs teardown.

2
Topic 2 of 5
Custom hooks for reusable logic
Why Do I Need to Know This?
The same stateful logic recurs across screens — debouncing a search box (waiting until typing stops before querying), paging through a list. Copying that logic into each screen invites drift: one copy gets a fix the others miss. A custom hook packages reusable stateful logic behind one named interface, tested once and shared everywhere, so the logic has a single home.

Scenario
Three of the capstone’s screens need a search box that waits until the user stops typing before querying, and each needs pagination over its list. Rather than re-implement the debounce timer and the page math three times, the team extracts a useDebounce hook and a usePagination hook, tests each in isolation, and imports them wherever they are needed.

Theory
A custom hook composes built-in hooks
A custom hook is a function whose name starts with use and which calls other hooks — useState, useEffect, or other custom hooks — to package stateful logic. useDebounce(value, ms) holds a debounced copy of a value; usePagination(items, pageSize) holds the current page and the slice to show. The naming convention is not cosmetic: the lint rule applies the rules of hooks only to functions that start with use.

Custom hooks share logic, not state
Each call to a custom hook gets its own independent state. Two components that both call useDebounce do not share a debounced value — each has its own, exactly as two useState calls would. A custom hook is a reusable recipe for logic, not a shared store; sharing state across components is a different problem, addressed by the Local state vs a store decision later in this lesson.

A custom hook is tested in isolation
Because a custom hook is just a function that uses hooks, it can be tested on its own with renderHook from React Testing Library, which runs the hook inside a throwaway component and exposes its return value as result.current. State updates inside the test are wrapped in act(). Testing the hook once means every screen that uses it inherits verified logic.

One hook, many independent consumers
A single useDebounce hook is imported by three components; each call has its own state instance.

Example
a usedebounce hook and its isolation test
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);  // (1) schedule update
    return () => clearTimeout(t);                          // (2) cancel if value changes first
  }, [value, ms]);
  return debounced;
}

// useDebounce.test.ts
import { renderHook } from "@testing-library/react";        // (3) test the hook in isolation
test("returns the initial value immediately", () => {
  const { result } = renderHook(() => useDebounce("a", 200));
  expect(result.current).toBe("a");                         // (4) result.current is the return value
});

Annotation (1) — the effect schedules the update after ms, so rapid changes do not each trigger a query.
Annotation (2) — cleanup clears the pending timer when value changes again, which is what produces the debounce.
Annotation (3) — renderHook runs the hook inside a test component so it can be verified without mounting a real screen.
Annotation (4) — result.current exposes the hook’s current return value; state-changing calls in a test are wrapped in act().

AI Practice
Prompt it
Have Codex extract a custom hook the capstone needs, then verify it composes built-in hooks and is tested in isolation.

Extract a reusable useDebounce(value, ms) custom hook in React 18 + TypeScript
that returns a debounced copy of the value, composing useState and useEffect with
a timer cleanup. Then write a renderHook test that verifies the initial value is
returned immediately and the debounced value updates after the delay. Keep it
generic over the value type.

Watch out
Codex sometimes writes a "custom hook" that takes no hooks and is really a plain helper, or forgets to clear the timer so debounces stack up. In the test, it may read the return value off the wrong property instead of result.current, or omit act() around the state change so the assertion runs before the update. Confirm the hook composes real built-in hooks with cleanup, and the test uses renderHook and result.current correctly.

Verify
Confirm the hook’s name starts with use, that it calls built-in hooks, and that its effect clears the timer on change. Use the hook in two components and confirm each has its own debounced value, proving custom hooks share logic, not state. Run the renderHook test and confirm it reads result.current and wraps updates in act(). Record any non-hook "helper" or missing cleanup Codex produced in your prompt journal.

Knowledge Check
1. What makes a function a custom hook rather than a plain helper?
Its name starts with use and it calls other hooks.
2. Two components call the same useDebounce hook. What do they share?
The logic, while each call keeps its own separate state.
3. Why extract repeated stateful logic into a custom hook?
So the logic lives and is tested in one shared place.
4. How do you test a custom hook in isolation?
Use renderHook and read the value from result.current.

3
Topic 3 of 5
Local state vs a store — the decision
Why Do I Need to Know This?
Reaching for Redux or Zustand on the first day of a React project is the most common form of over-engineering in the ecosystem. Most state is either local to one component or server state that belongs to a data-fetching layer; a global client store is a cost you take on only when shared client state genuinely demands it. The team makes that call deliberately and records it, rather than defaulting to a store out of habit.

Scenario
A teammate proposes Redux Toolkit for the whole app "so state is centralized." The team pushes back with specifics: the filing list is server state, which is the next lesson’s job; a modal’s open flag is local to one component; a cross-screen filter is the only genuinely shared client state, and even that may not need a library. They settle on built-ins by default and record it in ADR-0012, reserving a store for a need they can name.

Theory
Three kinds of state
Most state falls into three buckets, and naming the bucket picks the tool. Local state — a toggle, an input, a modal flag — belongs in useState in the component that owns it. Server state — a cached copy of data that lives on the server and can change underneath you — belongs in a data-fetching layer. A global client store is only for client state that several distant components genuinely share, which is rarer than it first appears.

The options, and when each wins
The built-in hooks (useState, useReducer, and context for passing values down) are the default and cover most needs. Zustand is a light global store — a small API, minimal boilerplate — for genuinely shared client state like a cross-screen filter or a wizard’s progress. Redux Toolkit is heavier and more structured, earning its weight in large apps that need strict conventions, action logging, and devtools across a big team. The program’s rule is no global store without an ADR (AGENTS.md).

Default to built-ins, justify the store
Adding a global store before you need one buys indirection and boilerplate with no payoff: every piece of state now routes through a layer it did not need. The discipline is to start with built-ins, treat server state as the data layer’s job, and add a store only when you can point to specific client state that multiple distant components share. ADR-0012 captures that default and the bar a store must clear.

Note
Server state is not client state. A large share of what beginners put in Redux is really cached API data — server state — which a query library manages far better. Classifying state as server state first shrinks the "needs a store" pile dramatically.

Example
classifying three pieces of the capstone's state
filing list          → server state   → TanStack Query (cached API data)
"new filing" modal    → local state    → useState in the screen that opens it
cross-screen filter   → shared client  → built-in context now; Zustand if it grows

AI Practice
Prompt it
Have Codex propose a state-management decision tree, then ratify it in an ADR and reject premature stores.

For our React 18 SPA, classify these pieces of state and recommend where each
lives: the filing list (from the API), a "new filing" modal open flag, a
cross-screen status filter, and a form's draft values. Use the rule: server state
→ TanStack Query, single-component state → useState, genuinely shared client
state → consider a store. Justify any recommendation to add a global store.

Watch out
Codex frequently recommends a global store (Redux or Zustand) for state that is really server state or purely local, because centralizing sounds tidy. It may also treat the API-backed filing list as client state to put in the store. Reject any store recommendation that cannot name specific client state shared by distant components, and confirm the API data is classified as server state, not store state.

Verify
Check each classification against the rule: API data is server state, single-component flags are local, and only distant-shared client state is a store candidate. Confirm Codex’s reasoning for any store names the specific shared state — reject it otherwise. Record the decision and its rationale in ADR-0012, including which state you deliberately kept in built-ins. Note any premature-store suggestion in your prompt journal.

Knowledge Check
1. What is the program’s default for managing state in a new React screen?
Built-in hooks; add a store only when an ADR justifies it.
2. The filing list comes from the API. How should it be classified?
Server state, owned by the data-fetching layer.
3. When is reaching for a global client store actually justified?
When specific client state is shared by distant components.
4. What is the main cost of adding a global store before it is needed?
Indirection and boilerplate for state that needs no layer.

4
Topic 4 of 5
Performance hooks — useMemo, useCallback, memo, useTransition
Why Do I Need to Know This?
React re-renders more often than beginners expect — a parent re-render re-runs its children by default — and the fix is targeted, not blanket. Knowing when useMemo, useCallback, memo, and useTransition actually help, and when they are just noise, keeps the UI fast without applying them reflexively to every value and function. The program teaches them as React 18 tools applied where a real cost justifies them.

Scenario
The data table re-renders every visible row on each keystroke in the search box, and the table visibly lags. The team profiles it, finds the cost is in recomputing a filtered-and-sorted list plus re-rendering hundreds of row components, and applies three targeted fixes: memoize the derived list, wrap the row in memo with a stable callback, and mark the filter update as a transition so the input stays responsive.

Theory
useMemo, useCallback, and memo
useMemo caches an expensive computed value and recomputes it only when its dependencies change — useful for filtering or sorting a large list. useCallback caches a function’s identity so it stays the same reference between renders, which only matters when that function is passed to a memo-wrapped child or used as another hook’s dependency. memo wraps a component so it skips re-rendering when its props are unchanged by reference. The three work together: memo on the child, useCallback on the handler passed to it, useMemo on the data passed to it.

Apply them only where a real cost exists
These hooks have a cost of their own — a cache to maintain, dependency arrays to keep correct — and applied everywhere they add complexity and can make code slower, not faster. The guidance from the React docs is to write the code so it works without them, then add memoization to a measured hot spot: an expensive computation, a large list, a memo child that re-renders needlessly. Memoize only the specific value or component you profiled as slow, not everything around it.

useTransition keeps the UI responsive
useTransition marks a state update as non-urgent, so React can keep an urgent update — like the text appearing in the search box — responsive while the expensive update — re-filtering the list — happens in the background. It is for the specific case where one update is cheap and user-facing and another is expensive; it is not a general wrapper for every setState — wrapping routine updates in it just adds scheduling overhead for no gain.

Which performance hook for which cost
- useMemo: expensive computed value (filter/sort a large list) recomputes every render -> cache it, recompute on dep change.
- useCallback: function passed to a memo child changes identity every render, breaking the skip -> stabilize its reference.
- memo: child re-renders although its props did not change -> skip re-render when props are equal.
- useTransition: expensive update makes an urgent input feel janky -> mark expensive update non-urgent.
- None: no measured cost -> leave plain.

Example
a memoized list and a memoized row
import { useMemo, useCallback, memo, useState, useTransition } from "react";

function FilingTable({ filings }: { filings: Filing[] }) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(                                  // (1) cache the expensive derive
    () => filings.filter((f) => f.id.includes(query)).sort(byDate),
    [filings, query],
  );
  const onOpen = useCallback((id: string) => openFiling(id), []); // (2) stable identity for memo child

  return (
    <>
      <input onChange={(e) => startTransition(() => setQuery(e.target.value))} /> {/* (3) non-urgent */}
      {visible.map((f) => <Row key={f.id} filing={f} onOpen={onOpen} ></Row>)}
    </>
  );
}
const Row = memo(function Row({ filing, onOpen }: RowProps) { /* ... */ }); // (4) skip unchanged rows

AI Practice
Prompt it
Have Codex propose performance fixes for a laggy table, then verify each is justified by a real cost.

This FilingTable re-renders every row on each keystroke and lags. Profile-style,
recommend targeted fixes using useMemo, useCallback, memo, and useTransition, and
for each one state the specific cost it addresses. Do not apply memoization where
there is no measured cost. Show the optimized component.

Watch out
Codex tends to over-apply these hooks — wrapping every value in useMemo and every handler in useCallback whether or not a child is memoized — which adds complexity with no benefit and can slow the component. It may add useCallback without a memo child to make it matter, or reach for useTransition on a cheap update. Confirm each optimization names a real cost: memo on a child that actually re-renders, useCallback only for a handler passed to that child, useMemo only for an expensive derive.

Verify
For each hook Codex added, confirm it targets a real cost — a memo child that re-rendered needlessly, a handler passed to that child, an expensive computed list, or an expensive update behind a responsive input. Remove any memoization that guards no measured cost and confirm behavior is unchanged. Profile before and after the table fix to confirm the re-renders dropped. Record any blanket or unjustified memoization Codex applied in your prompt journal.

Knowledge Check
1. When does wrapping a handler in useCallback actually help?
When it is passed to a memo child or used as a hook dependency.
2. What does wrapping a component in memo do?
It skips re-rendering when the props are unchanged by reference.
3. What problem does useTransition address?
An expensive update making an urgent input lag.
4. A teammate wraps every value and function in a component in useMemo/useCallback. What is the right critique?
Memoization has a cost; target a profiled hot spot only.
