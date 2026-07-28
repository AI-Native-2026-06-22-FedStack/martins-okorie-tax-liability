Week 5 · Day 4
Forms, Tables & Dashboards
Build the capstone's interactive surface — forms with react-hook-form validated by the shared zod schema, data tables with TanStack Table, Chart.js dashboards from the wireframe, and accessibility built into all three.

1
Topic 1 of 5
Forms with react-hook-form and the shared zod schema
Why Do I Need to Know This?
Forms are where users write to the capstone, and re-typing validation rules in the UI that already exist in the API guarantees the two drift apart — the form accepts what the server rejects, or rejects what the server accepts. Reusing the shared zod schema makes the form and the API validate from one source, so a rule changes in exactly one place. This builds directly on the routed, query-backed screens from 5.3 — Server State: TanStack Query & Router: the form’s submit becomes a mutation.

Scenario
The team builds the create/edit form for the capstone’s primary entity. Instead of writing fresh validation in the component, they import the same zod schema the API uses for that entity — the one from the shared-schemas package built in 4.5 — The Polyglot Slice: Sprint 2 Integration — and wire it into react-hook-form through the zod resolver. A field that is required on the server is now required in the form, from the same definition.

Theory
react-hook-form manages form state efficiently
react-hook-form tracks form state with minimal re-renders by registering inputs as uncontrolled by default. useForm returns register to wire each input, handleSubmit to gather and validate values, and formState.errors for per-field errors. The form re-renders far less than a controlled-input form that lifts every keystroke into React state.

The shared zod schema validates the form
The same zod schema the API uses validates the form, wired through zodResolver from @hookform/resolvers/zod: useForm({ resolver: zodResolver(filingSchema) }). Because the schema is imported from the shared-schemas package, the form and the API enforce identical rules, and z.infer<typeof filingSchema> gives the form values their type. A resolver replaces react-hook-form’s built-in validators rather than combining with them — the schema is the single source.

Field errors map to their inputs
formState.errors holds one entry per field that failed the schema, so each input renders its own message — errors.amount?.message next to the amount field. Tying the message to its input is also where accessibility starts: the error is associated with the field it describes, a thread the Accessibility for forms, tables, and charts topic later in this lesson picks up.

i
Note
One schema, two consumers. The API validated requests against this schema in 4.5 — The Polyglot Slice: Sprint 2 Integration; the form now validates input against the same object. A new rule — a max length, a required field — is added once in shared-schemas and both sides inherit it.

One schema feeds both API and form validation
The shared zod schema is the single source: the API validates requests with it, and the form validates input through the zod resolver.

shared-schemas: filingSchema (zod)

API: validates requests

zodResolver(filingSchema)

react-hook-form: validates input

formState.errors → per-field messages

Example
useform wired to the shared schema
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { filingSchema, type Filing } from "@app/shared-schemas"; // (1) the API's schema

function FilingForm({ onSave }: { onSave: (f: Filing) => void }) {
  const { register, handleSubmit, formState: { errors } } =
    useForm<Filing>({ resolver: zodResolver(filingSchema) });     // (2) same rules as the API

  return (
    <form onSubmit={handleSubmit(onSave)}>
      <label htmlFor="amount">Amount</label>                      {/* (3) real label, associated by id */}
      <input id="amount" {...register("amount", { valueAsNumber: true })} /> {/* (4) registered, uncontrolled */}
      {errors.amount?.message && <p role="alert">{errors.amount.message}</p>} {/* (5) field error */}
    </form>
  );
}
Copy
Annotation (1) — the schema and its inferred Filing type are imported from shared-schemas, not redefined, so the form cannot drift from the API.
Annotation (2) — zodResolver(filingSchema) makes react-hook-form validate with the exact rules the server uses.
Annotation (3) — a real <label> with htmlFor="amount" matches the input’s id, so the first form example is accessible from the start; the error association (aria-describedby) is added in the accessibility topic.
Annotation (4) — register wires the input as uncontrolled, so typing does not re-render the whole form.
Annotation (5) — the per-field message comes from formState.errors; tying it to the input with aria-describedby so a screen reader announces it comes in the accessibility topic.
AI Practice
Prompt it
Have Codex build a form from the shared schema, then verify it reuses the schema rather than a copy.

Build a create/edit form for our Filing entity with react-hook-form. Validate it
with our existing zod schema imported from the shared-schemas package, wired
through zodResolver — do not write new validation rules in the component. Use
register for the inputs, handleSubmit for submission, and render each field's
error from formState.errors. Type the form with z.infer of the schema.
Copy
Watch out
Codex frequently re-declares a fresh zod schema inside the component instead of importing the shared one, which is the drift the single-source rule exists to prevent. It may also mix react-hook-form’s built-in required/min validators with the resolver (the resolver replaces them), or make every input controlled, losing the re-render benefit. Confirm the schema is the imported shared one, validation goes only through the resolver, and inputs are registered, not controlled.

Verify
Confirm the schema is imported from shared-schemas, not redefined in the component (grep for a local z.object). Change a rule in the shared schema and confirm the form’s validation changes without editing the component. Submit invalid input and confirm each field’s message renders from formState.errors. Record any duplicated schema or mixed built-in validators Codex produced in your prompt journal.

Knowledge Check
1. Why validate the form with the API’s shared zod schema?
Because react-hook-form cannot validate without an external schema.
So form and API rules come from one source and cannot drift.
Because zod schemas render input fields automatically.
Because the resolver makes the form submit faster over the network.
2. What does registering an input as uncontrolled achieve?
The form re-renders far less than a controlled one.
It stores the input’s value in the shared zod schema.
It makes the input immutable so the user cannot edit it.
It disables validation for that field entirely.
3. A teammate adds react-hook-form’s built-in required next to the zod resolver. What is the issue?
Built-in validators run faster, so zod should be removed instead.
The form will not compile with both configured at once.
The resolver replaces built-in validators as the single source.
Built-in validators only work with controlled inputs.
4. Where do a form’s per-field error messages come from?
From the API’s HTTP response on every keystroke.
From a separate errors schema written in the component.
From React Router’s error element for the route.
From formState.errors, set by the resolver.
2
Topic 2 of 5
Data tables with TanStack Table
Why Do I Need to Know This?
The capstone’s primary screen is a list of records, and a real list needs pagination, sorting, and filtering. Building that logic by hand — tracking sort direction, slicing pages, filtering rows — is error-prone and repetitive. A headless table library owns that logic while you own the markup, which matters because the markup has to be accessible and you cannot cede control of it.

Scenario
The filing list grows past a single screen. The team rebuilds it with TanStack Table: sortable columns, a filter box, and client-side pagination over the list that TanStack Query already caches. Because the library is headless, the team renders a real semantic <table> themselves and keeps full control of the accessible markup.

Theory
TanStack Table is headless
TanStack Table v8 manages table state — sorting, filtering, pagination — and renders nothing: you provide columns and data to useReactTable and render the markup from the table instance it returns.

"Headless" is the point: the library owns the logic, and you own every element, so the rendered output can be a semantic, accessible <table> rather than a library’s fixed markup you cannot change.

Sorting, filtering, and pagination are opt-in row models
Features are enabled by passing row models: getCoreRowModel is required, and getSortedRowModel, getFilteredRowModel, and getPaginationRowModel add each capability. Column definitions use an accessorKey matching a data property and a header. The table instance then exposes table.getHeaderGroups(), table.getRowModel().rows, and helpers like table.nextPage() to drive the markup you render.

Client-side state for this lesson’s data sizes
This lesson uses client-side pagination, sorting, and filtering: the query fetches the full list and the table handles the rest in the browser, which is the simplest approach for the capstone’s data sizes. Large lists can also virtualize — rendering only the visible rows — when a list grows long enough to matter. If the API paginates server-side instead, the same column model drives it with the table in manual mode.

Headless state drives the team's own markup
The library owns sorting, filtering, and pagination state; the team renders an accessible table from the instance it returns.

data + columns

useReactTable (state: sort/filter/page)

Team renders semantic /

Accessible, controllable output

Example
a sortable, filterable table
import { useReactTable, getCoreRowModel, getSortedRowModel,
         getFilteredRowModel, getPaginationRowModel, flexRender } from "@tanstack/react-table";

const columns = [
  { accessorKey: "id", header: "Filing" },        // (1) accessorKey maps to a data property
  { accessorKey: "status", header: "Status" },
];

function FilingTable({ data }: { data: Filing[] }) {
  const table = useReactTable({
    data, columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),         // (2) opt-in features as row models
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  return (
    <table>                                          {/* (3) the team's own semantic markup */}
      <thead>{table.getHeaderGroups().map((hg) => (
        <tr key={hg.id}>{hg.headers.map((h) => (
          <th key={h.id} onClick={h.column.getToggleSortingHandler()}>
            {flexRender(h.column.columnDef.header, h.getContext())}
          </th>))}</tr>))}
      </thead>
      <tbody>{table.getRowModel().rows.map((row) => (
        <tr key={row.id}>{row.getVisibleCells().map((c) => (
          <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
        ))}</tr>))}</tbody>
    </table>
  );
}
Copy
Annotation (1) — each column’s accessorKey matches a property on the row data, and header is its label.
Annotation (2) — sorting, filtering, and pagination are enabled by passing their row models; omit one and that feature is simply off.
Annotation (3) — the markup is a real <table>/<th> the team writes, which is what keeps it accessible — the library never dictates the HTML.
AI Practice
Prompt it
Have Codex build the table, then verify the rendered markup is a semantic, accessible table.

Build the filing list as a TanStack Table v8 (headless) with sortable columns, a
text filter, and client-side pagination over data we already have from TanStack
Query. Render a semantic HTML table — real <table>, <thead>, <th>, <tbody> — not
divs styled as a grid. Use accessorKey column defs and the appropriate row models.
Show the table component.
Copy
Watch out
Codex sometimes renders the table as a grid of <div>s (fast to style, inaccessible to a screen reader) instead of a semantic <table>, defeating the reason to keep markup control. It may also forget to pass a row model — enabling sorting in the columns but omitting getSortedRowModel, so clicking a header does nothing. Confirm the output is a real <table> with <th> headers, and every enabled feature has its matching row model.

Verify
Confirm the rendered output is a semantic <table> with <thead>/<th>/<tbody>, not <div>s — inspect the DOM. Click a header and confirm sorting works (its row model is present); type in the filter and confirm rows narrow; page through and confirm the page changes. Record any div-based table or missing row model Codex produced in your prompt journal.

Knowledge Check
1. What does "headless" mean for TanStack Table?
It renders a default table you cannot restyle.
It runs without a browser, on the server only.
It owns the logic; you render the markup.
It removes the need to define columns or data.
2. How are sorting and pagination enabled in TanStack Table v8?
By passing its row model, like getSortedRowModel.
By setting boolean flags such as sortable: true globally.
They are always on and cannot be disabled.
By installing separate plugin packages for each feature.
3. Why render the table as a semantic <table> rather than styled <div>s?
Because TanStack Table refuses to manage state for div layouts.
Because divs cannot display tabular data on screen.
A screen reader announces real table semantics that divs lack.
Because divs are slower to render than table elements.
4. A developer enables sorting in the column defs but clicking a header does nothing. What is missing?
A controlled useState for every cell value.
An onClick on the <tbody> rows instead of the headers.
A separate sorting plugin package to install.
The getSortedRowModel was not passed to the table.
3
Topic 3 of 5
Dashboards with Chart.js
Why Do I Need to Know This?
The panel wants to see the capstone’s data as a dashboard, not a table of numbers, and the wireframe specifies KPI cards and charts. The team builds them from the real API data the SPA already fetches, so the dashboard reflects the live system rather than invented numbers that look right in a demo and mislead in production.

Scenario
The wireframe shows a dashboard: KPI cards across the top, then a line chart of filings over time, a bar chart by status, and a donut of the status split. The team builds them with Chart.js through react-chartjs-2, fed by the same query data the list uses, and checks each chart’s data shape against what the API actually returns before trusting the picture.

Theory
Chart.js renders charts from a data and options config
Chart.js v4 via react-chartjs-2 renders the common chart types — Line, Bar, Doughnut — as React components taking a data prop and an options prop. Chart.js v4 is tree-shakeable, so you register the pieces you use once (ChartJS.register(ArcElement, Tooltip, Legend, …)) and the typed components register their own controllers.

KPI cards are not charts at all — they are plain components showing a single number with a label.

Build from the real data shape
The dashboard reads the same query data the rest of the SPA uses, so it shows the live system. The work is mapping the API’s shape into each chart’s data structure — labels and datasets — and verifying that mapping against what the API returns, not against a mock. A chart fed invented numbers looks finished and is wrong; one fed real data surfaces shape mismatches early — the same lesson 5.5 — UI Integration Gate: Sprint 3 teaches when the SPA meets the live backend.

A chart needs a text alternative
A Chart.js chart renders to a <canvas>, which is a single opaque element to a screen reader — the bars and slices inside are invisible to assistive tech. So a chart needs a text alternative: a short summary or an associated data table conveying the same information. This is required, not optional, for federal software, and the accessibility topic next covers exactly how.

API data composes the dashboard
The same query data drives KPI cards and the line, bar, and donut charts that make up the dashboard screen.

API data (from TanStack Query)

KPI cards (single numbers)

Line: filings over time

Bar: count by status

Doughnut: status split

Dashboard screen

Example
a line chart from api-shaped data
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LineElement, PointElement, LinearScale,
         CategoryScale, Tooltip, Legend } from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Legend); // (1) register once

function FilingsTrend({ points }: { points: { month: string; count: number }[] }) {
  const data = {                                          // (2) map API shape → chart data
    labels: points.map((p) => p.month),
    datasets: [{ label: "Filings", data: points.map((p) => p.count) }],
  };
  return <Line data={data} options={{ responsive: true }} aria-label="Filings per month" ></Line>; // (3)
}
Copy
Annotation (1) — Chart.js v4 is tree-shakeable, so you register the elements you use once before rendering any chart.
Annotation (2) — the chart’s data is built by mapping the real API shape into labels and datasets — no invented numbers.
Annotation (3) — the <canvas> carries an aria-label, the minimum text alternative; a fuller summary or data table comes in the accessibility topic.
AI Practice
Prompt it
Have Codex build a dashboard chart, then verify the data shape against the real API.

Build a dashboard for our filing SPA from the wireframe: KPI cards plus a line
chart (filings over time), a bar chart (count by status), and a doughnut (status
split), using react-chartjs-2 with Chart.js v4. Feed the charts from our real
TanStack Query data, mapping the API shape into each chart's data structure.
Register the Chart.js elements you use. Show the dashboard components.
Copy
Watch out
Codex tends to fill charts with plausible hard-coded sample data instead of mapping the real query data, producing a dashboard that looks done but reflects nothing. It may also forget ChartJS.register(...), so the chart silently fails to render, or omit any text alternative on the canvas. Confirm each chart maps the actual API shape, the used elements are registered, and the canvas has at least an aria-label.

Verify
Confirm each chart’s data is mapped from the real API response, not a hard-coded array — change the underlying data and confirm the chart changes. Confirm ChartJS.register includes every element the charts use (a missing one shows as a blank chart). Confirm each canvas has at least an aria-label. Record any invented data or unregistered element Codex produced in your prompt journal.

Knowledge Check
1. How does react-chartjs-2 render a chart type like a line chart?
By reading a CSS class that names the chart type.
As a component taking data and options props.
By generating an SVG from a schema definition.
By querying the API directly from inside the chart.
2. Why build the dashboard from the real API data shape?
Because Chart.js rejects any hard-coded data array.
Because real data renders faster than sample data.
So the dashboard reflects the system, not invented numbers.
Because sample data cannot be mapped into labels and datasets.
3. Why does a Chart.js chart need a text alternative?
Its <canvas> is opaque to a screen reader.
Because Chart.js cannot render labels on the chart itself.
Because the text alternative is what makes the chart interactive.
Because react-chartjs-2 requires a caption prop to render.
4. A chart renders blank with no errors after adding a new chart type. What is the likely cause?
The data prop was passed as an object instead of an array.
A required Chart.js element was not registered.
React Router did not define a route for the chart.
The chart was rendered outside a TanStack Query provider.
4
Topic 4 of 5
Accessibility for forms, tables, and charts
Why Do I Need to Know This?
Accessibility is part of done in this program from this module forward, and forms, tables, and charts are exactly where it is won or lost. Labels, headers, keyboard operation, and text alternatives are not optional polish for federal software — a screen a keyboard or screen-reader user cannot operate is not finished, and the CI gate in 5.5 — UI Integration Gate: Sprint 3 will fail the build over it.

Scenario
The team’s first pass has accessibility gaps: the form inputs have placeholder text but no real labels, the table headers are styled <div>s, and the donut chart is invisible to a screen reader. They fix each — associate a label and its error with every input, use semantic <th scope> headers, and add a data-table alternative to the chart — and then operate the whole screen by keyboard to confirm.

Theory
Forms: labels, associated errors, keyboard
Every input needs a real <label> associated with it (by htmlFor/id or by wrapping), not a placeholder standing in for one — a placeholder vanishes on input and is not reliably announced. Each error is tied to its input with aria-describedby, so a screen reader reads the message when the field is focused, and the form is fully operable by keyboard. This extends the per-field errors from the react-hook-form topic into accessible ones.

Tables: semantic headers with scope
A data table must be a semantic <table> with <th> header cells carrying a scope (col or row), so a screen reader announces which header a cell belongs to. This is exactly why the table topic insisted on real markup over <div>s — the semantics are what make the table navigable. A sortable column also exposes its sort state (for example, aria-sort) so the current order is announced, not just shown.

Charts: a text alternative, and color is never the only signal
A canvas chart needs a text alternative that conveys the same information — a short summary or, better, an associated data table with the numbers. Beyond that, color must never be the only way to read a chart: status encoded only by color is invisible to a color-blind user, so pair it with labels or patterns. Together these make the dashboard’s information available without sight.

!
Important
A screen no one can operate by keyboard or screen reader is not done — it is a defect, the same as a failing test. From 5.5 — UI Integration Gate: Sprint 3, axe and Lighthouse enforce this in CI, so accessibility built in now is what keeps the build green.

The accessibility fix for each surface
Each of the three surfaces has a specific, checkable fix that makes it usable by keyboard and screen reader.

Form — real <label> per input · error tied via aria-describedby · fully keyboard-operable
Table — semantic <th scope> headers · sort state exposed via aria-sort
Chart — text alternative (summary or data table) · color never the only signal
Example
a labeled field with an associated error
<div>
  <label htmlFor="amount">Amount</label>                 {/* (1) real label, associated by id */}
  <input id="amount" {...register("amount", { valueAsNumber: true })}
         aria-describedby={errors.amount ? "amount-error" : undefined} /> {/* (2) error tied to input */}
  {errors.amount?.message && (
    <p id="amount-error" role="alert">{errors.amount.message}</p>          // (3) announced on focus
  )}
</div>
Copy
Annotation (1) — a real <label> with htmlFor="amount" matches the input’s id, so clicking the label focuses the field and a screen reader announces it.
Annotation (2) — aria-describedby points to the error element, so the message is read out when the field is focused, not just shown visually.
Annotation (3) — the error is the same formState.errors message from the forms topic, now associated and announced — accessible, not just visible.
AI Practice
Prompt it
Have Codex make the three surfaces accessible, then verify with a keyboard-only pass.

Make our filing form, data table, and dashboard charts accessible: associate a
real <label> with every input and tie each error to its field with
aria-describedby; render the table with semantic <th scope> headers and expose
sort state; give each chart a text alternative (a summary or data table) and
ensure color is not the only signal. Show the accessible form field, table header
row, and chart alternative.
Copy
Watch out
Codex often uses placeholder text as a stand-in for a label (it disappears on input and is poorly announced), leaves table headers as <div>s, or considers a chart done once it renders — with no text alternative. It may also encode status by color alone. Confirm every input has a real associated label, headers are <th scope>, each chart has a text alternative, and no information is conveyed by color only. Automated checks come in 5.5 — UI Integration Gate: Sprint 3; this pass is by hand.

Verify
Operate each surface with the keyboard only: tab through the form and confirm labels and errors are announced, navigate the table and confirm headers are conveyed, and reach the chart’s text alternative. Confirm no input relies on a placeholder for its label, no header is a <div>, and no status is shown by color alone. Record each accessibility gap Codex left in your prompt journal — the CI gate in 5.5 — UI Integration Gate: Sprint 3 will check these automatically.

Knowledge Check
1. Why is a placeholder not an acceptable substitute for a label?
Placeholders cannot contain more than a few characters.
It disappears on input and is not reliably announced.
Placeholders are rendered too small for most users to read.
React strips placeholder text from registered inputs.
2. How is a field’s error message made accessible to a screen reader?
By rendering it in a larger, red font near the field.
By logging it to the console on validation failure.
By tying it to the input with aria-describedby.
By placing it inside the submit button’s label.
3. What makes a data table navigable by a screen reader?
Semantic <th> headers with a scope.
A high-contrast color on every header cell.
An onClick handler on each row for keyboard users.
A fixed pixel width on every column.
4. Beyond a text alternative, what else must a chart avoid for accessibility?
Rendering more than three datasets at once.
Using any animation when the chart loads.
Displaying a legend alongside the chart.
Using color as the only signal.
5
Topic 5 of 5
Practice — build the accessible form, table, and dashboard
Why Do I Need to Know This?
This lesson’s payoff is the capstone’s interactive surface built right: a form validated by the shared schema, a headless table rendered as accessible markup, a dashboard fed by real data, and accessibility built into all three so the CI gate in 5.5 — UI Integration Gate: Sprint 3 passes. The way to know you have it is to build it and then attack it — redeclare the schema and watch it drift, render the table as <div>s and run a screen reader, feed a chart mock data and compare it to the API. This exercise drives Codex through the surface and verifies by breaking each guarantee.

AI Practice
Prompt it
Hands-on practice for this lesson — build the accessible form/table/dashboard with Codex, then break each guarantee.

Build the capstone's interactive surface in React 18 + TypeScript against our
TanStack Query data: (1) a create/edit Filing form with react-hook-form validated
by the shared zod schema via zodResolver — no re-declared rules; (2) the filing
list as a headless TanStack Table v8 (sort, filter, client-side pagination)
rendered as a semantic <table>; (3) a dashboard with KPI cards and line/bar/donut
charts (react-chartjs-2 + Chart.js v4) mapped from the real data; (4) accessibility
across all three — real labels with aria-describedby errors, <th scope> headers,
chart text alternatives, no color-only signals. Show the form, table, dashboard,
and the accessibility details.
Copy
Watch out
Codex is likely to re-declare the zod schema in the form (drift), render the table as styled <div>s (inaccessible), fill the charts with hard-coded sample data, use placeholders instead of labels, and treat a chart as done once it renders. Each passes a quick look while breaking a guarantee. Read where validation rules live, whether the table is a real <table>, where the chart data comes from, and how inputs and errors are associated before trusting it.

Verify
Confirm the form imports the shared schema (change a rule and watch the form follow), the table is a semantic <table> with <th scope> and working sort/filter/pagination, and each chart maps real query data with the elements registered. Operate every surface by keyboard: labels and errors announced, table headers conveyed, chart alternatives reachable, no color-only status. Record every guarantee Codex broke in your prompt journal — these are exactly what 5.5 — UI Integration Gate: Sprint 3 checks.

