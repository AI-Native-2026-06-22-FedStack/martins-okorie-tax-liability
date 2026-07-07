2.1 Relational Data Modeling & SQL Fundamentals
🕐 Last Updated: 2026-06-19 15:14:26 UTC
📌 Commit: db3e5914
Week 2 · Day 1
Relational Data Modeling & SQL Fundamentals
Design a normalized relational model for your capstone domain — entities and relationships, keys and constraints, the right indexes — and learn to read a query plan instead of guessing.

1
Topic 1 of 6
Domain modeling — entities, relationships, and lifecycles
Why Do I Need to Know This?
The schema is the contract every later layer of your service depends on: the API, the queries, and the migrations all build on the tables you define here. A wrong entity boundary is expensive to fix: once data exists, correcting it means writing a schema migration and transforming every affected row — for example, collapsing payment into filing makes it impossible to represent two partial payments per filing without a table redesign and a full data migration.

Before writing a single CREATE TABLE, your team has to agree on what the real things are, how they relate, and how each one changes over time.

Scenario
Your team opens its empty capstone repo with a one-line brief: "track multi-state tax filings with their line items and payments." One engineer wants a single wide filing table that holds the taxpayer’s name, every line item, and every payment in repeated columns. Another wants separate taxpayer, filing, line_item, state_allocation, and payment tables connected by relationships. You settle it by walking the lifecycle — a filing moves from draft to submitted to paid — and the cardinalities: one taxpayer has many filings, one filing has many line items. The separate-tables model wins because the wide table cannot represent "many line items" without repeating columns. You also pull the taxpayer’s SSN into a separate one-to-one taxpayer_identity table, so the sensitive field can be locked down apart from the name and email.

Theory
An entity is a thing the business tracks
An entity is a distinct thing the business needs to store and reason about — a taxpayer, a filing, a payment. Each entity becomes one table, and each instance of it becomes one row. The first modeling decision is drawing these boundaries: a filing and the payment that settles it are different things with different lifecycles, so they are different entities, not columns on one row.

A relationship’s cardinality decides how it is stored
A relationship is how two entities connect, and its cardinality — how many of each side participate — decides how you store it. Relational modeling has three:

One-to-one: each row on one side matches at most one row on the other. A taxpayer has one taxpayer_identity row holding sensitive data like an SSN that needs stricter access than the name and email. Store it as a separate table whose primary key is also a foreign key to taxpayer, which allows at most one identity row per taxpayer.
One-to-many: one row on the first side matches many on the second. One taxpayer files many filings, so the "many" side, filing, carries a taxpayer_id pointing back to the one taxpayer.
Many-to-many: rows on each side match many on the other. One filing is allocated across several states and one state appears on many filings; a single pointer cannot hold that, so a join table state_allocation stores one row per filing-and-state pair.
Cardinality	Tax-domain example	How it is stored
One-to-one	taxpayer ↔ taxpayer_identity	a separate table; its primary key is also a foreign key to the parent
One-to-many	taxpayer → filing	a foreign key on the many side (filing.taxpayer_id)
Many-to-many	filing ↔ state	a join table (state_allocation), one row per pair
Model the lifecycle as an explicit status
A filing changes over time: draft, then submitted, then paid. Store that as an explicit status column with a known set of values, not as something you infer from whether a payment row exists. Inferring state from the presence of other rows breaks the moment two facts disagree — a filing marked unpaid that already has a payment row. An explicit status gives every query one place to read the lifecycle, and the example below shows it as a column on filing.

The capstone domain as an entity-relationship diagram
The capstone entities your team models, showing all three cardinalities: one-to-one (taxpayer–identity), one-to-many (taxpayer–filing), and many-to-many (filing–state).

has one

files

contains

allocated to

settled by

TAXPAYER

int

id

PK

text

name

text

email

TAXPAYER_IDENTITY

int

taxpayer_id

PK,FK

text

ssn

FILING

int

id

PK

int

taxpayer_id

FK

text

status

int

total_cents

LINE_ITEM

int

id

PK

int

filing_id

FK

text

description

int

amount_cents

STATE_ALLOCATION

int

filing_id

PK,FK

text

state_code

PK

int

amount_cents

PAYMENT

int

id

PK

int

filing_id

FK

int

amount_cents

timestamp

paid_at

Example
one-to-many and one-to-one in the schema
-- One taxpayer has many filings (one-to-many): the "many" side carries the pointer.
CREATE TABLE taxpayer (
  id    integer GENERATED ALWAYS AS IDENTITY,
  name  text,
  email text
);

CREATE TABLE filing (
  id          integer GENERATED ALWAYS AS IDENTITY,
  taxpayer_id integer,                 -- (1) one-to-many: points back to the owning taxpayer
  status      text,                    -- (2) explicit lifecycle: 'draft' | 'submitted' | 'paid'
  total_cents integer                  -- money as integer cents, never a float
);

-- One taxpayer has exactly one identity row (one-to-one): the child's PK is the link.
CREATE TABLE taxpayer_identity (
  taxpayer_id integer PRIMARY KEY,     -- (3) one-to-one: this column is both the PK and the FK to taxpayer
  ssn         text
);
Copy
Annotation (1) — taxpayer_id on filing stores the one-to-many: the "many" side holds a pointer to the "one" side. The constraints that make this pointer trustworthy come in the Keys, constraints, and indexes topic.
Annotation (2) — status records the lifecycle as data, so a query reads the state directly instead of guessing it from other tables.
Annotation (3) — making taxpayer_id the primary key of taxpayer_identity allows at most one identity row per taxpayer, which is the one-to-one; adding the foreign key to taxpayer (in Keys, constraints, and indexes) ties it to a real taxpayer. The many-to-many between filings and states is the state_allocation join table shown in the figure.
These are deliberately bare tables — no keys or checks beyond the one-to-one’s primary key yet; here the point is the entity boundaries and the relationships.
AI Practice
Prompt it
Have Codex propose a 3NF relational model from a prose brief, then check the relationships against your own reading before accepting.

Here is my capstone domain brief: "Track multi-state tax filings. A taxpayer
submits filings; each filing has line items and is allocated across one or more
states; each filing can be paid by one or more payments." Propose a 3NF
relational model with at least 5 entities. For each entity list its columns, and
for each relationship state the cardinality (one-to-one, one-to-many, or
many-to-many) and which table holds the foreign key. Do not write CREATE TABLE yet — give me the entities and relationships only.
Copy
Watch out
Codex tends to collapse a many-to-many into a single foreign key — for example putting one state_code column on filing instead of a state_allocation join table — which silently makes a multi-state filing impossible to represent. It may also invent columns the brief never mentioned. Check every relationship’s cardinality against the brief and confirm each many-to-many has its own join table.

Verify
For each relationship Codex proposed, name a real example that proves the cardinality: "filing 12 has line items 3, 4, and 5" proves filing-to-line-item is one-to-many; "filing 12 is allocated to CA and NY, and CA appears on filings 12 and 19" proves filing-to-state is many-to-many and needs state_allocation. If any relationship can’t represent the example, the model is wrong — fix it and record the correction in your prompt journal.

Knowledge Check
1. Your brief says one filing can be allocated across several states, and each state appears on many filings. How should the model represent this?
Add a single state_code column to the filing table and update it per state.
Add a state_allocation join table keyed on (filing_id, state_code).
Add a filing_id foreign-key column to the state table instead.
Store every state for a filing as a comma-separated string in one column.
2. A teammate proposes inferring whether a filing is paid by checking if a payment row exists, instead of storing a status. What is the risk?
Storing the payment rows uses noticeably more disk space than a single status column would.
Postgres cannot reliably count the rows in a related payment table.
The inferred state can disagree with reality and there is no single source of truth.
It makes the entire payment table redundant and safe to drop.
3. In the one-to-many between taxpayer and filing, which table holds the foreign key, and why?
filing holds taxpayer_id, since the "many" side points to the "one".
taxpayer holds a repeating list of filing_id values, one per filing it owns.
Both tables hold each other’s id so the link is navigable from either side.
Neither table; the relationship is implied by matching column names.
4. Your team must store each taxpayer’s SSN under stricter access than their name and email, with exactly one SSN row per taxpayer. How should you model it?
Add an ssn column to the taxpayer table beside name and email.
A separate taxpayer_identity table whose taxpayer_id is its primary key and a foreign key.
A taxpayer_identity table with a plain non-unique taxpayer_id column referencing the parent.
Put the SSN in a comma-separated column alongside other identity fields on taxpayer.
2
Topic 2 of 6
Normalization (1NF–3NF) and intentional denormalization
Why Do I Need to Know This?
Normalization is the discipline that stops the same fact from being stored in two places, which is the root cause of data that drifts out of agreement with itself — the kind of inconsistency a federal auditor will find and ask you to explain. Your team reaches third normal form by default so an update changes one row, then denormalizes only on purpose with a written reason. Getting this right on the model your team just drew keeps every later query honest.

:::tip Want to go deeper? This guide to data normalization walks through the normal forms with additional examples. :::

Scenario
A teammate’s first draft stores taxpayer_name and taxpayer_state directly on every filing row "to make the dashboard reads simpler." A taxpayer corrects their legal name, the update touches some filing rows but misses others, and the dashboard now shows two different names for the same person. Your team moves the name to the taxpayer table so it lives in exactly one row, and separately decides to keep a computed total_cents on filing as a documented exception because the dashboard reads it constantly.

Theory
Normalization removes the same fact stored twice
A schema is normalized when each fact lives in exactly one place. First normal form (1NF) is the floor: every column holds a single atomic value, with no repeating groups and no comma-separated lists. The duplication normalization targets causes update anomalies — the scenario’s corrected name that updates unevenly — because the same fact (taxpayer_name) was copied onto many filing rows. Store it once on taxpayer, and a correction is one update that every reader sees.

2NF and 3NF: every column depends on the key, the whole key, and nothing but the key
Second and third normal form remove two more kinds of misplaced data. 2NF removes a column that depends on only part of a composite key — in a state_allocation keyed by (filing_id, state_code) — the filing’s submission date depends on filing_id alone, so it belongs on filing, not on the allocation. 3NF removes a column that depends on another non-key column rather than the key — a taxpayer_state_name stored beside taxpayer_state_code depends on the code, not on the filing, so it belongs wherever the state code is defined. The shorthand is that every column depends on the key, the whole key, and nothing but the key.

Denormalize only on purpose, and write down why
Denormalization is storing a fact in more than one place on purpose to make a read faster — the opposite of what normalization asks, accepted as a deliberate trade-off. The scenario’s filing.total_cents duplicates the sum of its line items so the dashboard does not recompute it on every read. That is defensible only when it is intentional and documented, with a stated plan for keeping the copy in sync; an accidental duplicate is the update-anomaly bug, while a documented one is an engineering decision an auditor can review.

!
Warning
A denormalized value can go stale. filing.total_cents is only correct if every change to a line item also updates the filing total. If you denormalize, you own keeping the copy correct — in application code, a trigger, or a scheduled recompute — and you record which one in an ADR

One wide table split into normalized tables
The duplicated column on the left is the update-anomaly risk; normalization moves each fact to the one table it belongs to.

normalize

normalize

normalize

filing_wide: id, taxpayer_name, taxpayer_state, status, line_item_1, line_item_2, ...

taxpayer: id, name, state

filing: id, taxpayer_id, status

line_item: id, filing_id, description, amount_cents

Example
a duplicated fact before and after 3nf
-- BEFORE: taxpayer_name is duplicated on every filing row (update anomaly waiting to happen).
CREATE TABLE filing_wide (
  id            integer GENERATED ALWAYS AS IDENTITY,
  taxpayer_name text,        -- same name copied across all of this taxpayer's filings
  status        text
);

-- AFTER: the name lives once on taxpayer; filing points to it.
CREATE TABLE taxpayer (
  id   integer GENERATED ALWAYS AS IDENTITY,
  name text                  -- the single place this fact is stored
);

CREATE TABLE filing (
  id          integer GENERATED ALWAYS AS IDENTITY,
  taxpayer_id integer,       -- the relationship replaces the copied column
  status      text
);
Copy
The filing_wide table repeats taxpayer_name on every filing for the same taxpayer; correcting the name means updating every one of those rows, and missing one creates the inconsistency from the scenario.
The normalized version stores the name once on taxpayer; filing carries taxpayer_id and reads the name through the relationship, so a correction is a single update.
A read that needs the name joins filing to taxpayer — the small cost of a join in exchange for never storing the name twice.
AI Practice
Prompt it
Have Codex normalize a wide table and name the anomaly each step removes, then check it did not over-split the model.

Here is a wide table:
CREATE TABLE filing_wide (
  id integer, taxpayer_name text, taxpayer_email text,
  state_code text, state_name text, status text, line_items text
);
Normalize it to third normal form. For each table you produce, list its columns
and the foreign keys. For each change, name which normal form it satisfies and
which anomaly (update, insert, or delete) it removes. Keep line items as their
own table with one row per item.
Copy
Watch out
Codex sometimes over-normalizes — splitting status into its own lookup table when a CHECK constraint would do — which adds joins the reads do not need. It can also leave state_name beside state_code on the filing, which is the exact 3NF violation you are removing. Confirm each resulting table holds only columns that depend on its own key, and that nothing was split past what the reads require.

Verify
Pick one corrected fact — a taxpayer’s email changes — and trace it through Codex’s normalized model: it must be a single-row update in exactly one table. If the same fact still appears in two tables, the model is not in 3NF; fix it. Then confirm any denormalized column it kept has a written reason. Record what you changed in your prompt journal.

Knowledge Check
1. A taxpayer’s name is stored on every one of their filing rows. A name correction updates some rows and misses others. Which problem is this, and what fixes it?
A performance problem; add a B-tree index on taxpayer_name.
A constraint problem; add a NOT NULL constraint to taxpayer_name.
An update anomaly; move the name onto taxpayer so it lives once.
No problem at all; duplicating the name is good for read speed.
2. Your team keeps filing.total_cents as a sum of the filing’s line items, even though it duplicates data. When is this acceptable?
Never; any duplication violates normalization and must be removed.
Always, as long as the denormalized total makes the dashboard read faster.
When it is a documented decision with a plan to keep the copy in sync.
Only if total_cents is also declared the table’s primary key.
3. In a state_allocation table keyed by (filing_id, state_code), someone adds a filing_submitted_at column. Which normal form does this violate?
First normal form, because the timestamp value is not an atomic value.
Second normal form, because it depends on filing_id alone, part of the key.
Third normal form, because the column depends on another non-key column in the same row.
No normal form is violated; the column is perfectly fine where it sits.
4. A read needs the taxpayer’s name alongside each filing, but the name lives only on taxpayer. What is the normalized way to get it?
Copy taxpayer_name back onto every filing row so the read needs no join.
Store the name in a comma-separated text column on each filing row.
Query taxpayer separately and merge the two result sets in application code.
Join filing to taxpayer on taxpayer_id and select the name.
3
Topic 3 of 6
Keys, constraints, and indexes
Why Do I Need to Know This?
Constraints make the database itself reject bad data, so a bug in one service cannot write a row that corrupts what every other service reads — the integrity guarantee a federal system has to be able to demonstrate. Indexes are what keep the dashboard reads fast as the data grows from ten rows in testing to millions in production. Both are decided when the table is created and both are painful to retrofit safely, so your team gets them right on the model it just normalized.

Scenario
During testing, your team’s payment table accepts a row with a negative amount and another whose filing_id points to a filing that does not exist. Both are invalid, and both got in because nothing stopped them. Your team adds a primary key, a foreign key to filing, a CHECK (amount_cents >= 0), and — to speed the dashboard’s most common read — a partial index on submitted filings only.

After that, the database refuses the bad rows itself, regardless of which service tries to write them.

Theory
Primary and foreign keys give a row identity and enforce relationships
A primary key is the column whose value uniquely identifies a row, so two payments can never collide on the same id. A foreign key says a column’s value must match an existing row in another table — payment.filing_id must reference a real filing.id — and the database rejects any insert or update that would point at a filing that does not exist. This is what makes the one-to-many and many-to-many relationships trustworthy at write time, not just at read time.

CHECK, NOT NULL and UNIQUE push invariants into the database
A CHECK constraint is a rule the database enforces on every write — CHECK (amount_cents >= 0) makes a negative payment impossible to store, not merely discouraged. NOT NULL forbids a missing value, and UNIQUE forbids a duplicate. Putting these invariants in the schema means every writer — your API, a migration, a one-off script, or Codex-generated code — is held to the same rule, because the database is the single enforcement point rather than each service remembering to check.

Indexes speed reads, and partial indexes stay small
An index is a separate structure the database maintains so it can find matching rows without scanning the whole table; a query that filters or sorts on an indexed column can jump straight to the rows it needs. An index has a cost — it uses space and must be updated on every write — so you index the columns your reads actually filter on. A partial index covers only the rows matching a condition, using CREATE INDEX ... WHERE, so an index serving "show me submitted filings" indexes only submitted rows and stays small (PostgreSQL partial indexes).

A write passes the constraint gates or is rejected
Every insert runs the gauntlet of constraints; a row that fails any gate never lands.

no

yes

no

yes

no

yes

INSERT INTO payment (...)

Primary key unique?

Foreign key references a real filing?

CHECK and NOT NULL satisfied?

Row stored

Write rejected -- error returned

Example
a table with keys, a check, and a partial index
CREATE TABLE payment (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,   -- (1)
  filing_id    integer NOT NULL REFERENCES filing(id),             -- (2)
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),         -- (3)
  paid_at      timestamptz NOT NULL DEFAULT now()
);

-- (4) Partial index: the dashboard's most common read is a taxpayer's submitted filings.
CREATE INDEX filing_submitted_idx
  ON filing (taxpayer_id)
  WHERE status = 'submitted';
Copy
Annotation (1) — PRIMARY KEY makes id unique and non-null, giving every payment a stable identity nothing else can collide with.
Annotation (2) — REFERENCES filing(id) rejects any payment whose filing_id does not match a real filing, so the orphaned row from the scenario is impossible; NOT NULL means a payment must belong to a filing.
Annotation (3) — CHECK (amount_cents >= 0) makes the negative payment impossible to store, enforced on every write by the database itself.
Annotation (4) — the partial index covers only submitted filings — a small fraction of all filings — so it stays much smaller and cheaper to maintain than a full index while still serving the dashboard’s most common read; non-submitted rows are never indexed.
AI Practice
Prompt it
Have Codex turn a set of invariants into constraints and one partial index, then verify each invariant maps to a real constraint.

Here is a bare table:
CREATE TABLE payment (id integer, filing_id integer, amount_cents integer, paid_at timestamptz);
Apply these invariants as database constraints: id is the primary key; filing_id
must reference filing(id) and is required; amount_cents is required and cannot be
negative; paid_at defaults to the current time. Then add one partial index on the
filing table that speeds the dashboard's most common read — a taxpayer's
submitted filings — i.e. on filing(taxpayer_id) WHERE status = 'submitted'. Do

not propose any schema change without also giving me the migration file (a
versioned SQL file that applies one schema change, committed to the repo and
covered in **Lesson 4, Drizzle ORM: TS-First Schema, Migrations & the Data Layer**) it goes in.
Copy
Watch out
Codex sometimes enforces an invariant in application code instead of the schema — validating the amount in a handler rather than with a CHECK — which leaves the database open to any other writer. It may also add a full index where a partial one was asked for. Confirm every invariant is a database constraint, not a code comment, and that the index has the WHERE clause.

Verify
Try to insert the two bad rows by hand in psql: a payment with amount_cents = -100 and one with a filing_id that does not exist. Each INSERT must fail with a constraint error naming the violated constraint. If either succeeds, the invariant is not in the schema — add it. Record which constraint caught which bad row in your prompt journal.

Knowledge Check
1. Your payment table accepted a row whose filing_id points to a filing that does not exist. Which constraint prevents this?
A CHECK (filing_id > 0) constraint on the column.
A UNIQUE constraint placed on the filing_id column.
A foreign key: filing_id REFERENCES filing(id).
A NOT NULL constraint placed on the filing_id column.
2. A teammate validates amount_cents >= 0 only in the Express handler, not in the schema. Why is that weaker?
Any other writer — a migration or script — can still insert a negative amount.
A handler check is meaningfully slower than the equivalent database check.
Express has no way to validate that a number is non-negative.
The database will silently rewrite any negative amount it receives up to zero on insert.
3. The dashboard frequently reads only submitted filings, which are a small fraction of all filings. What indexing approach fits best?
A full index covering the status column of every filing row.
No index at all, since a sequential scan is always fine here.
A partial index with WHERE status = ’submitted’.
A composite index spanning every single column of filing.
4. Why put the amount_cents >= 0 rule in the schema rather than trusting every service to check it?
Because the schema-level check runs measurably faster than application code does.
Because the database is one enforcement point no code path can bypass.
Because Postgres is unable to surface errors raised in application code.
Because application-side checks are not permitted in federal systems at all.
4
Topic 4 of 6
Postgres 17 features you will use — MERGE and JSON
Why Do I Need to Know This?
This program locks PostgreSQL 17, and two of its capabilities change how your team writes operations it will need this week: MERGE for an insert-or-update in one statement, and the JSON handling for a filing’s variable metadata. Reaching for these where they fit keeps the code shorter and clearer than the older multi-step patterns, and knowing where they fit keeps you from misusing JSON for data that should be a column.

:::note PostgreSQL 18 is the current release as of 2026, but this program standardizes on PostgreSQL 17 so every team builds on the same version, the way Module 1 locked its TypeScript, Node, and Python versions. The features below shipped in 17 (PostgreSQL 17 release notes). :::

Scenario
Your team has a job that sets each filing’s per-state allocation: for a given filing and state, it updates the allocated amount if that allocation already exists, otherwise it inserts it. Written as a SELECT to check existence followed by either an INSERT or an UPDATE, it is three statements and a race condition. Separately, a filing carries occasional metadata — a note, a source-system tag — that differs from filing to filing and is rarely queried. Your team writes the upsert as one MERGE and stores the variable metadata in a jsonb column instead of adding a sparse column for every possible field.

Theory
MERGE performs insert-or-update in one statement
MERGE looks at a target table against a source and, per row, inserts, updates, or deletes based on whether a match is found — the standard "upsert" in one statement instead of a check-then-write sequence. PostgreSQL 17 extended MERGE with a RETURNING clause and a merge_action() function so the statement can report which rows it inserted versus updated (PostgreSQL 17 release notes). One statement replaces the scenario’s three and removes the gap between the check and the write.

jsonb stores genuinely variable data
jsonb is a column type that stores a JSON document in a binary form the database can index and query with dedicated operators. It is the right tool when the data is genuinely variable — a metadata blob whose fields differ from row to row and that you rarely filter on. It is the wrong tool for data you query often or constrain, because a value buried in a JSON document cannot carry a foreign key or a CHECK the way a real column can.

Choosing a column or jsonb is a modeling decision
Whether a field is a real column or a key inside jsonb is the same kind of boundary decision as drawing entities: it depends on how you use the field. A field you filter, sort, join, or constrain on is a column, because the schema can index and protect it. A field that is variable, sparse, and read only as part of the whole row is a jsonb key, because giving every possible field its own mostly-empty column wastes space and structure. The example shows one of each.

Column or jsonb — a decision by usage
The same question for every field: is it queried and stable, or variable and rarely queried?

yes

no -- variable, rarely queried

Do you filter, sort, join, or constrain on this field?

Make it a real column

Store it as a key in a jsonb column

Example
a merge upsert and a jsonb metadata column
-- (1) jsonb holds variable, rarely-queried metadata; status stays a real column.
CREATE TABLE filing (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  taxpayer_id integer NOT NULL REFERENCES taxpayer(id),
  status      text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'   -- e.g. {"source": "import-2026", "note": "amended"}
);

-- (2) MERGE: insert the allocation if absent, otherwise update its amount — one statement.
MERGE INTO state_allocation AS t
USING (SELECT :filing_id AS filing_id, :state AS state_code, :amount AS amount_cents) AS s
ON t.filing_id = s.filing_id AND t.state_code = s.state_code
WHEN MATCHED THEN
  UPDATE SET amount_cents = s.amount_cents
WHEN NOT MATCHED THEN
  INSERT (filing_id, state_code, amount_cents) VALUES (s.filing_id, s.state_code, s.amount_cents);
Copy
Annotation (1) — status is a real column because every dashboard read filters on it; metadata is jsonb because its fields vary per filing and are read only as part of the row. A source you constantly filtered on would instead be its own column.
Annotation (2) — MERGE matches on the join table’s composite key (filing_id, state_code): WHEN MATCHED updates the existing allocation, WHEN NOT MATCHED inserts it, with no window between checking and writing.
The :filing_id, :state, and :amount are bound parameters supplied by the caller, not values pasted into the SQL string.
AI Practice
Prompt it
Have Codex write the upsert as a MERGE and justify it against the older pattern, then verify the match keys.

Write a single PostgreSQL 17 MERGE statement that upserts a row into state_allocation
(columns: filing_id, state_code, amount_cents), matching on the pair
(filing_id, state_code): update amount_cents when that allocation already exists,
insert it when it does not. Then explain in two sentences why this is preferable to
a SELECT-then-INSERT-or-UPDATE sequence. Use bound parameters, not string interpolation.
Copy
Watch out
Codex may target an older Postgres pattern (INSERT ... ON CONFLICT) when you asked for MERGE, or match on the wrong column so every run inserts a duplicate instead of updating. It can also suggest jsonb for a field you actually filter on. Confirm the statement is MERGE, the ON clause matches the real key, and that anything stored in jsonb is genuinely not queried.

Verify
Run the MERGE twice with the same (filing_id, state_code) against a test database: the first run must insert one row, the second must update it and not create a duplicate. Check the row count stays at one. If the second run inserts again, the ON match key is wrong — fix it and record the corrected key in your prompt journal.

Knowledge Check
1. You need to set a filing’s allocation for one state — insert it if that filing-and-state pair has no allocation yet, update the amount if it does — in one safe statement on Postgres 17. Which approach fits?
A SELECT to check existence, then an INSERT or UPDATE in application code.
A single MERGE matching on (filing_id, state_code).
A CREATE TABLE IF NOT EXISTS for the state_allocation table.
Always delete any existing allocation row and then insert a fresh one each time.
2. A filing carries occasional metadata whose fields differ per filing and that you never filter on. Where should it go?
In a separate dedicated column for every metadata field a filing might have.
In one comma-separated text column holding all the metadata values.
In the status column, packed in alongside the lifecycle value.
In a jsonb column, since the data is variable and read whole.
3. A teammate wants to store the filing’s status inside a jsonb metadata blob instead of as a column. Why is that the wrong call?
Because a jsonb column is simply unable to store a plain string value such as ’draft’.
Because every dashboard read filters on status, so it belongs in a real column.
Because jsonb columns are noticeably slower to insert than plain text columns.
Because Postgres 17 removed support for the jsonb column type entirely.
4. Why does this program build on PostgreSQL 17 even though 18 is the current release?
Because Postgres 18 is unable to run either MERGE or jsonb queries.
Because version 17 is the only Postgres release that supports foreign keys.
Because the program locks every team on one shared version.
Because Postgres 18 has not actually been released to the public yet.
5
Topic 5 of 6
Reading query plans — EXPLAIN ANALYZE and the cost of a missing index
Why Do I Need to Know This?
A query that is fast on the ten rows in your test database can be catastrophically slow on the million rows in production, and the only way to tell which you have is to read the plan the database chose. Your team reads EXPLAIN ANALYZE so an index decision rests on evidence rather than a guess — and so it can verify, rather than trust, what Codex claims about a query. This closes the modeling-to-performance loop: the index you added in Keys, constraints, and indexes is only doing its job if the plan says so.

Scenario
A dashboard read that lists a taxpayer’s filings is slow in staging. Your team runs EXPLAIN (ANALYZE, BUFFERS) and sees the database reading every row of the filing table — a sequential scan — to find the handful for one taxpayer, because there is no index on taxpayer_id. They add the index, run the plan again, and the sequential scan becomes an index scan that touches only the matching rows. The plan, not a hunch, is what confirms the fix worked.

Theory
EXPLAIN shows the plan; ANALYZE runs it; BUFFERS shows the I/O
EXPLAIN asks the database to show the plan it would use for a query — which operations, in which order — without running it. EXPLAIN ANALYZE actually runs the query and reports the real time and row counts at each step, so you compare what the planner expected against what happened. Adding BUFFERS reports how much data was read from memory and disk (PostgreSQL using EXPLAIN). You read these to see what the query actually did, not what you assumed it did.

A sequential scan reads every row; an index scan jumps to the matches
A sequential scan reads the whole table row by row; the database falls back to it when no index helps, and its cost grows directly with table size. An index scan uses an index to go straight to the matching rows, reading far fewer of them. The difference is invisible at ten rows — both are instant — and decisive at a million, where the sequential scan reads every row to return three. A missing index is what forces the sequential scan, which is why the plan is where the cause of a slow read shows up.

Read the plan to confirm the index is used, not just present
Creating an index does not guarantee the database uses it; the planner chooses a scan based on the query and the data, and a query written a certain way can defeat an index that exists. After adding an index, you re-run EXPLAIN ANALYZE and confirm the plan now shows an index scan on the column you indexed. This is also the check you apply to Codex: when it claims a query is optimized or an index will help, the plan is the evidence that settles it.

The same query, sequential scan versus index scan
Before the index the planner reads every row; after it, the planner jumps to the matches.

Query filters filing by taxpayer_id (no index)

Seq Scan on filing -- reads all N rows

Same query (index on taxpayer_id)

Index Scan -- reads only matching rows

Example
a plan before and after adding an index
-- The read: a taxpayer's filings.
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM filing WHERE taxpayer_id = 42;

-- (1) BEFORE the index — a sequential scan over the whole table:
--   Seq Scan on filing  (cost=0.00..1834.00 rows=6 width=...) (actual time=0.30..12.4 rows=6 ...)
--     Filter: (taxpayer_id = 42)
--     Rows Removed by Filter: 99994

-- Add the index the plan tells you is missing.
CREATE INDEX filing_taxpayer_idx ON filing (taxpayer_id);

-- (2) AFTER the index — an index scan that reads only the matching rows:
--   Index Scan using filing_taxpayer_idx on filing  (cost=0.29..8.31 rows=6 ...) (actual time=0.03..0.05 rows=6 ...)
--     Index Cond: (taxpayer_id = 42)
Copy
Annotation (1) — Seq Scan with Rows Removed by Filter: 99994 is the tell: the database read 100,000 rows to return 6. On a large table that work grows with every new row.
Annotation (2) — Index Scan using filing_taxpayer_idx with Index Cond confirms the planner now uses the index and reads only the matching rows; the actual time drops accordingly.
The plan is the proof: the same SELECT did far less work after the index, and you can see exactly which operation changed.
AI Practice
Prompt it
Have Codex pull and read a real plan through the Postgres MCP server, then verify its reading against the plan yourself.

Using the connected Postgres MCP server in restricted mode, run
EXPLAIN (ANALYZE, BUFFERS) on this query against the live schema:
  SELECT * FROM filing WHERE taxpayer_id = 42;
In plain language, tell me which scan type the planner chose, how many rows it
read versus returned, and whether adding an index would change the plan and on
which column. Then use the server's hypothetical-index simulation to show the
plan that index would produce. Point to the line in each plan that supports your
claims; do not assume the query is optimized.
Copy
Watch out
Codex sometimes declares a query "optimized" without evidence, or recommends an index on a column the query does not filter on. It can also misread rows (the planner’s estimate) as the actual row count when ANALYZE shows both, and it may trust the hypothetical-index simulation as if it were a real result. Confirm each claim against a specific line of the plan, and treat the simulated plan as a prediction to verify, not proof.

Verify
Find the scan node in the real plan. If it says Seq Scan with a large Rows Removed by Filter, the query read far more rows than it returned — create the index on the filtered column and re-run EXPLAIN ANALYZE. The plan must now show an Index Scan (or Index Cond) on that column, and it must match what the MCP server’s hypothetical-index simulation predicted. If the real plan still shows a sequential scan, the index is unused — investigate why before trusting Codex’s claim. Record the before and after scan types in your prompt journal.

Knowledge Check
1. An EXPLAIN ANALYZE shows Seq Scan on filing with Rows Removed by Filter: 99994 to return 6 rows. What does this tell you?
The query is already optimal because it returned exactly the correct 6 rows.
The table simply needs more working memory allocated to it.
The query read the whole table to find a few rows; an index would help.
The filter condition must be wrong, since it removed so many rows.
2. You add an index, but EXPLAIN ANALYZE still shows a sequential scan on that column. What is the right conclusion?
The index is working fine, because simply creating it guarantees the planner uses it.
The index is not being used; investigate why before assuming the query is fast.
Postgres deliberately ignores all indexes while running EXPLAIN.
The table is simply too small for the planner to bother using the index.
3. Codex says a query is "fully optimized." How do you verify the claim?
Run EXPLAIN ANALYZE and confirm it uses an index scan.
Trust the claim, since Codex generated the query in the first place.
Re-run the query and check that the result rows are correct.
Count the lines of SQL, since a shorter query runs faster.
4. What is the difference between EXPLAIN and EXPLAIN ANALYZE?
EXPLAIN runs the query, while EXPLAIN ANALYZE only estimates it.
They are completely identical; ANALYZE is just a convenience alias for plain EXPLAIN.
EXPLAIN ANALYZE rewrites the table’s storage to make it faster.
EXPLAIN shows the plan without running; ANALYZE runs it and reports actuals.
6
Topic 6 of 6
Practice — build the schema with Codex and prove it
Why Do I Need to Know This?
You have modeled the domain on paper; this is where you make it real and confirm it holds up. Driving Codex to generate the schema and then checking its work yourself is the exact AI workflow the program runs on — the model proposes, you verify against the database, and the database is the judge. This hands-on exercise pulls the modeling, normalization, and constraints work together against a real Postgres.

Theory
The loop this exercise drills is the one the whole program runs on: Codex proposes the schema, you verify it against a real database by trying to violate each constraint, and you record any gap in your prompt journal. The schema is only correct when the database itself rejects the bad rows — a generated CREATE TABLE that compiles is not proof, a failed constraint-violating insert is. You drive the model; the database is the judge.

AI Practice
Prompt it
Hands-on practice for this lesson — do this end-to-end against a local Postgres 17, then verify Codex’s output yourself rather than trusting it.

Here is my ER model for the tax-filing domain: [paste your entities, columns,
and relationships]. Generate the Postgres 17 CREATE TABLE statements for
taxpayer, filing, line_item, state_allocation, and payment. Include primary
keys, foreign keys, NOT NULL where appropriate, a CHECK (total_cents >= 0) on
filing, and the composite primary key (filing_id, state_code) on
state_allocation. Output only SQL.
Copy
Watch out
Codex tends to collapse the filing-to-state many-to-many into a single column, drop the CHECK, or omit the composite key on state_allocation. It may also invent columns your model never had. Read every constraint against your model before running the SQL.

Verify
Run the generated SQL in a local Postgres, then prove each constraint by trying to break it: insert a filing with a non-existent taxpayer_id (the foreign key must reject it), a negative total_cents (the CHECK must reject it), and a duplicate (filing_id, state_code) pair in state_allocation (the composite primary key must reject it). Every violating insert should fail. Where Codex left a constraint out, add it and note the gap in your prompt journal.

