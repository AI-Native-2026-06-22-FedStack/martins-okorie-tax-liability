# Week 3 · Day 3
Audit Logging & Redaction
Make authenticated traffic safe to log — distinguish application, audit, and security logging; emit structured JSON with correlation IDs across both services; redact sensitive fields in one boundary place; and define an audit-log schema of who did what, when, why, and with what result.

## Topic 1 of 6
Three kinds of logging — application, audit, and security
Why Do I Need to Know This?
Now that requests are authenticated, your team logs them — and "logging" is three different jobs, not one. Treat them as one stream and you get logs that are too noisy to debug with and too sensitive to keep for compliance. Before deciding what a log line may contain, your team has to separate the three kinds, because each has a different reader and a different retention rule.

Scenario
Your team’s service currently writes everything to one stream: a debug line about a slow query, a record that user 7 changed filing 12, and a failed-login warning all land together. A federal reviewer asks for the audit trail and gets debug spew mixed with it. Your team splits the streams — application logs for developers, audit logs for "who did what," security logs for auth events.

Theory
Application logs are for developers
Application logging is the debugging stream: errors, timings, the occasional trace a developer reads while fixing a bug. It is high-volume, low-retention, and written for engineers. It is not the record an auditor reads, and it must never become the place a consequential business action is recorded, because nobody keeps debug logs long enough to answer "who changed this filing last year."

Audit logs are a durable record of consequential actions
Audit logging records the actions that matter to the business: who submitted a filing, who changed an amount, who approved a payment. It is written for auditors and kept far longer than debug logs. An audit entry is a deliberate, structured record (its shape is defined in the The audit-log schema — who, what, when, why, result topic), not a stray log.info a developer happened to add.

Security logs capture authn and authz events
Security logging records authentication and authorization events and anomalies: failed logins, token rejections, permission denials. It feeds intrusion detection and incident response, and it overlaps the auth work from Lesson 1, Node Authentication & Authorization — a rejected alg=none token is a security-log event. Keeping it separate from debug noise is what makes an alert meaningful.

Three log streams, three readers
The same POST /filings produces entries in three streams that differ in reader, contents, and how long they are kept.

Kind	Reader	Records	Retention
Application	Developers	Errors, timings, traces	Short
Audit	Auditors	Who did what, when	Long
Security	Security / IR team	Auth events, anomalies	Long

Example
the same request in all three streams
application  level=debug  msg="filing insert took 24ms"            filing_id=12
audit        action=filing.submitted  actor=user_7  result=success filing_id=12
security     event=auth.success  actor=user_7  ip=10.0.0.5         route=POST /filings

The application line helps a developer reason about performance; it is disposable.
The audit line is the durable "who did what" record an auditor will ask for; it is kept long-term.
The security line records the authentication event; it feeds alerting, separate from debug noise.
One request, three purposes — which is why they are three streams, not one.

AI Practice
Prompt it
Have Codex classify a set of log statements, then verify the classification and its retention implication.

Classify each of these log statements as application, audit, or security
logging, and state how long each kind should be retained and who reads it:
1) "DB pool acquired connection in 3ms"
2) "user 7 changed filing 12 status to submitted"
3) "rejected token: alg=none"
4) "cache miss for key filing:12"
Explain each classification in one sentence.

Watch out
Codex tends to label everything "application logging" because that is the most common kind in tutorials, collapsing the audit and security distinctions that matter for compliance. It may also assign one retention period to all of them. Confirm the "who changed what" line is audit and the token-rejection line is security, each with its own retention.

Verify
Check that statement 2 is classified as audit (long retention, read by auditors) and statement 3 as security (long retention, read by the security team), while 1 and 4 are application (short retention, read by developers). If Codex lumped them together, the consequence is a debug stream you cannot keep and an audit trail you cannot find — note the correction in your prompt journal.

Knowledge Check
1. A reviewer asks for the record of who changed filing 12 last quarter. Which log stream should hold it, and why?
Application logs, because that is where the change was first observed.
Security logs, because changing a filing is an authorization event.
Audit logs, the durable record of consequential actions.
Whichever stream had capacity when the change happened.
2. What distinguishes security logging from application logging?
Security logs capture auth events and anomalies for the security team.
Security logs are simply application logs marked with a higher level.
Security logs are the only stream allowed to contain any error message.
Security logs are written by the client, not the server.
3. Why is recording a consequential business action only in the application log a problem?
Application logs cannot store a user id alongside the message.
Application logs are encrypted, so an auditor cannot read them.
Application logs reject any entry that an auditor would want to read.
Application logs are short-retention, so the record disappears.
4. How many retention policies should the three log kinds have?
One, applied uniformly so every log line is treated the same.
Separate policies, since the kinds differ in audience.
Two, with audit and security sharing the application policy.
None, because retention is decided by the log shipper later.

## Topic 2 of 6
Structured JSON logs, correlation IDs, and request IDs
Why Do I Need to Know This?
A single request now crosses the Express service and the FastAPI service, so one human-readable line per service cannot be searched or stitched back together. Structured JSON logs with a correlation ID that travels across the hop are what let you take one ID and reconstruct a request’s entire path through both services — which is the difference between debugging an incident in minutes and in days.

Scenario
Your team adds a middleware that assigns each inbound request a correlation ID, propagates it on the Node→Python call from Lesson 2, Python Authentication & a Shared Trust Domain, and stamps every log line with it. When a filing submission fails somewhere across the two services, one correlation ID pulls back every log line from every hop.

Theory
Structured JSON logs are searchable; prose lines are not
A structured log line is a JSON object of fields (level, msg, actor, filing_id) rather than a sentence. That matters because fields can be filtered, aggregated, and shipped to a log platform, while a free-text line can only be grep’d. The program emits JSON in both services — pino on the Node side, structlog on the Python side — so logs from both look the same to a search.

A request ID names one request; a correlation ID ties the hops together
A request ID identifies one request to one service. A correlation ID is broader: it is shared across every hop of one logical operation, so the Express request and the FastAPI call it triggers carry the same correlation ID. Without it, you have two unrelated request IDs and no way to know they belong to the same operation.

The ID is generated at the boundary and propagated on the header
The correlation ID is created at the first service to see the request, then passed to the next service on a header — X-Correlation-Id is the conventional name. The receiving service reads the header instead of minting a new ID, so the chain stays linked. The Figure shows the ID surviving the hop from Express to FastAPI.

One correlation ID across both services
Express assigns the correlation ID, passes it on the header to FastAPI, and both services stamp every log line with it.

FastAPI
Express
Client
assign correlation id abc-123, log with it
read the header, log with abc-123
POST /filings
1
POST /py/filings (X-Correlation-Id: abc-123)
2
200
3
201 (all logs share abc-123)
4

Example
json logs stamped with a correlation id
// Node (pino): a child logger carries the correlation id on every line
import pino from "pino";
const logger = pino();

app.use((req, res, next) => {
  const correlationId = req.header("x-correlation-id") ?? randomUUID(); // (1) reuse or mint
  req.log = logger.child({ correlationId });                            // (2) stamp every line
  next();
});
// downstream: req.log.info({ filingId: 12 }, "filing submitted")


python
# Python (structlog): bind the correlation id so it appears on every line
import structlog
log = structlog.get_logger()

correlation_id = request.headers.get("x-correlation-id")   // (3) read from the header
log = log.bind(correlation_id=correlation_id)              //(4) same id as Express
log.info("token verified")

Annotation (1) — the middleware reuses an incoming x-correlation-id or mints one, so a request entering at Express gets a single ID.
Annotation (2) — a pino child logger binds the ID, so every later req.log line carries it without repeating it.
Annotation (3) and (4) — FastAPI reads the same header and binds it, so its logs share the Express request’s ID and the two hops stitch together.

AI Practice
Prompt it
Have Codex add correlation-id middleware and propagate it across the hop, then verify the ID survives.

Add correlation-id handling to my two services. In Express (pino), add
middleware that reads an x-correlation-id header or generates one, and binds it to a child logger so every log line includes it. When Express calls the FastAPI service, forward the id on the x-correlation-id header. In FastAPI (structlog), read that header and bind it so its logs carry the same id. Emit JSON logs.

Watch out
Codex often generates a fresh ID in each service instead of propagating the incoming one, which produces two unrelated IDs and breaks the trace. It may also log plain strings instead of JSON. Confirm the FastAPI side reads the header rather than minting its own, and that both sides emit structured JSON.

Verify
Send one request through Express that triggers the FastAPI call, then search the logs for the correlation ID: it must appear on lines from both services. If FastAPI’s lines carry a different ID, it is minting instead of reading the header. Confirm both services’ output is JSON, not prose, and record the result in your prompt journal.

Knowledge Check
1. Why emit logs as structured JSON rather than human-readable sentences?
JSON logs are smaller on disk than the equivalent sentence would be.
Fields can be filtered and shipped; prose can only be grep’d.
JSON logs do not need a correlation ID to be searchable.
JSON is the only format a log line is allowed to be written in.
2. What is the difference between a request ID and a correlation ID?
A request ID is for production and a correlation ID is for local debugging.
A request ID is generated by the client and a correlation ID by the server.
A correlation ID identifies one service while a request ID spans many.
A request ID names one request; a correlation ID spans all the hops.
3. To keep one operation’s logs linked across services, what must the second service do with the correlation ID?
Read it from the incoming header instead of minting a new one.
Generate a fresh ID and map it back to the first in a lookup table.
Hash the request body to derive a matching ID deterministically.
Store the ID in the database so the other service can query it.
4. Where is the correlation ID created in the request’s path?
In every service independently, then reconciled by the log platform.
In the database, when the first row for the request is written.
At the first service to see the request, then propagated onward.
In the client, which must send a unique ID on every request.

## Topic 3 of 6
What to redact, and why one boundary place
Why Do I Need to Know This?
Authenticated requests carry exactly the data you must never log — SSNs, tokens, whole request bodies — and that data leaks into logs through a hundred scattered log.info calls no reviewer can audit. The only reliable defense is to declare what is sensitive once and strip it in a single place, so a developer cannot accidentally log a forbidden field from somewhere you forgot to check.

Scenario
Your team lists the capstone’s sensitive fields — SSN, TIN, account number, access tokens, and full request bodies that may contain them — and decides redaction happens in one boundary middleware driven by one config. No engineer is trusted to remember to scrub a field inline; the boundary does it for every log line.

Theory
What must be redacted
The redaction list covers personally identifiable information (PII), sensitive-but-unclassified (SBU) fields, secrets and tokens, and whole request bodies that may carry any of them. In the tax domain that means SSN, TIN, and account number at minimum, plus the Authorization header and any token — the same token-out-of-logs rule previewed in Lesson 1, Node Authentication & Authorization.

Scattered redaction fails; one boundary place succeeds
Redacting inline at each log call means every one of hundreds of call sites must remember to do it, and the one that forgets is the breach. A single boundary redactor — one place every log line passes through — with a declared field list is auditable: a reviewer reads one config to know what is protected. Centralizing it is what makes the guarantee real rather than aspirational.

The field list is owned configuration
The list of sensitive fields is configuration the team owns and extends per capstone domain, not a constant buried in code. Keeping it in one declared place means adding a new sensitive field (say, a bank routing number) is a one-line change that instantly applies everywhere, and the list itself is the artifact a reviewer audits.

Many log calls, one redactor
Every log call in the service funnels through one boundary redactor that strips the declared sensitive fields before anything is written.

Example
one declared list, consumed by the redactor
// redaction config — the one place sensitive fields are declared
export const REDACT_PATHS = [
  "ssn", "tin", "accountNumber",          // (1) domain-sensitive PII / SBU
  "password", "token", "authorization",   // (2) secrets and tokens
  "*.ssn", "*.token",                     // (3) one level of nesting
];

// before:  { actor: "user_7", ssn: "123-45-6789", token: "eyJ..." }
// after:   { actor: "user_7", ssn: "[REDACTED]",  token: "[REDACTED]" }

Annotation (1) and (2) — the list names the domain-sensitive fields and the secrets/tokens in one place, so the policy is readable at a glance.
Annotation (3) — a wildcard path catches the field one level into a nested object (e.g. user.ssn), not at arbitrary depth; reaching a field nested deeper than that needs an explicit path for each level.
This config is consumed by the boundary redactor built in the Building the boundary redactor in both services topic; nothing is scrubbed inline at the call sites.

AI Practice
Prompt it
Codex proposes a redact list; you extend it with capstone-specific fields and verify nothing is missed.

Propose a redaction field list for a federal tax-filing API's logs. Include PII, sensitive-but-unclassified fields, secrets, tokens, and the Authorization header, using path patterns (including wildcards for nested fields). Output it as a single config array, with a one-line comment grouping the categories.

Watch out
Codex’s list will cover the obvious fields (password, token) but routinely misses domain-specific ones — a tax API’s TIN, account number, or routing number — and forgets the Authorization header. Treat its list as a starting point and add the capstone’s sensitive fields; one missed field is a leak (AGENTS.md: all sensitive fields in one config, never inline).

Verify
Compare Codex’s list against the capstone’s data model and confirm every sensitive field is present — SSN, TIN, account number, tokens, and the Authorization header. Check that nested occurrences are covered with wildcard paths. Anything missing is a field that will reach the logs unredacted; add it and record the gap in your prompt journal.

Knowledge Check
1. Why redact in one boundary place instead of scrubbing each log call inline?
Inline scrubbing is slower than redacting once at the boundary.
The boundary redactor can compress the logs as it strips fields.
Inline scrubbing cannot remove a field from a nested object.
One forgotten call site leaks; a boundary catches every line.
2. Which of these belongs on a federal tax API’s redaction list but is the kind of field Codex tends to miss?
The password field on a login request body.
The taxpayer’s TIN, which a generic list omits.
The level field that marks a line as debug or error.
The msg field containing the human-readable message.
3. Why keep the sensitive-field list as owned configuration rather than constants in code?
Configuration loads faster than inline constants at startup.
One declared list is auditable and extends with a single change.
Constants in code cannot express a wildcard path pattern.
Configuration is automatically encrypted while constants are not.
4. A request body may contain an SSN nested one level inside a filing object (filing.ssn). How does the redaction list ensure it is stripped?
A wildcard path catches it one level into the nested object.
The redactor encrypts the whole body so the SSN is unreadable.
Each handler must delete the SSN before logging the body.
The body is never logged, so no SSN can appear in it.

## Topic 4 of 6
Building the boundary redactor in both services
Why Do I Need to Know This?
The redactor has to work identically in Express and FastAPI, because a field that is stripped in Node and leaked in Python is still a breach. Both services run one shared field list through their own logger’s redaction mechanism, so the guarantee holds no matter which service writes the line.

Scenario
Your team ships the boundary redactor in both services: pino’s redact option on the Node side and a structlog processor on the Python side, both driven by the same declared field list. A test then asserts that six sensitive fields never appear in the emitted logs of either service.

Theory
Node: pino’s redact option
pino’s redact option takes the declared paths and a censor value and strips matching fields before the line is written — it uses fast-redact under the hood and supports dot-notation and * wildcards. Because redaction is configured on the logger itself, every line from that logger is covered, which is what makes it a true boundary rather than a per-call habit.

Python: a structlog processor
On the FastAPI side, structlog’s processor chain does the same job: a custom processor runs over each event dictionary, replaces the declared sensitive keys, and passes the cleaned event to the JSONRenderer. The processor sits in the chain before the renderer, so every line is scrubbed before it is serialized — the boundary on the Python side.

One shared list, asserted by tests
Both mechanisms cover the same set of fields, each named in its language’s convention (camelCase in Node, snake_case in Python), so the two services redact the same things, and tests assert it: a log line built with sensitive fields is captured and checked that the values are absent. The test is what turns "we configured redaction" into "these six fields provably never appear," and it fails if someone removes a path.

One field list, two redactors
The single declared field list feeds both the pino redactor and the structlog processor, so both services strip the same fields.

Example
the redactor in both services
// Node: configure pino once with the shared paths — every line is covered
import pino from "pino";
import { REDACT_PATHS } from "./redaction-config";

const logger = pino({
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },  // (1) boundary redaction
});



// Python: a structlog processor that scrubs the same fields before rendering
REDACT_KEYS = {"ssn", "tin", "account_number", "password", "token", "authorization"}

def redact(_logger, _method, event: dict) -> dict:        // (2) runs on every event
    for key in list(event):
        if key in REDACT_KEYS:
            event[key] = "[REDACTED]"
    return event

structlog.configure(processors=[redact, structlog.processors.JSONRenderer()])  // (3) before the renderer

Annotation (1) — pino’s redact is set on the logger, so every line it writes has the declared paths stripped; nothing is scrubbed at the call site.
Annotation (2) — the structlog processor receives each event dict and replaces the sensitive keys, mirroring the Node behavior with the same field set.
Annotation (3) — the processor runs before JSONRenderer, so the line is cleaned before it is serialized — the boundary on the Python side.

AI Practice
Prompt it
Have Codex wire the redactor in both services from the shared list, then verify the sensitive fields are gone.

Wire boundary redaction in both services from a shared field list (ssn, tin,
account_number, password, token, authorization). In Express, configure pino's redact option with those paths and a [REDACTED] censor. In FastAPI, write a structlog processor that replaces those keys and runs before JSONRenderer. Then write tests in each service that log an object containing all six fields and assert none of the values appear in the captured output.

Watch out
Codex may scrub fields inline in a handler instead of configuring the logger/processor (so other call sites still leak), or cover the fields in only one service. It may also place the structlog processor after JSONRenderer, where it can no longer edit the event. Confirm redaction is configured on the logger in both services and the processor runs before the renderer.

Verify
In each service, log an object containing all six sensitive fields and capture the output: none of the real values may appear, only the censor. Then place the structlog processor after JSONRenderer on purpose and confirm the Python test fails — proving order matters. Restore it. Record that both services pass the redaction test in your prompt journal.

Knowledge Check
1. Why configure redaction on the pino logger itself rather than scrubbing in a handler?
Configuring it on the logger covers every line automatically.
The logger redacts faster than a handler can scrub the same fields.
A handler is not allowed to modify the object it logs.
Logger redaction also forwards the logs to the security stream.
2. Where must the redaction processor sit in the structlog chain, and why?
After JSONRenderer, so it can edit the serialized JSON string.
Anywhere in the chain, since processors run in parallel.
Before JSONRenderer, so it can edit the event dict.
Only as the very first processor, before timestamps are added.
3. Why must the redactor be shipped in both Express and FastAPI, not just one?
Because pino and structlog cannot share a configuration file.
A field safe in one service but logged in the other still leaks.
FastAPI logs are exempt from redaction because they are internal.
Express cannot redact nested fields, so FastAPI must compensate.
4. What turns "we configured redaction" into a guarantee?
A code comment listing which fields the team intends to redact.
A manual review of a sample of production log lines each week.
Encrypting the log files so sensitive fields cannot be read at rest.
A test that logs the sensitive fields and asserts they are absent.

## Topic 5 of 6
The audit-log schema — who, what, when, why, result
Why Do I Need to Know This?
An audit log is only useful if every entry answers the same questions, so its shape is a fixed schema, not whatever fields a developer happened to include. A federal auditor reading the trail needs to know, for every consequential action, who did it, what they did, when, why, and whether it succeeded — and a validated schema is what guarantees no entry is missing a piece.

Scenario
Your team defines an audit-entry schema — actor, action, timestamp, reason, result — validates every entry against it, and writes ADR-0004 recording the schema. Now "user 7 submitted filing 12 successfully at 14:03" is a structured, complete record, not a free-text line a query cannot rely on.

Theory
Five questions every audit entry answers
An audit entry records the actor (who), the action (what), the timestamp (when), the reason or context (why), and the result (outcome). Those five fields make the entry answer an auditor’s question on its own, without cross-referencing other logs. Anything consequential — a filing submitted, an amount changed, a payment approved — produces one entry with all five.

A validated schema keeps entries uniform
If entries are assembled ad hoc, some will be missing the result or the actor, and a query across them becomes unreliable. Validating each entry against a schema (with zod on the Node side or pydantic on the Python side, the tools from Modules 1–2) rejects a half-populated record at write time, so every stored entry is complete and queryable.

Audit entries are still redacted
An audit entry is a log line like any other, so it passes through the boundary redactor from the previous topic. The schema captures that an action happened and by whom; it does not store the sensitive payload. Recording "user 7 changed the SSN on filing 12" is the audit fact — the SSN value itself is redacted, not stored in the trail.

The audit entry's five fields
Each audit entry carries the same five fields; the example row records a successful filing submission.

Field	Question	Example
actor	who	user_7
action	what	filing.submitted
timestamp	when	2026-06-16T14:03:00Z
reason	why	end-of-quarter filing
result	outcome	success

Example
an audit-entry schema and one validated entry
import { z } from "zod";

// the five-field audit schema — every entry must satisfy it
const AuditEntry = z.object({
  actor: z.string(),                                   // (1) who
  action: z.string(),                                  // (2) what
  timestamp: z.iso.datetime(),                         // (3) when
  reason: z.string(),                                  // (4) why
  result: z.enum(["success", "failure"]),              // (5) outcome
});

// validated at write time — a missing field is rejected here, not stored
const entry = AuditEntry.parse({
  actor: "user_7", action: "filing.submitted",
  timestamp: "2026-06-16T14:03:00Z", reason: "end-of-quarter filing", result: "success",
});
auditLog.info(entry);

Annotation (1)–(5) — the schema names the five fields, so every audit entry answers who/what/when/why/result.
The parse call rejects an entry missing any field at write time, so a half-populated record never reaches the trail.
The entry records the action and actor, not the sensitive payload; the boundary redactor still applies to the line.

AI Practice
Prompt it
Have Codex draft the audit schema, then verify it captures all five dimensions and rejects an incomplete entry.

Write a zod schema for an audit-log entry with exactly these fields: actor (string), action (string), timestamp (ISO datetime), reason (string), and result (success or failure). Add a helper that validates and writes an entry. Then show an example entry for "user 7 submitted filing 12 successfully" and an example that is missing the result field.

Watch out
Codex may add nice-to-have fields (a free-text message, a severity) that dilute the fixed five, or make result a free string instead of a closed set, so "ok"/"done"/"success" all appear and queries break. Confirm the schema has the five fields, result is a closed enum, and a missing field fails validation.

Verify
Validate the complete entry and confirm it passes; validate the entry missing result and confirm it is rejected at parse time, not stored. Query a few entries by action to confirm the closed result enum makes the query reliable. Record the schema in ADR-0004 and note any field Codex tried to add.

Knowledge Check
1. What five questions must every audit entry answer?
Level, message, service, environment, and version.
Source IP, user agent, route, status code, and latency.
Who, what, when, why, and the result of the action.
Who, what, and when — the other two are optional extras.
2. Why validate each audit entry against a schema at write time?
It rejects a half-populated entry before it reaches the trail.
It encrypts the entry so only auditors can read it.
It compresses entries so the long-retention trail costs less.
It converts the entry into application-log format automatically.
3. Why should the audit result field be a closed enum rather than a free string?
A closed enum makes each entry smaller on disk than a string.
A free string cannot be stored in a long-retention audit log.
An enum lets the redactor skip the field during redaction.
A free string lets "ok"/"done"/"success" diverge.
4. A teammate records "user 7 changed the SSN on filing 12" in the audit trail with the new SSN value included. What is wrong?
Nothing — the audit trail should capture the full before-and-after values.
The entry should go in the application log, not the audit trail.
The SSN value should be redacted; the entry records the action only.
The entry is missing a severity field required by the schema.

## Topic 6 of 6
Practice — make authenticated traffic safe to log
Why Do I Need to Know This?
This lesson’s payoff is logs you could hand to a federal auditor without leaking a single SSN, and the only way to know you have them is to log the sensitive fields on purpose and prove they never come out. This exercise has you drive Codex to wire the correlation ID, the boundary redactor in both services, and the audit schema, then verify by trying to leak — the verify-don’t-trust loop applied to the logs themselves.

AI Practice
Prompt it
Hands-on practice for this lesson — wire it across both services with Codex, then try to leak a sensitive field and confirm you can’t.

In my Express and FastAPI services, add: correlation-id middleware that mints or reuses an x-correlation-id and propagates it across the inter-service call; boundary redaction from one shared field list (ssn, tin, account_number, password, token, authorization) using pino's redact in Node and a structlog processor before JSONRenderer in Python; and a zod/pydantic audit-entry schema (actor, action, timestamp, reason, result). Then write tests that log an object containing all the sensitive fields and assert none of the values appear.

Watch out
Codex is likely to mint a fresh correlation ID per service (breaking the trace), scrub fields inline instead of on the logger/processor, cover only one service, place the structlog processor after JSONRenderer, or let the audit result be a free string. Each one passes a shallow check while leaving a real gap. Read where redaction is configured and where the processor sits before trusting the green checks.

Verify
Send one request that crosses both services and confirm a single correlation ID appears in logs from both. Log an object containing all six sensitive fields in each service and confirm only [REDACTED] appears, never the values. Validate an audit entry missing result and confirm it is rejected. Then prove a test is real: remove one path from the redact list and confirm the redaction test fails. Record any gap Codex left in your prompt journal for ADR-0004.
