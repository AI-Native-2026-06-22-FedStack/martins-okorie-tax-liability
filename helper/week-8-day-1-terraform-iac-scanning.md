# 8.1 Terraform & IaC Scanning

🕐 Last Updated: 2026-07-23 18:57:31 UTC  
📌 Commit: [de4f99ec](https://git.uptimecrew.com/wisam.naji/ai-native-curriculum/-/blob/de4f99ecc91e3c0721176f7aaff1b1558708327e/curriculum_fs/Module8/Lesson1/lesson.lms.md)

Week 8 · Day 1

**Terraform & IaC Scanning**

Replace click-ops with reproducible infrastructure as code — Terraform's building blocks, safe remote state with S3-native locking, plan/apply discipline, and Checkov + Trivy as a Day-1 gate that blocks an insecure plan before it ever reaches AWS, with findings mapped to NIST 800-53 evidence.

---

## Topic 1 of 5: Why infrastructure as code — reproducibility, audit, rollback, drift

### Why Do I Need to Know This?

In Module 7 you got the capstone running on AWS compute, but only against LocalStack and only by hand — scripts, AWS CLI calls, and a few console clicks. There is no single artifact that says what the infrastructure is, no way to recreate it on a clean machine, and no record an auditor can read to see what changed and when. For a federal system that gap is the whole problem: infrastructure as code makes the infrastructure a reviewed, versioned artifact that is the same every time.

This is the foundation the rest of the module stands on. The Terraform you start here becomes the full stack you compose in 8.2 Full-Stack Terraform, and the code the secure pipeline gates in 8.3 The Secure-PR Gate. Everything in this module is a change to reviewed code, not a click in a console.

### Scenario

A teammate edits a security-group rule directly in the AWS console to unblock a demo. It works for the demo — and then nobody else can reproduce the environment, because the change exists nowhere in the repo. Worse, the next terraform apply would silently revert it, because Terraform compares the code to reality and "fixes" anything that does not match. The team has just met drift, and the reason the program bans console-only changes.

### Theory

**IaC makes infrastructure reproducible, auditable, and rollback-able**

Infrastructure as code describes your cloud resources in files you commit to git. Three properties follow, and all three are federal requirements rather than conveniences:

- **Reproducible** — the same code produces the same infrastructure, on a teammate's laptop or in a fresh account.
- **Auditable** — the change record is the git history and the reviewed pull request; an auditor reads the diff, not a memory of who clicked what.
- **Rollback-able** — revert the code and re-apply to return to a known-good state.

**Declarative, not imperative**

Terraform is declarative: you declare the end state you want — "a VPC with these subnets, an ECS service with this image" (the same building blocks you stood up by hand in 7.3 ECS Fargate & ALB) — and Terraform computes the actions needed to reach it. You do not script "create this, then configure that." This is why the same code is safe to run repeatedly: if the world already matches the code, Terraform does nothing.

**Drift is reality diverging from code**

Drift is what happens when the live infrastructure no longer matches the code — a console edit, a manual hotfix, a change made by another tool. `terraform plan` detects drift by comparing the code to the real resources and showing you the difference. The AGENTS.md rule "no console-only changes" exists precisely so drift never accumulates: every change goes through the code so the code stays the source of truth.

> **⚠️ Warning**: No console-only changes. A manual edit in the AWS console is invisible to the next engineer and will be reverted (or fought over) by the next apply. If something must change, it changes in the Terraform code and goes through a reviewed plan — never in the console.

**Desired state, actual state, and drift**

`terraform plan` computes the difference between the code (desired state) and AWS (actual state); apply converges them; a console edit introduces drift the next plan surfaces.

```
terraform plan → terraform apply → introduces drift → next plan detects drift

Terraform code (desired state) → Plan: what must change → AWS (actual state) → Console edit (out-of-band change)
```

### Example: reading a plan's change symbols

```hcl
Terraform will perform the following actions:

  ~ aws_security_group.alb          # (1) ~ update in place
  + aws_s3_bucket.logs              # (2) + create
  - aws_instance.legacy             # (3) - destroy
  -/+ aws_db_instance.main          # (4) -/+ replace (destroy then create)

Plan: 1 to add, 1 to change, 1 to destroy.
```

- **Annotation (1)** — `~` is an in-place update: the resource changes but keeps its identity and data.
- **Annotation (2) and (3)** — `+` creates a new resource, `-` destroys an existing one.
- **Annotation (4)** — `-/+` is a replace: Terraform destroys the resource and creates a new one. On a stateful resource (a database) that means data loss, so a `-/+` is the line you read most carefully (the lifecycle guards for it come in 8.2 Full-Stack Terraform).

### AI Practice

**Prompt it**

Have Codex read a terraform plan and classify each change, then verify its reading against the symbols yourself.

```
Here is the output of `terraform plan` for our capstone. For each resource in the plan, tell me whether the change is create (+), destroy (-), update in place (~), or replace (-/+), and flag every replace (-/+) as potentially destructive. Explain which changes are safe to apply and which need a closer look before apply.
```

**Watch out**: Codex may call a replace (`-/+`) an "update" and miss that it destroys the resource first — dangerous on anything stateful. It can also assert a change is safe without seeing the resource type. Treat its classification as a draft and confirm each symbol against the actual plan output.

**Verify**: Read the plan yourself and confirm Codex labeled every `-/+` as a replace, not an update. For each destroy (`-`) and replace (`-/+`), confirm the resource is one you actually intend to remove or recreate. Record any change Codex misclassified in your prompt journal — a missed replace on a database is the one that hurts.

### Knowledge Check

1. **Why is infrastructure as code a federal requirement rather than a convenience?**
   - ❌ It makes AWS resources run faster than ones created in the console.
   - ❌ It encrypts the infrastructure configuration so it cannot be audited.
   - ✅ The code is reproducible and the reviewed diff is the audit record.
   - ❌ It removes the need to ever review infrastructure changes again.

2. **What does it mean that Terraform is declarative?**
   - ❌ You write the ordered shell commands Terraform runs in sequence.
   - ✅ You declare the desired end state and Terraform computes the steps.
   - ❌ Each run executes every command top to bottom regardless of the current state.
   - ❌ It can only add resources, never change or remove existing ones.

3. **A resource was changed directly in the AWS console. What will the next terraform plan show?**
   - ✅ Drift — a difference between the code and the live resource.
   - ❌ Nothing, because Terraform only tracks resources it created this run.
   - ❌ An error that halts all future applies until the console change is reverted by hand.
   - ❌ A new duplicate resource created to match the console version.

4. **In terraform plan output, what does the -/+ symbol mean for a resource?**
   - ❌ The resource will be updated in place with no interruption.
   - ❌ The resource is unchanged and shown only for context.
   - ❌ Two separate resources will be created from one definition.
   - ✅ The resource is replaced — destroyed and then recreated.

---

## Topic 2 of 5: Terraform building blocks — providers, resources, data sources, modules

### Why Do I Need to Know This?

Before you compose a whole stack, you need the four nouns every Terraform file is built from. The one that trips up most beginners is the difference between a resource (something Terraform creates and owns) and a data source (something that already exists and Terraform only reads). Confuse them and Terraform will try to manage — and can destroy — infrastructure it should only have looked at.

### Scenario

The team's first config tries to create a VPC that already exists in the sandbox account. Terraform now believes it owns that VPC, so a later change could destroy and recreate it, taking everything inside it down. The fix is not more code — it is knowing that an existing VPC should be read with a data source, while only new infrastructure is a resource.

### Theory

**The provider talks to the platform**

A provider is the plugin that knows how to call a platform's API. The AWS provider turns your Terraform into AWS API calls. You pin it to a version so a provider upgrade cannot silently change how your code behaves — reproducibility again.

**Resource versus data source**

A resource is something Terraform creates and owns the full lifecycle of — `aws_ecs_service`, `aws_s3_bucket`. Terraform will create it, update it, and destroy it to match your code. A data source is a read-only lookup of something that already exists — `data.aws_availability_zones`, a VPC another team owns. Terraform reads its attributes but never manages it. The rule: if your code is responsible for the thing's existence, it is a resource; if you are only referencing something that exists, it is a data source.

**Modules group resources for reuse**

A module is a reusable group of resources with inputs (variables) and outputs. Your top-level configuration is the root module; it calls child modules (a network module, an app module). Modules are the unit of composition 8.2 Full-Stack Terraform leans on — you will assemble the capstone stack out of them.

**The four building blocks in one module**

A root module calls child modules; each child holds resources (created and owned) and data sources (read-only); the provider sits beneath, calling the AWS API.

```
Root module
├── module: network
│   ├── resource: aws_vpc (owned)
│   └── data source: aws_availability_zones (read-only)
├── module: app
│   └── resource: aws_ecs_service (owned)
└── AWS provider (version-pinned) → AWS API
```

### Example: a small module with all four blocks

```hcl
terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }   # (1) pin the provider major
  }
}

variable "vpc_cidr" { type = string }                          # (2) module input

data "aws_availability_zones" "available" {}                   # (3) data source: read existing AZs

resource "aws_vpc" "main" {                                    # (4) resource: Terraform owns it
  cidr_block = var.vpc_cidr
}

output "vpc_id" { value = aws_vpc.main.id }                    # (5) output other modules can consume
```

- **Annotation (1)** — `required_providers` pins the AWS provider; `~> 6.0` allows 6.x updates but blocks a breaking 7.0. Pin to whichever major is current — check the [Terraform Registry](https://registry.terraform.io/providers/hashicorp/aws/latest) — so an automatic upgrade can't silently change how your code behaves.
- **Annotation (2)** — `variable` is an input, so the same module serves dev and prod with different values.
- **Annotation (3)** — `data` reads the account's availability zones; Terraform never creates or destroys them.
- **Annotation (4)** — `resource` is owned: Terraform creates this VPC and will change or destroy it to match the code.
- **Annotation (5)** — `output` exposes the VPC id so another module can reference it (the cross-module wiring of 8.2 Full-Stack Terraform).

### AI Practice

**Prompt it**

Have Codex scaffold a small module, then verify it used resources and data sources correctly.

```
Scaffold a Terraform network module: a new VPC and two subnets we create, using the account's existing availability zones and an existing shared Route 53 zone we do NOT own. Pin the AWS provider. Expose the VPC id and subnet ids as outputs. Be explicit about which blocks are resources (we own) and which are data sources (read-only).
```

**Watch out**: Codex frequently turns an existing, externally-owned thing (a shared DNS zone, a pre-created VPC) into a resource, which makes Terraform try to manage — and potentially destroy — infrastructure it should only read. It may also forget to pin the provider. Confirm every existing thing is a data source and only genuinely new infrastructure is a resource.

**Verify**: Read the generated code and confirm: the things your code is responsible for creating are `resource` blocks, and everything pre-existing (AZs, the shared zone) is a `data` source. Confirm the provider is pinned with `required_providers`. Run `terraform plan` and confirm it proposes to create only the new resources and reads — never creates — the data sources. Record any existing resource Codex tried to own in your prompt journal.

### Knowledge Check

1. **Your teammate deletes the required_providers block from the configuration entirely. What breaks?**
   - ❌ Nothing changes — the provider block only affects documentation, not behavior.
   - ✅ Every resource and data source call fails — there is no plugin to reach AWS.
   - ❌ Only version pinning is lost; Terraform still calls the AWS API as before.
   - ❌ State file reads fail, since state decryption depends on the provider block.

2. **When should something be a data source rather than a resource?**
   - ❌ When it is a new resource you want Terraform to create quickly.
   - ❌ When it has more than a few attributes to manage.
   - ❌ When it must be destroyed and recreated on every apply.
   - ✅ When it already exists and your code only needs to read it.

3. **What is a Terraform module?**
   - ✅ A reusable, parameterized group of resources with inputs and outputs.
   - ❌ A single resource that has been given a custom name.
   - ❌ The platform plugin that authenticates Terraform to the AWS API endpoints.
   - ❌ A read-only snapshot of the current state file.

4. **Why pin the AWS provider with version = "~> 6.0"?**
   - ❌ It makes terraform apply run faster by caching the provider.
   - ✅ It allows 6.x updates but blocks a breaking 7.0 from changing behavior.
   - ❌ It lets the configuration use resources from any AWS account.
   - ❌ It automatically upgrades the provider to the newest major version on each run.

---

## Topic 3 of 5: Remote state, locking, and plan/apply discipline

### Why Do I Need to Know This?

State is the most dangerous part of Terraform. It is the file that maps your code to the real resource IDs — and it can contain sensitive values. If two engineers run apply at the same time against the same state, they can corrupt it, and a corrupted state can orphan or double-create real infrastructure. So before anyone on the team runs apply, the state has to live in a shared remote location with a lock.

### Scenario

Two engineers run `terraform apply` within a minute of each other. Each started from its own copy of the state, and the second write clobbers the first — now the state file disagrees with reality, and Terraform wants to recreate resources that already exist. The team moves the state to a shared S3 backend with locking, so only one apply can run at a time and everyone reads the same truth.

### Theory

**Local state does not work for a team; remote state does**

By default Terraform writes state to a local file. That is fine for one person on one laptop and broken for a team: there is no shared copy, and two people will overwrite each other. A remote backend — an S3 bucket — makes the state shared, versioned, and the single source of truth. Turn on S3 bucket versioning so a bad write can be rolled back.

**State locking with S3-native locking**

A state lock stops two applies from writing at once. Terraform's S3 backend now does this natively: set `use_lockfile = true` and the backend uses an S3 conditional write to create a lock file in the bucket for the duration of the operation — no separate lock service needed ([Terraform S3 backend docs](https://developer.hashicorp.com/terraform/language/backend/s3)).

> **ℹ️ Note**: S3-native locking replaced the DynamoDB lock table. Older guides pair the S3 backend with a DynamoDB table for locking. As of Terraform 1.11, `use_lockfile` is generally available and the `dynamodb_table` argument is deprecated (to be removed in a future version). New work uses `use_lockfile = true`; you only keep a DynamoDB table when maintaining an older configuration that has not migrated yet.

**Plan/apply discipline**

`terraform plan` is read-only — it shows what would change and is the thing a reviewer reads. `terraform apply` mutates real infrastructure. The discipline, and the AGENTS.md rule, is no apply without a reviewed plan. Separate environments (dev, prod) keep separate state — either through workspaces or, more commonly for federal work, entirely separate backends — so a dev apply can never touch prod.

**A lock serializes concurrent applies**

Two engineers apply at once; the S3 backend's lock lets one proceed and makes the other wait until the lock is released, so the state is never written by two operations at the same time.

```
S3 backend (state + lock)
Engineer A: terraform apply → acquire lock (1) → write state, release lock (3)
Engineer B: terraform apply → lock held so wait (2) → lock acquired, proceed (4)
```

### Example: an S3 backend with native locking

```hcl
terraform {
  backend "s3" {
    bucket         = "acme-tax-tfstate"               # (1) private, versioned bucket
    key            = "capstone/terraform.tfstate"      # (2) path to this stack's state
    region         = "us-east-1"
    encrypt        = true                              # (3) encrypt state at rest
    use_lockfile   = true                              # (4) S3-native locking — no DynamoDB
  }
}
```

- **Annotation (1)** — the bucket is private with no public access and has versioning on, so a bad state write can be rolled back to a prior version.
- **Annotation (2)** — `key` is the object path; each stack/environment uses its own key so their states do not collide.
- **Annotation (3)** — `encrypt = true` encrypts the state object, which matters because state can hold sensitive attributes.
- **Annotation (4)** — `use_lockfile = true` turns on S3-native locking; run `terraform init` to adopt the backend, then a second concurrent apply waits for the lock instead of corrupting state.

### AI Practice

**Prompt it**

Have Codex write the remote-state backend, then verify the bucket is private and locking is on.

```
Configure a Terraform S3 remote backend for our capstone: a private, versioned, encrypted state bucket, a per-stack state key, and S3-native state locking with use_lockfile (do NOT add a DynamoDB table — it is deprecated). Show the backend block and the terraform init command, and explain how a second concurrent apply is blocked.
```

**Watch out**: Codex often reaches for the old DynamoDB-table locking pattern, or leaves the state bucket public or un-versioned. It may also skip `encrypt`. Confirm the backend uses `use_lockfile = true` (not a `dynamodb_table`), the bucket is private and versioned, and `encrypt` is set.

**Verify**: Run `terraform init` and confirm it adopts the S3 backend without error. Start an apply, and while it runs start a second apply from another shell — confirm the second one waits on the lock instead of proceeding. Confirm the state bucket blocks public access and has versioning enabled. Record whether Codex used `use_lockfile` or fell back to the deprecated DynamoDB pattern in your prompt journal.

### Knowledge Check

1. **Why does a team move Terraform state to a remote S3 backend?**
   - ✅ So state is shared, versioned, and the single source of truth for everyone.
   - ❌ Because Terraform refuses to run at all without an S3 bucket explicitly configured.
   - ❌ Because S3 makes terraform plan produce fewer changes.
   - ❌ Because remote state removes the need to review applies.

2. **What problem does state locking solve, and how does the S3 backend now provide it?**
   - ❌ It encrypts the state file, using a KMS key stored in DynamoDB.
   - ❌ It compresses the state file so concurrent reads are faster.
   - ✅ It stops concurrent applies from corrupting state, via use_lockfile (S3-native).
   - ❌ It backs up the entire state file to a second AWS region automatically on each apply.

3. **In the program's plan/apply discipline, what is the rule?**
   - ❌ Apply first to see the result, then write a plan describing it afterward.
   - ❌ Run apply directly in CI so no human has to read the plan.
   - ❌ Plan and apply must always run against the same shared prod state.
   - ✅ No apply without a reviewed plan; plan is read-only, apply mutates.

4. **Your team starts a new configuration in 2026 and needs state locking. What is the current approach?**
   - ❌ Always create a DynamoDB lock table — it is required for any S3 backend.
   - ❌ Use local state only, since locking is simply not possible with a remote backend.
   - ✅ Enable `use_lockfile = true` on the S3 backend; DynamoDB is no longer needed.
   - ❌ Use workspaces, which provide locking in place of a backend lock.

---

## Topic 4 of 5: IaC scanning as a Day-1 gate — Checkov + Trivy, and 800-53 evidence

### Why Do I Need to Know This?

A misconfiguration is cheapest to catch before it reaches AWS — a public S3 bucket, a security group open to the world, an unencrypted volume. Scanning the Terraform at pull-request time is the federal shift-left gate: the bad plan never applies, and the scan's machine-readable output is evidence an auditor can read. This gate runs from the very first commit, not after the stack is built.

### Scenario

A pull request would create an S3 bucket with a public-read ACL. Before anyone can merge it, Checkov fails the PR and names the exact policy the bucket violates. The misconfiguration never reaches AWS. The team either fixes the bucket or, if the bucket is meant to be public (a CDN origin), records a justified exception — and either outcome becomes part of the audit trail.

### Theory

**Two open-source scanners read the Terraform and fail on policy violations**

Checkov and Trivy both read your Terraform and fail the build on a policy violation — a public bucket, an open security group, missing encryption. Running both is deliberate: Checkov's graph-based checks catch cross-resource issues (IAM edge cases), while `trivy config` covers broad misconfiguration in one binary and is the successor to the now-deprecated tfsec ([Trivy config scanning](https://trivy.dev/docs/latest/scanner/misconfiguration/config/config/)).

**A skip must be justified**

Sometimes a flagged pattern is intentional. You suppress a check with an inline comment — `# checkov:skip=CKV_AWS_20:<reason>` for Checkov, `# trivy:ignore:<AVD-id>:<reason>` for Trivy — but a suppression without a written reason and an ADR is banned. The skip-justification matrix in ADR-0023 records which checks are skipped and why, so a reviewer can see that every suppression was a decision, not an accident.

> **❗ Important**: No skip without an ADR. A bare `# checkov:skip` with no reason is how a real misconfiguration ships disguised as a known exception. Every suppression carries a reason in the comment and an entry in the ADR-0023 skip matrix, or it does not merge.

**SARIF is the federal evidence format**

Both scanners emit SARIF, a standard JSON format for scan findings. The pipeline uploads SARIF to GitHub code-scanning (so findings annotate the PR) and copies it to the evidence sink (`artifacts/security/`) for the audit packet. These findings map to NIST 800-53 controls — RA-5 (vulnerability monitoring and scanning) and SI-2 (flaw remediation) — which is what makes "we scan and remediate misconfigurations" provable rather than asserted.

**The Day-1 IaC scanning gate**

A pull request runs terraform plan, then Checkov and Trivy; a policy violation blocks the merge unless an ADR-justified skip covers it, and every run emits SARIF to code-scanning and the evidence sink.

```
Pull request → terraform plan → Checkov + Trivy (trivy config)
  ├── pass → Mergeable
  └── fail: policy violation → Blocked unless ADR-justified skip
      └── SARIF to code-scanning + evidence sink
```

### Example: a failed check and a justified skip

```hcl
# Checkov fails this PR:
# Check: CKV_AWS_20: "S3 Bucket has an ACL defined which allows public access"
# FAILED for resource: aws_s3_bucket.cdn_origin

resource "aws_s3_bucket" "cdn_origin" {
  bucket = "acme-tax-cdn-origin"
  # checkov:skip=CKV_AWS_20: public CDN origin by design — reviewed in ADR-0023, 2026-06-26
  # (1)
}
```

- **Annotation (1)** — the skip carries the check id, a real reason, and a pointer to ADR-0023. A reviewer can see why this bucket is allowed to be public; a bare `# checkov:skip=CKV_AWS_20` with no reason would be rejected in review.

Run the gate locally with `checkov -d .` and `trivy config .`; add `--format sarif --output <file>` to produce the SARIF that uploads to code-scanning and the evidence sink.

Checkov uses `CKV_AWS_*` ids and Trivy uses `AVD-*` ids; the same misconfiguration is often caught by both, which is the point of running them together.

### AI Practice

**Prompt it**

Have Codex propose skip justifications for the scan findings, then accept or reject each one yourself.

```
Here are the Checkov and Trivy findings for our Terraform. For each finding, tell me whether it is a real misconfiguration to fix or a defensible exception. For any you think is an exception, draft the skip comment with the check id and a specific reason I can put in ADR-0023. Do not suppress anything you cannot justify.
```

**Watch out**: Codex tends to suppress findings to make the scan green — generating skip comments for real misconfigurations, or writing vague reasons like "not applicable." A suppressed real finding is worse than a failing one, because it looks resolved. Review every proposed skip: accept only genuine exceptions with a concrete reason, and fix the rest.

**Verify**: Run `checkov -d .` and `trivy config .` and confirm the gate fails on a real misconfiguration (seed a public bucket to prove it). For each skip Codex proposed, confirm the reason is specific and the exception is genuine — reject anything vague or unjustified. Confirm SARIF is written to the evidence sink. Record every finding Codex tried to suppress without justification in your prompt journal.

### Knowledge Check

1. **Why scan the Terraform at pull-request time instead of after the stack is deployed?**
   - ❌ Because scanning a deployed stack is impossible once it is on AWS.
   - ❌ Because the scanners only work on code, never on real resources.
   - ❌ Because a deployed misconfiguration is cheaper to fix than a flagged one.
   - ✅ So a misconfiguration is blocked before it ever reaches AWS.

2. **A scanner flags a check on a bucket that is intentionally public. What is the correct action?**
   - ✅ Add a skip comment with the check id and a reason, recorded in ADR-0023.
   - ❌ Add a bare `# checkov:skip` so the scan passes and move on.
   - ❌ Delete the check from the scanner configuration entirely.
   - ❌ Make the bucket private to satisfy the scanner even though it must be public.

3. **What is SARIF and why does the gate produce it?**
   - ❌ A Terraform state format that records resource locks.
   - ✅ A standard JSON format for scan findings, used as code-scanning and audit evidence.
   - ❌ A CLI flag that makes Checkov ignore low-severity findings.
   - ❌ A cryptographic signing format that proves the Terraform configuration was authored by us.

4. **Scan findings in this module map to which NIST 800-53 controls, and why does that matter?**
   - ❌ SC-7 and AC-2, because scanning configures network boundaries and manages user accounts.
   - ❌ CP-9 and IR-4, because scanning backs up and responds to incidents.
   - ✅ RA-5 and SI-2, because they cover vulnerability scanning and flaw remediation.
   - ❌ AU-2 and PE-3, because scanning logs events and controls physical access.

---

## Topic 5 of 5: Practice — initialize the capstone's Terraform with a gated base

### Why Do I Need to Know This?

This lesson's payoff is a Terraform foundation a federal reviewer would accept: state in a shared, versioned, locked backend; the network and IAM base modules written as reviewable code; and Checkov + Trivy gating every plan from the very first commit. The only way to know you have it is to build it and then attack it — try a concurrent apply, seed a public bucket, propose an unjustified skip — and confirm the foundation holds. This exercise drives Codex through the full setup and verifies by trying to break each guarantee, producing ADR-0022 (module structure) and ADR-0023 (IaC scanning policy).

### AI Practice

**Prompt it**

Hands-on practice for this lesson — stand up the gated Terraform base with Codex, then try to break it.

```
For our capstone Terraform repo: (1) configure an S3 remote backend that is private, versioned, encrypted, with S3-native locking via use_lockfile (no DynamoDB); (2) write a network base module (VPC, subnets) and an IAM base module, using resources for what we own and data sources for what already exists, with the AWS provider pinned; (3) wire Checkov and Trivy (trivy config) to scan on every plan and emit SARIF to artifacts/security/. Then draft ADR-0022 (module structure) and ADR-0023 (IaC scanning policy + skip-justification matrix).
```

**Watch out**: Codex is likely to fall back to DynamoDB locking, leave the state bucket public or un-versioned, turn an existing resource into one Terraform owns, suppress real scan findings to make the gate green, or skip the SARIF output. Each one passes a quick look while leaving a real hole — a corruptible state, a managed-then-destroyed shared resource, or a hidden misconfiguration. Read the backend block, the resource-vs-data-source choices, and every skip before trusting the green checks.

**Verify**: Confirm `terraform init` adopts the S3 backend and a second concurrent apply waits on the lock. Confirm the state bucket is private and versioned. Run `checkov -d .` and `trivy config .`, seed a public bucket, and confirm the gate fails; confirm every skip has a reason and an ADR-0023 entry. Confirm SARIF lands in `artifacts/security/`. Then close Codex and explain, without AI, why the state bucket needs locking and why a console change is banned. Record every guarantee Codex broke on the first pass in your prompt journal for the ADRs.
