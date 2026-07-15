2.2 Advanced SQL & Integration Testing with Testcontainers
🕐 Last Updated: 2026-06-20 01:51:37 UTC
📌 Commit: ac482464
Week 2 · Day 2
Advanced SQL & Integration Testing with Testcontainers
Write the reads the dashboard needs — common table expressions and window functions — and prove them against a real, throwaway Postgres in a container instead of a mock.

1
Topic 1 of 5
Common table expressions, regular and recursive
Why Do I Need to Know This?
The dashboard your team is building needs reporting reads that quickly outgrow a single flat SELECT. A common table expression lets you name and compose steps, so a query that computes one thing and then uses that result stays readable and reviewable instead of collapsing into nested subqueries. Recursive common table expressions go further: they are the clean way to walk a hierarchy, like the chain of amended filings that each replace the one before, which a normal query cannot follow at all.

Scenario
Your team needs a report that first sums each filing’s line items, then keeps only the filings whose total is over a threshold for review. Written as one nested subquery it is hard to read and harder to review. A WITH clause names the subtotal step and feeds it to the filtering step, so the query reads as two stages. Separately, the tax domain allows an amended filing: a new filing that points back to the one it replaces. Your team needs the original filing at the bottom of a chain of amendments, and a WITH RECURSIVE query walks from any filing down to its original.

Theory
A CTE names a query step so the query reads as stages
A common table expression (CTE) is a named subquery you define with WITH, then use in the main query as if it were a table. It matters because reporting reads are usually multi-step — compute a subtotal, then filter or join on it — and nesting those steps as subqueries makes the query unreadable. Naming each step with WITH turns the query into composed stages you can read top to bottom, as the Example below shows with a per-filing subtotal feeding a filter.

A recursive CTE walks a self-referencing relationship
A recursive CTE walks a relationship a table has with itself, which a flat query cannot do because it does not know in advance how many steps the walk takes. It has two parts joined by UNION ALL: a base case that selects the starting row, and a recursive case that joins the table back to the rows the CTE has produced so far. For the amended-filing chain, each filing has an amends_filing_id pointing to the filing it replaces; the base case is the filing you start at, and the recursive case follows amends_filing_id one hop at a time until it reaches the original, which has none. The syntax is current in PostgreSQL 17.

A cycle in the data makes a recursive CTE run forever — bound it
A recursive CTE assumes the chain ends. If the data has a cycle — filing A amends B and a bad write makes B amend A — the recursion never reaches a row with no parent, so it loops until the server kills it. Postgres gives you a CYCLE clause that stops the walk when it revisits a row it has already seen: CYCLE id SET is_cycle USING path tracks visited ids and marks the row where a cycle is detected (PostgreSQL 17 docs). A depth guard such as WHERE depth < 100 in the recursive case is a simpler bound when you know the chain’s realistic maximum length.

!
Warning
A recursive CTE without a cycle guard is a production hazard: one cyclic row turns a fast query into one that consumes server resources until it is terminated. Add the CYCLE clause or a depth bound to any recursive query that walks data a user can write.

How a recursive CTE walks the amendment chain
The recursive CTE starts at one filing (the base case), then repeatedly follows amends_filing_id to the filing it replaces, unioning each hop until it reaches the original.

another amendment exists

amends_filing_id IS NULL

Base case: SELECT the starting filing (id = 42)

Recursive case: JOIN filing ON filing.id = chain.amends_filing_id

UNION ALL combines the base row with each hop

Stop: reached a filing whose amends_filing_id IS NULL (the original)

Example
a regular cte and a recursive cte over the filing schema
-- (1) Regular CTE: name the subtotal step, then filter on it.
WITH filing_totals AS (
  SELECT filing_id, SUM(amount_cents) AS total_cents
  FROM   line_item
  GROUP  BY filing_id
)
SELECT f.id, ft.total_cents
FROM   filing f
JOIN   filing_totals ft ON ft.filing_id = f.id   -- (2) use the CTE like a table
WHERE  ft.total_cents > 100000
ORDER  BY ft.total_cents DESC;

-- (3) Recursive CTE: walk the amendment chain from filing 42 down to its original.
WITH RECURSIVE amendment_chain AS (
  SELECT id, amends_filing_id, 1 AS depth          -- (4) base case: the starting filing
  FROM   filing
  WHERE  id = 42
  UNION ALL
  SELECT f.id, f.amends_filing_id, ac.depth + 1    -- (5) recursive case: one hop back
  FROM   filing f
  JOIN   amendment_chain ac ON f.id = ac.amends_filing_id
)
CYCLE id SET is_cycle USING path                   -- (6) stop if a filing is revisited
SELECT id, depth, is_cycle FROM amendment_chain;
Copy
Annotation (1) and (2) — filing_totals is computed once and used in the JOIN like any table, so the query reads as "subtotal, then filter" instead of a nested subquery.
Annotation (3) — WITH RECURSIVE is required for a query that references itself; without RECURSIVE the CTE cannot use its own name.
Annotation (4) and (5) — the base case picks the starting row; the recursive case joins filing back to rows the CTE already produced, following amends_filing_id one filing at a time.
Annotation (6) — the CYCLE clause tracks visited ids and stops if the walk returns to a filing it has seen, so a cyclic amendment can’t loop forever.
AI Practice
Prompt it
Have Codex draft the recursive query and its query plan, then verify both before you trust it.

My `filing` table has a self-referencing column `amends_filing_id` (nullable;
points to the filing this one replaces, NULL for an original). Write a
WITH RECURSIVE query that, given a starting filing id, returns every filing in
its amendment chain down to the original, with a depth column. Guard against a
cycle in the data. Then give me the EXPLAIN for the query. Explain how your
cycle guard works.
Copy
Watch out
Codex often writes the recursive case correctly but omits the cycle guard, because the happy-path data has no cycles, so the query looks fine in a quick test. It may also reverse the join direction — walking to amendments of the filing instead of the filing it amends. Read the join condition against your column’s meaning, and confirm a CYCLE clause or depth bound is present.

Verify
Insert a deliberate two-row cycle (filing A’s amends_filing_id = B, filing B’s = A) into a throwaway database and run the query against it. Without a guard it hangs or errors on resource limits; with the guard it returns and marks the cycle. Then read the EXPLAIN and confirm the recursive term joins on amends_filing_id, not the reverse.

Knowledge Check
1. Your report computes a per-filing subtotal and then keeps only filings above a threshold. Why express the subtotal as a CTE rather than a nested subquery?
A CTE runs measurably faster than the same logic written as a subquery.
A CTE names the subtotal step, so the query reads as composed stages.
A CTE lets you skip the GROUP BY that the subtotal would otherwise need.
A CTE automatically creates an index on the grouped column for you.
2. You write a WITH RECURSIVE query to walk the amendment chain, but it never returns and the server eventually kills it. What is the most likely cause?
The base case selects too many starting rows for the recursion to handle.
WITH RECURSIVE is not supported, so the query falls back to a full scan.
The recursive case is missing a GROUP BY, so rows are duplicated endlessly.
The data has a cycle and the query has no guard, so the walk never ends.
3. A recursive CTE has two parts joined by UNION ALL. What does the recursive part (the second part) do?
It joins the table back to the rows the CTE has produced so far.
It selects the single starting row that the walk begins from.
It defines the final ORDER BY and LIMIT for the whole result.
It declares the cycle guard that stops the recursion safely.
4. You need to stop a recursive walk from looping on cyclic data, and the realistic chain length is unknown. Which guard fits best?
A LIMIT 100 on the outer query that selects from the CTE.
A WHERE id IS NOT NULL condition inside the recursive term.
A CYCLE clause that tracks visited rows and stops on repeat.
A DISTINCT in the base case to remove duplicate starting rows.
2
Topic 2 of 5
Window functions over partitions
Why Do I Need to Know This?
The dashboard often needs a value computed across a group of rows while still showing every row — each line item’s rank within its filing, or a running total within its filing. A GROUP BY cannot do this: it collapses the rows into one per group, and the detail rows the dashboard displays disappear. Window functions are how your team computes a per-group value and keeps every row, so the report shows both the line item and where it stands in its filing.

Scenario
The dashboard shows each line_item next to its rank within its filing — the largest line item first — and a running total within its filing. If your team reaches for GROUP BY filing_id, the individual line items collapse into one summary row per filing and the detail the dashboard needs is gone. A window function with OVER (PARTITION BY filing_id ...) computes the rank and the running total per filing while leaving all the line-item rows in place.

Theory
A window function keeps every row while computing across a group
A window function computes a value over a set of related rows — the window — without collapsing them, which is the difference from GROUP BY. GROUP BY filing_id returns one row per filing; a window function returns every line item and adds a computed column alongside it. Use a window function whenever the report needs both the detail row and a value derived from its group, as the Figure contrasts.

PARTITION BY sets the groups, ORDER BY sets the order
The OVER (...) clause defines the window. PARTITION BY filing_id splits the rows into groups, one per filing, and the function restarts for each group. ORDER BY amount_cents DESC inside OVER sets the order the function sees, which is what makes a rank or a running total meaningful — ROW_NUMBER() numbers the rows in that order, and a running SUM accumulates in it. Without PARTITION BY, the whole result is one window; without ORDER BY, there is no order to rank or accumulate over.

The frame clause bounds which rows a running calculation sees
For running totals, a third part of the window — the frame — bounds which rows are included for each row’s calculation. ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW means "every row from the start of the partition through this one," which is exactly a running total. The two functions this topic uses are ROW_NUMBER() for ordering within a partition and SUM() OVER (...) for running totals. The frame and function syntax is current in PostgreSQL 17.

GROUP BY collapses rows; a window function keeps them
The same four line items of one filing: GROUP BY returns a single summary row, while a window function returns every row with the computed columns added.

GROUP BY filing_id
filing_id	sum_cents
42	9000
Four line items collapse into one row. The detail is gone.
SUM() OVER (PARTITION BY filing_id)
line_item	amount	running
A	4000	4000
B	3000	7000
C	1500	8500
D	500	9000
Every row stays; a running total is added.
Example
rank and running total per filing
SELECT
  li.filing_id,
  li.description,
  li.amount_cents,
  ROW_NUMBER() OVER (                          -- (1) rank within the filing
    PARTITION BY li.filing_id
    ORDER BY li.amount_cents DESC
  ) AS rank_in_filing,
  SUM(li.amount_cents) OVER (                  -- (2) running total within the filing
    PARTITION BY li.filing_id
    ORDER BY li.amount_cents DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_cents
FROM line_item li
ORDER BY li.filing_id, rank_in_filing;
Copy
Annotation (1) — ROW_NUMBER() numbers the line items within each filing in descending amount order, so the largest is rank 1; PARTITION BY restarts the numbering for every filing.
Annotation (2) — the same partition and order, plus the frame ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW, accumulates a running total from the largest line item down.
Every line_item row stays in the result — the rank and running total are added columns, not a collapse. A GROUP BY filing_id would have returned one row per filing instead.
Changing the frame changes the meaning: drop the frame and SUM() OVER (PARTITION BY filing_id) becomes the filing’s grand total on every row, which you can divide into amount_cents to get each line item’s share.
AI Practice
Prompt it
Ask Codex to convert a collapsing aggregate into a window-function version that keeps the detail rows.

Here is a report that uses GROUP BY filing_id to return one summary row per
filing with the total amount. Rewrite it so it returns every line_item row
instead, adding two columns: the line item's rank within its filing (largest
amount = rank 1) and a running total within the filing. Use window functions.
Do not change which rows are included beyond keeping the detail rows.
Copy
Watch out
Codex sometimes keeps the GROUP BY and adds a window function on top, which still collapses the rows and defeats the point. It may also omit PARTITION BY, computing the rank across the whole table instead of within each filing. Confirm there is no GROUP BY and that every OVER (...) partitions by filing_id.

Verify
Count the rows the new query returns and compare it to the number of line_item rows for the filings in range — they must match, proving no rows were collapsed. Then pick one filing and check by hand that rank 1 is its largest line item and the last running total equals the filing’s total.

Knowledge Check
1. The dashboard must show each line_item row and its rank within its filing. Why is GROUP BY filing_id the wrong tool?
GROUP BY cannot sort rows, so it cannot produce a rank at all.
GROUP BY ranks rows globally instead of within each filing.
GROUP BY collapses each filing to one row, so detail rows disappear.
GROUP BY requires every selected column to be aggregated, which is slow.
2. In ROW_NUMBER() OVER (PARTITION BY filing_id ORDER BY amount_cents DESC), what does PARTITION BY filing_id do?
It restarts numbering for each filing, so rank 1 is per filing.
It filters the result down to a single filing before numbering.
It sorts the whole result by filing_id before anything else runs.
It joins line_item to filing on filing_id automatically.
3. You want a running total of amount_cents within each filing, accumulating from the first row to the current one. Which clause expresses that?
PARTITION BY filing_id with no ORDER BY inside OVER.
GROUP BY filing_id with SUM(amount_cents).
ORDER BY amount_cents placed in the outer query, applied only after the result rows are selected.
ORDER BY amount_cents DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW.
4. A query returns 50 rows with GROUP BY filing_id. You rewrite it with a window function instead and expect the detail back. Roughly how many rows should it now return?
About 50 — a window function and GROUP BY return the same row count.
As many rows as there are line_item records; no rows collapse.
Exactly one row — window functions always reduce to a single summary.
Half as many — the partition merges each pair of rows into one.
3
Topic 3 of 5
Integration testing against a real, containerized database
Why Do I Need to Know This?
A test that runs against a fake stand-in for the database can only return what you told the stand-in to return, so it proves your code called the database — never that your SQL, your constraints, and your column types actually behave against Postgres. The advanced reads you just wrote are exactly where that gap bites: a wrong column name, a constraint you never exercised, a type that coerces differently. Your team runs these queries against a real Postgres so the test failure surface matches production, not a fiction you wrote.

Scenario
A teammate’s test for the data-access code passes against a mock — a fake that returns a canned filing row. But the query fails the moment it runs in psql, because a column was misspelled and a CHECK constraint the mock never enforced rejects the row. Your team switches the test to run against a real Postgres that Testcontainers starts in a container for the test run and throws away afterward. The same test now fails for the right reason, catching what the mock hid.

Theory
A mock proves interaction, not database behavior
A mock returns values you program into it, so a test using a mock verifies that your code called the database in the expected way — not that the SQL is correct, the constraints hold, or the types line up. Those are exactly where persistence bugs live. The misspelled column and the unenforced CHECK in the Scenario both pass a mock because the mock has no schema; only a real database rejects them. Use a mock to test logic that surrounds the query, and a real database to test the query itself.

Testcontainers starts a real, disposable Postgres for the test run
Testcontainers starts an actual Postgres in a Docker container when your tests begin and stops it when they finish, so each run gets a clean real database with no shared dev server to corrupt or coordinate. For Node, the @testcontainers/postgresql module exposes new PostgreSqlContainer("postgres:17-alpine"), a .start() that returns the running container, .getConnectionUri() for the connection string, and .stop() for teardown. It works with Vitest, the test runner your team adopted in 1.5 AI-Augmented TDD, by starting the container in a setup file.

Each test gets clean state so tests do not depend on order
Integration tests that share a database can pass or fail depending on what ran before them, which makes failures impossible to trust. Each test, or each test file, must see a known starting state. The cheapest reliable way is to reset the data between tests; the Test-data factories and cleanup topic covers the exact cleanup step. The container itself is disposable, but within one container many tests run, so resetting data between them is still required.

»
Tip
Starting a container takes a few seconds, so start one Postgres for the whole test run in a Vitest global setup and reuse it, rather than starting a fresh container per test. Reset the data between tests, not the container.

The lifecycle of a Testcontainers integration test run
The test run starts one real Postgres, applies the schema, runs the tests against it, and tears the container down at the end.

Test files
Postgres container
Testcontainers
Vitest (global setup)
start PostgreSqlContainer("postgres:17-alpine")
1
pull image and run container
2
getConnectionUri()
3
apply schema (CREATE TABLE ...)
4
run queries against the real database
5
real rows, real constraint errors
6
teardown -> container.stop()
7
Example
a vitest setup that runs a query against a real postgres
// db.test.ts — runs against a real Postgres started by Testcontainers
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Client } from "pg";
import { beforeAll, afterAll, expect, test } from "vitest";

let container: StartedPostgreSqlContainer;
let db: Client;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:17-alpine").start(); // (1) real Postgres
  db = new Client({ connectionString: container.getConnectionUri() });     // (2) connect to it
  await db.connect();
  await db.query(`CREATE TABLE filing (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    status text NOT NULL,
    total_cents integer NOT NULL CHECK (total_cents >= 0)
  )`);                                                                      // (3) real schema + constraint
}, 60_000);                                                                 // (4) allow time to pull/start

afterAll(async () => {
  await db.end();
  await container.stop();                                                   // (5) dispose the container
});

test("rejects a negative total via the CHECK constraint", async () => {
  await db.query(`INSERT INTO filing (status, total_cents) VALUES ('draft', 100)`);
  await expect(
    db.query(`INSERT INTO filing (status, total_cents) VALUES ('draft', -1)`)
  ).rejects.toThrow();                                                      // (6) the real DB enforces it
});
Copy
Annotation (1) and (2) — the container is a real Postgres 17; getConnectionUri() gives the connection string the pg client uses, so the test talks to an actual database.
Annotation (3) — the schema, including the CHECK (total_cents >= 0) constraint, is applied to the real database, so the test exercises the constraint a mock could not.
Annotation (4) — the 60-second timeout on beforeAll allows for pulling the image on first run; later runs reuse the cached image and start faster.
Annotation (5) — container.stop() disposes the database so nothing leaks between runs.
Annotation (6) — the negative-total insert is rejected by Postgres itself; against a mock this test would pass without proving anything, because a mock has no CHECK constraint.
AI Practice
Prompt it
Have Codex set up the Testcontainers harness and one integration test, then verify it uses a real database.

Set up an integration test in Vitest that starts a real Postgres using
@testcontainers/postgresql (image postgres:17-alpine) in a beforeAll, applies a
CREATE TABLE filing schema with a CHECK (total_cents >= 0) constraint, and stops
the container in afterAll. Write one test that inserts a valid row and one that
asserts a negative total_cents is rejected by the database. Use the `pg` client
with the container's getConnectionUri().
Copy
Watch out
Codex may quietly swap the real container for a mock or an in-memory fake "to make the test faster," which removes the entire point of the exercise. It may also forget container.stop(), leaking containers between runs, or hardcode a connection string instead of using getConnectionUri(). Confirm the test starts a real PostgreSqlContainer, connects via its URI, and stops it in teardown.

Verify
Run the test once and confirm it passes. Then change the CHECK to total_cents >= 1000 and rerun: the negative-total test still passes (rejected) but a 100-cent insert now fails, proving the real database is enforcing the constraint. Revert the change. If swapping the constraint changes nothing, the test is not hitting a real database.

Knowledge Check
1. A teammate’s data-access test passes against a mock, but the same query throws in psql because a column name is wrong. Why did the mock miss it?
A mock returns canned values and has no schema, so a wrong column slips by.
The mock validated the column but used a case-insensitive comparison by mistake.
The mock cached an older version of the query from a previous test run.
The query was correct and psql reported a false error unrelated to the column.
2. Why start one Postgres container in a Vitest global setup and reuse it, rather than starting a fresh container in each test?
Reusing one container lets tests share data, which makes them simpler to write.
A fresh container per test would run the tests against different Postgres versions.
Starting a container takes seconds, so per-test containers make the suite slow.
Vitest cannot start more than one container during a single test run.
3. What does running a test against a real Postgres container prove that a mock-based test cannot?
That the network between the application and the database is configured correctly.
That the SQL, constraints, and column types actually behave against Postgres.
That the application handles thousands of concurrent users under load.
That the query returns within a fixed millisecond budget every time.
4. After the container starts in beforeAll, what must afterAll do, and why?
Re-run the schema so the next test file starts from the same tables.
Insert a row of seed data so the next run has something to query.
Leave the container running so the next test file can connect faster.
Call container.stop() to dispose the database so nothing leaks.
4
Topic 4 of 5
Test-data factories and cleanup
Why Do I Need to Know This?
Integration tests need realistic, varied rows to exercise the queries you just wrote, and hand-writing those rows inline makes every test long, noisy, and fragile — add one required column and a dozen tests break at once. A factory builds a valid domain row on demand, so each test states only the field it cares about and the rest stay valid. Cleanup between tests keeps them independent, so a failure or a leftover row in one test does not cascade into the next.

Scenario
Your team’s integration tests are copy-pasting twelve-line literal filing objects into every test. When the schema adds a required taxpayer_id, five tests break at once because each literal is now missing a field. You introduce a makeFiling(overrides) factory that builds a valid filing with sensible defaults from @faker-js/faker, so a test overrides only the one field it asserts on. You add an afterEach that truncates the tables, so each test starts from empty and no test depends on another’s rows.

Theory
A factory centralizes how a valid row is built
A factory is a function that returns a valid domain object, with defaults for every field and an overrides argument for the few a test cares about. It matters because it removes duplication: the rule for "what makes a valid filing" lives in one place, so a schema change updates one function instead of every test. A test that asserts on status calls makeFiling({ status: "submitted" }) and trusts the factory for the rest, as the Example shows.

Faker generates realistic, varied values
@faker-js/faker generates realistic fake data — names, dates, numbers — so test rows vary instead of all using identical values that can hide ordering or uniqueness bugs. The library exposes namespaced methods like faker.person.fullName(), faker.number.int({ min, max }), and faker.date.recent().

i
Note
Faker’s namespaces (faker.person, faker.number, faker.date) are stable across recent major versions; if you see older examples using faker.name or faker.random, those were renamed and no longer exist in the current API.

Cleanup keeps tests independent of order
Cleanup resets the database between tests so none depends on another’s writes or on the order they run in. Two patterns are common, and your team’s default is truncate between tests: an afterEach runs TRUNCATE ... RESTART IDENTITY CASCADE on the tables, which empties them and resets identity counters. It is chosen as the default because it exercises the real commit path — your code’s inserts actually commit, exactly as in production. The alternative, transaction-per-test rollback, is described below as a deep dive.

A factory feeds a test, then cleanup resets state
The factory builds a valid row with the test’s overrides; the test runs; an afterEach truncates the tables so the next test starts clean.

makeFiling({ status: 'submitted' })

valid filing row (other fields faked)

test inserts and asserts

afterEach: TRUNCATE ... RESTART IDENTITY CASCADE

next test starts from empty tables

Example
a faker-backed factory and an aftereach cleanup
import { faker } from "@faker-js/faker";
import { afterEach } from "vitest";

type FilingInput = { taxpayer_id: number; status: string; total_cents: number };

// (1) defaults for every field; overrides win via the spread
function makeFiling(overrides: Partial<FilingInput> = {}): FilingInput {
  return {
    taxpayer_id: faker.number.int({ min: 1, max: 1000 }),   // (2) varied, valid value
    status: "draft",
    total_cents: faker.number.int({ min: 0, max: 500_000 }),
    ...overrides,                                            // (3) only what the test cares about
  };
}

// (4) a test overrides one field and trusts the factory for the rest
const submitted = makeFiling({ status: "submitted" });

// (5) reset state between tests so none depends on another's rows
afterEach(async () => {
  await db.query("TRUNCATE filing, line_item RESTART IDENTITY CASCADE");
});
Copy
Annotation (1) — makeFiling returns a fully valid input, so a test never has to remember every required column.
Annotation (2) — faker.number.int({ min, max }) produces varied values within valid bounds, so tests do not all use identical data.
Annotation (3) — the ...overrides spread lets the caller replace any default, so a test states only the field it asserts on.
Annotation (4) — makeFiling({ status: "submitted" }) reads as "a filing that happens to be submitted," which is the only fact this test depends on.
Annotation (5) — TRUNCATE ... RESTART IDENTITY CASCADE empties the tables and resets the identity counters in afterEach, so each test begins from a known empty state. db here is the client established in the Testcontainers beforeAll block from 2.2 Advanced SQL & Integration Testing with Testcontainers Topic 3.
AI Practice
Prompt it
Ask Codex to write the factory with faker defaults, then verify every produced row is valid.

Write a TypeScript factory function makeFiling(overrides) that returns a valid
filing input object: taxpayer_id (a positive integer), status (default "draft"),
and total_cents (a non-negative integer). Use @faker-js/faker (current major
version, namespaced API like faker.number.int) for the defaults, and let
overrides replace any field. Then write a Vitest afterEach that truncates the
filing and line_item tables and resets identity sequences.
Copy
Watch out
Codex may use the old faker API (faker.random.number or faker.name.findName), which does not exist in the current major version and will not run. It may also generate values that violate your constraints — a negative total_cents, or a status outside your allowed set. Confirm the methods are the namespaced ones (faker.number, faker.person) and that every faked value satisfies the table’s constraints.

Verify
Call the factory a few times and print the results: the varied fields should differ between calls, and the defaults should be valid. Then insert a factory-built row into the real Testcontainers database from the previous topic — if any produced value violates a constraint, the insert fails, which tells you the factory’s defaults do not match the schema.

Knowledge Check
1. A schema change adds a required taxpayer_id, and five tests that build filing rows inline all break. How does a factory prevent this in future?
It makes the new column optional so existing tests keep compiling.
It centralizes valid-row construction, so only one function changes.
It mocks the database so the missing column is never actually inserted.
It retries the failing inserts until the missing field is filled in.
2. Why build factory defaults with faker instead of hardcoding the same literal values in every row?
Faker values are guaranteed unique, which enforces primary-key uniqueness for you.
Varied values surface bugs that identical fixed data can hide.
Faker values are validated against your table constraints automatically.
Faker makes the tests run faster than constructing literals by hand.
3. Your team picks truncate-between-tests over transaction-per-test rollback as the default. What is the main reason?
Truncate runs faster than a transaction rollback in every case.
Truncate avoids needing a real database connection during cleanup.
Truncate lets writes commit, matching the real production path.
Truncate keeps data between tests so later tests can reuse earlier rows.
4. Your cleanup truncates the tables once in afterAll at the end of the file instead of in afterEach. The first test passes. What breaks on the second test?
The second test may find rows left by the first, so its result depends on order.
The container stops before the second test runs, so there is no database to connect to.
The afterAll truncate executes before any test runs, leaving the tables permanently empty.
TRUNCATE inside afterAll is invalid SQL and throws a syntax error.
5
Topic 5 of 5
Practice — generate a recursive query with Codex and prove it terminates
Why Do I Need to Know This?
The reads this lesson teaches — a recursive amendment chain and a windowed dashboard report — are exactly the kind of code that looks correct in a quick test and then misbehaves on real, messy data: the recursion loops forever on a cycle, the window query silently collapses the detail rows. Having Codex write both and then proving them against a real, containerized database is how you build the habit of verifying AI output against the failure case, not the happy path. This exercise pulls the lesson’s CTE, window-function, and integration-testing work together against a real Postgres.

Theory
The loop is propose → prove-against-a-real-database → record: Codex proposes the queries, you prove them by running against a throwaway Postgres seeded with the data that exposes their failure modes (a cycle for the recursion, multi-row filings for the window), and you record any gap. Neither query is verified by reading it — a recursive CTE without a cycle guard reads fine until it hits a cycle, and a window query that kept a stray GROUP BY returns the wrong row count. A real database is the proving ground: row counts confirm the window query did not collapse detail rows, the ranked values confirm ordering, and the recursion’s result set confirms the chain terminates.

AI Practice
Prompt it
Hands-on practice for this lesson — do this against a Testcontainers Postgres seeded with an amendment chain that includes a deliberate cycle and several multi-line-item filings, then verify each query yourself.

Against my filing/line_item schema, write two reads and the tests that prove
them, to run on a Testcontainers Postgres:
1. A WITH RECURSIVE query that, given a starting filing id, returns its amendment
   chain (via self-referencing amends_filing_id) down to the original with a depth
   column, guarded against a cycle in the data.
2. A window-function report listing each line_item with its rank within its
   filing and a running total, keeping every detail row (no GROUP BY collapse).
Give me the EXPLAIN for query 1, and a Vitest integration test that seeds a cyclic
chain and a multi-item filing and asserts both queries behave.
Copy
Watch out
On the recursive query Codex usually omits the cycle guard, because the happy-path data has no cycle to expose the bug, and it may reverse the join direction (walking to amendments of the filing instead of the filing it amends). On the window query it may leave a GROUP BY that collapses the detail rows, or drop PARTITION BY so the rank spans the whole table. Confirm the CYCLE clause or depth bound is present and that the window query returns one row per line_item.

Verify
Seed the container with a normal chain plus one deliberate two-row cycle (filing A’s amends_filing_id = B, B’s = A) and a filing with several line items. Run query 1: without a guard it hangs or errors on resource limits; with the guard it returns and marks the cycle, and the depth column counts hops correctly — confirm via the EXPLAIN that the recursive term joins on amends_filing_id. Run query 2 and confirm its row count equals the number of line_item rows (nothing collapsed) and that rank 1 is each filing’s largest item.

