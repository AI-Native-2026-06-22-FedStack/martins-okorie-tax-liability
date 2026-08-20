# Week 8 · Day 3: The Secure-PR Gate

> **Last Updated:** 2026-08-10 23:56:14 UTC  
> **Commit:** [8db241a7](https://git.uptimecrew.com/wisam.naji/ai-native-curriculum/-/blob/8db241a7f8362f04b3aec11d0cef1344dbeef8d6/curriculum_fs/Module8/Lesson3/lesson.lms.md)

Build the GitHub Actions secure-PR gate — OIDC to AWS with no long-lived keys, then SAST (Semgrep, ESLint-security, Bandit), SCA (OSV-Scanner, Dependabot), and secret scanning (Gitleaks) all required to merge — with SARIF as the federal evidence format and a deliberate failing-then-fixed Gitleaks regression that proves the gate works.

---

## Topic 1 of 5: GitHub Actions fundamentals and OIDC to AWS

### Why Do I Need to Know This?
Every gate in this lesson runs as a GitHub Actions job, and any job that touches AWS has to authenticate. The federal rule is that CI carries no long-lived `AWS_ACCESS_KEY_ID` — a stored key is a standing breach waiting to leak. Instead CI proves its identity to AWS with OIDC and receives short-lived credentials scoped to the one workflow run. Get this right first, because 8.4 The Secure-Release Gate runs on the same foundation.

### Scenario
The team’s first CI workflow stores a permanent AWS access key as a repository secret so a job can read from S3. The review rejects it: that key never expires, and anyone who can read the repo’s secrets — or a compromised action — now holds standing AWS access. The team replaces it with OIDC, so the workflow assumes an IAM role and gets credentials that expire when the run ends, with no key stored anywhere.

### Theory
- **Workflows, jobs, and steps**: A workflow is triggered by an event — a pull request, a push. It runs jobs, and each job is a sequence of steps. The secure-PR gate is one workflow whose jobs are the scanners, all triggered on every PR.
- **OIDC gives short-lived credentials, no stored key**: OIDC lets a workflow prove who it is without a secret. GitHub’s OIDC provider issues a signed token unique to the run; the `aws-actions/configure-aws-credentials` action exchanges it for temporary AWS credentials by assuming an IAM role ([configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)). Nothing long-lived is stored. Two pieces make it work: the job sets `permissions: id-token: write` so GitHub will mint the token, and the IAM role’s trust policy restricts which repository, and in which trigger context, may assume it via the `token.actions.githubusercontent.com:sub` condition.
- **Trigger Context & Claims**: The `:sub` value is not a branch name — it names the event that started the run. A workflow triggered on `pull_request` presents `repo:ORG-NAME/REPO-NAME:pull_request`; a workflow triggered by a push to a branch presents `repo:ORG-NAME/REPO-NAME:ref:refs/heads/main`. Write the condition to match the trigger your job actually runs on, or the assume-role is denied ([OIDC token claims](https://docs.github.com/en/actions/reference/security/oidc)).

> [!IMPORTANT]
> `id-token: write` is not write access to your infrastructure. It only lets the run request an identity token from GitHub’s OIDC provider. The actual AWS permissions come from the IAM role you assume — scope that role tightly, because the trust policy is what stops another repo from assuming it.

#### OIDC versus a stored access key
```
[GitHub Actions job (id-token: write)] --(request token)--> [GitHub OIDC provider]
[GitHub Actions job] <--(signed token for this run)-- [GitHub OIDC provider]
[GitHub Actions job] --(assume role with token)--> [AWS STS (trust policy checks repo + trigger context)]
[GitHub Actions job] <--(short-lived credentials)-- [AWS STS]

Rejected: AWS_ACCESS_KEY_ID stored as a repo secret (never expires, can leak)
```

### Example: A job that assumes a role via OIDC
```yaml
permissions:
  id-token: write # (1) lets the run request an OIDC token from GitHub
  contents: read

jobs:
  plan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: aws-actions/configure-aws-credentials@v6 # (2) exchange the token for AWS creds
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }} # (3) scoped IAM role, from a repo variable
          aws-region: us-east-1
      - run: aws sts get-caller-identity # (4) proves the role was assumed, no key
```
- **Annotation (1)** — `id-token: write` is required for GitHub to mint the OIDC token; without it the exchange fails. It does not grant any AWS access by itself.
- **Annotation (2) and (3)** — the action assumes `role-to-assume`; the role’s trust policy limits which repo and trigger context may assume it, so a fork or another repo cannot. The ARN is a repository variable, not a secret — an ARN identifies a role, it does not authenticate to it, and treating it as a secret obscures that distinction.
- **Annotation (4)** — the job calls AWS with temporary credentials that expire at the end of the run; there is no `AWS_ACCESS_KEY_ID` anywhere in the repo.

### AI Practice
- **Prompt it**:
  > Write a GitHub Actions workflow job that authenticates to AWS using OIDC: set the `id-token: write` permission, use `aws-actions/configure-aws-credentials` with a `role-to-assume` (no `AWS_ACCESS_KEY_ID` secret), and run `aws sts get-caller-identity` to confirm. Then describe the IAM trust policy condition that limits which repo and branch can assume the role.
- **Watch out**: Codex sometimes falls back to storing `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as repository secrets, or forgets the `id-token: write` permission so the OIDC exchange silently fails and it "fixes" it by adding a stored key. It may also leave the trust policy wide open to any repo, or write the `:sub` condition as a branch ref (`:ref:refs/heads/…`) on a job that runs on `pull_request`, which is denied. Confirm no long-lived key exists, `id-token: write` is set, and the trust policy scopes to your repo and the trigger context the job actually runs on.
- **Verify**: Search the workflow and repo secrets for `AWS_ACCESS_KEY_ID` — there must be none. Confirm the job sets `id-token: write` and uses `configure-aws-credentials` with `role-to-assume`. Run the workflow and confirm `aws sts get-caller-identity` returns the assumed role. Inspect the IAM role’s trust policy and confirm the `:sub` condition matches your repo and the job’s trigger context (`:pull_request` for a PR-triggered job). Record any stored key or open trust policy Codex produced in your prompt journal.

### Knowledge Check
1. **Why does the program forbid storing an AWS_ACCESS_KEY_ID as a repository secret for CI?**
   - *Answer:* A stored key never expires, so a leak is standing AWS access until rotated.
2. **What does the id-token: write permission actually grant a workflow?**
   - *Answer:* The ability to request a short-lived OIDC identity token from GitHub.
3. **How does a workflow get AWS credentials with OIDC instead of a stored key?**
   - *Answer:* It exchanges a GitHub-issued token for temporary credentials by assuming a role.
4. **What stops another repository from assuming your CI’s IAM role through OIDC?**
   - *Answer:* The role’s trust policy condition on the `:sub` claim scoping the repo and the trigger context.

---

## Topic 2 of 5: SAST — Semgrep, ESLint-security, and Bandit

### Why Do I Need to Know This?
Static analysis catches vulnerable code before it merges — an injection, an unsafe deserialization, a taxpayer ID written to a log. The polyglot capstone needs a Node analyzer and a Python analyzer plus a cross-language rule engine, so the gate runs three SAST tools. They scan the application services you built on top of the infrastructure from 8.2 Full-Stack Terraform.

### Scenario
A pull request adds code that logs a taxpayer ID in plaintext — a federal disclosure risk that no generic linter would flag. A custom Semgrep rule the team wrote, "no PII in logs," catches it at PR time. The author confirms it is a true positive and fixes it before the change can merge.

### Theory
- **SAST reads source without running it**: SAST analyzes code statically. Semgrep is the cross-language engine: it runs community rule packs (`p/ci`, `p/owasp-top-ten`) plus custom rules for capstone-specific patterns, written as small YAML files in `.semgrep/` and checked with `semgrep --validate` ([Semgrep CE in CI](https://semgrep.dev/docs/deployment/oss-deployment)). The Community Edition is free and runs in CI with no account.
- **Each language gets a native analyzer too**: Semgrep is broad; language-native tools catch idioms it can miss. Node code gets `eslint-plugin-security` and `eslint-plugin-no-secrets` — together, these two plugins are what the rest of this lesson calls ESLint-security; Python code gets Bandit. Running the native tool alongside Semgrep gives each language redundant coverage — a finding one tool misses, the other can catch.
- **Every finding is triaged**: A SAST finding is a candidate, not a verdict. Each HIGH-severity finding must be fixed (true positive) or documented as a false positive — no HIGH merges unaddressed. The discipline mirrors the IaC skip-justification rule from 8.1 Terraform & IaC Scanning: a suppression needs a reason.

#### Three SAST tools over one pull request
```
PR diff (polyglot source)
  ├── Semgrep: rule packs + custom rule
  ├── ESLint-security: Node files
  └── Bandit: Python files
        │
        ▼
Triage each finding (fix or documented false positive)
        │
        ▼
SARIF for the gate
```

### Example: A custom Semgrep rule for "no PII in logs"
```yaml
# .semgrep/no-pii-in-logs.yaml
rules:
  - id: no-taxpayer-id-in-logs # (1) capstone-specific rule
    languages: [typescript, javascript]
    severity: ERROR # (2) ERROR fails the gate
    message: Do not log a taxpayer ID — PII must never reach logs.
    patterns:
      - pattern: console.$METHOD(..., $X.taxpayerId, ...) # (3) matches logging a taxpayerId field
```
- **Annotation (1)** — the rule lives in `.semgrep/` as YAML; run `semgrep --validate --config .semgrep/` to check its syntax before relying on it.
- **Annotation (2)** — `severity: ERROR` makes a match fail the gate, so the PII line cannot merge.
- **Annotation (3)** — the pattern matches any `console.log`/`console.error` call that includes a `.taxpayerId` field; tune it against a known-bad and a known-good snippet so it neither misses nor over-fires.

### AI Practice
- **Prompt it**:
  > Write a custom Semgrep rule (YAML, for our `.semgrep/` directory) that flags any code path logging a taxpayer ID — a `.taxpayerId` field passed to a console logging call — at ERROR severity. Then give me one code snippet it should flag and one similar snippet it should NOT flag, so I can confirm it has no false negative and no false positive.
- **Watch out**: Codex often writes a rule so broad it flags every log line (false positives that train the team to ignore the gate), or so narrow it misses the obvious case. It may also forget `severity: ERROR`, so the finding only warns and still merges. Validate the rule with `semgrep --validate`, then run it against the known-good and known-bad snippets and confirm exactly one fires.
- **Verify**: Run `semgrep --validate --config .semgrep/` and confirm the rule parses. Run it against the known-bad snippet and confirm it fails at ERROR; run it against the known-good snippet and confirm it stays silent. Confirm ESLint-security and Bandit also run in the gate over the Node and Python code. Record any false positive or false negative in your prompt journal and tune the rule.

### Knowledge Check
1. **Why does the polyglot capstone run Semgrep and ESLint-security and Bandit?**
   - *Answer:* Semgrep is cross-language while ESLint-security and Bandit catch language-native idioms.
2. **What is a custom Semgrep rule for, in the capstone?**
   - *Answer:* To catch a capstone-specific pattern, like a taxpayer ID reaching the logs.
3. **A SAST scan reports a HIGH-severity finding on a pull request. What must happen before merge?**
   - *Answer:* It is fixed as a true positive, or documented as a false positive with a reason.
4. **What does running semgrep --validate --config .semgrep/ tell you?**
   - *Answer:* That your custom rule files parse correctly before you rely on them.

---

## Topic 3 of 5: SCA and secret scanning — OSV-Scanner, Dependabot, and Gitleaks

### Why Do I Need to Know This?
Most vulnerable code in a modern app is dependencies, and the most damaging leaks are secrets in git history. Software composition analysis scans the dependency tree against known-vulnerability feeds; secret scanning catches keys before they are committed and after they have already slipped in. Both are required to merge.

### Scenario
A dependency the capstone pulls in has a known-exploited CVE, and an earlier commit accidentally included an API key that is still sitting in the git history. OSV-Scanner flags the vulnerable dependency; Gitleaks finds the key in history. Both block the gate until the team resolves them.

### Theory
- **SCA scans the dependency tree**: SCA checks your dependencies against a vulnerability feed. OSV-Scanner checks the tree against the OSV.dev database; the gate’s bar is zero known-exploited CVEs. Dependabot complements it by opening PRs to bump vulnerable versions — remediation, not just detection.
- **Secret scanning runs in two places**: Gitleaks runs as a pre-commit hook (stopping a secret on the developer’s machine before it is committed) and as a full-history CI scan (catching anything that slipped through earlier). The full-history scan needs `fetch-depth: 0` so CI clones the entire history, not just the latest commit ([Gitleaks](https://github.com/gitleaks/gitleaks)). The bar is zero secrets in current code and zero in history.
- **A found secret is an incident**: Finding a committed secret is not "delete the commit and move on." The history may already be cloned elsewhere, so the secret must be rotated — invalidated at its source — not merely removed. A suppression of a Gitleaks finding, like any gate suppression, needs an ADR.

> [!WARNING]
> Rotate, do not just delete. Removing the commit that added a key does not un-leak it — anyone who pulled the repo still has it. The only safe response to a committed secret is to rotate the credential so the leaked value no longer works.

#### Two lanes into the secure-PR gate
```
Dependency tree  ────────► OSV-Scanner vs OSV.dev (Dependabot opens bump PRs) ───┐
                                                                                 ├──► Secure-PR gate
Commit + full git history ► Gitleaks: pre-commit + CI (fetch-depth 0) ────────────┘
```

### Example: SCA and full-history secret scan in CI
```yaml
jobs:
  sca:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: google/osv-scanner-action@v2 # (1) scan dependencies vs OSV.dev

  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # (2) full history, not just the latest commit
      - uses: gitleaks/gitleaks-action@v3 # (3) scan current code AND history for secrets
```
- **Annotation (1)** — OSV-Scanner checks the resolved dependency tree against OSV.dev; the gate fails on a known-exploited CVE, and Dependabot opens a PR to bump the offending package.
- **Annotation (2)** — `fetch-depth: 0` clones the entire history so Gitleaks can scan past commits, not only the tip — a secret added three commits ago is still caught.
- **Annotation (3)** — Gitleaks runs in CI here and also as a local pre-commit hook; a finding means rotate the credential, then remove it, with an ADR for any suppression.

### AI Practice
- **Prompt it**:
  > Add two GitHub Actions jobs to our secure-PR workflow: one that runs OSV-Scanner against our dependencies and fails on known-exploited CVEs, and one that runs Gitleaks over the full git history (set `fetch-depth: 0`) and as a pre-commit hook. Explain what to do when Gitleaks finds a real secret in an old commit.
- **Watch out**: Codex frequently omits `fetch-depth: 0`, so Gitleaks only scans the latest commit and misses secrets already in history. It may also suggest deleting the offending commit as the fix without rotating the credential, or treat a Dependabot PR as optional. Confirm the secret scan uses full history, the remediation is rotation, and OSV findings actually fail the job.
- **Verify**: Confirm the secret-scan job sets `fetch-depth: 0` and that Gitleaks runs both pre-commit and in CI. Plant a fake secret in an old commit on a test branch and confirm CI catches it (proving history is scanned). Confirm OSV-Scanner fails the job on a known-vulnerable dependency. Confirm the documented remediation is to rotate, not just delete. Record any missed-history or delete-without-rotate behavior in your prompt journal.

### Knowledge Check
1. **Why does the Gitleaks CI job set fetch-depth: 0?**
   - *Answer:* So the full git history is cloned and a secret in an older commit is caught.
2. **What does OSV-Scanner check, and what is the gate’s bar?**
   - *Answer:* The dependency tree against OSV.dev, with zero known-exploited CVEs to pass.
3. **Gitleaks finds a real API key committed three commits ago. What is the correct response?**
   - *Answer:* Rotate the credential so the leaked value stops working, then remove it.
4. **How does Dependabot complement OSV-Scanner in the gate?**
   - *Answer:* It opens pull requests to bump vulnerable dependencies to patched versions.

---

## Topic 4 of 5: Assembling the gate — required checks and SARIF as federal evidence

### Why Do I Need to Know This?
Individual scanners are useless if a pull request can merge while they are red. The team makes build, tests, SAST, SCA, and secret-scan required checks on main, so a green gate is the only path to merge — and the SARIF they emit is the audit evidence. A deliberate failing-then-fixed Gitleaks regression proves the gate actually blocks, rather than merely existing.

### Scenario
The team wants a guarantee that no one can merge past a red scanner — not by policy, but mechanically. They turn on branch protection so every gate job is a required check, upload each scanner’s SARIF to GitHub code-scanning and the evidence sink, and commit one PR that deliberately fails Gitleaks and then fixes it, to demonstrate the gate works end to end.

### Theory
- **Required status checks make the gate non-bypassable**: Required status checks on main block a merge until the named jobs pass: build, tests, SAST, SCA, and secret-scan must all be green. This is the mechanical enforcement — a reviewer cannot click merge past a red check, and the rule is not a convention someone can forget.
- **SARIF flows to two destinations**: Every scanner emits SARIF (introduced in 8.1 Terraform & IaC Scanning). `github/codeql-action/upload-sarif` sends it to GitHub code-scanning so findings annotate the PR, and `actions/upload-artifact` copies it to the evidence sink (`artifacts/security/`) for the audit packet — one format, two destinations: one for review, one for the record.
- **ADR-0024 records what blocks versus what warns**: Not every scanner has to hard-block. The secure-PR gate matrix in ADR-0024 records which scanners block a merge and which only warn, and why — a deliberate policy. The failing-then-fixed Gitleaks regression is the proof that the blocking ones actually block.

#### The secure-PR gate as required checks
```
Pull request
  │
  ▼
Parallel jobs: build, tests, SAST, SCA, secrets
  ├── SARIF to code-scanning + evidence sink
  │
  ▼
All required checks green?
  ├── Yes ──► Merge to main
  └── No  ──► Merge blocked
```

### Example: Uploading SARIF and a required-checks list
```yaml
- uses: github/codeql-action/upload-sarif@v4 # (1) findings annotate the PR
  with:
    sarif_file: semgrep.sarif
- uses: actions/upload-artifact@v7 # (2) copy into the evidence sink
  with:
    name: security-evidence
    path: artifacts/security/

# Branch protection on main — required status checks:
# build, tests, sast-semgrep, sca-osv, secrets-gitleaks
# (3) all must be green to merge
```
- **Annotation (1)** — `upload-sarif` pushes findings into GitHub code-scanning so they show on the PR’s Security tab.
- **Annotation (2)** — `upload-artifact` preserves the same SARIF in the evidence sink for the audit packet.
- **Annotation (3)** — these jobs are configured as required status checks on main; a red one blocks the merge mechanically, and ADR-0024 records which checks block versus warn.

### AI Practice
- **Prompt it**:
  > Configure our secure-PR gate: make build, tests, SAST (Semgrep), SCA (OSV-Scanner), and secret-scan (Gitleaks) required status checks on main, and upload every scanner's SARIF to GitHub code-scanning and to `artifacts/security/`. Then stage a single pull request that first fails Gitleaks (a planted fake secret) and then fixes it, to demonstrate the gate blocks and then passes.
- **Watch out**: Codex often sets up the jobs but never marks them required, so a PR can merge while a scanner is red. It may upload SARIF to code-scanning but skip the evidence sink, or stage a regression that never actually fails (so it proves nothing). Confirm the checks are required on main, SARIF reaches both destinations, and the regression PR genuinely goes red before it goes green.
- **Verify**: Confirm branch protection lists build, tests, SAST, SCA, and secret-scan as required checks. Confirm each scanner’s SARIF appears in code-scanning and in `artifacts/security/`. Open the regression PR and confirm the first commit fails the Gitleaks check (the gate blocks the merge) and the fix commit turns it green. Confirm ADR-0024 records which checks block versus warn. Record any non-required check or missing evidence in your prompt journal.

### Knowledge Check
1. **What makes the secure-PR gate non-bypassable rather than a convention?**
   - *Answer:* Required status checks on main that block the merge until every job is green.
2. **Why upload each scanner’s SARIF to both code-scanning and the evidence sink?**
   - *Answer:* Code-scanning annotates the PR for review; the sink preserves it for the audit packet.
3. **What is the purpose of the deliberate failing-then-fixed Gitleaks regression PR?**
   - *Answer:* To prove the gate actually blocks a bad change and then passes once it is fixed.
4. **What does ADR-0024 record for the secure-PR gate?**
   - *Answer:* Which scanners block a merge versus only warn, and the reason for each.

---

## Topic 5 of 5: Practice — ship the secure-PR gate on the capstone repo

### Why Do I Need to Know This?
This lesson’s payoff is a pull request that cannot merge insecure code: OIDC to AWS with no stored key, SAST and SCA and secret-scanning all running as required checks, every finding triaged, and the SARIF preserved as evidence. The way to know you have it is to build it and then attack it — try to merge past a red scanner, plant a secret in history, write a custom rule that over-fires — and confirm the gate holds. This exercise drives Codex through the gate and verifies by trying to slip a regression past it, producing ADR-0024.

### AI Practice
- **Prompt it**:
  > Ship our secure-PR gate on the capstone repo: (1) OIDC to AWS (`id-token: write`, `configure-aws-credentials` with `role-to-assume`, no stored key); (2) parallel jobs for Semgrep (with one custom rule), ESLint-security, Bandit, OSV-Scanner, and Gitleaks (full history, `fetch-depth: 0`, plus a pre-commit hook); (3) upload every scanner's SARIF to code-scanning and `artifacts/security/`; (4) make build, tests, SAST, SCA, and secret-scan required checks on main. Then stage a single PR that fails Gitleaks and then fixes it. Draft ADR-0024 (the gate matrix: which checks block, which warn).
- **Watch out**: Codex is likely to store an AWS key instead of using OIDC, set up scanner jobs but never mark them required, omit `fetch-depth: 0` so history is unscanned, write a custom rule that floods false positives, suggest deleting a leaked secret without rotating it, or skip the evidence-sink upload. Each one passes a glance while leaving a real hole — a standing credential, a bypassable gate, an unscanned history, or a hidden leak. Read the auth, the required-checks list, the secret-scan depth, and the custom rule before trusting the green checks.
- **Verify**: Confirm no `AWS_ACCESS_KEY_ID` exists and the job authenticates via OIDC. Confirm build, tests, SAST, SCA, and secret-scan are required checks on main, and that every scanner’s SARIF reaches both code-scanning and `artifacts/security/`. Open the regression PR and confirm it goes red on Gitleaks, then green after the fix. Run the custom Semgrep rule against a known-good and known-bad snippet and confirm exactly one fires. Then close Codex and explain, without AI, the difference between SAST, SCA, and secret scanning, and why a leaked secret must be rotated, not just deleted. Record every guarantee Codex broke on the first pass in your prompt journal for ADR-0024.
