# Week 9 Day 3 Task 1 Corpus Acceptance Evidence

Verified on 2026-08-24.

## Corpus

- Completed `data/corpus/CORPUS-SPEC.md`.
- Generated 10 committed synthetic markdown documents:
  - 6 rule provision documents using `TPX-RP-###-X` section identifiers.
  - 4 advisory playbook documents using `TPX-PB-###-X` section identifiers.
- Fictional issuing authority: `Fictional TaxPulse Planning Board`.
- Every document includes tenant metadata in front matter.
- Every document labels itself synthetic training material and states that rates and limits are invented.
- The identifier scheme is intentionally synthetic and non-statutory.

## Acceptance Check

Implemented `services/retrieval/corpus_check.py` to verify:

- document count is 10-12;
- every H2/H3 section has a stable synthetic identifier;
- section identifiers are unique corpus-wide;
- tenant metadata is present and constrained to the chosen allowed values;
- synthetic label and invented-rates disclaimer are present on every document;
- at least 5 sections carry numeric threshold tables;
- required table-bearing section identifiers are present;
- 3 near-duplicate provision groups exist;
- the superseded provision and replacement provision exist with effective dates.

## Commands

```text
python -m py_compile services/retrieval/corpus_check.py
```

```text
python services/retrieval/corpus_check.py
Corpus acceptance check PASSED
```
