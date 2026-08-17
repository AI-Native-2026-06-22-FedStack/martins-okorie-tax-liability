# Week 8 · Day 2: Full-Stack Terraform

> **Last Updated:** 2026-08-10 23:56:14 UTC  
> **Commit:** [8db241a7](https://git.uptimecrew.com/wisam.naji/ai-native-curriculum/-/blob/8db241a7f8362f04b3aec11d0cef1344dbeef8d6/curriculum_fs/Module8/Lesson2/lesson.lms.md)

Compose the whole capstone as layered Terraform modules — network → data → app → observability — with stateful-resource lifecycle safety, Secrets Manager wiring so no secret lands in state or code, cross-module outputs, mandatory tagging, and Checkov + Trivy green across the entire stack.

---

## Topic 1 of 5: Composing modules — the network → data → app → observability layering

### Why Do I Need to Know This?
In 8.1 Terraform & IaC Scanning you wrote a single small module. A real capstone is dozens of resources, and one giant file is unreviewable and unsafe to change — a reviewer cannot hold it in their head, and a change to one corner can ripple anywhere. The team composes the stack as layered modules so each layer can be reasoned about and changed on its own, and so a higher layer can consume a lower layer’s outputs instead of duplicating values.

### Scenario
The team needs the VPC and subnet IDs created in the network module inside the ECS service defined in the app module. Copy-pasting the IDs would drift the moment the network changes. Instead the network module outputs those IDs and the app module references them — one source, referenced through the module’s output, so a change in the network layer flows to the app layer automatically.

### Theory
- **Layered composition**: The capstone stack is built as four layers, each its own module: network (VPC, subnets, security groups) → data (RDS, DynamoDB, ElastiCache) → app (ECS services, ALB, Lambda) → observability (alarms, dashboards). Lower layers expose outputs; higher layers consume them. The layering is what keeps each module small enough to review and lets you change the app layer without touching the network layer.
- **Output values and cross-module references**: A module’s output is how another module reads an attribute of something it created — an ARN, an ID, an endpoint. The root module wires layers together by passing one module’s output into another’s input variable, referenced as `module.<name>.<output>`. This reference is what replaces copy-pasted IDs.
- **Module inputs parameterize the module**: A module’s variable blocks are its inputs. The same network module serves dev and prod by being called twice with different values — composition, not duplication. A module that hard-codes values it should accept as inputs is one you cannot reuse.

#### The four module layers and the outputs that wire them
```
module: network         --> (subnet_ids, sg_ids)          --> module: app
module: data            --> (db_endpoint, cache_endpoint) --> module: app
module: app             --> (service_name, alb_arn)       --> module: observability
Root module wires the layers
```

### Example: An output consumed across modules
```hcl
# modules/network/outputs.tf — the network layer publishes what others need
output "private_subnet_ids" {
  value = aws_subnet.private[*].id # (1) created here, exposed for reuse
}

# root main.tf — wire the network output into the app module's input
module "network" {
  source   = "./modules/network"
  vpc_cidr = "10.0.0.0/16"
}

module "app" {
  source     = "./modules/app"
  subnet_ids = module.network.private_subnet_ids # (2) cross-module reference, not a copied id
}
```
- **Annotation (1)** — The network module owns the subnets and publishes their IDs as an output; nothing outside the module reaches into its resources directly.
- **Annotation (2)** — The app module receives the IDs through `module.network.private_subnet_ids`, so if the subnets change, the app layer follows automatically — no hard-coded ID to drift.

### AI Practice
**Prompt it**:
> Compose our capstone app module so it consumes the network module's outputs: take the VPC id and private subnet ids from module.network as input variables (do not hard-code any ids), and place the ECS service in those subnets. Show the network module's outputs, the root module wiring, and the app module's variables.

**Watch out**: Codex often hard-codes subnet or VPC IDs as string literals instead of referencing the network module’s outputs, which silently drifts the moment the network changes. It may also reach into another module’s resources directly rather than through a published output. Confirm every cross-layer value flows through an output → input variable, with no literal IDs.

**Verify**: Read the generated code and confirm no resource ID is a hard-coded string — every one comes from `module.<name>.<output>`. Run `terraform plan` and confirm the app module’s subnets resolve from the network module, not from literals. Record any hard-coded ID or cross-module reach-in Codex produced in your prompt journal.

### Knowledge Check
1. **Why compose the capstone as layered modules instead of one large configuration?**
   - *Answer:* Each layer stays small enough to review and change on its own.
2. **How does the app module use a value created in the network module?**
   - *Answer:* It references `module.network.<output>` wired through an input variable.
3. **What makes a module reusable across dev and prod?**
   - *Answer:* Its variable inputs, so the same module is called with different values.
4. **What is the purpose of a module output?**
   - *Answer:* To publish a created resource’s attribute so another module can read it.

---

## Topic 2 of 5: Stateful resources — RDS, DynamoDB, and ElastiCache lifecycle safety

### Why Do I Need to Know This?
Stateful resources are the ones that hurt when Terraform replaces them. A change that forces a new RDS instance destroys the old one — and its data — before creating the replacement. You need to recognize which changes are destructive in a plan, and how to guard the resources where a destroy means data loss.

### Scenario
A reviewer reading the plan notices a proposed change shows `-/+` on the RDS instance — a replace, which would drop the production database. The change looked harmless in the diff of the code. The team learns to read the replace signal on stateful resources and to set lifecycle guards so an accidental destroy cannot apply.

### Theory
- **In-place update versus replace**: Some attribute changes update a resource in place (`~`); others force a replace (`-/+`) — Terraform destroys the resource and creates a new one. For a database, a replace means the data is gone. Reading the plan specifically for `-/+` on stateful resources is a required review step, because the danger is invisible in the code diff itself.
- **Lifecycle guards stop an accidental destroy**: A lifecycle guard makes Terraform refuse to destroy a resource. `lifecycle { prevent_destroy = true }` fails any plan that would destroy or replace the resource while the block is present ([Terraform lifecycle docs](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle)). On top of that, the provider offers deletion protection — RDS `deletion_protection = true`, and similar settings on other stores — as a second lock at the AWS layer.
- **Backups are part of the resource**: A stateful resource is created with its backup posture, not as an afterthought: RDS automated backups and snapshots, DynamoDB point-in-time recovery. Even if backup policy is light this module, the resource definition is where retention lives, so it belongs in the Terraform from the start.

> [!WARNING]
> Read every `-/+` on a database before you apply. A replace destroys then recreates — on RDS that is data loss. `prevent_destroy` turns an accidental replace into a failed plan instead of a dropped database, which is exactly the outcome you want.

#### Classifying a plan change on a stateful resource
```
Plan shows a change to a stateful resource
  ├─ Update in place (~) ──> Applies safely, data kept
  └─ Replace (-/+) ────────> prevent_destroy set?
                              ├─ Yes ──> Plan fails -- no accidental data loss
                              └─ No  ──> Destroy then recreate -- data lost
```

### Example: A guarded RDS instance
```hcl
resource "aws_db_instance" "main" {
  identifier          = "capstone-db"
  engine              = "postgres"
  instance_class      = "db.t4g.micro"
  allocated_storage   = 20
  deletion_protection = true # (1) AWS-layer lock against deletion

  lifecycle {
    prevent_destroy = true # (2) Terraform refuses any destroy/replace
  }
}
```
- **Annotation (1)** — `deletion_protection = true` makes AWS itself reject a delete, a second lock independent of Terraform.
- **Annotation (2)** — `prevent_destroy = true` makes Terraform fail the plan if a change would destroy or replace this instance, so an attribute change that forces a replace surfaces as a hard error instead of silent data loss.
- To intentionally replace a guarded resource you must first remove the guard in a separate, reviewed change — which is the point: destroying a database is never a side effect of an unrelated edit.

### AI Practice
**Prompt it**:
> Write a data module with an RDS Postgres instance, a DynamoDB table, and an ElastiCache Redis cluster for our capstone. Add deletion protection and a prevent_destroy lifecycle guard to the database. Then run terraform plan against a change I will make and tell me which stateful resources would be replaced (-/+) versus updated in place (~).

**Watch out**: Codex frequently omits `prevent_destroy` and `deletion_protection` on stateful resources, and it may describe a `-/+` replace as a harmless "update," hiding the data loss. It can also propose an attribute change that forces a replace without flagging it. Confirm the database carries both guards and that every `-/+` on a stateful resource is called out explicitly.

**Verify**: Run `terraform plan` and read it for `-/+` on the RDS, DynamoDB, and ElastiCache resources — confirm none would be replaced by the change you are making. Confirm the database has both `deletion_protection = true` and `prevent_destroy = true`. As a test, propose a change that forces a replace and confirm the plan fails rather than offering to drop the database. Record any unguarded stateful resource in your prompt journal.

### Knowledge Check
1. **In a plan, why is a `-/+` on an RDS instance more dangerous than a `~`?**
   - *Answer:* Because `-/+` destroys then recreates the instance, losing its data.
2. **What does `lifecycle { prevent_destroy = true }` do?**
   - *Answer:* It makes Terraform fail any plan that would destroy or replace the resource.
3. **A teammate wants to intentionally replace a database guarded by `prevent_destroy`. What is the correct path?**
   - *Answer:* Remove the guard in a separate reviewed change, then make the replacing change.
4. **Where does a stateful resource’s backup posture (snapshots, point-in-time recovery) belong?**
   - *Answer:* In the resource’s own Terraform definition, from the moment it is created.

---

## Topic 3 of 5: Secrets and parameters — Secrets Manager wiring without leaking into state

### Why Do I Need to Know This?
A federal system cannot have database passwords or API keys sitting in code or in the committed Terraform state. State is shared in the backend and can be read by anyone with access to the bucket, and it stores many attributes in plaintext. So secrets flow through AWS Secrets Manager: Terraform wires a reference, and the application fetches the value at runtime.

### Scenario
The team’s first attempt sets the database password as a Terraform variable with a default value. That password would land in the plan output and in the state file in plaintext. The team moves it into Secrets Manager and passes only the secret’s ARN to the ECS task, so Terraform never sees — and never stores — the actual password.

### Theory
- **State can hold secrets in plaintext**: Terraform state records resource attributes, and a secret value set directly as a managed attribute can be readable in that state. The rule that follows: keep raw secrets out of the code and out of state entirely, rather than trying to scrub them afterward.
- **Wire the reference, not the value**: Store the secret in AWS Secrets Manager (or SSM Parameter Store as a SecureString), and pass the secret’s ARN to the ECS task or Lambda. The ECS task definition’s `secrets` block takes a `valueFrom` ARN, and at runtime the execution role fetches the value and injects it as an environment variable ([aws_ecs_task_definition docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ecs_task_definition.html)). Terraform wires the pointer; the plaintext never touches state.
- **`sensitive = true` reduces exposure but is not the fix**: Marking a variable or output `sensitive = true` stops Terraform from printing it in plan output. That reduces accidental exposure in logs, but it does not keep the value out of state — a sensitive value still sits in the state file. It is a complement to the Secrets-Manager pattern, not a substitute for it.

> [!IMPORTANT]
> `sensitive = true` is not encryption and not a hiding place. It only suppresses the value in CLI output; the raw value still lives in state. The real protection is never putting the secret in Terraform at all — store it in Secrets Manager and pass the ARN.

#### A secret referenced by ARN, fetched at runtime
```
Secrets Manager: db password (plaintext value)
       │
       ▼ (ARN only)
Terraform wires ARN into task def (secrets: valueFrom ARN)
       │
       ▼ (runtime fetch via execution role)
Container gets the value as an env var
```

### Example: Secret created, then referenced by ARN
```hcl
resource "aws_secretsmanager_secret" "db" {
  name = "capstone/db-password" # (1) Terraform creates the container, not the value
}

resource "aws_ecs_task_definition" "api" {
  family = "capstone-api"
  container_definitions = jsonencode([{
    name = "api"
    secrets = [{
      name      = "DB_PASSWORD"                          # (2) env var name inside the container
      valueFrom = aws_secretsmanager_secret.db.arn       # (3) reference by ARN, never the value
    }]
  }])
}
```
- **Annotation (1)** — Terraform creates the secret container; the actual password is set out of band (console, CLI, or a rotation function), so it never enters the code or state.
- **Annotation (2) & (3)** — The task definition references the secret by ARN through `valueFrom`; at runtime the execution role reads it and injects `DB_PASSWORD`. The plan and state hold only the ARN, never the password.

### AI Practice
**Prompt it**:
> Wire our database password into the ECS task definition through AWS Secrets Manager: create the secret container in Terraform (not the value), and reference it from the task definition's secrets block by ARN using valueFrom. Do not put the password in a Terraform variable or anywhere in the configuration. Show the secret resource and the task definition.

**Watch out**: Codex commonly sets the secret value directly in Terraform — as a variable default, an `aws_secretsmanager_secret_version` with a literal string, or a hard-coded password argument — all of which land in state in plaintext. Confirm the configuration creates only the secret container and references it by ARN; the actual value must be set outside Terraform.

**Verify**: Search the configuration and the plan output for the literal password — it must not appear anywhere. Confirm the task definition references the secret by ARN via `valueFrom`, not a literal value. Run `terraform plan` and confirm only the ARN is shown, not the password. Record any place Codex put the raw secret into Terraform in your prompt journal.

### Knowledge Check
1. **Why is putting a database password in a Terraform variable a problem?**
   - *Answer:* The value lands in the plan output and the state file in plaintext.
2. **How does the capstone get a secret to a container without it touching Terraform state?**
   - *Answer:* Terraform passes the secret’s ARN; the runtime role fetches the value.
3. **What does marking a Terraform output `sensitive = true` actually do?**
   - *Answer:* It suppresses the value in CLI output, but the value still sits in state.
4. **Who sets the actual value of a secret whose container Terraform creates?**
   - *Answer:* It is set out of band — console, CLI, or a rotation function — not in the code.

---

## Topic 4 of 5: Stack-scale discipline — tagging, cost visibility, and whole-stack scanning

### Why Do I Need to Know This?
Once the whole stack is one composed plan, the discipline shifts from "does this resource work" to "is the whole stack attributable, costed, and clean." An untagged resource in a federal account cannot be traced to an owner, and a single oversized instance is a real budget surprise. The same gate from 8.1 Terraform & IaC Scanning now runs across every layer at once.

### Scenario
The full-stack plan creates dozens of resources. The reviewer cannot tell who owns what or what it will cost, and Checkov flags three resources the team added since 8.1 Terraform & IaC Scanning. The team enforces tags stack-wide, adds a cost estimate to the PR, and re-greens the whole-stack scan before merging.

### Theory
- **Mandatory tags, applied stack-wide**: Every resource carries `Name`, `Owner`, and `Environment` tags — the AGENTS.md rule — so it is attributable and filterable in a federal account. Rather than tagging each resource by hand, set `default_tags` on the AWS provider; the tags apply to every resource, and a resource can still override a key locally if needed.
- **Cost visibility before apply**: Infracost estimates the monthly cost of a plan: `infracost breakdown --path .` produces the numbers, and in CI it posts the cost delta on the pull request so an oversized instance is caught before it bills. It is open-source and used as the CLI only (no paid tier required) — a guardrail for a budgeted sandbox.
- **The scan gates the whole stack**: Checkov and Trivy (`trivy config`) now scan the entire composed stack, not one module — the bar is zero HIGH/CRITICAL findings unjustified across everything, and the plan’s outputs match the expected ARNs. A misconfiguration introduced in any layer fails the PR exactly as it did for a single module.

#### The whole-stack gate on a pull request
```
Full-stack terraform plan
  ├── default_tags applied to every resource
  ├── Infracost cost delta on the PR (advisory)
  └── Checkov + Trivy whole-stack scan
       ├─ Tagged & scan green ──> Mergeable
       └─ Issues found ─────────> Blocked: fix or ADR-justify
```

### Example: Provider default tags and a cost check
```hcl
provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Owner       = "tax-platform-team" # (1) applied to every resource the provider manages
      Environment = "sandbox"
      Name        = "capstone"
    }
  }
}

# In CI, before apply:
# infracost breakdown --path .          # (2) monthly cost estimate, posted on the PR
```
- **Annotation (1)** — `default_tags` stamps `Owner`, `Environment`, and `Name` onto every resource without editing each one; a resource can override a key locally when it genuinely needs a different value.
- **Annotation (2)** — `infracost breakdown` ([Infracost](https://www.infracost.io/)) estimates the plan’s monthly cost so the PR shows the delta; an accidental oversized instance is caught in review, not on the bill.

### AI Practice
**Prompt it**:
> Add provider-level default_tags (Owner, Environment, Name) to our AWS provider so every resource in the capstone stack is tagged, and add an Infracost breakdown step to our CI that posts the monthly cost estimate on the pull request. Then run terraform plan and tell me if any resource is missing the required tags.

**Watch out**: Codex sometimes tags only a few resources by hand and misses the rest, or sets the tags on individual resources instead of provider `default_tags` so new resources are untagged by default. It may also skip the cost step. Confirm tagging is enforced at the provider level and that the Infracost step actually runs in CI and posts a delta.

**Verify**: Run `terraform plan` and confirm every resource shows the `Owner`, `Environment`, and `Name` tags from `default_tags`. Confirm `infracost breakdown --path .` runs and produces a monthly estimate, and review the delta for any surprise (an oversized instance, a forgotten NAT gateway). Run Checkov and Trivy across the whole stack and confirm zero unjustified HIGH/CRITICAL findings. Record any untagged resource or cost surprise in your prompt journal.

### Knowledge Check
1. **Why set tags through provider `default_tags` rather than on each resource?**
   - *Answer:* It applies the required tags to every resource, so none is left untagged.
2. **What does `infracost breakdown --path .` give the team?**
   - *Answer:* A monthly cost estimate of the plan, posted as a delta on the PR.
3. **At the whole-stack scale, what is the scanning bar the gate enforces?**
   - *Answer:* Zero HIGH/CRITICAL findings unjustified across the entire composed stack.
4. **A reviewer cannot tell who owns the resources in a full-stack plan. What is the fix?**
   - *Answer:* Enforce `Owner`, `Environment`, and `Name` tags via provider `default_tags`.

---

## Topic 5 of 5: Practice — compose the full-stack capstone Terraform

### Why Do I Need to Know This?
This lesson’s payoff is the whole capstone expressed as reviewed Terraform: the network → data → app → observability layers wired through cross-module outputs, stateful resources guarded against accidental destruction, every secret referenced through Secrets Manager rather than stored in state, and the whole stack tagged, costed, and scanned green. The way to know you have it is to compose it and then attack it — propose a change that would replace the database, try to slip a secret into a variable, add an untagged resource — and confirm the stack defends itself. This exercise drives Codex through the composition and verifies by trying to break each guarantee, producing a stable terraform plan committed as evidence.

### AI Practice
**Prompt it**:
> Compose our capstone as layered Terraform: a network module (VPC, subnets, SGs), a data module (RDS Postgres with deletion_protection and prevent_destroy, DynamoDB, ElastiCache), an app module (ECS service consuming the network's subnet ids and the database endpoint via cross-module outputs, with the DB password wired from Secrets Manager by ARN), and provider default_tags (Owner, Environment, Name). Add an Infracost step and run Checkov + Trivy across the whole stack. Produce a stable terraform plan I can commit as evidence.

**Watch out**: Codex is likely to hard-code subnet IDs instead of referencing the network outputs, omit the database lifecycle guards, set the DB password as a Terraform variable (leaking it into state), tag only some resources, or skip the cost and whole-stack scan steps. Each one passes a glance while leaving a real hole — a drifting ID, a droppable database, a leaked secret, or an unattributable resource. Read the cross-module wiring, the database guards, where the secret lives, and the tags before trusting the green plan.

**Verify**: Run `terraform plan` and confirm:
1. No hard-coded IDs (every cross-layer value flows through `module.<name>.<output>`).
2. No `-/+` on the RDS/DynamoDB/ElastiCache resources.
3. The database carries `deletion_protection` and `prevent_destroy`.
4. The DB password appears nowhere in the plan or state (only its ARN).
5. Every resource shows the `default_tags`.
6. Confirm Infracost produces a monthly estimate and Checkov + Trivy are green or ADR-justified across the whole stack.
7. Commit the stable plan as evidence.
8. Explain without AI why a `-/+` on a database is dangerous and how remote state locking prevents a corrupted apply. Record every guarantee Codex broke on the first pass in your prompt journal.
