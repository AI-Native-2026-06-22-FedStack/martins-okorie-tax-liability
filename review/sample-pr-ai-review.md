# Sample PR AI Review

## Sample AI Review Output

AI review is useful as a first pass over the mechanical layer of a pull request. A typical
review might report:

- The PR description should link the governing ADR.
- A test name does not describe the negative path it covers.
- A nullable value is used before it is checked.
- A generated example should use synthetic TaxPulse identifiers.

## What AI Review Caught

- Style and consistency issues.
- Obvious null or undefined handling gaps.
- Simple test coverage gaps visible from the diff.
- Documentation claims that do not match the changed files.

## What AI Review Missed

AI review can miss bugs that look plausible in code:

- Domain logic that computes the wrong tax-liability result for the business rule.
- Authorization checks that use the wrong condition.
- Security behavior that appears structured but grants access too broadly.
- Intent that is not stated in the diff or pull request description.

## Human Follow-Up Checklist

- Trace domain logic with concrete synthetic examples.
- Verify a non-owner, non-admin user cannot access another client's data.
- Confirm tests prove the intended behavior rather than merely exercising code paths.
- Reject AI suggestions that delete assertions, bypass tests, or weaken security.
- Record accepted and rejected AI suggestions in the active prompt journal.

## Prompt Journal Note

Record the AI review summary, any missed issue found by the human reviewer, whether the
AI output was accepted or rejected, and why.
