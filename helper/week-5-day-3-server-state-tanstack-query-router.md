Week 5 · Day 3
Server State: TanStack Query & Router
Bring the live backend's data into the SPA — client vs server state, TanStack Query for queries, mutations, cache invalidation and optimistic updates, React Router for nested routes and error elements, all behind one auth-aware fetcher that carries the bearer token and correlation ID and runs a 401 refresh, with loading, empty, and error states on every screen.

1
Topic 1 of 5
Client state vs server state
Why Do I Need to Know This?
In 5.2 — Hooks & State Management the team decided that API data is server state and deferred it to a data-fetching layer. This is where that decision pays off. Treating API data like local state — fetching in useEffect and storing in useState — is the source of stale data, race conditions, and loading logic copied across every screen. Server state is a different problem, and naming it as such is what points you at the right tool.

Scenario
The team’s first filing list fetches in a useEffect and stores the result in useState. It works in the demo, then breaks in two ways: after a user edits a filing, the list still shows the old value until a full reload, and every navigation back to the list flashes empty while it refetches from scratch. The team reframes the list as server state — a cached copy of data that lives on the server — which is exactly what TanStack Query manages.

Theory
Two kinds of state, two different problems
Client state is owned by the app and changes only when the app changes it: a toggle, a filter, a modal flag. Server state is a cached copy of data that actually lives on the server and can change underneath you — another user edits a filing, a background job updates a status. The two need different handling, because client state is always current by definition while server state can silently go stale.

Why useState + useEffect is the wrong tool for it
Hand-rolling server state with useState and useEffect means re-implementing caching, background refetch, request deduplication, and invalidation in every component — and getting the race conditions wrong. A fast navigation can land an older response after a newer one; an edit on one screen leaves another screen showing stale data. These are not bugs in your code so much as the absence of a cache, and a cache is not something you should hand-write per screen.

Server state gets dedicated tooling
Because server state needs caching, deduplication, background refetch, and invalidation, it gets a dedicated library — TanStack Query — rather than the built-in hooks that handle client state. This is the same split 5.2 — Hooks & State Management set up: built-ins for client state, a query layer for server state. Classifying a piece of state correctly is the decision that makes the rest of the screen simple.

i
Note
The reframe is the lesson. Most "the data is stale" and "it flashes empty on every visit" complaints disappear once API data is treated as a cache to be managed, not a value to be stored. The tooling is downstream of getting the classification right.

Client state vs server state
The two differ in who owns them and whether they can go stale, which is why they need different tools.

Client state
owned by the app · changes only when the app changes it · always current
toggle, filter, modal flag → useState
Server state
lives on the server · can change underneath you · needs caching + refetch
filing list, a record → TanStack Query
Example
the naive fetch and the stale-data failure
function FilingList() {
  const [filings, setFilings] = useState<Filing[]>([]);   // (1) API data stored as local state
  useEffect(() => {
    fetch("/api/filings").then((r) => r.json()).then(setFilings); // (2) refetches from scratch each mount
  }, []);
  // (3) after an edit elsewhere, this list still shows the old data — no cache, no invalidation
  return <ul>{filings.map((f) => <li key={f.id}>{f.id}</li>)}</ul>;
}
Copy
Annotation (1) — storing API data in useState treats server state as client state; nothing keeps it in sync with the server.
Annotation (2) — fetching in useEffect with [] refetches on every mount, producing the empty flash on each navigation, with no dedup or caching.
Annotation (3) — there is no way to invalidate the data after an edit, so the list goes stale until a full reload — the failure that motivates a query cache.
AI Practice
Prompt it
Have Codex classify the capstone’s state, then verify the API-backed data is treated as server state.

Classify each piece of state in our filing SPA as client state or server state,
and say which tool manages it: the filing list (from the API), the search query,
a "new filing" modal open flag, and a single filing record loaded by id. Explain
why API data is server state and should not be stored with useState + useEffect.
Copy
Watch out
Codex sometimes labels everything "state" without splitting client from server, or proposes caching API data in a global store — re-introducing the stale-data problem the query layer solves. It may also call the modal flag server state. Confirm the API-backed list and record are classified as server state for the query layer, while the modal flag and search query stay client state in built-ins.

Verify
Check that the filing list and the filing record are classified as server state (cached, refetched), and the modal flag and search query as client state. Confirm Codex’s reasoning names the stale-data and empty-flash failures that useState + useEffect cause for server data. Record any piece it misclassified — especially API data treated as client state — in your prompt journal.

Knowledge Check
1. What distinguishes server state from client state?
Server state is larger, so it must be stored on disk rather than memory.
Server state lives on the server and can change underneath the app.
Server state is read-only, while client state can be written.
Server state is typed, while client state is untyped.
2. Why is useState + useEffect a poor fit for API data?
Because useEffect cannot make network requests at all.
Because React forbids storing arrays in useState.
You hand-roll caching, refetch, and invalidation per screen.
Because useState values cannot be passed to child components.
3. A list shows old data after an edit on another screen. What is the root cause?
API data is stored locally with nothing to invalidate.
React batches the two screens’ renders incorrectly.
The edit screen failed to call setState after saving.
The list component was wrapped in memo by mistake.
4. Why does server state get a dedicated library instead of built-in hooks?
Because built-in hooks are deprecated for data fetching in React 18.
Because a library renders lists faster than map over state.
Because TypeScript cannot type a useEffect fetch.
It needs caching, dedup, refetch, and invalidation the hooks lack.
2
Topic 2 of 5
TanStack Query — queries, mutations, invalidation, optimistic updates
Why Do I Need to Know This?
TanStack Query turns server state into a managed cache: one hook gives you the data, a loading flag, and an error in a single call. Mutations plus invalidation keep that cache correct after a write, and optimistic updates make the UI feel instant without lying when the write fails. This is the core of a responsive data UI, and it replaces the naive fetch from the previous topic.

Scenario
The team replaces the useEffect fetch with useQuery for the filing list, keyed by ["filings"]. Creating a filing becomes a useMutation that, on success, invalidates the ["filings"] query so the new row appears. To make it feel instant, they add an optimistic update: the new filing shows in the list immediately and rolls back if the server rejects the write.

Theory
useQuery caches by a query key
useQuery fetches data and caches it under a query key — ["filings"], or ["filing", id] for one record — and returns data, isPending, and isError in one object. It deduplicates identical requests, serves cached data instantly while refetching in the background, and never produces the empty flash, because the cache persists across navigations. The query key is the cache’s identity, and the handle that invalidation targets.

useMutation writes, then invalidation refreshes
A write is a useMutation — create, update, delete. After the write succeeds, calling invalidateQueries on the affected key marks that cached data stale and refetches it, so the list reflects the change. A precise query-key strategy is what makes invalidation surgical: invalidate ["filings"] after a create, ["filing", id] after editing one record.

Optimistic updates make writes feel instant
An optimistic update applies the change to the cache before the server confirms it, so the UI responds immediately. The v5 pattern uses onMutate to cancel in-flight refetches, snapshot the current cache, and write the optimistic value; onError restores the snapshot on failure; onSettled invalidates to reconcile with the server. The UI feels instant but still tells the truth when a write fails — it rolls back.

An optimistic mutation's lifecycle
The mutation updates the cache immediately, then either reconciles on success or rolls back on error.

Server
Query cache
User
snapshot + optimistic write
onSettled → invalidate + refetch
onError → restore snapshot
alt
[success]
[error]
create filing (onMutate)
1
POST /filings
2
201 Created
3
4xx / 5xx
4
Example
a query list and a mutation that invalidates it
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function useFilings() {
  return useQuery({ queryKey: ["filings"], queryFn: getFilings }); // (1) cached by key
}

function useCreateFiling() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createFiling,
    onMutate: async (newFiling: Filing) => {                          // (2) optimistic write
      await qc.cancelQueries({ queryKey: ["filings"] });             //     stop in-flight refetches
      const prev = qc.getQueryData<Filing[]>(["filings"]);           //     snapshot for rollback
      qc.setQueryData<Filing[]>(["filings"], (old = []) => [...old, newFiling]);
      return { prev };
    },
    onError: (_err, _newFiling, ctx) => qc.setQueryData(["filings"], ctx?.prev), // (3) rollback
    onSettled: () => qc.invalidateQueries({ queryKey: ["filings"] }), // (4) reconcile with server
  });
}

// in the list: data/isPending/isError come straight from the hook
const { data, isPending, isError } = useFilings();                  // (5) one call, three states
Copy
Annotation (1) — useQuery caches the list under ["filings"], deduping requests and serving cached data instantly on the next visit.
Annotation (2) — onMutate cancels in-flight refetches, snapshots the current cache, and writes the optimistic value so the UI updates before the server confirms; it returns the snapshot for rollback.
Annotation (3) — onError restores the snapshot taken in onMutate, so a failed write rolls back instead of leaving a phantom row.
Annotation (4) — onSettled invalidates ["filings"] to reconcile the cache with the server once the write settles, so the list reflects the real state.
Annotation (5) — data, isPending, and isError arrive from the one hook, which drives the three render states in the next topics — no separate loading state to wire up.
AI Practice
Prompt it
Have Codex wire a query and a mutation, then verify invalidation runs and the optimistic update rolls back.

Using TanStack Query v5, write a useFilings query keyed ["filings"] and a
useCreateFiling mutation. After a successful create, invalidate ["filings"] so
the list refreshes. Add an optimistic update with onMutate (cancel, snapshot,
write), onError (rollback to the snapshot), and onSettled (invalidate). Show the
hooks and how the list reads data/isPending/isError.
Copy
Watch out
Codex often forgets the invalidation, so the new filing never appears until a reload, or writes an optimistic update with no onError rollback, so a failed write leaves a phantom row in the UI. It may also key queries inconsistently ("filings" vs ["filings", {}]), which makes invalidation miss. Confirm the mutation invalidates the exact key the query uses, and that onError restores the snapshot taken in onMutate.

Verify
Create a filing and confirm the list updates without a manual reload — proof the invalidation hit the right key. Force the write to fail and confirm the optimistic row disappears (the onError rollback), not a phantom row left behind. Confirm the query key in the mutation’s invalidateQueries matches the query’s queryKey exactly. Record any missing invalidation or rollback Codex produced in your prompt journal.

Knowledge Check
1. What identifies a cached query in TanStack Query?
The component instance that first called useQuery.
The URL string passed to fetch inside the query function.
Its query key, such as ["filings"] or ["filing", id].
The order in which queries are declared in the file.
2. After a successful create mutation, how does the list reflect the new row?
Invalidating the list’s query key marks it stale and refetches.
React automatically re-runs every useQuery on the page.
The mutation directly mutates the component’s local state array.
The new row appears only after the user reloads the page.
3. In the v5 optimistic-update pattern, what does onError do?
It retries the failed mutation until the server accepts it.
It restores the cache snapshot taken in onMutate.
It logs the error and leaves the optimistic value in place.
It cancels the query cache for the whole application.
4. Why does TanStack Query avoid the "empty flash" on every navigation?
Because it blocks navigation until the next fetch completes.
Because it disables useEffect across the application.
Because it renders a default skeleton component for you.
It serves cached data at once and refetches in background.
3
Topic 3 of 5
React Router — nested routes and error elements
Why Do I Need to Know This?
A multi-screen SPA needs navigation, and React Router structures it: nested routes share one app-shell layout, and a route-level error element keeps a single failed screen from blanking the whole app. Getting routing right is what makes list → detail → dashboard feel like one application rather than three disconnected pages.

Scenario
The team wires three routes — the filing list, a filing detail, and the dashboard — under a shared app-shell layout with the nav and header. They add an error element on the detail route, so when a detail load fails the user sees an error panel inside the shell, not a white screen that loses the navigation entirely.

Theory
Nested routes share a layout through Outlet
React Router (v7, which ships as the single react-router package) defines routes as a tree: a parent layout route holds the shared chrome — nav, header, shell — and renders its children through an <Outlet ></Outlet>. The list, detail, and dashboard routes are children of that layout, so the chrome is written once and wraps every screen. Nesting is how shared layout is expressed, rather than repeating the shell in each screen component. React Router v8 is also usable — it is a non-breaking upgrade from v7 and keeps the same single-package approach.

Error elements contain a failure
A route can declare an errorElement (via the data router from createBrowserRouter) that renders when that route throws during loading or rendering. The error bubbles to the nearest error element and renders there, so a failed detail screen shows an error panel inside the shell while the rest of the app keeps working — instead of the whole tree crashing to a blank page.

Router navigates; TanStack Query owns the data
This module pairs React Router for navigation with TanStack Query for data, rather than using Router’s own loaders and actions to fetch. The two stay in their lanes: Router decides which screen shows, TanStack Query owns what data that screen reads from the cache. Keeping data in the query layer means a screen’s data is cached and invalidated consistently, whether you arrive by link, back button, or refresh.

i
Note
One owner for data. Router loaders can fetch data too, but mixing them with TanStack Query gives you two caches and two refetch stories. This program keeps data in TanStack Query and uses Router only for navigation — recorded as the data-fetching pattern in ADR-0013.

A nested route tree with an error element
The app-shell layout wraps the three screens through an Outlet; the detail route carries its own error element.

AppShell (layout route, renders Outlet)

/filings -- FilingList

/filings/:id -- FilingDetail

/dashboard -- Dashboard

errorElement: FilingError (failed load)

Example
a nested route config with a shared layout and an error element
import { createBrowserRouter } from "react-router"; // React Router v7 — one package, no react-router-dom

const router = createBrowserRouter([
  {
    element: <AppShell ></AppShell>,                 // (1) layout route: nav + header + <Outlet></Outlet>
    children: [
      { path: "/filings", element: <FilingList ></FilingList> },
      {
        path: "/filings/:id",
        element: <FilingDetail ></FilingDetail>,
        errorElement: <FilingError ></FilingError>,      // (2) contains a failed detail load
      },
      { path: "/dashboard", element: <Dashboard ></Dashboard> },
    ],
  },
]);
Copy
Annotation (1) — the layout route renders the shared shell and an <Outlet ></Outlet>; each child screen renders into that outlet, so the chrome is written once.
Annotation (2) — the detail route’s errorElement renders inside the shell when the route throws, so a failed load shows an error panel, not a blank page.
The screens still read their data from TanStack Query, not from Router loaders — Router only chooses which screen is shown.
AI Practice
Prompt it
Have Codex wire the three routes, then verify the shared layout and a contained route error.

Set up React Router for our SPA with a shared AppShell layout route (nav + header
+ Outlet) and three child routes: /filings (list), /filings/:id (detail), and
/dashboard. Add an errorElement on the detail route so a failed load renders an
error panel inside the shell. Do not fetch data in Router loaders — screens read
their data from TanStack Query. Show the route config.
Copy
Watch out
Codex may duplicate the app-shell chrome inside each screen instead of using a layout route with an Outlet, or add Router loaders that fetch data — duplicating TanStack Query’s job and creating a second cache. It may also skip the error element, so a failed route blanks the app. Confirm the shell is a single layout route, screens read data from TanStack Query (not loaders), and the detail route has an error element.

Verify
Navigate among the three routes and confirm the nav and header persist (proof of one shared layout via Outlet), not re-mounted per screen. Force the detail load to fail and confirm an error panel renders inside the shell, not a blank page. Confirm no route uses a loader to fetch the data that TanStack Query owns. Record any duplicated shell or Router-loader fetching in your prompt journal for ADR-0013.

Knowledge Check
1. How does React Router share one layout across several screens?
A layout route renders children through an <Outlet ></Outlet>.
Each screen imports and renders the shell component itself.
The router copies the layout into every route at build time.
A global context re-renders the layout on every navigation.
2. What does a route’s errorElement accomplish?
It validates the route’s params before the screen renders.
It redirects to a login page whenever any route fails.
It renders an error UI in place when that route throws.
It retries the route’s data load three times automatically.
3. In this module, who owns data fetching — Router or TanStack Query?
React Router, through its loaders and actions on each route.
Both equally, with Router caching and Query refetching.
Neither — each screen fetches directly in a useEffect.
TanStack Query owns data; Router only chooses the screen.
4. Why prefer a layout route over rendering the shell in each screen?
Because React Router refuses to render a screen without a parent.
The shared chrome is written once and persists across nav.
Because the shell can only be styled when it is a layout route.
Because per-screen shells load faster than a shared one.
4
Topic 4 of 5
The auth-aware fetcher and the three UI states
Why Do I Need to Know This?
Every API call the SPA makes needs the bearer token from 3.1 — Node Authentication & Authorization and the correlation ID from 3.3 — Audit Logging & Redaction, and a 401 needs a refresh-and-retry — doing that per call guarantees drift and missed cases. Likewise every screen needs loading, empty, and error states, not just the happy path. The team centralizes the fetcher and standardizes the three states so auth and resilience are solved once, not re-solved on every screen.

Scenario
The team builds one fetch-based API client that attaches the bearer token and a correlation ID to every request, maps the backend’s RFC 9457 Problem+JSON error into a typed UI error, and runs the 401-refresh flow exactly once before failing to login. Each screen then renders three states from the query hook: a loading state while data arrives, an empty state when the list has no rows, and an error state when the call fails.

Theory
One fetcher attaches auth and maps errors
A single fetcher — built on fetch, not axios (the AGENTS.md rule) — wraps every request. It attaches the Authorization: Bearer token and the correlation ID header carried over from 3.3 — Audit Logging & Redaction, and it maps the backend’s Problem+JSON error body (the same RFC 9457 contract from Module 2, Lesson 3 — The Express Skeleton: Validation, Errors & OpenAPI) into a typed error the UI can render. Because all calls route through it (AGENTS.md), auth and error mapping are written once instead of per request, and a backend error contract change is a one-file edit.

The 401-refresh flow lives in the fetcher
When a request returns 401, the fetcher refreshes the token once and retries the original request; if the refresh also fails, it sends the user to login. This belongs in the fetcher, not in every screen, so a single expired token does not surface as a broken screen. Concurrent 401s share one in-flight refresh rather than each firing their own, which avoids a refresh stampede.

Every screen has three states
A screen is not just its success path. TanStack Query surfaces isPending and isError alongside data, which map directly to three render states: loading while the request is in flight, error when it fails (showing the typed message from the fetcher), and a designed empty state when the call succeeds but returns no rows. An empty list and a failed load are intended UI, not afterthoughts — especially for federal software where a blank screen is not an acceptable answer.

!
Important
A blank screen on error or empty data is a defect, not a default. Every screen must render a real loading state, a real empty state, and a real error state — the three are part of "done."

A request through the fetcher and the three render states
The fetcher attaches auth, handles a 401 once, and maps the error; the screen branches into loading, empty, or error.

401

Problem+JSON error

ok

Screen calls the API via the fetcher

Attach bearer token + correlation id

Response?

Refresh token once, retry -- else go to login

Map to typed UI error

Return typed data

Render state

loading (isPending)

empty (no rows)

error (isError → typed message)

Example
the fetcher attaching auth and handling a 401
async function apiFetch<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${getToken()}`, "X-Correlation-Id": correlationId() }, // (1) attach bearer token + correlation id
  });
  if (res.status === 401 && !retried) {
    await refreshOnce();                 // (2) refresh once (shared); throws/redirects to login on failure
    return apiFetch<T>(path, init, true); // retry exactly once — the `retried` flag caps it
  }
  if (!res.ok) throw toTypedError(await res.json()); // (3) map Problem+JSON → typed UI error
  return res.json() as Promise<T>;
}
Copy
Annotation (1) — every request gets the bearer token and the correlation ID, attached in one place so no call can forget them.
Annotation (2) — a 401 triggers a single shared refresh and one retry; the retried flag caps it at one attempt, so if the retried request still returns 401 the code falls through to the typed error / login rather than looping. Concurrent 401s await the same refresh rather than stampeding.
Annotation (3) — a non-ok response maps the Problem+JSON body into a typed error, which a screen renders as its error state instead of a raw failure.
AI Practice
Prompt it
Have Codex build the fetcher and the three screen states, then verify all calls go through it.

Build one fetch-based API client (not axios) for our SPA that attaches the bearer
token and an X-Correlation-Id to every request, maps the backend's RFC 9457
Problem+JSON error into a typed error, and on a 401 refreshes the token once and
retries (sharing one refresh across concurrent 401s, else go to login). Then show
a FilingList that renders loading, empty, and error states from a TanStack Query
hook, using the typed error message on failure.
Copy
Watch out
Codex may reach for axios despite the rule, attach the token in only some calls instead of centralizing it, or fire a separate refresh per concurrent 401 (a refresh stampede). On the screen, it often renders only the success path, leaving loading, empty, and error undefined. Confirm the client is fetch-based, every call routes through it, the refresh is shared and capped at one retry, and the screen renders all three states.

Verify
Confirm every API call goes through the one fetcher (grep for stray fetch(/axios outside it). Expire the token and confirm a single refresh-and-retry happens, not one per request, and that a failed refresh routes to login. On a screen, confirm loading, empty (no rows), and error (typed message) each render — force each state and check. Record any direct fetch, axios use, or missing screen state in your prompt journal.

Knowledge Check
1. Why route every API call through one shared fetcher?
Because fetch can only be called from a single module in React.
Auth, correlation IDs, and error mapping live in one place.
Because TanStack Query refuses to call more than one fetch function.
Because a shared fetcher makes individual requests faster.
2. Where does the 401 refresh-and-retry flow belong?
In each screen, so it can show its own refresh spinner.
In TanStack Query’s retry option on every query.
In the fetcher, refreshing once and retrying.
In React Router, as a redirect on every protected route.
3. What are the three states every screen must render?
Mounted, updating, and unmounted lifecycle phases.
Loading, empty, and error — beyond the success path.
Draft, submitted, and approved record statuses.
Authenticated, anonymous, and expired session states.
4. How should a backend Problem+JSON error reach the user?
Rendered as the raw JSON body on the screen.
Swallowed silently so the screen stays on its loading state.
Thrown uncaught so the whole app shows a blank page.
Mapped in the fetcher to a typed error the screen renders.
5
Topic 5 of 5
Practice — bring the live data in behind one fetcher
Why Do I Need to Know This?
This lesson’s payoff is a routed, data-driven slice of the SPA that behaves correctly under real conditions: API data treated as server state through TanStack Query, screens wired under a shared layout with contained errors, and every call going through one auth-aware fetcher that handles a 401 and feeds loading, empty, and error states. The way to know you have it is to build it and then attack it — let a write fail and watch the rollback, expire the token and watch the refresh, force an empty list and a failed load. This exercise drives Codex through the slice and verifies by breaking each path.

AI Practice
Prompt it
Hands-on practice for this lesson — build a routed, query-backed filing slice with Codex, then break each path.

Build a slice of our SPA in React 18 + TypeScript: (1) one fetch-based API client
that attaches the bearer token and X-Correlation-Id, maps RFC 9457 Problem+JSON to
a typed error, and refreshes once on a 401; (2) TanStack Query v5 hooks — a
useFilings query keyed ["filings"] and a useCreateFiling mutation that invalidates
it, with an optimistic update that rolls back on error; (3) React Router with a
shared AppShell layout and /filings, /filings/:id (with an errorElement), and
/dashboard; (4) loading, empty, and error states on the list screen from the query
hook. Show the client, the hooks, the route config, and the list screen.
Copy
Watch out
Codex is likely to store API data in useState instead of the query cache, forget to invalidate after the mutation or skip the optimistic rollback, fetch in Router loaders (a second cache), reach for axios, fire a refresh per concurrent 401, and render only the success path. Each passes a quick demo while breaking a guarantee the slice depends on. Read where the data lives, how the mutation invalidates, where the fetch happens, and which screen states exist before trusting it.

Verify
Confirm the list reads from TanStack Query (no API data in useState) and the mutation invalidates the exact ["filings"] key. Force the create to fail and confirm the optimistic row rolls back, not a phantom row. Expire the token and confirm one shared refresh-and-retry, then a failed refresh routes to login. Force an empty list and a failed load and confirm the empty and error states render, not a blank screen. Confirm every call goes through the one fetch-based fetcher and no Router loader fetches data. Record every path Codex got wrong in your prompt journal for ADR-0013.

