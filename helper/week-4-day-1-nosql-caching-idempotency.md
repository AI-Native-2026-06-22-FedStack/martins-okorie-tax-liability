Week 4 · Day 1
"NoSQL, Caching & Idempotency"
Give the capstone the stores and the write safety to use them — model DynamoDB single-table from access patterns, choose the right consistency and capacity, add Redis cache-aside with TTL and stampede protection, and make create endpoints idempotent with an Idempotency-Key and a distributed lock.

1
Topic 1 of 5
DynamoDB data modeling — access patterns, PK/SK, GSI, single-table
Why Do I Need to Know This?
Your secure Express service keeps everything in one Postgres database, but some of the capstone’s reads are simple, high-volume key lookups that a relational schema serves expensively. DynamoDB is built for exactly those — but only if you model it from how the data is read, not from how the entities relate. Design the keys before you list the access patterns and you get costly table scans and queries you cannot run. Your team has to write the access patterns first, then derive the keys.

Scenario
Your team needs two fast lookups: all filings for one taxpayer, and all line items for one filing. A teammate reaches for a relational instinct — a table per entity, joined at read time. In DynamoDB that means scans and a missing query path. Instead the team writes down the four access patterns the capstone needs, then designs one table with a partition key, a sort key, and a single secondary index that serves them all.

Theory
DynamoDB is queried by key, not joined
A relational database lets you join tables at query time; DynamoDB does not. You read items by their partition key (PK) and narrow within it by sort key (SK). That means the keys must be designed to match the queries you will run — a query that does not map to a key becomes a full-table scan, which is slow and expensive. You model the keys to the access patterns, not the entities.

Single-table design and the GSI
DynamoDB rewards single-table design: multiple entity types share one table, keyed so each access pattern is a single efficient query. When a query needs a different key than the table’s own PK/SK, you add a Global Secondary Index (GSI) — an alternate key layout over the same data that serves that access pattern. The capstone’s filing and line-item lookups can share one table, with a GSI for the access pattern the base keys do not cover.

Access patterns come first
The non-negotiable order is: list the access patterns, then derive PK/SK and any GSI from them. A schema proposal that does not begin with a written list of access patterns is the thing to reject — it is almost always a relational design, a table per entity, that was never modeled to the access patterns, and it will scan.

One table, two entity types, one GSI
A single table holds filings and line items, keyed so each access pattern is one query; a GSI serves the lookup the base keys cannot.

PK SK Entity + access pattern served
TAXPAYER#42 FILING#2026-001 filing — "all filings for a taxpayer" (query PK)
FILING#2026-001 LINE#01 line item — "all line items for a filing" (query PK)
GSI1: STATUS#submitted 2026-04-15 filing — "submitted filings by date" (GSI)
Example
put and query against dynamodb local
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// (1) DocumentClient maps plain JS objects to DynamoDB's wire format
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint: process.env.DDB_ENDPOINT }));

await doc.send(new PutCommand({
TableName: "capstone",
Item: { PK: "TAXPAYER#42", SK: "FILING#2026-001", status: "submitted" }, // (2) one item, keyed for the query
}));

// (3) access pattern: "all filings for a taxpayer" — one query on the partition key
const res = await doc.send(new QueryCommand({
TableName: "capstone",
KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
ExpressionAttributeValues: { ":pk": "TAXPAYER#42", ":sk": "FILING#" },
}));
Copy
Annotation (1) — @aws-sdk/lib-dynamodb’s DocumentClient converts plain objects to/from DynamoDB’s typed format; the endpoint points at DynamoDB Local in development.
Annotation (2) — the item’s PK/SK are chosen to match the access pattern, not the entity’s relational shape.
Annotation (3) — KeyConditionExpression with begins_with reads all of one taxpayer’s filings in a single query — no scan, because the keys were modeled to the pattern.
AI Practice
Prompt it
Have Codex design the single-table schema, then reject any proposal that skips the access patterns.

Here are the capstone's DynamoDB access patterns: (1) all filings for a taxpayer, (2) all line items for a filing, (3) a single filing by id, (4) submitted filings by date. Propose a single-table design — PK, SK, and any GSI — that serves all four as single queries, and for each pattern state which key it uses. List the access patterns first, then the keys.
Copy
Watch out
Codex often proposes a relational design in disguise — a separate table per entity, or keys named after entities rather than access patterns — which forces a scan for at least one pattern. It may also add a GSI for a pattern the base keys already serve. Confirm every one of the four patterns maps to a single query, and reject any proposal that did not list the access patterns first.

Verify
Check that each of the four access patterns is served by a single Query (not a Scan), and that the GSI exists only for the pattern the base PK/SK cannot serve. Put a few items and run each pattern against DynamoDB Local to confirm it returns the right items. Record any pattern Codex left as a scan in your prompt journal — that is the one to fix before it reaches the capstone.

Knowledge Check

1. Why must a DynamoDB schema be designed from access patterns rather than from the entities?
   Because DynamoDB cannot store more than one entity type in a single table.
   Because entity-based design uses more storage than pattern-based design.
   Because a query must map to a key, or it becomes a full-table scan.
   Because DynamoDB rejects any table that does not define a sort key.
2. What is a Global Secondary Index (GSI) for?
   To serve an access pattern the base table’s keys cannot.
   To store a backup copy of the table in a second region automatically.
   To enforce that every item in the table has a unique sort key.
   To convert the table from eventually consistent to strongly consistent.
3. A teammate proposes a DynamoDB design that begins with a table per entity and no list of access patterns. What should you do?
   Accept it, since a table per entity is the DynamoDB best practice.
   Accept it only if each table has fewer than five attributes.
   Add a GSI to every table so any future query is covered.
   Reject it — the access patterns must come first, then the keys.
4. In the single-table design, how is "all line items for a filing" served as one query?
   By scanning the table and filtering items whose type is line item.
   By joining the filing and line-item tables on the filing id.
   By querying the partition key FILING#<id> for its items.
   By reading each line item individually with its own GetItem call.
   2
   Topic 2 of 5
   Consistency and capacity — read modes and cost knobs
   Why Do I Need to Know This?
   DynamoDB makes you choose two things most databases hide: how fresh a read is, and how you pay for throughput. Pick the wrong default and you either serve a stale answer where it matters or quietly run up cost. Your team has to choose eventually- versus strongly-consistent reads per access pattern, and a capacity mode that fits the capstone’s traffic, on purpose rather than by accident.

Scenario
Your team has two reads with different needs. "List my filings" can tolerate a moment of staleness — a just-added filing showing up a second late is fine. "Did my just-submitted filing land?" cannot — it must reflect the write that just happened. The team uses an eventually-consistent read for the first and a strongly-consistent read for the second, and picks on-demand capacity because demo traffic is spiky and unpredictable.

Theory
Eventually- vs strongly-consistent reads
By default a DynamoDB read is eventually consistent: it is cheaper and faster but may be served from a replica that has not yet caught up to the latest write. A strongly consistent read (ConsistentRead: true) always reflects the most recent committed write, at higher cost. Match the choice to the read: a list that tolerates a second of lag is eventually consistent; a read-your-own-write check is strongly consistent.

Capacity modes: on-demand vs provisioned
DynamoDB also lets you choose how throughput is billed. On-demand capacity charges per request and scales automatically — the right fit for spiky or unknown load like a demo. Provisioned capacity reserves a steady throughput at a lower per-unit price — better when load is predictable and high. The capstone uses on-demand this sprint because the traffic shape is not yet known; the choice is recorded, not defaulted.

i
Note
Consistency is a per-read decision and capacity is a per-table decision — they are independent. A strongly-consistent read is about freshness; the capacity mode is about how you pay for throughput.

The choice is per access pattern
There is no single right default — each access pattern has its own freshness need. Reserving strong consistency for the reads that truly require it keeps cost down without serving stale data where it would mislead. The team annotates each access pattern with its consistency choice and the reason, feeding ADR-0008, which records which store each access pattern lives in — the subject of Module 4, Lesson 2 — The Storage Decision Matrix.

Choosing consistency and capacity
Freshness need decides the read mode; load shape decides the capacity mode — two independent choices.

yes

no

no

yes

Read must reflect the latest write?

strongly consistent (ConsistentRead: true)

eventually consistent (default, cheaper)

Load predictable and steady?

on-demand capacity (spiky/unknown)

provisioned capacity (steady, cheaper per unit)

Example
the same query, two consistency choices
// (1) "list my filings" — staleness is fine, use the cheaper default
const list = await doc.send(new QueryCommand({
TableName: "capstone",
KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
ExpressionAttributeValues: { ":pk": "TAXPAYER#42", ":sk": "FILING#" },
})); // eventually consistent by default

// (2) "did my just-submitted filing land?" — must read the latest write
const check = await doc.send(new QueryCommand({
TableName: "capstone",
KeyConditionExpression: "PK = :pk AND SK = :sk",
ExpressionAttributeValues: { ":pk": "TAXPAYER#42", ":sk": "FILING#2026-001" },
ConsistentRead: true, // (3) strongly consistent — higher cost, reserved for this read
}));
Copy
Annotation (1) — the list read omits ConsistentRead, so it is eventually consistent: cheaper and fast, and a second of lag does not mislead.
Annotation (2) and (3) — the read-your-own-write check sets ConsistentRead: true so it always reflects the submission that just happened, paying the higher cost only where it is needed.
AI Practice
Prompt it
Have Codex assign a consistency and capacity choice per access pattern, then check it reserved strong consistency for the reads that need it.

For each of these capstone reads, recommend eventually- or strongly-consistent and explain why: (1) list a taxpayer's filings on a dashboard, (2) confirm a filing was just submitted, (3) show submitted filings by date for a report. Then recommend a capacity mode (on-demand or provisioned) for demo-stage traffic that is spiky and low-volume, and justify it.
Copy
Watch out
Codex tends to mark everything strongly consistent "to be safe," which doubles read cost for no benefit on reads that tolerate lag, or to recommend provisioned capacity by default even when load is unknown. Confirm strong consistency is reserved for the read-your-own-write case, and that the capacity recommendation matches spiky, unpredictable demo traffic.

Verify
Check that only the "confirm a just-submitted filing" read is strongly consistent and the dashboard list and report reads are eventually consistent. Confirm the capacity recommendation is on-demand for spiky, unknown load with a stated reason. Run the strongly-consistent read after a write and confirm it reflects the write; note the consistency choice per pattern in your prompt journal for the ADR.

Knowledge Check

1. What does an eventually-consistent read risk that a strongly-consistent read does not?
   Returning items that belong to a different partition key entirely.
   Not yet reflecting the most recent write to that item.
   Failing the request whenever the table is under heavy write load.
   Charging more than a strongly-consistent read for the same query.
2. When is on-demand capacity the better choice over provisioned?
   When load is spiky or unknown, as at demo stage.
   When load is steady and high and known well in advance.
   When the table must serve strongly-consistent reads only.
   When the table has a Global Secondary Index defined on it.
3. Why reserve strongly-consistent reads for only the access patterns that need them?
   Because strongly-consistent reads cannot run against a Global Secondary Index.
   Because a table allows only a fixed number of strongly-consistent reads per second.
   Because they cost more, and most reads tolerate slight staleness.
   Because strongly-consistent reads return items in a different sort order.
4. A teammate marks every capstone read ConsistentRead: true. What is the effect?
   The reads become cheaper because consistency is batched across them.
   The table is forced into provisioned capacity automatically.
   The reads now return stale data less often but at no extra cost.
   Read cost rises for reads that gain nothing from being strong.
   3
   Topic 3 of 5
   Cache-aside with Redis — TTL, invalidation, and stampede protection
   Why Do I Need to Know This?
   A hot read that hits the database on every request wastes both latency and cost, especially the dashboard reads that many users hit at once. A cache fixes that — but a naive cache silently serves stale data after an update, or collapses under a stampede when a popular key expires and every request rebuilds it at once. Your team adds cache-aside with a TTL, explicit invalidation, and stampede protection so the cache helps without lying or melting down.

Scenario
Your team caches the two heaviest reads. The first version caches forever with no TTL, and after a filing is updated the dashboard keeps showing the old totals. The next version adds a TTL and invalidates the cached entry on write, so updates appear promptly. Then a load test shows that when a popular key expires, hundreds of requests all miss and hammer the database together — so the team adds a short lock so only one request rebuilds the key while the rest wait.

Theory
Cache-aside: the app owns the cache
In the cache-aside pattern the application reads the cache first; on a hit it returns immediately, and on a miss it reads the database, populates the cache, and returns. The cache is not the source of truth — it is a fast copy the app fills on demand. The database remains authoritative, so the cache can be cleared or lost without data loss (the anti-pattern of treating it as the record is the subject of Module 4, Lesson 2 — The Storage Decision Matrix).

TTL bounds staleness; invalidation keeps it honest
A TTL on each entry bounds how long a stale value can live: when it expires, the next read repopulates from the database. But within the TTL, a write can make the cached value wrong, so the write path must explicitly invalidate (delete or update) the cached entry. TTL handles the slow drift; invalidation handles the change that happens before the TTL would have expired.

Stampede protection
When a popular key expires, every concurrent request misses at once and they all rebuild the same value against the database — a cache stampede (or "thundering herd"). The fix is to let only one request rebuild the key while the others briefly wait or serve a slightly stale value — a short lock or single-flight around the rebuild. Without it, the cache’s worst moment is exactly when the database is already busiest.

The cache-aside read and write paths
A read hits the cache or falls back to the database and populates it; a write invalidates the entry; a stampede guard lets only one request rebuild an expired key.

Database
Redis
App (concurrent)
App
alt
[cache hit]
[cache miss]
on write: DEL filing:12 (invalidate)
GET filing:12
1
value
2
acquire short rebuild lock
3
acquire rebuild lock -> held, wait
4
read filing 12
5
row
6
SETEX filing:12 (TTL)
7
DEL rebuild lock
8
GET filing:12 -> hit (no DB read)
9
Example
cache-aside with ioredis
import Redis from "ioredis";
const redis = new Redis(process.env.REDIS_URL!);

async function getFiling(id: string) {
const key = `filing:${id}`;
const hit = await redis.get(key); // (1) read cache first
if (hit) return JSON.parse(hit);

const row = await db.filings.findById(id); // (2) miss: read the database
await redis.set(key, JSON.stringify(row), "EX", 60); // (3) populate with a 60s TTL
return row;
}

async function updateFiling(id: string, patch: Patch) {
const row = await db.filings.update(id, patch);
await redis.del(`filing:${id}`); // (4) invalidate on write
return row;
}
Copy
Annotation (1) and (2) — the read checks Redis first and only touches the database on a miss; a hit avoids the database entirely.
Annotation (3) — set with "EX", 60 stores the value with a 60-second TTL, bounding how stale the entry can get.
Annotation (4) — the write deletes the cached entry, so the next read repopulates with fresh data instead of serving the pre-update value.
AI Practice
Prompt it
Have Codex add cache-aside to the heaviest read, then verify the write invalidates and a stampede guard exists.

Add cache-aside caching with ioredis to my getFiling(id) read: check Redis first, on a miss read the database and store the result with a 60-second TTL. Invalidate the cached entry in updateFiling(id) on write. Add protection against a cache stampede when a hot key expires, so only one request rebuilds it. Show the read path, the write path, and the stampede guard.
Copy
Watch out
Codex routinely caches the read but forgets to invalidate on write, so the dashboard serves stale data until the TTL expires. It also frequently omits stampede protection entirely, or sets no TTL so a stale entry lives forever. Confirm the write path deletes (or updates) the cached key, a TTL is set, and only one request rebuilds an expired hot key.

Verify
Read a filing twice and confirm the second read is a cache hit (no database query). Update the filing and confirm the next read reflects the change, proving invalidation works. Then expire a hot key under concurrent load and confirm only one rebuild hits the database, not all of them. Record any missing invalidation or stampede guard in your prompt journal.

Knowledge Check

1. In cache-aside, what happens on a cache miss?
   The app reads the database, populates the cache, and returns.
   The cache fetches the value from the database on the app’s behalf.
   The request fails until the cache is manually repopulated.
   The database is bypassed and a default placeholder value is returned.
2. A teammate ships a 60-second TTL on the filings cache but skips the invalidation step on write, reasoning the TTL alone will keep things fresh enough. What does a user see right after a filing update?
   The updated filing immediately, because Redis watches the source database for writes.
   The pre-update filing, until the TTL expires and the next read repopulates it.
   An error, because the cache key has no invalidation handler registered.
   The updated filing, but only on alternating requests until the TTL expires.
3. What is a cache stampede?
   One request overwrites another’s cached value, corrupting the entry.
   The cache evicts every key at once when memory runs low.
   Many requests miss an expired hot key and rebuild it at once.
   The cache returns stale data indefinitely after a failed write.
4. Why must the write path invalidate the cached entry?
   Because Redis cannot store a value that has been updated in the database.
   Because invalidation is what assigns the entry its time-to-live.
   Because the cache becomes the source of truth once a write occurs.
   Because otherwise the cache serves the pre-update value until the TTL.
   4
   Topic 4 of 5
   Idempotent writes — the Idempotency-Key middleware and a distributed lock
   Why Do I Need to Know This?
   A client that retries a create after a network timeout can create the resource twice, and in a tax domain a duplicate is a second filing or a double payment — a real defect, not a cosmetic one. An Idempotency-Key lets the server recognize a retry and return the original result instead of repeating the effect, and a distributed lock stops two concurrent retries from both executing before either has finished. Your team adds both to every create endpoint.

Scenario
A flaky network makes a client’s POST /filings time out, so the client retries — and your team sees two filings for one submission. They add an Idempotency-Key header: the first request stores its result under the key, and any retry carrying the same key gets the stored response instead of creating a second filing. A Redis lock around the key ensures that if two retries arrive at once, only one executes the write; the other is rejected with a 409 and retries, and that later retry replays the stored result.

Theory
The Idempotency-Key recognizes a retry
An Idempotency-Key is a unique value the client sends in a header on a create request. The server stores the key together with the result of the first request; when a request arrives with a key it has already seen, it returns the stored result rather than performing the write again. This makes a non-idempotent method like POST safe to retry. It follows the IETF Idempotency-Key header draft (draft-ietf-httpapi-idempotency-key-header) — an expired Internet-Draft that was never published as an RFC, but which codifies a widely used industry convention rather than a ratified standard.

Storing the key and replaying the result
The server keeps a mapping of key → stored response, with a TTL so keys do not accumulate forever (the capstone stores it in Redis, alongside the cache). A repeat within the TTL replays the stored response; once the key expires, a genuinely new request with that key would execute again, so the TTL is set longer than any realistic retry window. The stored result includes the status and body, so the replay is identical to the original response.

A distributed lock prevents concurrent double-execution
The key check alone has a race: two retries can both look up the key, both find it absent, and both execute before either stores its result. A distributed lock closes that race — the request acquires a Redis lock on the key (SET with NX and a PX expiry) before executing, so a concurrent retry that finds the lock held is rejected with a 409 (request in progress) and retries. Once the first request has finished and stored its result, that later retry replays the original response. The lock’s expiry must outlive the request handler, or it can lapse before the result is stored and let a concurrent retry execute the write a second time.

!
Warning
A single-node Redis lock (SET key val NX PX) is enough for this lesson’s single-instance Redis. For multiple independent Redis nodes the naive lock is not safe, and the Redlock algorithm and its well-known criticisms apply — out of scope here, but do not copy a single-node lock into a multi-node setup without revisiting it.

First request, retry, and concurrent retry
The first request executes and stores its result; a later retry replays it; a concurrent retry that arrives while the lock is held is rejected with a 409 and retries.

Redis
Server
Client
POST /filings (Idempotency-Key: abc)
1
key abc seen? no -> acquire lock
2
create filing, store result under abc
3
201 (result stored)
4
concurrent POST /filings (Idempotency-Key: abc)
5
lock held?
6
409 (request in progress, retry later)
7
retry POST /filings (Idempotency-Key: abc)
8
key abc seen? yes
9
201 (stored result replayed, no second filing)
10
Example
an idempotency-key middleware in express
async function idempotency(req, res, next) {
const key = req.header("Idempotency-Key");
if (!key) return next(); // (1) only guards keyed requests

const stored = await redis.get(`idem:${key}`);
if (stored) { // (2) retry: replay the stored response
const { status, body } = JSON.parse(stored);
return res.status(status).json(body);
}

const lock = await redis.set(`lock:${key}`, "1", "PX", 30000, "NX"); // (3) lock TTL must outlive the handler
if (!lock) return res.status(409).json({ title: "Request in progress" });

res.on("finish", async () => { // (4) store result, release lock
if (res.statusCode < 500) { // (5) cache only final outcomes, never transient 5xx
await redis.set(`idem:${key}`, JSON.stringify({ status: res.statusCode, body: res.locals.body }), "EX", 86400);
}
await redis.del(`lock:${key}`); // release the lock either way
});
next();
}

app.post("/filings", idempotency, (req, res) => {
const filing = createFiling(req.body);
res.locals.body = filing; // (6) set before res.json, so `finish` can store it
res.status(201).json(filing);
});
Copy
Annotation (1) — the middleware only acts when the client sent an Idempotency-Key; unkeyed requests pass straight through.
Annotation (2) — a key already in Redis means this is a retry, so the stored status and body are replayed without re-executing the write.
Annotation (3) — SET … "PX", 30000, "NX" acquires a lock that only succeeds if no one holds it, so a concurrent retry gets a 409 instead of double-executing. The PX value must comfortably exceed the worst-case handler time — including the downstream retry budget the create path inherits in Module 4, Lesson 5 — The Polyglot Slice: Sprint 2 Integration (the allocation call’s retry-with-backoff on top of a per-attempt timeout) — or the lock can lapse before the result is stored.
Annotation (4) — once the response finishes, the lock is released and the result is stored under the key (with a long TTL). This relies on the handler having put the response payload on res.locals.body (Express does not expose the sent body to the finish handler) — annotation (6) below shows the route setting it.
Annotation (5) — the result is cached only for final outcomes (statusCode < 500); a transient 5xx is not stored, so a client retrying after a blip gets a fresh attempt rather than the cached error replayed for the full TTL.
Annotation (6) — the route sets res.locals.body before calling res.json, so the finish handler in the middleware has the real body to store; without this line the replay would store and return body: undefined.
AI Practice
Prompt it
Have Codex build the Idempotency-Key middleware, then verify retries replay and the lock prevents double-execution.

Write Express middleware that makes create endpoints idempotent using an Idempotency-Key header and Redis. On the first request with a key, acquire a short Redis lock (SET NX PX), execute, then store the response (status + body) under the key with a 24h TTL and release the lock. On a retry with the same key, return the stored response without re-executing. If a concurrent request holds the lock, return 409. Add a test that sends 3 retries and asserts one filing and identical responses.
Copy
Watch out
Codex often stores the key but never checks it on the way in (so retries still execute), or skips the lock so two concurrent retries both create a resource. It may also store only the status and lose the body, so the replayed response differs from the original. Confirm the middleware short-circuits on a seen key, the lock blocks concurrent retries, and the full response (status and body) is replayed.

Verify
Send the same create three times with one Idempotency-Key and confirm exactly one resource is created and all three responses are identical. Fire two requests with the same key concurrently and confirm one executes and the other is blocked, not a double create. Confirm the lock is released after the response finishes. Record the retry and concurrency results in your prompt journal.

Knowledge Check

1. What problem does an Idempotency-Key solve?
   It encrypts the request body so a retry cannot be read in transit.
   It lets the server spot a retry and not repeat the effect.
   It guarantees the request is processed faster on the second attempt.
   It allows the client to cancel a request that is still in progress.
2. Why is a key check alone not enough, requiring a lock as well?
   Two concurrent retries can both miss the key and both execute.
   The key lookup is too slow to run on every request without a lock.
   A lock is what assigns the Idempotency-Key its time-to-live.
   Redis cannot store a key and a value without a lock held first.
3. What must the server store so a retry returns an identical response?
   Only the request body, so it can re-run the handler deterministically.
   Only the status code, since the body can be regenerated each time.
   The original response — both its status and its body.
   A hash of the response, to compare against a freshly computed one.
4. Your capstone’s Redis moves from a single instance to a multi-node cluster for production. What happens to the SET NX PX lock from this lesson?
   Nothing — SET NX PX is cluster-aware and the lock still holds across all nodes.
   It no longer guarantees exclusion — Redlock, with its own caveats, would need evaluating.
   It keeps working, but every lock acquisition becomes twice as slow.
   It automatically falls back to a database transaction instead of a Redis lock.
   5
   Topic 5 of 5
   Practice — give the capstone its stores and safe writes
   Why Do I Need to Know This?
   This lesson’s payoff is a capstone that reads from the right store quickly and survives a retry without creating a duplicate — the data foundation Sprint 2 needs. The only way to know you have it is to build all three pieces and then attack them: model the table from access patterns, cache a hot read, make a create idempotent, and then try to break each — force a scan, serve a stale value, fire a double-submit. This exercise drives Codex through the full set and verifies by trying to break it.

AI Practice
Prompt it
Hands-on practice for this lesson — wire DynamoDB single-table, Redis cache-aside, and the Idempotency-Key middleware with Codex, then try to break each.

In my Express capstone service: (1) design a DynamoDB single-table schema from these access patterns — a taxpayer's filings, a filing's line items, a filing by id, submitted filings by date — with PK/SK and one GSI, and put/query it against DynamoDB Local; (2) add cache-aside with ioredis to the filings-list read with a 60s TTL, invalidation on write, and stampede protection; (3) add Idempotency-Key middleware backed by Redis (SET NX PX lock, store status+body, replay on retry). Add tests: each access pattern is one query, the cached read invalidates on write, and three retries create one filing with identical responses.
Copy
Watch out
Codex is likely to leave one access pattern as a scan, cache the read but forget to invalidate on write, omit stampede protection, skip the idempotency lock so concurrent retries double-create, or store only the status and lose the body on replay. Each one passes a glance while leaving a real gap — a slow query, stale data, or a duplicate filing. Read the key design, the write/invalidate path, and the lock before trusting the green checks.

Verify
Run each access pattern against DynamoDB Local and confirm it is a single Query, not a Scan. Read the filings list twice (hit), update a filing, and confirm the next read is fresh. Fire three creates with one Idempotency-Key and confirm exactly one filing and three identical responses; fire two concurrently and confirm one is blocked, not a double create. Record every gap Codex left — a scan, a missed invalidation, a double create — in your prompt journal for the ADR.
