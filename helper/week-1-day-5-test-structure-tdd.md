# Week 1 Day 5 Test Structure And TDD Helper

Read this helper before doing TaxPulse test or TDD work. It preserves the available lesson notes on Arrange-Act-Assert, Given-When-Then, Red-Green-Refactor, human-led AI TDD, the test pyramid, coverage, negative paths, and interaction versus state assertions.

The source attachment includes Topics 1 through 5 and labels them "of 6"; Topic 6 was not present in the provided content, so this note does not invent it.

## Source Lesson

## Topic 1 of 6: Test structure -- Arrange-Act-Assert and Given-When-Then

### Why Do I Need to Know This?

A test you cannot read quickly is a test a closed-book check will expose, and inconsistent structure across four engineers makes every review slower. Your team adopts two naming patterns so any engineer can open any test and know what it proves and where it would fail -- the structural baseline every topic in this lesson builds on.

### Scenario

Your team reviews a test that mixes setup, the call under test, and three assertions in one undivided block. No one can tell at a glance which line is the behavior being verified. You rewrite it in Arrange-Act-Assert and label a behavioral test with Given-When-Then, and the next reviewer reads the intent in seconds.

### Theory

#### Arrange-Act-Assert separates the three phases

AAA splits a test into three visible phases: Arrange the inputs and collaborators, Act by calling the one thing under test, and Assert the outcome. The separation matters because when the test fails, the phase boundaries tell you immediately whether setup, the call, or the expectation broke -- instead of hunting through an undivided block.

#### Given-When-Then frames behavior

GWT phrases a test as a precondition, an action, and an expected outcome: Given an account with two unpaid invoices, When a payment posts, Then the balance drops by the payment amount. It is the same three-part shape as AAA, expressed in domain language, which makes it the better fit for behavior and scenario tests a stakeholder might read.

#### When each fits

Use AAA for unit-level tests where the phases are code: arrange objects, call a function, assert a value. Use GWT for behavior or scenario tests where the value is communicating intent in domain terms. They are not rivals -- GWT expresses the same three-phase structure using domain language rather than code phase names.

#### One behavior, two structures

The same test shown in Arrange-Act-Assert phases beside its Given-When-Then phrasing:

| Given-When-Then | Arrange-Act-Assert |
| --- | --- |
| Given: precondition | Arrange: build inputs |
| When: action | Act: one call |
| Then: outcome | Assert: one expectation |

### Example

#### The same behavior in AAA

```ts
import { test, expect } from "vitest";
import { applyPayment } from "./billing";

// Given an account owing 100, When a 30 payment posts, Then the balance is 70.
test("applyPayment reduces the balance by the payment amount", () => {
  // Arrange
  const account = { balance: 100 };

  // Act
  const result = applyPayment(account, 30);

  // Assert
  expect(result.balance).toBe(70);
});
```

The comment line states the behavior in Given-When-Then; the body realizes it in Arrange-Act-Assert. Each phase is one visible region: build the account, make the single call, assert the single outcome. The single `expect` in the Assert phase means one assertion per test -- when it fails, there is no ambiguity about which outcome was expected.

### AI Practice

#### Prompt it

Ask Codex to restructure a messy test into AAA without changing what it asserts.

```text
Refactor this test into clear Arrange-Act-Assert structure with the three phases
separated by blank lines and short comments. Do not change which behavior is
tested or what is asserted -- only the structure. Keep the same test name.
<paste the messy test here>
```

#### Watch out

Codex sometimes "improves" a test it was only asked to restructure -- adding extra assertions, renaming the test, or changing an expected value. Any of those changes what the test proves. Diff the assertions before and after: the expectations must be identical, only the layout should differ.

#### Verify

Confirm the refactored test asserts exactly what the original did: same expected values, same number of assertions, and only AAA structure changed. Run it and confirm it still passes, or still fails with the same assertion error. Record in your prompt journal whether Codex changed anything beyond structure.

### Knowledge Check

1. A test fails and you need to tell quickly whether the setup, the call, or the expectation broke. Which structure makes that fastest?
   Arrange-Act-Assert, whose phase boundaries show which part failed.
   One block with setup, the call, and several assertions all interleaved together.
   A structure that wraps the whole body in a single try/catch.
   Whichever variant carries the most explanatory comments.
2. When is Given-When-Then the better choice over plain AAA?
   For low-level tests of a private numeric helper function.
   For behavior or scenario tests that communicate domain intent.
   Whenever a test grows longer than roughly ten lines of executable code.
   Only for tests that mock more than two collaborators.
3. A test is named "Given a zero balance, When a payment of 50 posts, Then the balance is -50." Which structural pattern does this follow, and which keyword maps to the Assert phase?
   Arrange-Act-Assert; the "Given" keyword maps to Assert.
   Given-When-Then; the "When" keyword maps to Assert.
   Given-When-Then; the "Then" keyword maps to Assert.
   Arrange-Act-Assert; the "Then" keyword maps to Act.
4. Codex restructures a test into AAA and also adds a second assertion you did not ask for. What should you do?
   Accept it, since adding more assertions always strengthens the test.
   Discard the original test entirely and adopt Codex's expanded version wholesale.
   Keep the extra assertion as long as the whole restructured test still passes.
   Reject the added assertion; a restructure must not change what is verified.

## Topic 2 of 6: The Red-Green-Refactor loop as three commits

### Why Do I Need to Know This?

This curriculum treats test-driven development as evidence: the red, green, and refactor phases each become a commit, so a reviewer can see you wrote the test before the code rather than after. Your team needs the loop as a reflex, because the week's closed-book gate is to run one full cycle with Codex disabled.

### Scenario

Your team takes one small behavior and runs the full loop. First a commit with a failing test: red. Then the smallest change that makes it pass: green. Then a commit that cleans up the code with the test holding it safe: refactor. The three commits, in order, are the proof that the test came first.

### Theory

#### Red: a failing test that fails for the right reason

Write a test that specifies the behavior you want, run it, and confirm it fails -- and that it fails because the behavior is missing, not because of a typo or an import error. A test that fails for the wrong reason proves nothing. Commit it; this is the red commit.

#### Green: the smallest change that passes

Make the test pass with the least code that does the job -- no extra features, no speculative generality. The discipline is to do exactly enough, because anything more is untested code sneaking in under a green bar. Commit it; this is the green commit.

#### Refactor: improve with the test as a safety net

Now improve the code -- rename, extract, simplify -- running the test after each change so it stays green. The test is the safety net that lets you refactor without fear, and the three-commit trail is the proof of sequence a reviewer reads.

#### The Red-Green-Refactor cycle

- Red: write failing test; commit 1; test fails.
- Green: smallest passing code; commit 2; test passes.
- Refactor: clean up; commit 3; test still passes.

### Example

#### Three commits for one behavior

```sh
# (1) RED -- write the failing test first; confirm it fails for the right reason.
$ git commit -m "test: applyDiscount caps discount at 50 percent (red)"
#   running the test now FAILS: applyDiscount is not implemented

# (2) GREEN -- smallest code that passes; nothing more.
$ git commit -m "feat: implement applyDiscount with 50 percent cap (green)"
#   running the test now PASSES

# (3) REFACTOR -- clean up; test stays green.
$ git commit -m "refactor: extract cap constant in applyDiscount (refactor)"
#   running the test STILL PASSES
```

Annotation (1): the red commit captures the test alone; running it must fail because the behavior is missing, confirming the test actually tests something. Annotation (2): the green commit adds the least code to pass; resist adding the next feature here. Annotation (3): the refactor commit improves the code while the test guards it; the three commits in order are the evidence the test came first.

### AI Practice

#### Prompt it

Write the failing test by hand, then drive Codex to green -- and do the refactor yourself.

```text
Here is my failing test for applyDiscount (it caps a discount at 50 percent).
Implement applyDiscount with the smallest code that makes this test pass. Do not
add other features, options, or parameters beyond what the test requires. Do not
modify the test.
```

#### Watch out

Codex tends to over-build at the green step -- adding configuration, extra parameters, or handling for cases your test does not cover -- which is untested code arriving under a green bar. It may also edit the test to make it easier to pass. Confirm it changed only the implementation and added nothing the test did not demand.

#### Verify

Confirm the test is unchanged and now passes, and that Codex added no behavior your test does not exercise. Read the diff for extra parameters or branches. Make the refactor commit yourself. Record in your prompt journal what Codex over-built on its first pass, if anything.

### Knowledge Check

1. Why must the red-phase test fail for the right reason before you proceed?
   A failure from a typo or bad import does not verify the behavior.
   Because any failing test always proves the production code is broken.
   Because CI will otherwise reject the red commit at the gate.
   Because the green phase is supposed to run before the red phase.
2. What is the discipline at the green step?
   Add this feature plus the next two you will probably need soon.
   Write the smallest code that makes the test pass, nothing more.
   Refactor the surrounding module while you are already in the file.
   Loosen the test's assertion if the code is hard to pass.
3. Why capture red, green, and refactor as three separate commits?
   To raise the commit count on the contribution graph.
   Because Git mechanically requires three commits per logical change.
   The ordered trail proves the test was written before the code.
   To let you skip writing the tests on a later change.
4. At the green step, Codex adds an extra optional parameter your test never exercises. Why is that a problem?
   It is not a problem at all; the extra options will generally prove useful later on.
   The added parameter will break the TypeScript compile of the whole module.
   It silently rewrites the assertion inside your failing test.
   It ships untested behavior under a passing bar, defeating minimal green.

## Topic 3 of 6: AI-augmented TDD, human-led

### Why Do I Need to Know This?

The week's AI habit is "test first, Codex second," and the order is the entire point. If Codex writes both the test and the code, nothing independent checks the code -- the test and the implementation share the same author and the same blind spots. Your team makes the human-written failing test the thing that drives Codex, never the reverse.

### Scenario

A teammate asks Codex to "write tests and make them pass." Your team stops them: the test must be human-written first, or it just rubber-stamps whatever Codex produces. Instead the engineer writes the failing test, drives Codex to green, then runs `/review` on the diff for SOLID violations and missing edge cases -- raising the reasoning effort when the test resists going green after two tries.

### Theory

#### The human writes the failing test first

An AI-written test cannot independently verify AI-written code, because both come from the same model reasoning about the same prompt -- a bug in its understanding appears identically in both. A human-written failing test encodes an independent statement of the desired behavior, which is what makes driving Codex to pass it meaningful.

#### The loop: human test, Codex green, human review

The cycle is: you write the failing test, Codex writes the smallest code to green, then you `/review` the diff for design problems -- SOLID violations and missing edge cases -- and refactor. You own the test and the final approval; Codex does the mechanical work of getting to green in between.

#### Escalate effort, not leniency

When a test resists going green after two attempts, raise `model_reasoning_effort` (`minimal`, `low`, `medium`, `high`, `xhigh`) so the model thinks harder -- rather than weakening the test to make it pass. The test states the requirement; you change how hard the tool works, not what the requirement is.

#### Important

Never let Codex write the test it then makes pass. A test and an implementation from the same model provide weak evidence of correctness -- the test may inherit the same assumptions and blind spots as the implementation. The failing test is the one artifact that must be human-authored.

#### The human-led loop

- Engineer: write failing test.
- Codex: drive to green.
- Codex output: diff that passes the test.
- Engineer: `/review` and refactor.

Codex must not write the test it then passes.

### Example

#### Human test, Codex green, human review note

```ts
// (1) HUMAN-WRITTEN failing test -- the independent statement of behavior.
import { test, expect } from "vitest";
import { splitEvenly } from "./split";

test("splitEvenly distributes a remainder to the earliest shares", () => {
  expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
});

// (2) CODEX produces the smallest implementation that passes:
//     export function splitEvenly(total: number, parts: number): number[] { ... }

// (3) HUMAN /review note on the diff:
//     "Codex hard-coded the remainder to index 0 only; works for this test but
//      fails for total=100, parts=6. Add an edge-case test before refactoring."
```

Annotation (3): the human `/review` catches that the green code is narrowly fit to the one test; the response is another human-written test, not accepting the narrow code.

### AI Practice

#### Prompt it

Drive the full human-led loop on one behavior, then review the diff for design problems.

```text
I have written this failing test for splitEvenly (it distributes a remainder to
the earliest shares). Implement splitEvenly with the smallest code that passes it,
without modifying the test. After it passes, /review your own diff and list any
SOLID violations or edge cases my test does not cover.
```

#### Watch out

Codex often writes code that passes the single test by special-casing it, which looks green but is not general. Its self-`/review` may also miss the narrowness it just introduced. Treat the green bar as necessary, not sufficient -- you decide whether the implementation is actually general.

#### Verify

Confirm Codex did not modify your test and that the implementation is general, not fitted to your one example. Write a second case with different inputs and confirm it passes. If the test resists going green, raise `model_reasoning_effort` rather than relaxing the test. Record what `/review` caught and missed in your prompt journal.

### Knowledge Check

1. Why must the failing test be written by a human rather than by Codex?
   A model's test and code share blind spots, so the test cannot verify it.
   Because Codex is fundamentally unable to emit syntactically valid test code.
   Because a test typed by a human executes measurably faster in the runner.
   Because tests that Codex generates are effectively guaranteed to pass.
2. A test resists going green after two attempts. What is the correct response?
   Relax the test's assertion so the current code can pass it.
   Raise `model_reasoning_effort` so the model works harder on the same test.
   Delete the stubborn test and move on to the next behavior.
   Accept whatever code Codex last produced, even though the test is still red.
3. In the human-led loop, who owns the final approval of the diff?
   Codex, on the grounds that it authored the implementation.
   Whoever happened to open the pull request for the change.
   The engineer, who reviews the diff for design issues and refactors.
   The CI system, the very moment its automated checks have all gone green.
4. Codex makes your single test pass by hard-coding the example's exact numbers. What does that tell you?
   The implementation is now complete and fully general for all inputs.
   Your original failing test must have been written incorrectly.
   You should lower `model_reasoning_effort` and then rerun the implementation step.
   The green bar is necessary but not sufficient; add a test for generality.

## Topic 4 of 6: The test pyramid -- unit, integration, and end-to-end

### Why Do I Need to Know This?

Coverage numbers are meaningless if every test sits at one layer. Your team needs a shared sense of how many tests belong at each level, so the suite is fast where it should be fast and thorough where it must be -- and so the walking skeleton you build later inherits a sensible mix instead of a slow, top-heavy one.

### Scenario

Your team agrees its test-pyramid targets for the capstone: many fast unit tests, fewer integration tests, and a thin layer of end-to-end tests. As a preview of the walking skeleton, you write a couple of HTTP-layer tests with `supertest` so the shape is in place before the real API arrives.

### Theory

#### The shape and the trade-off

The pyramid has many unit tests at the base, fewer integration tests in the middle, and few end-to-end tests at the top. The trade-off is cost versus confidence: unit tests are fast and pinpoint failures but do not prove the parts work together; E2E tests prove the whole flow but are slow and brittle. A healthy suite is mostly fast tests with a thin layer of slow ones.

#### What each layer should and should not test

A unit test exercises one piece of logic in isolation -- no database, no network. An integration test checks that parts work together, such as a handler plus its validation or a query plus the schema. An E2E test drives the whole system as a user would. The common mistakes are inverting this: hitting a database in a "unit" test or re-testing pure logic through an E2E.

#### Where the cohort's tools land

Unit tests run in Vitest for TypeScript and pytest for Python. HTTP-layer tests use `supertest`, which sends requests to an Express app without a live network. That is the integration layer previewed now and built on later.

#### The test pyramid with the cohort's tools

- End-to-end: few, slow, full-flow, browser-driven.
- Integration: fewer, `supertest` at the HTTP layer.
- Unit: many, fast, Vitest and pytest.

Higher layers are slower and higher-confidence; lower layers are faster and cheaper.

### Example

#### A unit test and an HTTP-layer test for the same code

```ts
import { test, expect } from "vitest";
import request from "supertest";
import { computeTotal } from "./total";
import { app } from "./app";

// (1) UNIT: pure logic, no network -- fast, pinpoints the calculation.
test("computeTotal sums line items", () => {
  expect(computeTotal([{ amount: 40 }, { amount: 2 }])).toBe(42);
});

// (2) INTEGRATION (HTTP layer): supertest drives the Express app, no live port.
test("GET /total returns the computed total", async () => {
  const res = await request(app).get("/total?items=40,2");
  expect(res.status).toBe(200);
  expect(res.body.total).toBe(42);
});
```

Annotation (1): the unit test checks the calculation directly: no app, no HTTP, no database. It is fast and tells you exactly which logic broke. Annotation (2): the `supertest` test exercises routing, request parsing, and the response shape together, without opening a real network port. It is the integration layer.

### AI Practice

#### Prompt it

Ask Codex to classify proposed tests by pyramid layer, and check it does not push slow work into the unit layer.

```text
Classify each of these proposed tests as unit, integration, or end-to-end, and
say which tool fits (Vitest/pytest, supertest, or an E2E runner). Flag any test
that hits a database or network but is labeled "unit", and explain why that is
misplaced.
1. Sums an array of line items.
2. POSTs to /invoices and checks the JSON response.
3. Reads a row from Postgres and asserts the mapping.
4. Drives the full UI checkout flow in a browser.
```

#### Watch out

Codex sometimes labels a test that touches a database or the network as a "unit" test because the function name sounds small. A unit test does no I/O -- if it hits a database, it is at least an integration test. Check each classification against whether the test does I/O, not against the function's name.

#### Verify

Confirm test 1 is unit, test 2 is integration (HTTP), test 3 is integration (touches the database), and test 4 is end-to-end. Confirm Codex flagged any database or network test mislabeled as unit. Disagree where it is wrong and note the correction in your prompt journal.

### Knowledge Check

1. What is the cost-versus-confidence trade-off the pyramid encodes?
   Unit tests are fast and narrow; E2E tests are slow but prove the whole flow.
   Unit tests are slow but prove the whole system; E2E tests are fast but narrow.
   Every layer costs about the same to run, so the pyramid shape is arbitrary.
   Integration tests are the only layer genuinely worth the maintenance.
2. A test reads a row from PostgreSQL and asserts the mapping. What layer is it?
   A unit test, since it exercises a single mapping function.
   An integration test, because it exercises code with the database.
   An end-to-end test, because a real database sits behind the whole flow.
   Not a legitimate automated test of any recognized layer.
3. What does `supertest` let you do, and at which layer does it sit?
   Speed up the unit layer by letting its tests skip their assertions entirely.
   Drive a real Chromium browser through the full checkout UI.
   Send HTTP requests to an Express app with no live port -- integration.
   Serve as the Node replacement for pytest in Python test suites.
4. Why is hitting a database inside a "unit" test a mistake?
   Because unit tests are by definition never actually permitted to pass.
   Because a database simply cannot be exercised by any kind of automated test.
   Because the extra database rows would push line coverage above the 80% gate.
   Because a unit test does no I/O; a database makes it slow and flaky.

## Topic 5 of 6: Coverage as a floor, negative paths, and interaction versus state

### Why Do I Need to Know This?

Coverage at or above 80% is the week's exit number, but a suite can hit 80% and still break the first time a record is invalid -- because every test took the happy path. Your team treats coverage as a floor rather than a goal, makes negative-path tests a deliberate share of the suite, and learns when to assert on how a collaborator was called versus what the result was.

### Scenario

Your team's suite reports 85% coverage, then crashes the first time a record arrives invalid: every test was a happy path. You add negative-path tests until they are about a third of the suite, and you write one ArgumentCaptor test that asserts a collaborator was called with exactly the right arguments -- catching a bug that a return-value check would have missed.

### Theory

#### Coverage is a floor, not a ceiling

At least 80% line coverage on the touched module is the minimum to merge, not the target. Coverage tells you which lines ran, not whether you asserted the right things -- a suite can execute every line on happy-path inputs and verify nothing about failure. Treat the number as a gate you clear, then keep going.

#### Negative-path tests are a deliberate share

A negative-path test exercises invalid input, an error branch, or an edge case. Your team targets about 30% of the suite as negative-path tests, because that is where production breaks and where happy-path-only suites are blind. Invalid records, empty ranges, and out-of-bounds values each get a test that asserts the failure behaves correctly.

#### Interaction versus state assertions

A state-based test asserts the result -- the return value or the final state. An interaction test asserts how a collaborator was called -- that a function received exactly the expected arguments. In Vitest, `mock.calls` holds the arguments of each call and `toHaveBeenCalledWith` asserts them. Use state assertions when the result is what matters, and interaction assertions when the call itself is the behavior, such as an audit logger invoked with the right record id.

#### Two test lenses

- State-based test: the result is the behavior; use `expect(result).toBe(...)`.
- Interaction test: the call is the behavior, such as audit logging; use `expect(mock).toHaveBeenCalledWith(...)`.

### Example

#### A state assertion and an interaction assertion

```ts
import { test, expect, vi } from "vitest";
import { recordPayment } from "./payments";

// (1) STATE-BASED: assert the returned value.
test("recordPayment returns the new balance", () => {
  const audit = vi.fn();
  const result = recordPayment({ balance: 100 }, 30, audit);
  expect(result.balance).toBe(70);
});

// (2) INTERACTION: assert HOW the audit collaborator was called.
test("recordPayment logs the payment to the audit collaborator", () => {
  const audit = vi.fn();
  recordPayment({ balance: 100 }, 30, audit);
  expect(audit).toHaveBeenCalledWith({ type: "payment", amount: 30 });
});

// (3) NEGATIVE-PATH: assert the failure behaves correctly.
test("recordPayment rejects a negative amount", () => {
  const audit = vi.fn();
  expect(() => recordPayment({ balance: 100 }, -5, audit)).toThrow();
});
```

Annotation (1): the state-based test cares only about the result; the audit mock is present but not asserted on. Annotation (2): the interaction test captures the audit call's arguments with `toHaveBeenCalledWith`; this catches a bug where the balance is right but the audit record is wrong. Annotation (3): the negative-path test asserts the invalid input is rejected; this is the class of test a happy-path-only suite omits.

### AI Practice

#### Prompt it

Ask Codex to add negative-path tests to a happy-path suite, then verify each truly exercises a failure.

```text
This suite for recordPayment only covers happy paths. Add negative-path tests
until they are about 30 percent of the suite: cover a negative amount, a payment
larger than the balance, and a missing audit collaborator. Each test must assert
the failure behavior (a throw or an error result), not a success.
```

#### Watch out

Codex sometimes pads the count with tests that look negative but assert success -- for example, "handles zero" that still expects a normal return. A relabeled happy-path test does not exercise an error branch. Check that each added test asserts a throw or an error outcome, not a successful one.

#### Verify

Confirm each new test asserts a failure, not a success in disguise, and that negative-path tests are about 30% of the suite. Run coverage and confirm the touched module is at or above 80% -- and that the new tests cover error branches the happy-path tests missed. Record the coverage number and the negative-path share in your prompt journal.

### Knowledge Check

1. Your module reports 85% line coverage but crashes on the first invalid input. What does that reveal?
   Coverage counts lines run, not failure cases asserted -- it was happy-path only.
   The coverage tool is clearly broken and its reported number should be ignored.
   The module needs a full 100% line coverage before it can be considered safe.
   The crash proves the suite's tests were written in the wrong programming language.
2. When should you write an interaction test instead of a state-based one?
   Any time the function under test happens to return a value to its caller.
   When the call itself is the behavior -- an audit logger invoked correctly.
   Never, since state-based assertions already cover every possible case.
   Only in Python suites, because TypeScript lacks the captor capability.
3. Why does the team target roughly 30% of the suite as negative-path tests?
   To make the overall suite longer so it looks more thorough to reviewers.
   Because 30% is the maximum line coverage that the merge gate will permit.
   Because failure cases are where production breaks and happy paths are blind.
   Because negative-path tests reliably execute faster than the happy-path ones do.
4. Codex adds a test named "handles zero amount" that still expects a normal successful return. Does it count as a negative-path test?
   Yes, because its name clearly describes an edge case input.
   Yes, because every additional test improves the suite's coverage.
   Only when it manages to raise line coverage past the 80% gate.
   No -- it asserts a success, so it never exercises an error branch.
