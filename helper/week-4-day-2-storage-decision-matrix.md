Week 4 · Day 2
The Storage Decision Matrix
Make the which-store choice defensible — weigh relational vs NoSQL vs cache across access patterns, consistency, joins, scale, cost, and audit; map each capstone entity to its store with a C4 container diagram; name the polyglot anti-patterns; and estimate cost at 1×/10×/100× load.

1
Topic 1 of 5
The decision matrix — relational vs NoSQL vs cache
Why Do I Need to Know This?
In the previous lesson, 4.1 NoSQL, Caching & Idempotency, you added DynamoDB and Redis beside Postgres, so the capstone now has three places a piece of data could live. "Which store?" is the question that decides cost, latency, and correctness for the life of the system — and it is answered by the data’s shape and constraints, not by preference or by whatever a teammate used last. A written decision matrix turns that debate into a defensible decision a federal reviewer can audit, cell by cell.

Scenario
Your team argues over whether filings belong in Postgres or DynamoDB. One engineer likes Dynamo’s scale; another wants Postgres’s joins. Instead of letting the loudest voice win, the team fills a decision matrix — access patterns, consistency, joins, scale, cost, audit — for the filing entity. The answer falls out of the factors: filings need relational joins and an audit trail, so they stay in Postgres, while a high-volume lookup moves to Dynamo.

Theory
The factors that decide a store
A store choice is driven by a fixed set of factors, scored for the data in question:

Access patterns — how the data is read and written (key lookups, ranges, ad-hoc queries).
Consistency — whether reads must reflect the latest write.
Joins / relationships — whether the data is queried across related entities.
Scale — read/write volume and growth.
Cost — what the access pattern costs at production load.
Audit / retention — whether the data needs a durable, queryable history.
Scoring these for an entity points at a store; guessing without them is how data lands in the wrong place.

Each store’s sweet spot
The three stores fit different shapes. Relational (Postgres) fits rich relationships, ad-hoc queries, and transactions — the place for data you join and audit. NoSQL (DynamoDB) fits known, high-scale key access where you do not join — the place for a hot lookup at volume. A cache (Redis) fits hot reads that can tolerate slight staleness, and is never the source of truth (the subject of the Polyglot anti-patterns — NoSQL-as-cache, cache-as-source-of-truth topic). Matching the entity’s factors to the right sweet spot is the whole exercise.

The matrix is the artifact
The decision matrix is not a whiteboard sketch you erase — it is the record that justifies each placement cell by cell, attached to ADR-0009. Because the reasoning is written down, the decision can be defended later (the closed-book check asks you to do exactly that) and revisited when the constraints change. A store choice with no matrix behind it is an opinion, not a decision.

The store decision matrix
Each store is scored against the factors; the cells say where it fits and where it does not.

Factor	Postgres (relational)	DynamoDB (NoSQL)	Redis (cache)
Access patterns	ad-hoc + ranges	known key access	hot key reads
Joins	yes	no	no
Scale	high, vertical-ish	very high, horizontal	very high reads
Audit / durability	strong	durable	ephemeral — never source of truth
Example
one entity's matrix row, reasoned out
Entity: filing
  access patterns : read by id; list by taxpayer; ad-hoc reporting queries
  consistency     : strong (a submitted filing must read back immediately)
  joins           : yes (filing ↔ line_item ↔ payment)
  scale           : moderate
  cost            : moderate
  audit           : REQUIRED (who changed what, retained for years)
  -> decision: Postgres. Joins + audit + ad-hoc queries are relational strengths;
     Dynamo would force scans for the reporting queries and has no joins.
Copy
The row scores the filing entity against each factor before naming a store.
The decision cites the factors that drove it — joins, audit, ad-hoc queries — not a preference.
A high-volume single-key lookup (say, a status check) could still move to DynamoDB; the matrix is per access pattern, not per system.
AI Practice
Prompt it
Have Codex generate the trade-off matrix, then challenge each cell against the capstone’s real constraints.

Build a decision matrix for choosing between Postgres, DynamoDB, and Redis for my
capstone, with rows for these factors: access patterns, consistency, joins,
scale, cost, audit. Then place these entities and say why for each: filing (joined,
audited), a per-taxpayer status lookup (high-volume key read), and a cached
dashboard total. Justify each placement by the factors, not by preference.
Copy
Watch out
Codex tends to default everything to one store it "likes," or to place data by entity name rather than by the factors (e.g., putting an audited entity in DynamoDB despite the audit and join needs). It may also treat Redis as a candidate source of truth. Challenge each cell: confirm the audited, joined entity is relational, the high-volume key read is a NoSQL candidate, and the cache is never the system of record.

Verify
Check that each placement cites the factors that drove it, not a preference, and that the audited/joined entity lands in Postgres while the high-volume key lookup is a DynamoDB candidate. Confirm Redis appears only as a cache, never as the source of truth. Then close the laptop and defend two of the placements out loud without AI — if you cannot, the matrix is not yet yours. Record the matrix in ADR-0009.

Knowledge Check
1. What should drive the choice of store for a piece of data?
The store the team is most comfortable operating already.
Whichever store the most recent similar project happened to use.
The data’s own factors, scored against each store.
The store that offers the lowest per-gigabyte storage price overall.
2. An entity is heavily joined to others and must keep a queryable audit history. Which store fits?
Postgres — its joins and durability fit the data.
DynamoDB, because it scales horizontally better than Postgres.
Redis, because reads of the entity would be very fast.
Any of them, since all three can store the entity’s fields.
3. Why is the decision matrix itself the artifact, not just a step to a conclusion?
Because the matrix runs as code that enforces the placement at runtime.
Because a matrix is required before DynamoDB will create a table.
Because it replaces the need for an ADR on data placement.
Because the written reasoning makes the decision defensible later.
4. Where does a cache like Redis fit in the matrix?
As a drop-in replacement for Postgres when reads get heavy.
As the system of record for any data read more than it is written.
As a fast copy of hot reads, never the source of truth.
As the audit log, since it retains every value it has cached.
2
Topic 2 of 5
Polyglot persistence and the C4 store map
Why Do I Need to Know This?
With Postgres, DynamoDB, and Redis all in play, "what lives where" stops being obvious — a new teammate cannot tell which store owns the filings and which just caches them. A shared diagram fixes that, and the C4 model’s container level is the right altitude: it shows the services and the data stores as boxes with the data flowing between them, so the polyglot layout is legible at a glance and travels with the ADR.

Scenario
A new engineer joins your team mid-sprint and asks where filing data lives. The answer — "Postgres owns it, Redis caches the dashboard read, and a status lookup is in DynamoDB" — is impossible to hold in your head from the code alone. Your team draws a C4 container diagram: each service and each store is a box, with arrows showing who reads and writes which. Now the layout is one picture, not tribal knowledge.

Theory
Polyglot persistence: more than one store per system
Polyglot persistence means a system uses several stores, each chosen for the part of the domain it fits best — exactly the result of the previous lesson’s work and this lesson’s matrix. The benefit is fit; the cost is that the team must now keep a clear mental model of which store owns what, because the boundaries are no longer "it’s all in the one database."

The C4 container level is the right altitude
The C4 model describes architecture at four zoom levels — Context, Container, Component, Code. The container level shows the separately runnable things — your services and your data stores — as boxes, with the data that flows between them. That is exactly a store map: Express, FastAPI, Postgres, DynamoDB, and Redis as containers, arrows showing who uses which.

!
Warning
A C4 container is not a Docker container. In C4 the word means a separately deployable or runnable unit — an application or a data store — regardless of how it is deployed. A Postgres database is a C4 "container" even when it happens to run inside a Docker container locally. Do not conflate the two.

The map is documentation, not a sketch
The store map is an artifact that travels with ADR-0009, not a whiteboard drawing that is erased after the meeting. Because it is checked in (as a Mermaid diagram), it stays current with the code and gives every engineer — and every reviewer — the same picture of the polyglot layout. A map that lives only in someone’s head is the thing it is meant to replace.

The capstone store map (C4 container level)
Each service and store is a C4 container; arrows show which service reads or writes which store.

reads/writes

caches reads

key lookups

owns

Express service

Postgres: filings, line items

Redis: dashboard cache + idempotency

DynamoDB: status lookups

FastAPI service

Postgres: allocations

Example
the store map's companion in adr-0009
ADR-0009 — Where each entity lives
  filing, line_item   -> Postgres   (joined, audited, ad-hoc queries)
  status lookup       -> DynamoDB   (high-volume single-key read)
  dashboard total     -> Redis      (hot read, cache-aside, TTL)
  idempotency keys    -> Redis      (short-lived key -> result)
Note: Redis entries are caches/ephemeral — Postgres/Dynamo remain the source of truth.
Copy
The table maps each entity to its store with the one-line reason, mirroring the C4 map in words.
The note makes the ephemeral-vs-durable boundary explicit, so no one mistakes a cache for the record.
The map (figure) and this table (ADR) say the same thing two ways — picture for the glance, table for the detail.
AI Practice
Prompt it
Have Codex draft the C4 container store map from the decision matrix, then verify it matches what each store actually owns.

From this placement — filings and line items in Postgres, a status lookup in
DynamoDB, the dashboard total and idempotency keys in Redis, FastAPI owning its
own context — draw a C4 container-level diagram in Mermaid. Show the Express and
FastAPI services and the three stores as containers, with arrows labeled by how
each service uses each store. Do not model Docker containers — this is C4.
Copy
Watch out
Codex may confuse the C4 "container" with a Docker container and draw a deployment diagram (images, ports) instead of the architecture. It may also draw a store as owned by two services at once, hiding the ownership boundary. Confirm the diagram is C4 container-level (services and stores as boxes), that each store has one clear owner, and that Redis is shown as a cache, not a record.

Verify
Check the diagram shows the services and the three stores as containers with labeled usage arrows, and that each store’s owner matches ADR-0009. Confirm it is an architecture map, not a Docker/deployment diagram. Confirm Redis is labeled as cache/idempotency, not as a source of truth. Attach the Mermaid map to ADR-0009 and note any ownership ambiguity Codex introduced in your prompt journal.

Knowledge Check
1. What does the C4 container level show?
The classes and functions inside a single service’s codebase.
The services and data stores as boxes and their data flows.
The system as one box among its users and external systems.
The Docker images and ports used to deploy the system.
2. In the C4 model, a "container" is best described as what?
A separately runnable app or data store.
A Docker image packaged for deployment to a host.
A grouping of related classes within one application’s code.
A physical server or virtual machine that hosts the system.
3. Why keep the store map checked in as a Mermaid diagram rather than on a whiteboard?
Because Mermaid diagrams enforce the data placement at runtime.
Because a whiteboard sketch cannot represent three data stores.
Because a checked-in map stays current and is shared with everyone.
Because Mermaid automatically updates the diagram when the schema changes.
4. Why does using several stores raise the need for a shared store map?
Which store owns what is no longer obvious.
Each additional store doubles the system’s total storage cost.
A diagram is mandatory before a second store can be provisioned.
Multiple stores cannot be queried without a central diagram.
3
Topic 3 of 5
Polyglot anti-patterns — NoSQL-as-cache, cache-as-source-of-truth
Why Do I Need to Know This?
The two most common polyglot mistakes do not announce themselves — they quietly corrupt either performance or correctness until something breaks in production. Naming them is what lets the team catch them in review instead of shipping them. Both come from using a store for a job that belongs to a different store, which is exactly the trap a fresh polyglot system invites.

Scenario
In a design review a teammate proposes two things: use DynamoDB "as the cache" for a hot read because "it’s fast," and keep a running counter "just in Redis" because "it’s simple." Your team names both as anti-patterns on the spot — the first pays durable-store prices for a cache’s job, the second trusts an ephemeral store as the record — and routes each piece back to the store that fits.

Theory
NoSQL-as-cache
Using a durable store like DynamoDB to do a cache’s job — absorbing hot reads — adds cost and latency without a cache’s benefits. You pay per-request durable-store prices for reads a cache would serve from memory for a fraction of the cost, and you get none of a cache’s TTL and eviction behavior. If the goal is to absorb hot reads, the tool is Redis cache-aside, not a second durable store.

Cache-as-source-of-truth
Trusting a cache as the durable record is the more dangerous mistake, because it risks data loss. A cache can evict an entry under memory pressure or lose everything on a restart, so anything that exists only in the cache can vanish. A cache must always be rebuildable from a durable store — the counter must live in Postgres (or Dynamo) and be cached, never live in Redis alone.

Each store has a job
Both anti-patterns are the same error in two directions: using a store for another store’s job. The rule is simple — a cache accelerates reads of data that durably lives elsewhere; a durable store is the record. Catching "wait, that data only lives in the cache" or "why is a durable store absorbing hot reads?" in review is what keeps the polyglot design honest.

The two anti-patterns and their fixes
Each anti-pattern uses a store for the wrong job; the fix routes the data back to the store that fits.

NoSQL-as-cache
Symptom: DynamoDB absorbs hot reads "because it's fast."
Cost: durable-store prices, no TTL/eviction.  Fix: Redis cache-aside.
Cache-as-source-of-truth
Symptom: a counter lives only in Redis.
Cost: data lost on eviction/restart.  Fix: durable store + cache on top.
Example
a counter, wrong then right
// WRONG — the counter lives only in Redis; an eviction or restart loses it
await redis.incr(`filings:count:${taxpayerId}`);          // (1) no durable record

// RIGHT — Postgres is the record; Redis caches the derived value
await db.filings.insert(row);                              // (2) durable source of truth
await redis.del(`filings:count:${taxpayerId}`);           // (3) invalidate the cached count
// the count is recomputed from Postgres on the next read and re-cached
Copy
Annotation (1) — incrementing only in Redis makes the cache the source of truth; an eviction or restart silently loses the count.
Annotation (2) — the durable write to Postgres is the record, so the count can always be recomputed.
Annotation (3) — the cached count is invalidated and rebuilt from the durable store, keeping Redis a cache, not the record.
AI Practice
Prompt it
Have Codex review a proposed design for the two anti-patterns and route each piece to the right store.

Review this design for polyglot anti-patterns: (1) a frequently-read dashboard
total is stored in DynamoDB "for speed", and (2) a per-taxpayer filing counter is
kept only in Redis and incremented on each filing. For each, say whether it is an
anti-pattern, name which one, explain the risk, and give the correct store
arrangement.
Copy
Watch out
Codex may wave through "store the counter in Redis" because the code looks clean and works in a demo, missing that an eviction or restart loses the count. It may also fail to flag DynamoDB-as-cache because Dynamo is "a real database." Confirm it names the counter as cache-as-source-of-truth (fix: durable + cached) and the hot-read-in-Dynamo as NoSQL-as-cache (fix: Redis cache-aside).

Verify
Check that Codex flags the Redis-only counter as cache-as-source-of-truth and prescribes a durable store with a cache on top, and flags the DynamoDB hot-read as NoSQL-as-cache with Redis cache-aside as the fix. Then prove the risk: in a test, write the counter only to Redis, flush Redis, and confirm the count is gone — then move it to Postgres and confirm it survives. Record the demonstration in your prompt journal.

Knowledge Check
1. What is wrong with keeping a running counter only in Redis?
An eviction or restart can lose it, since a cache is not durable.
Redis cannot perform an atomic increment on a counter value.
A counter in Redis is always slower than the same counter in Postgres.
Redis refuses to store integer values without an explicit schema.
2. Why is using DynamoDB "as a cache" for hot reads an anti-pattern?
DynamoDB cannot serve reads quickly enough to act as a cache.
You pay durable-store prices for a cache’s job.
DynamoDB loses cached entries on restart, unlike a real cache.
A table can hold either business data or cache data, never both.
3. What is the rule that both anti-patterns violate?
Every system should use exactly one data store to stay simple.
A cache must always be larger than the database it accelerates.
Each store has a job; do not use one for another’s job.
All data must be written to every store to stay consistent.
4. A cached value must always be what?
The only copy, so the system has a single place to read it.
Written before the durable store, so the cache is never stale.
Stored without a TTL, so it never has to be rebuilt.
Rebuildable from a durable store if it is lost or evicted.
4
Topic 4 of 5
Cost at scale — estimating 1×/10×/100× load
Why Do I Need to Know This?
A store choice that is cheap at demo scale can be ruinous at production scale, and a federal reviewer will ask "what does this cost at 100× load?" A defensible decision answers that with a cost estimate at several load multiples, not "it works on my machine." Estimating at 1×, 10×, and 100× surfaces the access pattern that breaks the budget before production does — and often shows where a cache pays for itself.

Scenario
Your team’s DynamoDB status-lookup design works fine in testing. A federal reviewer asks what it costs at 100× load. The team estimates the read cost at 1×, 10×, and 100× — say, 10 million reads a month scaling to 100 million and then 1 billion — and finds the lookup is affordable at 1× but expensive at 100× — until they put cache-aside in front of it, which absorbs most reads and brings the 100× cost back down. The cache just earned its place, on paper, before any money was spent.

Theory
Cost scales with the access pattern, not just data volume
DynamoDB on-demand bills per request, in request units: a read request unit (RRU) covers a 4 KB read (eventually consistent = 0.5 RRU, strongly consistent = 1 RRU), and a write request unit (WRU) covers a 1 KB write. So cost is driven by how often the pattern runs, the item size, and the consistency — not by how much data is stored. You estimate from the access pattern, not the table size.

Estimating at 1×/10×/100×
To find the pattern that breaks the budget, multiply the access pattern’s request volume by 1×, 10×, and 100× and price each. A pattern that costs cents at 1× may cost hundreds at 100×, and that is the one to redesign — usually by caching the hot read so most requests never reach the paid store. The multiples make the cliff visible before production finds it.

The estimate belongs in the ADR
A store decision without a cost view is incomplete. The 1×/10×/100× estimate goes into ADR-0009 beside the placement, so the choice is justified on cost as well as fit. When the estimate shows a cache is needed to stay affordable, that is a recorded, defensible reason — not a guess.

i
Note
Don’t hard-code the price — it changes (AWS cut on-demand throughput ~50% in late 2024) and varies by region. Look up the current per-request-unit rate on the DynamoDB on-demand pricing page and plug it into the formula. The dollar figures in this topic use a round sample rate of $0.25 per million RRUs purely to show the method; what matters and does not date is the calculation: request volume × request-units-per-operation × per-unit rate × load multiple.

One read pattern across three load multiples
The status-lookup read cost grows with load; a cache absorbing most reads flattens the 100× cost. (Costs use the sample rate from the note above — substitute the current rate from the AWS pricing page.)

Load	Reads / month	RRUs (0.5 each, ≤4 KB, eventual)	Est. cost (sample rate)
1×	10M	5M	≈ $1.25
10×	100M	50M	≈ $12.50
100×	1B	500M	≈ $125
100× + cache (90% hit)	100M to Dynamo	50M	≈ $12.50
Example
the estimate, worked out
Access pattern: status lookup (eventually consistent, item ≤ 4 KB -> 0.5 RRU/read)
RRU price (SAMPLE — look up the current rate on the AWS pricing page): $0.25 per 1,000,000 RRUs

1x   : 10M reads/mo  x 0.5 RRU = 5M RRU   -> 5  x $0.25 = $1.25 / mo
10x  : 100M reads/mo x 0.5 RRU = 50M RRU  -> 50 x $0.25 = $12.50 / mo
100x : 1B reads/mo   x 0.5 RRU = 500M RRU -> 500 x $0.25 = $125 / mo

With cache-aside at a 90% hit rate, only 10% reach DynamoDB:
100x : 100M reads/mo x 0.5 RRU = 50M RRU  -> $12.50 / mo   (10x cheaper)
Copy
The cost is computed from the access pattern’s volume and item size, not the amount of data stored.
At 100× the uncached read is ~$125/month for one pattern; multiply across patterns and the budget cliff is real.
A 90% cache hit rate cuts the paid reads tenfold — the recorded, defensible reason to add the cache.
AI Practice
Prompt it
Have Codex draft the 1×/10×/100× estimate, then challenge its assumptions.

Estimate the monthly DynamoDB on-demand read cost for a status-lookup access
pattern at 1x, 10x, and 100x load. Assume eventually-consistent reads of items
under 4 KB and a 1x volume of 10 million reads/month. Show the RRU math and the
cost at each multiple, then show the 100x cost if a cache absorbs 90% of reads.
State the per-RRU price you used and flag that I should confirm current AWS rates.
Copy
Watch out
Codex may use a stale or invented per-RRU price, forget that an eventually-consistent read is 0.5 RRU (not 1), or estimate from stored data volume instead of request volume. It may also omit the cached scenario that justifies the cache. Confirm the RRU math (0.5 RRU for the small eventual read), the price is flagged as needing verification, and the cached 100× case is shown.

Verify
Check the math: 10M reads × 0.5 RRU = 5M RRU at 1×, scaling ×10 and ×100, priced at the stated per-RRU rate, with the cached 100× case ~10× cheaper. Confirm Codex flagged the price as needing confirmation against current AWS rates rather than asserting it. Attach the estimate to ADR-0009 and note the load multiple where the pattern needs a cache in your prompt journal.

Knowledge Check
1. What primarily drives DynamoDB on-demand cost for a read pattern?
The total amount of data stored in the table over time.
The number of attributes defined on each item in the table.
How often the pattern runs, the item size, and the consistency.
The number of Global Secondary Indexes the table happens to have.
2. Why estimate cost at 1×, 10×, and 100× rather than just at current load?
The multiples reveal the budget cliff before production does.
AWS requires three load estimates before a table can go to production.
Cost grows unpredictably, so only three sample points can be computed.
The 10× and 100× figures are needed to choose a partition key.
3. An eventually-consistent read of a 3 KB item consumes how many RRUs?
1 RRU, the same as any read regardless of consistency.
3 RRUs, one for each kilobyte of the item.
0.5 RRU — an eventual ≤4 KB read is half a unit.
0 RRUs, because reads under 4 KB are not billed.
4. In the worked estimate, why does adding a cache cut the 100× cost roughly tenfold?
Because the cache lowers the per-RRU price DynamoDB charges.
Because cached reads are billed at the write-unit rate instead.
Because the cache converts strong reads into eventual ones automatically.
Because a 90% hit rate means only 10% of reads reach the paid store.
5
Topic 5 of 5
Practice — choose the stores and defend the choice
Why Do I Need to Know This?
This lesson’s payoff is a data layout you can defend to a federal reviewer: each entity in the store that fits it, a map anyone can read, no anti-patterns, and a cost estimate that shows where a cache earns its place. The only way to know you have it is to build the matrix, draw the map, and run the numbers — then attack them: try to place an audited entity in DynamoDB, hide a cache-as-record, or estimate cost from stored volume. This exercise drives Codex through all of it and verifies by challenging each cell.

AI Practice
Prompt it
Hands-on practice for this lesson — build the decision matrix, the C4 store map, and the cost estimate with Codex, then challenge each.

For my capstone: (1) build a decision matrix (factors: access patterns,
consistency, joins, scale, cost, audit) and place filing, line_item, a status
lookup, and a dashboard total across Postgres / DynamoDB / Redis, justifying each
by the factors; (2) draw a C4 container-level store map in Mermaid (services +
stores as containers, not Docker); (3) estimate the status-lookup read cost at
1x/10x/100x on-demand, then with a 90% cache hit. Then review the whole design for
the NoSQL-as-cache and cache-as-source-of-truth anti-patterns.
Copy
Watch out
Codex is likely to place an audited/joined entity in DynamoDB, treat Redis as a record, draw a Docker deployment diagram instead of a C4 container map, use a stale per-RRU price, or estimate cost from stored data volume rather than request volume. Each passes a glance while being wrong — a mis-placed entity, a data-loss risk, or a budget estimate off by an order of magnitude. Challenge every placement, the map’s altitude, and the cost math before trusting it.

Verify
Confirm the audited, joined entity is in Postgres and the cache is never the source of truth; confirm the map is a C4 container diagram (not Docker) with one owner per store; confirm the cost math uses request volume and 0.5 RRU for the small eventual read, with the cached case ~10× cheaper, and the price flagged for confirmation. Then defend two placements out loud without AI. Record the matrix, map, and estimate in ADR-0009 and any gap Codex left in your prompt journal.

