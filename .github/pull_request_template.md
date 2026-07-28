## Summary

<!-- What changed? Keep this concise and grounded in the diff. -->

## Related ADR

<!-- Link the relevant ADR if this PR changes or implements an architectural decision. Use N/A only when no architectural decision changes. -->

ADR:

## Testing

<!-- List only checks, tests, or manual verification actually performed. -->

## AI review evidence

Paste the sample PR AI-review output as a quote or code block:

```text
<pasted Codex review>
```

Paste the "what it missed" note as a quote or code block:

```text
<issue the AI missed or got wrong, and how the checklist or a human catches it>
```

## AI-tool reflection

<!-- One paragraph: name one Codex suggestion accepted and why, and one rejected and why. -->

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli`.

## AI code-review checklist

- [ ] stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [ ] Workflow changes keep stage transitions gated by role and current stage.
- [ ] typed boundaries are preserved with the existing TypeScript schema or Python Pydantic validation patterns.
- [ ] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [ ] Tests or documented verification cover the changed behavior, including relevant negative paths.
- [ ] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [ ] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

## Deliverables checklist

- [ ] Summary explains what changed.
- [ ] Related ADR is linked, or `N/A` is stated for no architectural decision change.
- [ ] Testing lists only checks or verification actually performed.
- [ ] AI code-review checklist is completed.
- [ ] AI review output is pasted above as a quote or code block.
- [ ] "What it missed" note is pasted above as a quote or code block.
- [ ] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [ ] PR is self-assigned in Assignees.
- [ ] `Isaiah Muli` is requested under Reviewers.
