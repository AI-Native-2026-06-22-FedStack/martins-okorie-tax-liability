 Topic 1 of 5
Trunk-based development, short-lived branches, and conventional commits
Why Do I Need to Know This?
Your team now has two services and four engineers committing to one repository, so the way you branch and commit decides whether the history stays readable and releasable. Trunk-based development with conventional commits is the discipline a federal reviewer expects, and it is what release-automation tools (like semantic-release) read to choose the next version number — get it wrong now and every release after is harder to trace.

Scenario
Your team turns on branch protection so no one can push to main directly, agrees that a branch lives hours rather than weeks, and configures commitlint so a commit message that does not follow the convention is rejected before it lands. The first time someone types git commit -m "stuff", the hook stops them and explains why.

Theory
Trunk-based development and short-lived branches
Trunk-based development means everyone integrates into one main branch frequently, through small, short-lived branches that merge back the same day. The alternative — long-lived feature branches — accumulates merge conflicts and hides work from the team until a painful, risky merge. A federal delivery cadence cannot absorb that risk, so branches stay small and merge fast.

!
Important
Direct pushes to main are blocked by branch protection. Every change lands through a pull request with required checks. This is not a style preference — it is the control that guarantees nothing reaches the main line without review and green tests.

Conventional commits map to SemVer (Semantic Versioning)
A conventional commit has a type and a short description: feat: add multi-state allocation endpoint. The type drives automated versioning later (Conventional Commits v1.0.0):

fix: → a PATCH release (a bug fix)
feat: → a MINOR release (a new feature)
a BREAKING CHANGE: footer (any type) → a MAJOR release
Other types — docs:, test:, chore:, refactor: — do not trigger a release but keep the history scannable.

Enforcement happens locally and on the server
Two layers keep the convention honest. Locally, Husky runs a Git hook (a script Git runs automatically at commit time) that calls commitlint to reject a malformed commit message, and lint-staged runs formatters on staged files before the commit. On the server, branch protection blocks a direct push to main and requires the Pull Request (PR) checks to pass. The local layer gives fast feedback; the server layer is the guarantee.

Short-lived branches versus a drifting long-lived branch
Two small branches that merge back the same day, contrasted with one long-lived branch drifting away from main.

main

feat/income-endpoint (hours)

fix/rounding (hours)

feature/big-rewrite (weeks)

Example
commitlint rejects a bad message

# commitlint.config.js

# module.exports =;

# (1) A non-conventional message is rejected by the Husky commit-msg hook.

$ git commit -m "stuff"
⧗   input: stuff
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
✖   found 2 problems, 0 warnings
husky - commit-msg hook exited with code 1 (error)

# (2) A conventional message passes.

$ git commit -m "feat: add multi-state allocation endpoint"
[feat/alloc 1a2b3c4] feat: add multi-state allocation endpoint
Copy
Annotation (1) — the commit-msg hook runs commitlint, which rejects "stuff" because it has no type and no valid subject; the commit never lands.
Annotation (2) — feat: ... matches the convention, so the commit succeeds and is ready to drive a MINOR version bump later.
AI Practice
Prompt it
Have Codex draft a conventional-commit message for your staged changes, then verify the type before committing.

Here is the staged diff (git diff --cached). Write a single Conventional Commits
message for it: a type (feat, fix, docs, test, chore, or refactor), an optional
scope, and a concise subject under 72 characters. If the diff is a bug fix, use
fix; if it adds behavior, use feat. Do not invent changes the diff does not show.
Copy
Watch out
Codex tends to label everything feat:, even pure refactors or doc edits, which would trigger a wrong version bump. It also sometimes writes a subject describing what it would do rather than what the diff actually does. Check the type matches the change and the subject matches the diff.

Verify
Confirm the chosen type matches the change (a bug fix is fix:, not feat:), and that the subject describes what the diff actually does. Commit it and confirm the Husky hook accepts it. If commitlint rejects it, read the rule it names and fix the message. Record the type you chose and why in your prompt journal.

Knowledge Check

1. Why does your team keep branches short-lived and merge them the same day?
   Long-lived branches accumulate merge conflicts and hide work in progress.
   Git slows down measurably once a branch is more than a day old.
   Short branches keep the repository’s disk footprint smaller for nightly backups.
   Branch protection garbage-collects branches that go stale past a day.
2. A commit adds a brand-new endpoint. Which conventional commit type drives the correct version bump?
   fix: — which maps to a MINOR release.
   feat: — which maps to a MINOR release.
   chore: — which maps to a MAJOR release.
   docs: — which maps to a PATCH release.
3. What is the difference between the local hooks and branch protection?
   They are the same control configured redundantly in two places.
   Branch protection runs on each developer’s laptop, while the Husky hooks run on the GitHub server.
   Local hooks replace pull requests entirely by validating the merge before it can happen.
   Local hooks give fast pre-commit feedback; branch protection is the server-side guarantee.
4. A change introduces a backward-incompatible API change. How is that signaled for versioning?
   Use a dedicated break: commit type so the tooling maps it to MAJOR.
   Bump the version field in package.json by hand and commit that change.
   Add a BREAKING CHANGE: footer, which maps to a MAJOR release.
   Note "breaking change" in the PR description and leave the commit message as-is.
   2
   Topic 2 of 5
   Pull Request (PR) hygiene and the code review checklist
   Why Do I Need to Know This?
   A pull request is the unit that both a reviewer and a closed-book check judge, so a small, well-described, linked PR is itself a deliverable, not just plumbing. Your team needs one shared checklist so that review quality does not depend on which of the four engineers happens to look at it.

Scenario
A teammate opens a 600-line pull request with the description "fixes stuff." Your team sends it back and adopts a standard: keep the diff small, write a description that explains the why, link the governing ADR (Architecture Decision Record — a short document capturing why a technical choice was made, introduced in the next topic), and review against four fixed dimensions before anyone approves.

Theory
PR hygiene: small, described, linked
Three habits make a PR reviewable. Keep the diff small so a reviewer can hold it in their head. Write a description that explains the why, not just the what — the diff already shows the what. Link the ADR that governs the decision, so the reasoning is one click away. A 600-line "fixes stuff" PR fails all three and wastes the reviewer’s time.

The four review dimensions
Every reviewer checks the same four things, so reviews are consistent and auditable:

Correctness — does it do what the description claims, including edge cases?
Security — does it leak data, weaken auth, or trust unvalidated input?
Observability — can you tell from logs and errors what happened in production?
Tests — are the changes covered, including the negative paths?
Why a checklist beats taste
In a four-engineer federal team, ad-hoc review means each reviewer checks whatever they happen to notice. A shared checklist makes review consistent across people and produces an audit trail — a reviewer can show which dimensions they checked, which matters when the evidence packet is assessed.

The PR review checklist
The hygiene rules and the four dimensions every reviewer applies before approving.

A reviewable PR

PR hygiene

Four review dimensions

Small diff

Description explains the why

Links the governing ADR

Correctness

Security

Observability

Tests

Example
a well-formed pr description versus a one-liner

<!-- (1) Rejected: no why, no scope, no link. -->

fixes stuff

<!-- (2) Accepted: summary, why, linked ADR, testing notes. -->

## Summary

Add the multi-state allocation endpoint (GET /allocations).

## Why

Implements the allocation slice from ADR-0001 (locked stack). Unblocks the
dashboard work in the next module.

## Changes

- New route + handler in apps/api
- Shared AllocationResult type in packages/shared-types

## Testing

- 4 unit tests incl. two negative paths (unknown state, empty range)
- Linked decision: ADR-0001
  Copy
  Annotation (1) — "fixes stuff" gives the reviewer nothing: no scope, no reason, no link to the decision it implements.
  Annotation (2) — the structured description states the why, lists the changes, links ADR-0001, and notes the tests, so a reviewer can check all four dimensions quickly.
  AI Practice
  Prompt it
  Have Codex draft a PR description from your diff using the team template, then verify it links the ADR and covers the four dimensions.

Write a pull request description for this diff using our template with these
sections: Summary, Why, Changes, Testing. In Why, reference the governing ADR by
id (ADR-0001). In Testing, list the tests including any negative-path tests. Base
every statement on the diff — do not claim changes or tests that are not present.
Diff: <paste git diff here></paste>
Copy
Watch out
Codex often invents tests that do not exist ("added comprehensive tests") and omits the ADR link unless told to include it. It may also restate the diff line-by-line instead of explaining the why. Confirm every claimed test is real, the ADR is linked, and the Why explains intent rather than echoing the code.

Verify
Check the description against the diff: every change listed is in the diff, every test claimed actually exists, and the ADR id is present and correct. Then walk the four dimensions — correctness, security, observability, tests — and confirm the PR gives you what you need to judge each. Record any claim Codex invented in your prompt journal.

Knowledge Check

1. Why is linking the governing ADR part of PR hygiene?
   It puts the reasoning behind the change one click from the reviewer.
   It pads the PR with extra context, and longer PRs read as more thorough.
   It signals the decision is final, so the PR is approved automatically.
   It documents the change well enough that tests become optional.
2. Which set of concerns are the four review dimensions?
   Merge speed, CI cost, code style, and total diff length.
   Syntax, indentation, naming conventions, and inline comments.
   Correctness, security, observability, and tests.
   Branch name, commit count, PR author, and the date opened.
3. Why does the team use a shared review checklist instead of letting each reviewer use judgment?
   Because reviewer judgment is never useful and should be removed.
   Because Git’s branch protection requires a checklist before merge.
   Because adding more required review steps is meant to slow merges down.
   So reviews are consistent across engineers and leave an audit trail.
4. A PR is 600 lines with the description "fixes stuff." What is the right response?
   Send it back to be split into smaller, described, ADR-linked diffs.
   Approve it as long as the full CI test suite is passing green.
   Approve it now but leave a comment asking for a better description next time.
   Quietly rewrite it into clean commits yourself and merge it.
   3
   Topic 3 of 5
   Architecture Decision Records in MADR format
   Why Do I Need to Know This?
   Your team is locking a stack this week, and a federal evidence packet needs the reasoning, not just the result. An architecture decision record captures why the stack was chosen so a future engineer — or an auditor — can see the trade-offs that were weighed instead of guessing at them later.

Scenario
Your team writes ADR-0001, "Stack — Express + Postgres + Python + Codex + AWS," using the MADR sections, and the author defends it to the instructor in a five-minute walkthrough. The hardest question is not "what did you pick" but "what did you give up" — which is exactly what the Consequences section records.

Theory
The MADR sections
MADR (Markdown Architectural Decision Records) structures a decision into a few sections (MADR):

Status — proposed, accepted, or superseded.
Context — the forces and the problem that made a decision necessary.
Decision — what was chosen, stated plainly.
Consequences — what follows, both the benefits and the costs you now accept.
Consequences is the section reviewers read first
A decision without its downsides reads like marketing. The Consequences section — including the negative consequences — is what an experienced reviewer reads first, because it shows you understood the trade-off. "We chose Postgres everywhere; consequence: the brownfield stored-procedure lab runs on Postgres, not the legacy engine, so some vendor-specific behavior is out of scope" is a real consequence, not a slogan.

Link the ADR from the PR that implements it
An ADR is not a write-once document filed away. The pull request that implements a decision links back to its ADR, closing the loop with PR hygiene: the reviewer sees the decision, the reasoning, and the code together.

The ADR-0001 skeleton
The four MADR sections with one line of guidance for what belongs in each.

Status

Context

Decision

Consequences - read first

Example
adr-0001 in madr format

# ADR-0001: Stack — Express + Postgres + Python + Codex + AWS

## Status

Accepted

## Context

The capstone needs a polyglot backend (Node + Python), a relational store, an
approved AI assistant, and a federal-ready cloud target. The program locks the
stack so one rubric grades all four teams.

## Decision

Use Express (Node 24 + TypeScript) and FastAPI (Python 3.13) over PostgreSQL,
with OpenAI Codex as the only AI assistant, deployed to AWS via Terraform.

## Consequences

- Positive: one shared rubric; reproducible grading; mainstream, well-documented tools.
- Negative: Postgres everywhere means the brownfield stored-procedure lab runs on
  Postgres, not the original legacy engine — some vendor-specific behavior is out of scope.
- Negative: locking to one AI vendor (Codex) means no cross-tool comparison this cohort.
  Copy
  The Status and Context set up why a decision was needed at all.
  The Decision states the choice in one readable sentence per part of the stack.
  The Consequences lists real costs — the Postgres-only lab and the single-vendor lock — which is what the instructor walkthrough probes.
  AI Practice
  Prompt it
  Have Codex draft the ADR from a decision summary, then strengthen the Consequences section by hand.

Draft ADR-0001 in MADR format (sections: Status, Context, Decision, Consequences)
for this decision: "Lock the stack to Express + FastAPI over PostgreSQL, OpenAI
Codex as the only AI assistant, deployed to AWS with Terraform." In Consequences,
list at least two negative consequences, not only benefits. Keep it under one page.
Copy
Watch out
Codex usually writes a glowing Consequences section that lists only benefits, because the prompt "sounds positive." The negative consequences are the ones that matter to a reviewer, and they are exactly what Codex tends to understate. Expect to write or sharpen the negatives yourself.

Verify
Confirm all four MADR sections are present and the Consequences section names at least two real costs (for example, the Postgres-only brownfield lab, the single-AI-vendor lock), not just benefits. Edit the Consequences by hand if Codex understated them, and record in your prompt journal what it left out.

Knowledge Check

1. Which MADR section does an experienced reviewer read first, and why?
   Status, because it tells them whether the ADR has been accepted yet.
   Consequences, because its negatives show the trade-off was understood.
   Context, because it is usually the longest and most detailed ADR section.
   Decision, because the chosen option is the only part that matters.
2. What belongs in the Context section of an ADR?
   The actual code that implements the decision being recorded.
   A catalog of every candidate library with its exact version number.
   The reviewer’s name and sign-off approving the decision.
   The forces and problem that made a decision necessary.
3. Why link the ADR from the pull request that implements it?
   Because the linked ADR makes the PR’s required CI checks pass.
   So the reviewer sees the decision, its reasoning, and the code together.
   Because an ADR would otherwise be impossible for anyone to locate in the repository.
   Because the linked ADR can stand in for the PR description.
4. Codex drafts an ADR whose Consequences section lists only benefits. What should you do?
   Accept it as written, since a well-chosen decision has no real downsides.
   Delete the Consequences section so the ADR stays short and readable.
   Add the real negative consequences by hand and record what Codex omitted.
   Switch the Status to "proposed" so the missing downsides do not count yet.
   4
   Topic 4 of 5
   AI-assisted review — what Codex catches and what it misses
   Why Do I Need to Know This?
   Codex’s built-in /review command — which reads a diff and reports findings — is fast and tireless, but trusting it blindly is how a security bug ships behind a green check. Your team needs a realistic model of what an AI reviewer is good at and what it systematically misses, because you own the final approval — the tool does not.

Scenario
Your team runs Codex /review on a deliberately bad pull request. Codex flags the style issues and a missing null check, but misses a logic bug that lets a request bypass an authorization check. Your team finds it by hand, and records both the catch and the miss in the prompt journal — proof that the human, not the tool, owns the approval.

Theory
What /review reliably catches
Codex /review reads the diff for a chosen commit and reports prioritized findings (Codex docs). It is reliably good at the mechanical layer: style and consistency, obvious null and undefined handling, simple correctness mistakes, and tests it can infer are missing. For this class of issue, an AI reviewer is a fast, tireless first pass.

What it systematically misses
The misses cluster where understanding the intent matters:

Domain logic bugs — code that is syntactically fine but computes the wrong thing for the business rule.
Security bypasses that "look correct" — an auth check that passes the wrong condition, which reads as plausible code.
Intent the diff does not state — the reviewer sees the change, not what the change was supposed to accomplish.
!
Important
A green AI review is not approval. Codex misses domain-logic and security bugs that look correct. Reject any Codex suggestion that bypasses tests or weakens security, and never let an AI review substitute for a human reading the change against its intent.

The rule, and the audit trail
Two practices make AI review safe. First, reject any suggestion that bypasses tests or weakens security, no matter how confident the tool sounds. Second, record every accept and reject decision in the prompt journal — that log is the evidence that a human judged the AI’s output rather than rubber-stamping it.

Where the AI review ends and the human review begins
A diff goes through /review; some issues are caught by Codex, others only a human catches, and both feed the final human approval.

PR diff

Codex /review

Codex-caught: style, nulls, simple bugs

Human-must-catch: logic, security, intent

Human approval

Example
a bug codex misses
// A deliberately bad diff: the auth check looks correct but is inverted.

function canViewReturn(user: User, ret: TaxReturn): boolean {
  // (1) Codex flags: "consider null-checking user.role" — a real but minor note.
  // (2) Codex MISSES: this returns true for the wrong case — it grants access
  //     when the user is NOT the owner and NOT an admin.
  return user.id !== ret.ownerId || user.role !== "admin";
}

// Correct logic: grant access only to the owner OR an admin.
//   return user.id === ret.ownerId || user.role === "admin";
Copy
Annotation (1) — Codex reliably catches the mechanical note about null-checking user.role.
Annotation (2) — the inverted condition is a security bypass that reads as plausible code; Codex’s review passes it, and only a human checking the logic against intent catches that it grants access to the wrong people.
AI Practice
Prompt it
Run Codex /review on a seeded bad PR, then find at least one bug it missed.

Run /review on the current diff. List every finding it reports. Then, separately,
read the authorization logic in canViewReturn by hand and tell me whether it grants
access to exactly the owner or an admin — trace it with a concrete example user.
Do not assume the /review output is complete.
Copy
Watch out
Codex /review will report the style and null-handling notes confidently and may end with an approving tone, which is easy to mistake for "this PR is safe." It rarely flags an inverted-but-plausible auth condition. Treat the review as a first pass over the mechanical layer, not a verdict on correctness or security.

Verify
For the auth function, trace a concrete example: a non-owner non-admin user must get false. If the condition returns true for them, it is a bypass Codex missed — fix it and reject any Codex suggestion that did not. Record both what /review caught and the bug it missed in your prompt journal.

Knowledge Check

1. Which kind of issue is Codex /review most reliable at catching?
   Domain logic that quietly computes the wrong business result.
   Style, obvious null/undefined handling, and simple correctness slips.
   Authorization bypasses where the check reads as plausible code.
   Whether the change actually matches the author’s original unstated intent.
2. Why is a "green" Codex review not the same as approval?
   Because Codex never surfaces any genuinely real issues in a diff.
   Because a green review coming from the tool is in practice always wrong.
   Because Codex cannot actually parse and read a pull-request diff.
   Because it misses domain-logic and security bugs that look correct.
3. A reviewer sees return user.id !== ret.ownerId || user.role !== "admin"; for "can view." How should they test it?
   Trust the Codex review here, since it did not flag this particular line as a problem.
   Approve it because the TypeScript compiler accepts the expression.
   Trace a concrete non-owner, non-admin user and confirm the result is false.
   Leave a review comment noting the concern and merge the PR anyway.
4. Codex suggests a change that makes a failing test pass by deleting the assertion. What is the correct action?
   Reject it, fix the code properly, and log the rejection in the prompt journal.
   Accept it, since the previously failing test now reports green.
   Accept the change but add a TODO comment promising to restore the assertion later.
   Disable the whole test file so the suite goes green for the merge.
