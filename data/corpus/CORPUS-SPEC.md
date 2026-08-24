# Corpus Specification: Synthetic Rule Provisions And Advisory Playbook

## Scope

Generate 10 markdown documents for the TaxPulse retrieval lab:

- 6 synthetic rule provision documents.
- 4 synthetic advisory playbook guidance documents.
- Each document should be short, structured, and retrieval-friendly.
- The corpus is committed under `data/corpus/` because later retrieval evaluation depends on stable source text.

## Required Structure

Every document must include YAML front matter with:

- `synthetic: true`
- `fictional_issuer: Fictional TaxPulse Planning Board`
- `invented_rates_and_limits: true`
- `tenant_scope`
- `tenant_segment`
- `document_type`
- `document_id`

Every document must declare in prose that it is synthetic training material from a fictional authority and that all rates and limits are invented.

Every H2 and H3 section heading must begin with a stable synthetic identifier:

- Rule provisions: `TPX-RP-###-X`
- Playbook entries: `TPX-PB-###-X`

The identifier scheme is intentionally fictional and must not resemble or claim to be a real tax code citation.

## Required Content Properties

- 10 total markdown documents, excluding this spec.
- Identifiers must be unique across the corpus.
- At least 5 sections must carry threshold tables with real numeric values.
- At least 3 near-duplicate provision pairs must exist and be marked.
- One superseded provision and its replacement must exist with effective dates.
- Tenant metadata must appear in each document front matter.
- All documents must be labelled synthetic.

## Decisions To Complete Before Generation

- Fictional issuer: `Fictional TaxPulse Planning Board`
- Tenant metadata fields and allowed values:
  - `tenant_scope`: `tenant-alpha-advisory`, `tenant-beta-family-office`, `tenant-gamma-ria`, `tenant-all`
  - `tenant_segment`: `RIA`, `MFO`, `HNW`, `All`
- Stable section-identifier pattern:
  - Rule provisions: `TPX-RP-###-X`
  - Playbook entries: `TPX-PB-###-X`
- Documents and policy areas:
  1. `TPX-RP-001` single filer advisory deduction reserve
  2. `TPX-RP-002` joint filer advisory deduction reserve
  3. `TPX-RP-003` liquidity buffer contribution limit
  4. `TPX-RP-004` liquidity buffer alternate limit
  5. `TPX-RP-005` superseded and replacement transition rule
  6. `TPX-RP-006` timing-safe charitable bunching cap
  7. `TPX-PB-007` client intake retrieval playbook
  8. `TPX-PB-008` scenario comparison playbook
  9. `TPX-PB-009` client approval playbook
  10. `TPX-PB-010` audit citation playbook
- Table-bearing section identifiers:
  - `TPX-RP-001-B`
  - `TPX-RP-002-B`
  - `TPX-RP-003-B`
  - `TPX-RP-004-B`
  - `TPX-RP-005-B`
  - `TPX-RP-005-C`
  - `TPX-RP-006-B`
- Near-duplicate section pairs and one material difference:
  - `TPX-RP-001-B` and `TPX-RP-002-B`: filing status differs only (`single` vs `joint`)
  - `TPX-RP-003-B` and `TPX-RP-004-B`: contribution limit differs only (`52000` vs `58000`)
  - `TPX-RP-005-B` and `TPX-RP-005-C`: effective status differs only (`superseded` vs `replacement`)
- Superseded and replacement section identifiers:
  - Superseded: `TPX-RP-005-B`, effective `2025-01-01` through `2025-12-31`
  - Replacement: `TPX-RP-005-C`, effective `2026-01-01`

## Required Labelling

Every document declares itself synthetic training content from the Fictional TaxPulse Planning Board and states that its rates and limits are invented.
