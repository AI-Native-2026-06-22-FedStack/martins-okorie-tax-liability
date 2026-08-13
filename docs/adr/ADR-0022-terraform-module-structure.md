# ADR-0022: Terraform Module Structure

- Status: Accepted

## Context

Modules 1–7 defined TaxPulse infrastructure as hand-crafted JSON files under `alb/`,
`ecs/`, `iam/`, and `infra/`, deployed via imperative AWS CLI scripts and docker-compose
against floci. This approach lacks reproducibility (scripts vary between engineers),
auditability (no plan-review step), and rollback capability (no state tracking). For a
federal system these gaps are the problem: a reviewer cannot read a declarative diff of
what changed, and there is no single command to recreate the infrastructure from scratch.

Module 8 moves all infrastructure to Terraform. The first decision is how to organize the
Terraform code so it is composable, reviewable, and aligned with the existing networking
and IAM specifications from Module 7.

## Decision

Organize Terraform as a root module with child modules under `terraform/`:

```
terraform/
├── main.tf              # Backend, provider, module calls
├── variables.tf         # Root-level inputs
├── outputs.tf           # Surfaced child-module outputs
├── versions.tf          # required_version + required_providers
├── modules/
│   ├── network/         # VPC, subnets, route tables, security groups
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── iam/             # ECS execution and task roles, inline policies
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
└── scripts/
    ├── bootstrap-state.sh   # Pre-create the S3 state bucket on floci
    └── scan.sh              # Checkov + Trivy scanning gate
```

### Rules

1. **Resource vs. data source**: if our code is responsible for the thing's existence, it
   is a `resource`; if we are only referencing something that already exists (AZs, AWS-managed
   policies), it is a `data` source. Confusing them risks Terraform managing — and potentially
   destroying — infrastructure it should only read.

2. **Provider pinning**: the AWS provider is pinned with `~> 6.0` in `versions.tf`. This
   allows 6.x patch and minor updates but blocks a breaking 7.0 major. Pin to whichever
   major is current at the time.

3. **Remote state**: S3 backend with `use_lockfile = true` (S3-native locking, no DynamoDB).
   The state bucket is private, versioned, encrypted, and blocks all public access. Each
   stack/environment uses its own `key` so states do not collide.

4. **Module composition**: the root module calls child modules with explicit variable
   inputs and consumes their outputs. Child modules never reach into each other — all
   cross-module wiring goes through the root.

5. **Plan/apply discipline**: no apply without a reviewed plan. `terraform plan` is
   read-only; `terraform apply` mutates. The plan output is the artifact a reviewer reads.

### Subnet layout

The network module implements the three-tier subnet layout from Module 7's
`alb/networking.json`:

| Tier        | Subnets                     | CIDRs                          | Placement                 |
| ----------- | --------------------------- | ------------------------------ | ------------------------- |
| public      | taxpulse-public-a/b         | 10.42.0.0/24, 10.42.1.0/24    | ALB                       |
| private-app | taxpulse-private-app-a/b    | 10.42.10.0/24, 10.42.11.0/24  | ECS Fargate tasks         |
| private-db  | taxpulse-private-db-a/b     | 10.42.20.0/24, 10.42.21.0/24  | Postgres                  |

## Consequences

- The M7 JSON deployment definitions under `alb/`, `ecs/`, `iam/` remain as documentation
  of the original hand-crafted approach. They are not consumed by Terraform.
- Adding a new infrastructure component (ALB, ECS service, Lambda) means adding a child
  module and wiring it through the root — the pattern 8.2 Full-Stack Terraform uses.
- Every infrastructure change goes through `terraform plan` → review → `terraform apply`,
  producing a reviewable diff an auditor can read.
- Provider upgrades are gated by the `~> 6.0` pin; a major bump requires an explicit
  decision.

## Alternatives considered

**Flat root module** — all resources in the root without child modules. Simpler for a
small config but does not compose: adding the ALB, ECS, Lambda, and CloudFront definitions
in 8.2 would produce a single unreadable file. Modules separate concerns and allow reuse
across environments.

**Terragrunt wrapper** — adds DRY configuration management on top of Terraform. Useful for
large multi-account setups but adds a learning and tooling dependency the cohort does not
need for two environments.
