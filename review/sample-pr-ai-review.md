# Sample PR — Stage Transition Validator

## Summary

Adds a pure Tax Plan Cycle stage-transition validator and tests the boundary behavior with
red-green-refactor evidence. The validator allows adjacent forward workflow movement,
allows the `Review` to `Modeling` send-back, rejects skipped transitions, and rejects
representative non-allowed backward moves.

## Related ADR

ADR: [0001: Keep a Tax Plan Cycle's condition in its stage](../docs/adr/0001-tax-plan-cycle-stage-only-condition.md)

## Testing

- `npm test`
- `npm run typecheck`
- `npx vitest run --coverage`

Coverage output:

```text
RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability
     Coverage enabled with v8

✓ src/typescript/stage-transition.test.ts  (3 tests) 2ms
✓ src/typescript/tax-liability.test.ts  (4 tests) 9ms

Test Files  2 passed (2)
     Tests  7 passed (7)
  Start at  05:49:34
  Duration  326ms (transform 44ms, setup 0ms, collect 58ms, tests 11ms, environment 0ms, prepare 95ms)

% Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |     100 |      100 |     100 |     100 |
 ...-transition.ts |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

Red-green-refactor commit log:

```text
852fecf refactor(tax-plan-cycle): consolidate stage transition rules
9ebb8f3 feat(tax-plan-cycle): allow review send-back transition
da818e4 test(tax-plan-cycle): pin review send-back transition
29accbc feat(tax-plan-cycle): implement stage transition validator
a0f290e test(tax-plan-cycle): pin stage transition validator
cd0dee2 reviewing the pr-ai-review.md file for the m1d4-implementation branch.
```

## AI review evidence

AI review output:

```text
Codex review of the local stage-transition diff:
- No blocking issues found in the validator implementation or tests.
- The first boundary test was committed before implementation and failed for the right reason: the validator module did not exist yet.
- The green implementation stayed minimal by adding only the behavior needed for the red test.
- The send-back edge case is covered: Review -> Modeling is allowed, while representative non-allowed backward moves are rejected.
- Coverage is enforced for src/typescript/stage-transition.ts with 80% lines/functions/branches thresholds and currently reports 100% for statements, branches, functions, and lines.
```

What it missed:

```text
Codex initially suggested broad workflow concerns such as role gating, audit events,
hold-state behavior, schemas, errors, and workflow services. Those are real TaxPulse
requirements later, but they are not covered by this validator's current tests. The human
review decision was to reject that extra scope so the green step stayed minimal and did
not ship untested behavior under a passing suite.
```

## AI-tool reflection

I accepted Codex's minimal typed transition-map suggestion because it keeps the validator
pure and makes the forward, skipped, and `Review` send-back rules easy to audit in one
place. I rejected broader workflow-service behavior such as role gates, audit logging,
hold handling, schemas, and custom errors because none of the current tests pin those
contracts down, and adding them here would blur the red-green-refactor evidence.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli` as the ES reviewer.

## AI code-review checklist

- [X] stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [X] Workflow changes keep stage transitions gated by current stage in the pure validator; role gating is intentionally not added in this tested helper.
- [X] typed boundaries are preserved with the existing TypeScript schema patterns.
- [X] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [X] Tests or documented verification cover the changed behavior, including skipped transitions and rejected backward moves.
- [X] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [X] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

## Deliverables checklist

- [X] Coverage summary is pasted above as a code block.
- [X] Red-green-refactor git log is pasted above as a code block.
- [X] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [X] Deliverables checklist is included and completed.
- [X] PR is self-assigned in Assignees.
- [X] `Isaiah Muli` is requested under Reviewers as the ES reviewer.
