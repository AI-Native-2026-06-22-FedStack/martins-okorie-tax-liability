# 1. Keep a Tax Plan Cycle's condition in its stage

- Status: Accepted

## Context

TaxPulse uses a Tax Plan Cycle as the primary case entity for each client and planning
period. A cycle moves through the workflow stages `Intake`, `Data Aggregation`,
`Modeling`, `Review`, `Client Approval`, `Executed`, and `Archived`.

The cycle needs to show where the case stands without creating competing state fields.
The MVP also needs pauses and overdue indicators, but it does not include SLA timers,
escalation routing, background jobs, or a separate overdue queue.

## Decision

Represent a Tax Plan Cycle's condition with its workflow stage. Do not add a separate
case status field.

Use `on_hold` plus `hold_reason` for pauses that are independent of stage. Use
`due_date` comparison for overdue indicators when a cycle is past due.

## Consequences

- Stage transition logic must gate by current stage and role.
- Second-pair review remains a normal role-gated transition rather than a separate status.
- Denied and accepted transition attempts must be recorded in the audit trail and
  stage-transition log.
- UI and API behavior should derive overdue indicators from `due_date`, not from a stored
  overdue status.
- Reporting can group cycles by stage without reconciling a second case-status field.
- The MVP intentionally does not need SLA timers, escalation routing, background jobs, or a
  separate overdue queue.

## Alternatives considered

- Add a separate `status` field for open, pending, blocked, overdue, and closed conditions.
  Rejected because it would duplicate workflow stage and create conflicting state.
- Add an overdue status or queue. Rejected for the MVP because overdue can be derived from
  `due_date`, and SLA/escalation workflows are out of scope.
- Add granular SLA and escalation state. Rejected because the MVP scope does not include
  background jobs or escalation routing.
