2.4 Drizzle ORM: TS-First Schema, Migrations & the Data Layer
🕐 Last Updated: 2026-06-19 17:09:14 UTC
📌 Commit: 98abdf16
Week 2 · Day 4
"Drizzle ORM: TS-First Schema, Migrations & the Data Layer"
Replace hand-written data access with Drizzle — a TypeScript-first schema with full type inference, SQL migrations emitted by drizzle-kit and committed, DTOs derived from the tables, forward-only migration discipline, and N+1 detection.

1
Topic 1 of 6
Choosing a data-access layer — repository, query builder, or ORM
Why Do I Need to Know This?
How your team talks to Postgres shapes every query, test, and migration for the rest of the program, and a federal reviewer will ask why you chose it. The three options — a thin repository of hand-written SQL, a query builder, or a full object-relational mapper — trade control against boilerplate differently, and picking one is a decision you record and defend, not a default you drift into. Your team needs the trade-offs clearly enough to write the choice down in an ADR, including the risks of the tool it picks.

Scenario
Your team debates how the repository layer from 2.3 The Express Skeleton: Validation, Errors & OpenAPI should actually talk to Postgres: raw SQL in a thin wrapper, a query builder, or a full ORM. You choose Drizzle — a TypeScript-first query builder with ORM conveniences and no code-generation step — and write the data-access ADR in the MADR format from 1.4 Git, ADRs & AI Code Review. The ADR records the rationale and the real risks: a smaller ecosystem than Prisma, no automatic down migrations, and weaker Codex priors for Drizzle than for more common tools.

Theory
Three layers trade control against boilerplate
The options sit on a spectrum. A thin repository hand-writes every SQL string: maximum control, maximum boilerplate, and you own every detail. A query builder composes typed queries in code, so you still think in SQL but the language checks your columns. A full ORM maps rows to objects and hides most SQL: least code, most "magic" you cannot see. Drizzle sits at the typed-query-builder end with some ORM conveniences, and unlike many ORMs it has no codegen step, as the Example contrasts.

The choice is a documented trade-off, not a default
Because each option fails differently — boilerplate, a learning curve, or hidden behavior — the decision belongs in an ADR with its rationale and its risks, the same MADR format your team used in 1.4 Git, ADRs & AI Code Review. Writing it down means the next engineer (and the reviewer) sees why Drizzle was chosen and what the team accepted in return, rather than discovering the constraints by surprise.

Codex has weaker priors for Drizzle, so verify its suggestions
Drizzle is newer and less common in training data than Prisma, so Codex produces more confident-but-wrong Drizzle code — outdated APIs, Prisma-style API calls relabeled as Drizzle equivalents. Your AGENTS.md carries the rule: verify every Drizzle suggestion against the official docs before merging. This is not optional caution; it is the documented reason the team double-checks Drizzle output specifically.

The control-versus-boilerplate spectrum, with Drizzle placed
The three data-access options arranged from most hand-written control to most hidden behavior, with Drizzle marked near the query-builder end.

more control · more boilerplate
less SQL · more hidden behavior
Thin repository
hand-written SQL
Query builder
typed SQL in code
← Drizzle
Full ORM
rows mapped to objects
Example
the same read as raw sql and as a drizzle query
// (1) Thin repository: hand-written SQL string, untyped result rows.
const rows = await pool.query(
  "SELECT id, status, total_cents FROM filing WHERE taxpayer_id = $1",
  [taxpayerId],
);
const filings = rows.rows; // (2) type is `any[]` unless you annotate it by hand

// (3) Drizzle query builder: typed columns, inferred result type, no codegen.
const filings2 = await db
  .select({ id: filing.id, status: filing.status, total: filing.total_cents })
  .from(filing)
  .where(eq(filing.taxpayer_id, taxpayerId)); // (4) eq() and columns are checked at compile time
Copy
Annotation (1) and (2) — the raw SQL works, but a typo in a column name is found only at runtime and the result is untyped, so the rest of your code loses type safety.
Annotation (3) and (4) — Drizzle keeps you in SQL-shaped code (select, from, where) while checking the columns and inferring the result type at compile time; a wrong column name fails to compile.
Neither approach hides the query the way a full ORM would; Drizzle’s point is typed SQL, not no SQL.
AI Practice
Prompt it
Have Codex draft the data-access ADR, then verify the risks are real and not softened.

Write a data-access-layer ADR in MADR format for a TypeScript + Express +
Postgres service. The decision is to use Drizzle (a TS-first query builder with
ORM conveniences, no codegen). Include the rationale and exactly three risks we
are accepting: smaller ecosystem than Prisma, no automatic down migrations, and
weaker AI priors for Drizzle. Keep each risk concrete, with its mitigation.
Copy
Watch out
Codex may soften the risks into non-risks ("smaller ecosystem, but it’s growing fast") or omit the no-down-migrations risk entirely, because its Prisma priors assume reversible migrations exist. It may also invent Drizzle features that belong to Prisma. Confirm all three risks are stated plainly with mitigations, and that no claimed Drizzle feature is actually a Prisma one.

Verify
Check each risk against a source: open the Drizzle docs and confirm there is no automatic down migration, and confirm the ecosystem and AI-prior claims are stated as accepted trade-offs, not waved away. If the ADR reads as marketing for Drizzle rather than a balanced decision, send it back.

Knowledge Check
1. Your team picks Drizzle and a reviewer asks where the decision and its trade-offs are recorded. What should you point to?
The schema.ts file, since the schema definition documents why the tool was chosen.
An ADR in MADR format recording the rationale and the accepted risks.
The commit message on the pull request that first added the Drizzle dependency.
The package.json, because the listed dependency version implies the choice.
2. Where does Drizzle sit on the control-versus-boilerplate spectrum, and why does that matter?
At the full-ORM end, mapping rows to objects so you write almost no SQL at all.
At the thin-repository end, requiring you to hand-write every SQL string yourself.
Outside the spectrum, because a query builder is unrelated to control or boilerplate.
Near the query-builder end — typed SQL in code, with no codegen step.
3. Why does your AGENTS.md single out Drizzle suggestions from Codex for extra verification?
Codex has weaker Drizzle priors, so it emits outdated or Prisma-style code.
Drizzle queries cannot be reviewed by a human, so the AI’s output is the only check.
Codex refuses to generate Drizzle code unless AGENTS.md explicitly permits it.
Drizzle changes its API on every release, so verified code breaks between versions.
4. A teammate argues raw SQL in a thin repository is strictly better because it gives "full control." What does the spectrum say they are trading away?
Nothing — full control has no cost, which is why it sits at the better end of the spectrum.
Runtime speed, because hand-written SQL always executes slower than a query builder.
More boilerplate and lost compile-time checks, since raw strings are untyped.
The ability to use Postgres at all, since raw SQL only works with other databases.
2
Topic 2 of 6
Drizzle's TypeScript-first schema with type inference
Why Do I Need to Know This?
Drizzle defines your tables in TypeScript and infers the row types straight from those definitions, with no separate code-generation step to run and keep in sync. That means src/db/schema.ts is the single typed source the whole service builds on: change a column there and every type that depends on it updates the moment the compiler runs. Your team writes the schema once and gets the insert and select types everywhere for free.

Scenario
Your team needs the filing table’s row type in both the repository and the service. Hand-writing a TypeScript interface beside the table would mean two definitions that drift the first time someone adds a column to one and not the other. Instead, your team defines filing once with pgTable in src/db/schema.ts and lets Drizzle infer the select and insert types. Adding a column updates the inferred types immediately, with no codegen command to remember.

Theory
pgTable defines the table in TypeScript
A Drizzle table is a pgTable("filing", { ... }) call whose second argument maps column names to column-helper functions: integer(...), text(...), timestamp(...), and so on. A primary key that auto-increments is integer().primaryKey().generatedAlwaysAsIdentity() (Drizzle column types). This definition is ordinary TypeScript, so it lives in your repo, is reviewed like code, and is the one place the table’s shape is declared.

Drizzle infers the row types — no codegen
From a pgTable, Drizzle derives the TypeScript types directly: typeof filing.$inferSelect is the row you read, and typeof filing.$inferInsert is the shape you insert (the equivalent InferSelectModel<typeof filing> form also exists). There is no generate-a-client step the way some ORMs require — the types come from the table object itself, so they cannot fall out of sync with a stale generated file. The Example uses an inferred type in a repository function.

The schema file is the single source
Because the types flow from the table, src/db/schema.ts is the authoritative definition, and everything else derives from it. Your AGENTS.md rule states the schema lives there and Codex must not bypass it with raw CREATE TABLE SQL or a parallel hand-written type. A change made anywhere else is a change that will drift; a change made in schema.ts propagates through inference automatically.

!
Warning
If Codex proposes a raw CREATE TABLE or a hand-written row interface next to the table, that defeats the single-source design — the database, the schema file, and the type will drift apart. Keep table shape in schema.ts only.

One pgTable definition inferring both row types
A single pgTable definition produces the select type and the insert type, both consumed by the repository without any code-generation step.

pgTable('filing', { ... }) in schema.ts

filing.$inferSelect (row you read)

filing.$inferInsert (shape you insert)

repository functions

Example
a drizzle schema and an inferred type in the repository
// src/db/schema.ts — the single source for the filing table
import { pgTable, integer, text } from "drizzle-orm/pg-core";

export const filing = pgTable("filing", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(), // (1) auto-increment PK
  taxpayer_id: integer().notNull(),                       // (2) column helpers in TS
  status: text().notNull(),
  total_cents: integer().notNull(),
});

// types inferred from the table — no codegen step
export type Filing = typeof filing.$inferSelect;          // (3) the row you read back
export type NewFiling = typeof filing.$inferInsert;       // (4) the shape you insert

// src/db/filing-repo.ts — uses the inferred type, never a hand-written one
import { type Filing } from "./schema";
export async function findById(id: number): Promise<Filing | undefined> {
  const rows = await db.select().from(filing).where(eq(filing.id, id)); // (5)
  return rows[0];
}
Copy
Annotation (1) — integer().primaryKey().generatedAlwaysAsIdentity() is the current way to declare an auto-incrementing primary key in Drizzle.
Annotation (2) — column helpers (integer, text) define each column in TypeScript, so the table shape is code in your repo.
Annotation (3) and (4) — $inferSelect and $inferInsert derive the read and insert types from the table; add a column above and both update with no command to run.
Annotation (5) — the repository imports the inferred Filing type, so the function’s return type tracks the table automatically.
AI Practice
Prompt it
Have Codex write the schema from your 2.1 Relational Data Modeling & SQL Fundamentals model, then verify it against the columns you designed.

Using drizzle-orm/pg-core, write src/db/schema.ts defining pgTable for filing
and line_item to match this ER model: [paste your 2.1 entities and
columns]. Use integer().primaryKey().generatedAlwaysAsIdentity() for primary
keys. Export the $inferSelect and $inferInsert types for each table. Do not emit
any raw CREATE TABLE SQL — the schema file is the single source.
Copy
Watch out
Codex may emit raw CREATE TABLE SQL alongside the pgTable calls, or hand-write a row interface instead of exporting the inferred type — both reintroduce the drift this design removes. It may also use an outdated primary-key helper from its Prisma priors. Confirm the table shape lives only in pgTable, the types use $inferSelect/$inferInsert, and the PK helper matches the current Drizzle docs.

Verify
Add a column to one pgTable and confirm the exported $inferSelect type gains the field with no other change and no command to run — that is the no-codegen property working. Then compare each column against your 2.1 Relational Data Modeling & SQL Fundamentals model (or the live schema via the Postgres MCP) to confirm nothing was invented.

Knowledge Check
1. Why is hand-writing a TypeScript interface for the filing row, beside the pgTable, a problem in Drizzle?
Drizzle forbids exporting any type that it did not itself generate from the table.
A hand-written interface runs slower at query time than an inferred one does.
The hand-written type and the table drift apart when a column changes.
The interface cannot describe an auto-increment primary key column at all.
2. What does "no codegen" mean for a Drizzle schema, compared with an ORM that generates a client?
The row types come from the table object itself, with no generate step.
Drizzle writes the SQL migration files for you, so you never run any command.
You must run a generate command after every query to refresh the types.
The database schema is created automatically the first time the app starts.
3. A teammate adds a created_at column to the filing pgTable. What must they run to update typeof filing.$inferSelect?
Nothing — the inferred type updates automatically when the compiler runs.
drizzle-kit generate, to regenerate the inferred TypeScript types from the table.
A custom codegen script that reads the table and rewrites the type definitions.
npm install, to pull a new Drizzle build that knows about the added column.
4. Why does the AGENTS.md rule require table shape to live only in schema.ts?
Because Drizzle cannot read a pgTable defined in any other file in the project.
Because schema.ts is the only file drizzle-kit is technically able to scan.
Because TypeScript inference only works for tables declared in a file named schema.ts.
Because a single source keeps the database, schema, and types from drifting.
3
Topic 3 of 6
Migrations with drizzle-kit — forward-only and roll-forward repair
Why Do I Need to Know This?
In federal production you can rarely run a destructive down migration to undo a change, because the old data and the service’s uptime matter more than a clean rollback. You fix forward instead: a new migration that corrects the state. Drizzle’s tooling fits this exactly — drizzle-kit emits SQL migration files from your schema changes, your team commits them, and they are only ever rolled forward.

Scenario
Your team changes src/db/schema.ts, runs drizzle-kit generate, and gets a new 0002_*.sql file it commits alongside the code. Later a bad column type ships to production. Because Drizzle has no automatic down migration to undo it, your team writes a new 0003_*.sql that repairs the column going forward — the roll-forward pattern — rather than trying to reverse 0002.

Theory
drizzle-kit generate emits SQL from schema changes
drizzle-kit generate compares your current schema.ts against the last migration and writes a new numbered SQL file capturing the difference. Your team commits that file with the code change, and drizzle-kit migrate applies the pending files to the database in order. The SQL is generated, reviewed, and version-controlled — not hand-written from scratch and not applied invisibly.

There is no automatic down — you roll forward
Drizzle does not generate a down (reverse) migration; the forward-only approach is the standard (Drizzle Kit docs). To undo a bad change in production, you write a new forward migration that corrects the state, exactly as the Scenario’s 0003 repairs 0002. This matches federal reality, where reverting a deployed change destructively is rarely safe; the fix is always another forward step.

!
Important
Never edit an applied migration — repair forward
Once a migration has been applied to any shared or production database, editing that file makes the committed history disagree with the database. Fix a mistake by generating a new forward migration that corrects it, and record the reason in an ADR if the repair is non-obvious.

drizzle-kit check guards schema-and-migration consistency
drizzle-kit check verifies that your migration files are consistent with each other and your schema, catching a schema change someone forgot to generate a migration for. Run it as a check before merging so a missing migration fails the review rather than reaching production. Wiring it into an automated pipeline is a later concern; the command itself is what your team runs now.

Generate, commit, migrate — and repair forward, never down
A schema edit generates a committed migration that is applied in order; a bad state is corrected by a new forward repair migration, with no reverse step.

edit schema.ts

drizzle-kit generate

commit 000N.sql

drizzle-kit migrate (apply in order)

bad column ships

generate a NEW forward repair migration (000N+1.sql)

Example
a schema edit, its migration, and a roll-forward repair
-- 0002_add_filing_total.sql  (generated by drizzle-kit from a schema change)
ALTER TABLE "filing" ADD COLUMN "total_cents" text NOT NULL DEFAULT '0';
-- (1) bug: total_cents was added as text, but it must hold integer cents

-- 0003_fix_total_type.sql  (a NEW forward migration that repairs 0002)
ALTER TABLE "filing"
  ALTER COLUMN "total_cents" TYPE integer USING "total_cents"::integer;  -- (2) roll forward
ALTER TABLE "filing" ALTER COLUMN "total_cents" SET DEFAULT 0;
Copy
Annotation (1) — 0002 shipped a wrong type. Editing 0002 after it has been applied would desync history from the database, so it is left untouched.
Annotation (2) — 0003 is a new forward migration that converts the column to integer; the fix moves the schema ahead, it does not reverse 0002.
Both files are generated, committed, and applied in order by drizzle-kit migrate; there is no down file because Drizzle does not produce one.
AI Practice
Prompt it
Have Codex generate the migrations and a roll-forward repair, then verify they are committed and forward-only.

I changed src/db/schema.ts to add filing.total_cents. Run drizzle-kit generate
to emit the migration, and show the SQL file it produces. Then suppose the
column shipped with the wrong type (text instead of integer): write a NEW
forward migration that repairs it by converting the column to integer. Do not
edit the original migration and do not write a down migration.
Copy
Watch out
Because Codex’s priors lean on tools that have down migrations, it may try to write a reverse migration or edit the original 0002 file in place — both break the forward-only model and can desync history from the database. Confirm the repair is a new, higher-numbered file and that no applied migration was edited.

Verify
Apply 0002 to a throwaway database, then apply the repair 0003, and confirm total_cents ends as integer with the data intact. Run drizzle-kit check and confirm it reports the schema and migrations as consistent. If check complains, a migration is missing or a file was edited after being applied.

Knowledge Check
1. A bad column type has already shipped to production. Drizzle has no down migration. What is the correct fix?
Edit the original migration file to the correct type and re-run drizzle-kit migrate.
Generate a new forward migration that converts the column to the correct type.
Manually run an ALTER TABLE in production and skip writing any migration file.
Delete the database and re-apply every migration from the corrected first file.
2. What does drizzle-kit generate actually produce?
It applies pending changes directly to the database without writing any file.
It regenerates the inferred TypeScript types from the current schema.
A new numbered SQL migration file with the diff from the last migration.
A reverse down migration paired with each forward migration it creates.
3. Why must your team never edit a migration file after it has been applied to a shared database?
Because drizzle-kit locks applied files and editing them throws a permission error.
Because editing it would automatically re-run every migration from the start.
Because applied migrations are deleted from the repository once they run successfully.
Because the committed history would then disagree with the database’s actual state.
4. What does drizzle-kit check protect against when run before merging?
It rolls back the most recent migration if it finds a problem in the schema.
A schema change that was made without generating its migration file.
A migration whose SQL is syntactically invalid for the Postgres version.
A database that has fallen behind on applying already-committed migrations.
4
Topic 4 of 6
drizzle-zod — DTOs derived from the tables
Why Do I Need to Know This?
In 2.3 The Express Skeleton: Validation, Errors & OpenAPI your team validated requests with hand-written zod schemas. If the table and the zod schema are written separately, they drift the first time a column changes on one but not the other. drizzle-zod derives the zod schema from the Drizzle table, so the table becomes the single source feeding the whole chain — table → zod → DTO → OpenAPI — and nothing along it can disagree.

Scenario
Your team’s create-filing zod schema and the filing table have already drifted: the table renamed a column the schema still expects, so a valid request fails validation. Your team generates the zod schema from the table with drizzle-zod, so a column change updates the DTO automatically. Where the API contract intentionally differs from the row shape — omitting a server-set column on create — the team overrides the derived schema on purpose.

Theory
drizzle-zod derives a zod schema from a table
drizzle-zod provides createInsertSchema(table) and createSelectSchema(table), which build a zod schema from a Drizzle table’s columns and types. Because the schema is generated from the table, the table drives validation: rename a column in schema.ts and the derived zod schema follows. This replaces the hand-written schema from 2.3 The Express Skeleton: Validation, Errors & OpenAPI with one that cannot drift from the table it validates against.

One source of truth feeds validation and docs
The chain is single-source: the Drizzle table feeds drizzle-zod, which produces the zod schema, which is your DTO, which feeds the OpenAPI document through the zod-to-openapi pipeline from 2.3 The Express Skeleton: Validation, Errors & OpenAPI. A change to the table propagates down the whole chain, so the validation, the DTO type, and the published docs all move together. The Example derives the create DTO from the filing table.

Override only where the API deliberately differs
Sometimes the request shape should not match the row exactly — a server-set id or created_at should not be in the create body. You override the derived schema with .omit({ id: true }) (or .extend(...)), and that override is a documented, intentional divergence, not an accident. The default is to derive; the exception is to override, and each override should be obvious in the code as a deliberate contract decision.

One table feeding zod, the DTO, and OpenAPI
The Drizzle table is the single source: drizzle-zod derives the zod schema, which is the DTO, which feeds the OpenAPI document.

pgTable('filing')

drizzle-zod: createInsertSchema

zod schema = create DTO

zod-to-openapi -> OpenAPI 3.1 doc

Example
a create dto derived from the table, with one override
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { filing } from "./schema";

// (1) derive the insert schema from the table — no hand-written duplicate
const insertFiling = createInsertSchema(filing);

// (2) the create DTO omits the server-set id; the override is intentional
export const CreateFiling = insertFiling.omit({ id: true });

// (3) the select schema describes the row shape read back to clients
export const FilingResponse = createSelectSchema(filing);

// (4) the derived type tracks the table automatically
export type CreateFiling = z.infer<typeof CreateFiling>;
Copy
Annotation (1) — createInsertSchema(filing) builds the validation schema from the table, so renaming a column in schema.ts updates this schema with no separate edit.
Annotation (2) — .omit({ id: true }) removes the server-set primary key from the create contract; this is a deliberate, visible divergence from the row shape.
Annotation (3) — createSelectSchema describes the read shape, which becomes the response DTO and feeds the OpenAPI response.
Annotation (4) — the DTO’s TypeScript type is derived from the schema, so the type, the validation, and the table all stay in agreement.
AI Practice
Prompt it
Ask Codex to derive the DTOs and wire them into the 2.3 The Express Skeleton: Validation, Errors & OpenAPI controller, then verify the overrides are intentional.

Using drizzle-zod, derive a create DTO and a response DTO from my Drizzle
`filing` table with createInsertSchema and createSelectSchema. The create DTO
must omit the server-set id column. Wire the create DTO into the existing
Express controller's .parse() call from **2.3 The Express Skeleton: Validation, Errors & OpenAPI**, replacing the hand-written
schema. Keep the override explicit and comment why id is omitted.
Copy
Watch out
Codex may keep the old hand-written schema and add the derived one beside it, leaving two sources that drift — defeating the point. It may also omit or add columns silently instead of using an explicit .omit()/.extend(), so the contract diverges from the table without anyone deciding it should. Confirm the hand-written schema is removed and every divergence is an explicit, commented override.

Verify
Rename a column in the filing pgTable, then check that the derived DTO and its type change with no edit to the DTO file — that proves it is truly derived. Then confirm the only differences between the DTO and the table are your explicit .omit()/.extend() calls, each with a comment explaining why.

Knowledge Check
1. Why derive the create DTO with createInsertSchema(filing) instead of hand-writing a zod schema beside the table?
A derived schema validates requests faster than a hand-written one at runtime.
Hand-written zod schemas cannot express a NOT NULL column constraint at all.
A derived schema follows the table, so a column rename cannot leave it stale.
Deriving the schema is the only way to produce a TypeScript type from it.
2. The create body should not include the server-set id. How should the DTO express that?
Leave id in the derived schema and ignore it in the controller when it arrives.
Hand-write a separate create schema that simply leaves the id field out.
Override the derived schema with .omit({ id: true }) as a deliberate divergence.
Mark id as optional in the database so it no longer appears in the insert schema.
3. With drizzle-zod in place, what is the single source of truth feeding validation and the OpenAPI docs?
The Drizzle table, which feeds the zod schema, the DTO, and then OpenAPI.
The hand-written zod schema, which the table and the docs both copy from.
The generated OpenAPI document, which the table and zod schema are checked against.
The controller’s .parse() call, which defines the shape the other layers follow.
4. A teammate keeps the hand-written zod schema from 2.3 The Express Skeleton and adds the drizzle-zod one next to it. Why is that a problem?
The two schemas will throw a naming conflict that stops the app from compiling.
There are now two sources for the same shape, so they will drift apart.
drizzle-zod refuses to run while a hand-written zod schema exists in the file.
The hand-written schema will silently override the derived one at runtime.
5
Topic 5 of 6
Data-layer performance — detecting N+1 and pooling connections
Why Do I Need to Know This?
Two failures quietly kill a data layer in production: the N+1 query, which runs one query per row instead of a single join, and connection exhaustion, where too many concurrent requests open too many database connections. Both are invisible on the ten rows in a test and fatal at ten thousand under load. Your team learns to catch an N+1 with a test and to pool connections so the service survives concurrency.

Scenario
Your team’s "list filings with their line items" endpoint fires one query for the filings, then one more query per filing to fetch its line items — fine for the ten rows in testing, catastrophic at ten thousand. With Drizzle’s logger: true and a query-counting wrapper in a test, the query count blows past the expected threshold and the test fails; a single .leftJoin() collapses it to one query. The team also configures a node-postgres pool so connections are reused instead of opened per request.

Theory
An N+1 query runs one query per row instead of one join
An N+1 query loads a list with one query, then issues another query for each row to load its related data: 1 + N queries total. It is invisible on small data because N is small, and catastrophic at scale because N grows with the table. The fix is to load the related rows in one query with a join, as the Example does with .leftJoin().

Detect an N+1 with a query-counting test
You catch an N+1 before production by counting queries in a test. Drizzle’s logger: true logs every query it runs (Drizzle connection docs); a counting wrapper around the logger lets a test assert the count stays at or below a threshold and fail when it does not. A test that expects one query but sees eleven has found an N+1, turning a silent scaling bug into a red test.

A connection pool reuses a bounded set of connections
Opening a new database connection per request is expensive and exhausts Postgres under load. A connection pool keeps a fixed number of open connections that requests borrow and return. With Drizzle you create a Pool from node-postgres (pg) with a max size and pass it to drizzle(...). At the infrastructure layer, pgbouncer pools connections across many service instances; the application pool and pgbouncer solve the same exhaustion problem at different layers.

N+1 versus a single joined query
The same "list filings with line items" read: the N+1 version issues one query plus one per filing, while the joined version issues a single query.

Postgres
App
N+1 -- 1 + N queries
Joined -- 1 query
SELECT * FROM filing
1
N filings
2
SELECT * FROM line_item WHERE filing_id = 1
3
SELECT * FROM line_item WHERE filing_id = 2
4
... one query per filing ...
5
SELECT ... FROM filing LEFT JOIN line_item ON ...
6
filings with line items
7
Example
the n+1, its leftjoin fix, and a query-counting test
// (1) Pool + Drizzle with query logging on, so a test can count queries
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URI, max: 20 }); // (2) bounded pool
const db = drizzle({ client: pool, logger: true });                              // (3) logs every query

// (4) N+1: one query for filings, then one per filing for its line items
const filings = await db.select().from(filing);
for (const f of filings) {
  // one extra query per filing — this is the N+1
  await db.select().from(lineItem).where(eq(lineItem.filing_id, f.id)); // N more queries
}

// (5) Fix: a single query with a join — returns flat rows, one per (filing, line_item) pair
const rows = await db.select().from(filing).leftJoin(lineItem, eq(lineItem.filing_id, filing.id));

// (7) Group flat rows into the required nested shape: each filing with its line items array
const grouped = Object.values(
  rows.reduce<Record<number, Filing & { lineItems: NewFiling[] }>>(
    (acc, { filing: f, line_item: li }) => {
      if (!acc[f.id]) acc[f.id] = { ...f, lineItems: [] };
      if (li) acc[f.id].lineItems.push(li);
      return acc;
    },
    {}
  )
);

// (6) Test that fails on an N+1 by counting logged queries
expect(queryCount).toBeLessThanOrEqual(1); // one query expected; an N+1 makes this fail
Copy
Annotation (5) and (7) — .leftJoin() returns a flat row per (filing, line_item) pair; the reduce collapses them so each filing appears once with a lineItems array, matching the "filings each with their line items" shape the prompt requires.
Annotation (6) — the test asserts the query count, so reintroducing the loop later turns the regression into a failing test instead of a silent slowdown.
AI Practice
Prompt it
Have Codex find the N+1 and propose a join fix, then verify it with the query counter.

Here is a "list filings with their line items" function that loops and queries
line_item once per filing. I have Drizzle configured with logger: true. Identify
the N+1, rewrite it as a single query using .leftJoin(), and write a Vitest test
that counts the queries run and asserts the count is 1. Keep the returned shape
(filings each with their line items) the same.
Copy
Watch out
Codex may "fix" the N+1 by adding a cache or batching the per-row queries rather than using a single join, which hides the count instead of reducing it. It may also change the returned shape so the grouped line items are lost. Confirm the fix is one joined query, the query-counting test asserts a count of 1, and the result still groups line items under each filing.

Verify
Run the test before the fix and confirm it fails with a count near 1 + N; apply the join and confirm it passes at 1. Then seed many filings and compare response times before and after — the joined version should stay flat as the row count grows, while the N+1 version climbs.

Knowledge Check
1. A "list filings with line items" endpoint is fast in tests but slow in production. The logs show one query for filings then one per filing. What is this?
A connection-pool exhaustion caused by opening too many connections per request.
A missing index on filing, which forces a sequential scan on every request.
A frame-clause mistake in a window function that recomputes per row.
An N+1 query — one query for the list plus one more per row.
2. How does a query-counting test catch an N+1 before it reaches production?
It asserts the query count stays at a threshold and fails when the count grows.
It measures the wall-clock time of the endpoint and fails if it exceeds a budget.
It inspects the SQL text for the word JOIN and fails when it is absent.
It runs the query against production data nightly and alerts on slow runs.
3. Why configure a node-postgres Pool with a max instead of opening a connection per request?
Because Drizzle cannot run a query without a pool object to log through.
Because a bounded pool of reused connections won’t exhaust Postgres.
Because a pool automatically rewrites N+1 queries into single joined queries.
Because Postgres rejects any connection that was not created through a pool.
4. Where does pgbouncer fit relative to the application’s pg Pool?
It replaces the application pool, so configuring pg Pool is unnecessary with it.
It detects N+1 queries at the network layer and collapses them into joins.
It generates the Drizzle schema from an existing database at deploy time.
It pools connections at the infrastructure layer, across many service instances.
6
Topic 6 of 6
Practice — generate a migration with Codex and catch an N+1
Why Do I Need to Know This?
The two data-layer skills from this lesson — committed migrations and N+1 detection — are only learned by doing them against a real database. Driving Codex to generate the schema and migration, then making it catch an N+1 you deliberately introduce, builds the verify-don’t-trust habit on the exact failures (a wrong migration, a silent query explosion) that hurt in production. This exercise pulls the migration and N+1-detection work together end-to-end locally.

Theory
The loop is propose → verify-with-tools → record: Codex proposes the migration and the data-access code, you verify with drizzle-kit check and a query-counting test rather than by eye, and you record what you corrected. Both failures this drills are invisible to a glance — a migration that diverges from the schema, and a query count that quietly grows one-per-row — so the tooling, not the code’s appearance, is what proves the work. The check command and the failing test are the judge.

AI Practice
Prompt it
Hands-on practice for this lesson — run this against a local Postgres, and verify Codex’s migration and N+1 fix with the tools, not by eye.

Step 1: From this Drizzle schema [paste your pgTable for filing and line_item],
run drizzle-kit generate and show me the migration SQL. Step 2: Write a "list
filings with their line_items" repository function the naive way (one query per
filing), enable Drizzle logger, and write a Vitest test that counts the queries
and asserts the count is 1. Step 3: Fix the N+1 with a single .leftJoin() so the
test passes, keeping the returned shape (filings each with their line_items).
Copy
Watch out
Because Codex leans on tools with down migrations, it may try to edit an applied migration or write a reverse one — keep migrations forward-only. On the N+1, it may "fix" the count by adding a cache or batching instead of a join, which hides the count rather than reducing it. Confirm the migration is a new forward file and the fix is one joined query.

Verify
Apply the migration to a local Postgres and run drizzle-kit check — it must report the schema and migrations as consistent. Run the query-counting test before the fix and confirm it fails near 1 + N; apply the .leftJoin() and confirm it passes at 1. If check complains, a migration is missing or was edited after being applied.

