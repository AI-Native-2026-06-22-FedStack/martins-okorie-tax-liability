2.3 The Express Skeleton: Validation, Errors & OpenAPI
🕐 Last Updated: 2026-06-18 19:01:47 UTC
📌 Commit: 3b5e8674
Week 2 · Day 3
"The Express Skeleton: Validation, Errors & OpenAPI"
Put an Express API in front of the data — layered route → controller → service → repository, zod-validated requests and responses, an RFC 9457 Problem+JSON error contract, and OpenAPI docs generated from the same zod schemas.

1
Topic 1 of 6
Express and middleware ordering
Why Do I Need to Know This?
Express runs the functions you register in the order you register them, and that order decides whether a request is parsed, logged, and checked before it reaches your handler. Get the order wrong and the failure is silent: the handler runs against a request that was never parsed, and nothing errors. Before your team writes a single route, it needs the ordering model, because an order bug does not announce itself — it just returns wrong data.

Scenario
Your team’s new POST /filings route reads req.body and gets undefined. Nothing threw, the route ran, and the body is simply not there. The cause is order: the JSON body-parser was registered after the route, so the route ran first against an unparsed request. Your team moves the parser and the request logger above the routes, puts the error handler last, and writes the canonical order down so no one rediscovers this the hard way.

Theory
Express runs middleware in registration order
Middleware is any function Express runs while handling a request, and Express runs them in the exact order you call app.use(...) or define a route. Each one does its work and calls next() to pass control to the next in line. This matters because every middleware can read and change the request before the next sees it: if the body-parser has not run yet, req.body is undefined for everything after it, which is the bug in the scenario.

The canonical order: parse and log, then routes, then errors last
Because order is execution order, there is a standard arrangement. The body-parser (express.json()) and the request logger (pino-http, the program’s structured logger) go first, so every route sees a parsed, logged request. The routes come next. A 404 handler sits after all routes, to catch requests no route matched. The error-handling middleware goes last of all, so it can catch errors thrown anywhere above it. The example wires exactly this order.

An error handler is the middleware with four arguments
Express recognizes an error handler by its signature: it takes four arguments, (err, req, res, next), where ordinary middleware takes three. In Express 5, a route or middleware that returns a rejected promise — including an async function that throws — is automatically forwarded to this error handler, so you no longer wrap every async handler in try/catch. This is a change from Express 4, where an unhandled rejection in an async handler was not forwarded and the request would hang.

!
Important
Register the error handler last
Because middleware runs in order, an error handler registered before your routes can never catch errors the routes throw. The four-argument error middleware must be the final app.use(...), after every route and the 404 handler.

A request flowing through ordered middleware
A request passes through the body-parser and the logger, then either matches a route or falls through to the 404 handler; if the matched route throws, the error handler catches it before the response returns.

no route matched

matched

threw / rejected

Request

express.json() -- parse body

pino-http -- log request

route lookup

404 handler

matched route handler

error handler (err, req, res, next)

Response

Example
a minimal express 5 app wired in the correct order
import express, { type Request, type Response, type NextFunction } from "express";
import pinoHttp from "pino-http";

const app = express();

app.use(express.json());                       // (1) parse JSON body first
app.use(pinoHttp());                           // (2) then log every request

app.get("/filings/:id", async (req, res) => {  // (3) routes after the parsers
  const filing = await loadFiling(req.params.id);  // if this throws, Express 5 forwards it
  res.json(filing);
});

app.use((req: Request, res: Response) => {     // (4) 404: no route matched
  res.status(404).json({ error: "not found" });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {  // (5) error handler last
  res.status(500).json({ error: "internal" });
});
Copy
Annotation (1) and (2) — the parser and logger run before any route, so every handler sees a parsed, logged request; reverse (1) and (3) and req.body is undefined.
Annotation (3) — because this is Express 5, a throw inside the async handler is forwarded to (5) with no try/catch; in Express 4 it would not be.
Annotation (4) — the 404 handler sits after the routes, so it only runs when no route matched.
Annotation (5) — the four-argument signature is what makes Express treat this as the error handler; registered last, it can catch errors from everything above.
AI Practice
Prompt it
Ask Codex to scaffold the app, then verify the registration order yourself.

Scaffold a minimal Express 5 app in TypeScript with: express.json() body
parsing, pino-http request logging, one GET /filings/:id route, a 404 handler, and a four-argument error-handling middleware. Register them in the correct order. Show why each sits where it does in a short comment per line.
Copy
Watch out
Codex frequently registers the error handler too early — before the routes — which means it can never catch the routes’ errors, and the mistake is invisible until something throws. It may also write the error handler with three arguments, so Express treats it as a normal middleware. Confirm the error handler is the last app.use and has four parameters.

Verify
Add a route that throws on purpose, start the app, and request it. With the handler last and four-argument, you get your error response; if the error handler runs before the routes or has three arguments, the request hangs or returns the default Express error page. Remove the throwing route once confirmed.

Knowledge Check
1. Your POST /filings handler reads req.body and gets undefined, but nothing throws. What is the most likely cause?
The route handler is async, so req.body resolves only after the response is sent.
express.json() was registered after the route, so the body was never parsed.
The client sent form-encoded data, which Express always rejects without a parser.
The error-handling middleware swallowed the body before the route ran.
2. Why must the four-argument error-handling middleware be registered last?
Because Express only allows one app.use call after the routes are defined.
Because the error handler must parse the body before the routes can use it.
Because registering it first would make every route return a 500 response.
Middleware runs in order, so only a last-registered handler catches them.
3. In Express 5, an async route handler throws. What happens to the error, compared with Express 4?
Express 5 forwards it to the error handler; Express 4 did not.
Express 5 and Express 4 both crash the process on an unhandled async throw.
Express 5 ignores it silently, which is why a try/catch is still required.
Express 5 returns the thrown value to the client as a 200 response body.
4. Where should the request logger (pino-http) be registered for it to log every request?
Immediately after the routes, so it can log the response each route produced.
Inside each individual route handler, called manually at the top of the function.
Near the top, before the routes, so it runs for every incoming request.
Last, in the four-argument error handler, so logging and error handling share one place.
2
Topic 2 of 6
Layered architecture — route, controller, service, repository
Why Do I Need to Know This?
When one handler reads the request, validates it, runs the SQL, applies a business rule, and formats the response, none of those jobs can be tested or reviewed on its own. The four review dimensions your team adopted in Module 1 Lesson 4, Git, ADRs & AI Code Review can’t be applied cleanly to one function doing five jobs, and a unit test would have to stand up an HTTP request and a database just to check one rule. Separating the work into layers gives each piece one job, so each can be tested and reviewed alone.

Scenario
A teammate’s POST /filings handler does everything in one function: it reads req.body, validates fields, runs a raw INSERT, applies the rule "a submitted filing must have at least one line item," and shapes the JSON response. No one can unit-test the rule without a live database and a fake request. Your team splits it into four layers — a route that wires the path, a controller that translates HTTP to and from the domain, a service that holds the rule, and a repository that owns the SQL.

Theory
Each layer has one responsibility
The four layers each do exactly one job. The route wires an HTTP path and method to a controller function. The controller translates between HTTP and the domain — it reads the request, calls the service, and shapes the response. The service holds the business rules and knows nothing about HTTP. The repository owns data access — the SQL or query builder — and is the layer you previewed in Lesson 2, Advanced SQL & Integration Testing with Testcontainers. The Example shows one request crossing all four.

Dependencies point inward
The layers call inward only: controller calls service, service calls repository. The service never imports an HTTP type like Request, and the repository never contains a business rule. This direction is what keeps each layer replaceable — you could put the same service behind a different transport, or swap the repository’s SQL, without touching the others, because the inner layers do not know what calls them.

Separation is what makes each layer testable in isolation
Because the service holds no HTTP and no SQL, you can unit-test a rule by calling the service function directly with plain objects — no server, no database. Because the repository is the only layer touching the database, you can integration-test it against a real Postgres with Testcontainers, exactly as in Lesson 2, Advanced SQL & Integration Testing with Testcontainers. A fat handler allows neither; the split is what makes both kinds of test possible.

The four layers and their inward dependencies
A request enters at the route and flows inward; each layer depends only on the one beneath it, and the arrows never point back out.

Route -- wire path + method to a controller

Controller -- translate HTTP ↔ domain

Service -- business rules (no HTTP)

Repository -- data access (no rules)

Example
one vertical slice across all four layers
// route.ts — wires HTTP path+method to a controller function
router.get("/filings/:id", getFilingController);

// controller.ts — HTTP in, HTTP out; no business rules, no SQL
export async function getFilingController(req: Request, res: Response) {
  const filing = await filingService.getById(Number(req.params.id));  // (1) call inward
  res.json(filing);                                                   // (2) shape the response
}

// service.ts — business rules only; knows nothing about req/res
export const filingService = {
  async getById(id: number) {
    const filing = await filingRepo.findById(id);     // (3) call inward to the repository
    if (!filing) throw new NotFoundError("filing", id);  // (4) a rule, not an HTTP concern
    return filing;
  },
};

// repository.ts — the only layer that touches the database
export const filingRepo = {
  findById(id: number) {
    return db.query("SELECT * FROM filing WHERE id = $1", [id]).then((r) => r.rows[0]);  // (5)
  },
};
Copy
Annotation (1) and (2) — the controller only translates: it converts the path param, calls the service, and serializes the result; it holds no rule and no SQL.
Annotation (3) — the service calls the repository; it never runs SQL itself.
Annotation (4) — "not found is an error" is a domain rule, expressed by throwing; the controller and the error middleware decide the HTTP status, not the service. NotFoundError is a small custom class (class NotFoundError extends Error {}) assumed to live in a shared errors module.
Annotation (5) — the repository is the single place SQL lives, which is why it is the layer the integration tests target.
AI Practice
Prompt it
Ask Codex to refactor a fat handler into the four layers, then check the seams.

Here is a single Express handler that reads the request, validates it, runs a raw SQL INSERT, applies a business rule, and formats the response. Refactor it into four layers: route, controller, service, repository. The service must not import any HTTP types, and the repository must contain all the SQL and no business rules. Keep the behavior identical.
Copy
Watch out
Codex often leaves a leak: an HTTP status code or a Response object used inside the service, or a business rule like "submitted filings need a line item" buried in the repository. These compile and pass a quick test but defeat the separation. Read the service for any req/res reference and the repository for any rule beyond data access.

Verify
Check the imports of each file. The service file should import no Express types; the repository file should contain the only SQL in the slice. Then write a unit test that calls the service function directly with plain objects and no server — if you cannot, a layer is still leaking HTTP or database concerns.

Knowledge Check
1. A unit test needs to check the rule "a submitted filing must have at least one line item" without a database. Which layer should hold that rule?
The service, because it holds business rules and depends on no HTTP or SQL.
The controller, because it already reads the request and can check fields there.
The repository, since it is closest to the data the rule reads from.
The route, since it is the entry point every request must pass through first.
2. What does "dependencies point inward" mean for the service layer?
The service may import Request and Response as long as it does not send them.
The service calls the controller back once it finishes applying a rule.
The service calls the repository but imports no HTTP types from the controller.
The service and repository share one module so they can call each other freely.
3. Why can the repository be integration-tested against a real Postgres while the service is unit-tested without one?
Because the repository runs faster than the service and can afford a database.
The repository is the only layer with SQL; the service holds none.
Because the service cannot be tested at all until the repository passes first.
Because integration tests and unit tests must always target the same layer.
4. A teammate puts the HTTP status code 404 inside the service when a filing is missing. Why is that a problem?
It is slower, because the service now has to build an HTTP response object.
It breaks the route, which can no longer wire the path to the controller.
It forces the repository to import the same status code to stay consistent.
It couples the service to HTTP, breaking its reuse and isolated testing.
3
Topic 3 of 6
Request and response validation with zod
Why Do I Need to Know This?
Every value that arrives from a client is untrusted, and a service that trusts the request body is one malformed payload away from a corrupt row or a crash. Your team validates at the boundary with the same zod it used in Module 1 Lesson 2, TypeScript, Node & Async Fundamentals, so a bad request is rejected with a clear error before it ever reaches the service. Validating the response too means the service cannot accidentally return a shape the API contract forbids.

Scenario
Your team’s POST /filings endpoint accepts a JSON body and must reject three things before any SQL runs: a missing taxpayer_id, a negative total_cents, and a status outside the allowed set. The controller parses the body with a zod schema; on a valid body it gets a fully typed object, and on an invalid one the parse throws, which becomes a clean 400 instead of a 500 from somewhere deep in the service.

Theory
Parse, don’t validate-then-trust
The boundary pattern is parse-and-narrow: schema.parse(input) either returns a value whose TypeScript type is now known, or throws. After a successful parse, downstream code receives a guaranteed shape, so the service never re-checks fields. This is stronger than checking a few fields and passing the original loose object along, where a missed field slips through untyped. The example parses the create-filing body in the controller, so the service receives a typed CreateFiling.

i
Note
Use the zod v4 top-level format validators — z.email(), z.url(), z.uuid() — not the older z.string().email() / z.string().url() method forms. The method forms are deprecated in v4, and z.string().url() has a known URL-validation bug. This applies to every schema you write in this module.

Validate the response, not just the request
Parsing the request stops bad input; parsing the response stops bad output. If the service returns an object with an extra internal field or a wrong type, a response schema catches it before it reaches the client, so the handler cannot quietly break the contract the OpenAPI doc promises. The cost is one extra parse on the way out, which is cheap next to shipping a response that violates the contract.

A failed parse is a client error, not a server error
When parse throws on a bad body, that is the client’s fault — a 400-class error — and it must be distinguished from a 500, which means the service itself failed. Treating them the same hides real server bugs behind validation noise and tells the client to retry when retrying cannot help. The Error handling and the Problem+JSON contract (RFC 9457) topic routes a zod parse failure to a 400 Problem+JSON response, while an unexpected error becomes a 500.

The request body passing through a zod parse
A request body either parses into a typed value that continues to the controller, or fails the parse and branches to a 400 error path.

valid

throws ZodError

Request body (untrusted JSON)

CreateFiling.parse(body)

typed CreateFiling -> controller -> service

400 client error -> Problem+JSON

Example
a zod schema parsed at the boundary
import { z } from "zod";

// (1) the contract for a create-filing request body
const CreateFiling = z.object({
  taxpayer_id: z.number().int().positive(),         // (2) required, must be a positive integer
  status: z.enum(["draft", "submitted", "paid"]),   // (3) only these values are allowed
  total_cents: z.number().int().nonnegative(),      // (4) no negative amounts
});

type CreateFiling = z.infer<typeof CreateFiling>;   // (5) the type comes from the schema

export async function createFilingController(req: Request, res: Response) {
  const input = CreateFiling.parse(req.body);       // (6) throws ZodError on a bad body
  const filing = await filingService.create(input); // service receives a typed, valid object
  res.status(201).json(filing);
}
Copy
Annotation (1)–(4) — the schema is the request contract: a missing taxpayer_id, an unknown status, or a negative total_cents each fail the parse before any SQL runs.
Annotation (5) — z.infer derives the TypeScript type from the schema, so the type and the runtime check can never drift apart.
Annotation (6) — parse throws a ZodError on invalid input; the Error handling and the Problem+JSON contract (RFC 9457) topic’s error middleware turns that into a 400, so the controller does not need its own try/catch.
AI Practice
Prompt it
Ask Codex to write the schema with the stated rules, then verify it rejects each bad case.

Write a zod schema named CreateFiling for a request body with: taxpayer_id (a positive integer, required), status (one of "draft", "submitted", "paid"), and total_cents (a non-negative integer). Derive the TypeScript type from the schema with z.infer. Parse req.body with it in an Express controller, and let the parse throw on invalid input rather than catching it. Use zod v4 idioms.
Copy
Watch out
Codex may use any for the parsed value or cast req.body as CreateFiling, which skips the runtime check entirely and is forbidden by your AGENTS.md rule against any in handlers. It may also reach for the deprecated z.string().url()-style method validators. Confirm the body is actually parsed with .parse, the type comes from z.infer, and any format checks use the v4 top-level validators.

Verify
Send three bad requests — one missing taxpayer_id, one with status: "archived", one with total_cents: -1 — and confirm each is rejected before reaching the service. Then send a valid body and confirm the controller receives a typed object. If a bad request reaches the service, the parse is being skipped or bypassed with a cast.

Knowledge Check
1. Why is CreateFiling.parse(req.body) preferred over checking a few fields and passing req.body along?
parse is faster than manual field checks because zod compiles the schema to native code.
parse mutates req.body in place so later middleware sees the validated values.
parse returns a typed value or throws, so the service receives a guaranteed shape.
parse automatically sends a 400 response, so the controller needs no error handling.
2. A zod parse fails on a malformed request body. Which HTTP status class is correct, and why?
A 4xx, because a malformed body is the client’s error, not the server’s.
A 5xx, because the server threw an exception while handling the request.
A 3xx, because the client should redirect and resubmit the corrected body.
A 200, because the validation ran successfully even though the body was rejected.
3. Why validate the response shape and not only the request?
Because clients can tamper with the response after the server sends it.
Because response validation is what generates the OpenAPI document automatically.
Because the request schema cannot be reused, so a second schema is required anyway.
Because it stops the service from returning a shape the API contract forbids.
4. A teammate writes const input = req.body as CreateFiling; instead of parsing. What is wrong with it?
Nothing — a TypeScript cast performs the same runtime validation as .parse.
The cast skips the runtime check, so invalid data flows in untyped-in-practice.
The cast throws at runtime when the body does not match, masking the real error.
The cast validates the body but discards the inferred TypeScript type afterward.
4
Topic 4 of 6
Error handling and the Problem+JSON contract (RFC 9457)
Why Do I Need to Know This?
A federal API has to report failures in a consistent, machine-readable shape, so a client — or an auditor — can tell what went wrong without scraping a stack trace. When every endpoint invents its own error format, no caller can handle errors uniformly. Your team adopts one standard error body so a validation failure, a missing record, and an unexpected crash all look the same on the wire.

Scenario
Your team’s endpoints currently return errors three different ways: one sends a plain string, another a { message } object, and a third leaks an HTML stack trace. A client cannot parse all three. Your team standardizes on the RFC 9457 Problem Details format — type, title, status, detail, instance — emitted by a single error-handling middleware, so every failure across the API has the same shape.

Theory
RFC 9457 defines a standard JSON error body
RFC 9457 (Problem Details for HTTP APIs) defines a standard JSON error object with five members: type (a URI identifying the problem kind), title (a short human summary), status (the HTTP status code), detail (an explanation for this occurrence), and instance (a URI for this specific occurrence). It obsoletes the older RFC 7807 but keeps the same wire format. Adopting it means every error your API returns is parseable the same way, which the Example produces from one place.

One error middleware maps thrown errors to the shape
Rather than format an error in every handler, your team throws errors and lets one error-handling middleware — registered last, from the Express and middleware ordering topic — convert them to Problem+JSON. It maps a zod ZodError to a 400, a NotFoundError to a 404, and anything unrecognized to a 500. Handlers stay simple: they throw, and the middleware owns the response shape and the application/problem+json content type.

Distinguish client errors from server errors
The middleware must set the right status class, because 4xx and 5xx mean different things to a caller. A 4xx says the request was wrong — fix it and the retry may succeed. A 5xx says the service failed — retrying the same request may still fail, and someone needs to look at the server. Mapping a validation failure to 400 and an unexpected exception to 500 is what lets a client decide whether retrying is worth it.

Thrown errors funneling into one Problem+JSON middleware
Different error types thrown anywhere in the app converge on a single error middleware that emits a Problem+JSON body with the matching status.

400

404

500

ZodError (bad input)

error middleware (registered last)

NotFoundError (missing record)

unexpected Error

Problem+JSON, status 400

Problem+JSON, status 404

Problem+JSON, status 500

Example
an error middleware that emits rfc 9457 bodies
import { ZodError } from "zod";
import { type Request, type Response, type NextFunction } from "express";

export function problemJson(err: Error, req: Request, res: Response, next: NextFunction) {
  res.type("application/problem+json");                 // (1) the RFC's content type

  if (err instanceof ZodError) {                        // (2) bad input -> 400
    return res.status(400).json({
      type: "about:blank", title: "Invalid request", status: 400,
      detail: err.issues.map((i) => i.message).join("; "), instance: req.originalUrl,
    });
  }
  if (err instanceof NotFoundError) {                   // (3) missing record -> 404
    return res.status(404).json({
      type: "about:blank", title: "Not found", status: 404,
      detail: err.message, instance: req.originalUrl,
    });
  }
  return res.status(500).json({                         // (4) anything else -> 500
    type: "about:blank", title: "Internal server error", status: 500,
    detail: "An unexpected error occurred.", instance: req.originalUrl,
  });
}
Copy
Annotation (1) — the response uses application/problem+json, the content type RFC 9457 defines, so clients know the body is a problem document.
Annotation (2) and (3) — a ZodError becomes a 400 and a NotFoundError a 404; the thrown type decides the status, and every body carries the same five members.
Annotation (4) — any unrecognized error becomes a 500 with a generic detail, so an internal failure never leaks a stack trace to the client.
Because this middleware is registered last, it catches errors thrown anywhere above it, including the ZodError from the Request and response validation with zod topic.
AI Practice
Prompt it
Ask Codex to write the error middleware, then verify the bodies match RFC 9457.

Write an Express 5 error-handling middleware in TypeScript that converts thrown errors to RFC 9457 Problem+JSON. Map a zod ZodError to status 400, a custom NotFoundError to 404, and any other error to 500. Every response must set the application/problem+json content type and include type, title, status, detail, and instance. Do not leak stack traces on the 500 path.
Copy
Watch out
Codex may invent extra top-level fields (error, code, errors) that are not part of RFC 9457, or put the stack trace into detail on the 500 path, which leaks internals. It may also forget the application/problem+json content type. Confirm the body has exactly the five standard members and the 500 path returns a generic detail.

Verify
Trigger each path: send an invalid body (expect 400), request a missing id (expect 404), and force an unexpected error (expect 500). For each, confirm the response has type, title, status, detail, and instance, the content type is application/problem+json, and the 500 body contains no stack trace.

Knowledge Check
1. Why route every error through one middleware instead of formatting errors in each handler?
Because Express forbids a handler from calling res.json more than once per request.
Because a handler cannot set an HTTP status code without the error middleware.
Because middleware runs faster than formatting the same body inside a handler.
Because one place produces a single consistent error shape for every endpoint.
2. Which set of members does an RFC 9457 Problem Details body use?
error, message, code, timestamp, path.
type, title, status, detail, instance.
kind, summary, httpCode, description, uri.
problem, reason, statusText, trace, id.
3. A validation failure and an unexpected exception are both mapped to status 500. What is the consequence for a client?
The client retries both, and the validation failure succeeds on the second try.
The client treats both as success because 500 still returns a JSON body.
The client cannot tell a fixable bad request from a real server failure.
The client is required to escalate every 500 to an on-call engineer immediately.
4. On the 500 path, why must detail be a generic message rather than the error’s stack trace?
A stack trace leaks internal implementation details to the client.
Because RFC 9457 forbids the detail member from exceeding 80 characters.
Because a stack trace cannot be serialized to JSON without throwing again.
Because the client needs the stack trace in a separate header instead.
5
Topic 5 of 6
Code-first OpenAPI from zod
Why Do I Need to Know This?
A hand-written OpenAPI document drifts from the code the moment a field is renamed, which is the same silent-contract-drift problem the DTO toolkit from Module 1 Lesson 2, TypeScript, Node & Async Fundamentals fought. Your team needs /docs for the Sprint-1 panel demo, but a doc that disagrees with the handlers is worse than none. Generating the spec from the same zod schemas the handlers validate with means the docs cannot disagree with the code.

Scenario
Your team needs interactive API docs at /docs for the demo, but the hand-maintained spec already lists a filing_total field the handler renamed to total_cents weeks ago. Rather than hand-edit the spec again, your team switches to code-first: zod-to-openapi derives the OpenAPI document from the request and response schemas, and @scalar/express-api-reference renders it at /docs. Now a schema change updates the docs automatically.

Theory
Schema-first writes the doc by hand; code-first derives it from the schemas
There are two directions. Schema-first writes the OpenAPI document by hand and generates code or types from it. Code-first does the reverse: the code’s schemas are the source, and the document is generated from them. The program uses code-first because the zod schemas already exist for validation, so deriving the doc from them means one source of truth feeds both — the doc tracks the handlers automatically, as the figure shows.

zod-to-openapi turns zod schemas into an OpenAPI 3.1 document
@asteasolutions/zod-to-openapi (v8, which supports zod v4) registers your schemas and paths and generates the spec. You create an OpenAPIRegistry, register each schema and route on it, then pass it to OpenApiGeneratorV31 to produce an OpenAPI 3.1 document. The same zod schema both validates a request at runtime and describes it in the doc, so the two cannot drift. Calling extendZodWithOpenApi(z) once adds the .openapi() metadata method to your schemas.

Scalar serves the rendered docs at a route
A generated document is JSON; the team still needs a page humans can read. @scalar/express-api-reference provides an apiReference(...) middleware that renders interactive docs from an OpenAPI document. You serve the generated JSON at one route and mount the reference UI at /docs, pointing it at that JSON, which is what the panel sees in the demo.

One zod schema feeding both validation and the docs
A single zod schema is the source for two outputs — runtime request validation and the generated OpenAPI document — so the docs always match the handlers.

zod schema (CreateFiling)

runtime validation (.parse in the controller)

zod-to-openapi -> OpenAPI 3.1 document

@scalar/express-api-reference at /docs

Example
generating and serving the spec from a zod schema
import { z } from "zod";
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { apiReference } from "@scalar/express-api-reference";

extendZodWithOpenApi(z);                         // (1) adds .openapi() to zod schemas
const registry = new OpenAPIRegistry();

const CreateFiling = registry.register(          // (2) same shape as the controller's schema
  "CreateFiling",
  z.object({
    taxpayer_id: z.number().int().positive(),
    status: z.enum(["draft", "submitted", "paid"]),
    total_cents: z.number().int().nonnegative(),
  }),
);

registry.registerPath({                          // (3) describe the route from the schema
  method: "post", path: "/filings",
  request: { body: { content: { "application/json": { schema: CreateFiling } } } },
  responses: { 201: { description: "Filing created" } },
});

const doc = new OpenApiGeneratorV31(registry.definitions).generateDocument({  // (4) OpenAPI 3.1
  openapi: "3.1.0", info: { title: "Filing API", version: "1.0.0" },
});

app.get("/openapi.json", (_req, res) => res.json(doc));        // (5) serve the generated JSON
app.use("/docs", apiReference({ url: "/openapi.json" }));      // (6) render it for the demo
Copy
Annotation (1) — extendZodWithOpenApi adds the .openapi() method so schemas can carry doc metadata; call it once at startup.
Annotation (2) — in your codebase this is the literal CreateFiling schema the controller parses with, imported from one shared module; it is re-declared here only because this is a standalone snippet. Registering one schema object, not just a matching shape, is what guarantees the doc matches the handler.
Annotation (3) and (4) — the path is described in terms of the schema, and OpenApiGeneratorV31 emits an OpenAPI 3.1 document.
Annotation (5) and (6) — the JSON is served at /openapi.json, and Scalar renders it at /docs for the panel.
AI Practice
Prompt it
Ask Codex to wire the generation from an existing schema, then verify it matches the handler.

I have a zod schema CreateFiling used to validate POST /filings. Using
@asteasolutions/zod-to-openapi (v8, zod v4), register the schema and the path, generate an OpenAPI 3.1 document with OpenApiGeneratorV31, serve it at /openapi.json, and render it at /docs with @scalar/express-api-reference. Use my existing schema as the single source — do not hand-write a separate spec.
Copy
Watch out
Codex may hand-write an OpenAPI document beside the schema "to be safe," which reintroduces exactly the drift this avoids. It may also invent fields the schema does not have, or target OpenAPI 3.0 with OpenApiGeneratorV3 when the program wants 3.1. Confirm the spec is generated from your registered schema, uses OpenApiGeneratorV31, and lists only the fields the schema defines.

Verify
Open /docs and confirm the POST /filings body lists exactly taxpayer_id, status, and total_cents. Then rename a field in the zod schema, restart, and reload /docs — the change must appear without editing any spec file. If it does not, a hand-written spec is still in the path.

Knowledge Check
1. Why does the program generate the OpenAPI document from the zod schemas instead of writing it by hand?
One source feeds both validation and docs, so they cannot drift.
Because a hand-written OpenAPI document cannot describe a JSON request body.
Because zod schemas cannot be used for runtime validation once docs exist.
Because OpenAPI 3.1 is only producible by a generator, never by hand.
2. What is the difference between schema-first and code-first OpenAPI?
Schema-first uses zod and code-first uses plain TypeScript types instead.
Schema-first validates requests while code-first only produces documentation.
Schema-first is for internal APIs and code-first is only for public ones.
Schema-first writes the doc by hand; code-first derives it from the code.
3. After generating the document, what is Scalar’s role in the setup?
It validates incoming requests against the generated document at runtime.
It renders the OpenAPI document as interactive docs at /docs.
It converts the zod schemas into the OpenAPI document during the build.
It generates a TypeScript client from the document for the frontend.
4. You rename a field in the zod schema and reload /docs, but the old field still shows. What does that indicate?
That Scalar caches the document for 24 hours and will refresh on its own later.
That OpenAPI 3.1 does not support renaming fields without a new version number.
That the controller is still validating against the old schema and must be redeployed.
That a hand-written spec is still in the path instead of the generated one.
6
Topic 6 of 6
Practice — scaffold the API with Codex and probe its error contract
Why Do I Need to Know This?
An API’s error contract is only real if every failure actually returns the agreed shape, and the way to know is to send bad requests and read the responses. Having Codex scaffold the skeleton and then probing it with curl is how you confirm the validation, the middleware order, and the Problem+JSON contract hold together — not just that the happy path returns 200. This exercise pulls the middleware-ordering, validation, and error-contract work together against a running server.

Scenario
Your team’s Codex-scaffolded skeleton returns 200 on every happy-path request, so the demo looks done. Then a teammate sends a request missing taxpayer_id, expecting a clean 400 Problem+JSON body — instead the connection hangs, because the error handler was registered before the routes. Only probing the running server with deliberately bad requests surfaces a contract bug a passing happy path hides.

Theory
The method here is to verify the contract from the outside: Codex proposes the scaffold, you probe it with real failing requests, and you record any response that breaks the contract. A passing happy path proves almost nothing about an error contract — only deliberately bad requests (a missing field, an unknown route, a forced exception) show whether every failure returns the agreed Problem+JSON shape with the right status. The running server’s responses are the judge, not the code’s appearance.

AI Practice
Prompt it
Hands-on practice for this lesson — have Codex scaffold the app, run it locally, then probe it with curl and verify each failure shape yourself.

Scaffold a minimal Express 5 app in TypeScript: express.json() and pino-http
first, a POST /filings route whose controller parses the body with a zod schema (taxpayer_id positive int, status in draft|submitted|paid, total_cents non-negative int), a 404 handler, and a last error-handling middleware that maps ZodError to 400 and anything else to 500 as RFC 9457 Problem+JSON. Make it runnable with one command.
Copy
Watch out
Codex may register the error handler before the routes (so it never catches their errors), write it with three arguments, or invent error fields that are not in RFC 9457 (error, code). It may also leak a stack trace on the 500 path. Confirm the error handler is last and four-argument, and the body has exactly type, title, status, detail, instance.

Verify
Run the app and send three requests with curl: a body missing taxpayer_id (expect 400), a request to an unknown route (expect 404), and a request that forces an unexpected error (expect 500). For each, confirm the content type is application/problem+json, the body has the five RFC 9457 members, and the 500 carries no stack trace.

