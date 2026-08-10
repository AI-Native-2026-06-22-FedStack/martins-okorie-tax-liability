# Prompt Journal: ECS Fargate & ALB

## Entry 1

Asked — Save the attached Week 7 Day 3 "ECS Fargate & ALB" lesson as a helper and create a new prompt journal.

Produced — Saved `helper/week-7-day-3-ecs-fargate-alb.md` from the provided lesson text and initialized `prompt-journal/0028-ecs-fargate-alb.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 7 Day 3 ECS Fargate and ALB helper lesson is saved in the repository helper directory and prompt journal 0028 is initialized for the new infrastructure work.

## Entry 2

Asked — Start the Week 7 Day 3 ECS Fargate and ALB deliverable with version-controlled ECR, ECS, ALB, IAM, ADR, and evidence files, all targeting floci instead of a cloud account.

Produced — Added skeletal deployment-definition directories and files for ECR lifecycle policy, ECS task and service definitions, ALB load balancer/target group/listener definitions, separate execution and task IAM role documents, ADR-0020, and Week 7 Day 3 evidence. Ran the bootstrap smoke for AWS CLI, local Week 7 Day 1 image tags, JSON validity, and floci ECR reachability from inside the emulator container.

Accepted or rejected — Accepted.

Why — The Week 7 Day 3 deployment definitions now live in version-controlled files, the local images and AWS CLI are present, JSON syntax validates, and floci ECR is reachable locally with no real cloud account involved.

## Entry 3

Asked — Complete Task 1 by creating one immutable ECR repository per service in floci, pushing the existing `w7d1` API and Tax Engine images without using `latest` or rebuilding, adding a two-rule lifecycle policy, and proving immutable tag behavior.

Produced — Updated `ecr/lifecycle-policy.json` with the concrete two-rule retention policy, mounted the Docker socket into the floci service so ECR could start its backing registry, created `taxpulse-api` and `taxpulse-compute` repositories with `IMMUTABLE` tag settings, attached the lifecycle policy to both, pushed the existing `taxpulse-api:w7d1` and `taxpulse-compute:w7d1` images to floci ECR, verified both images through `describe-images`, and recorded floci fidelity gaps in evidence.

Accepted or rejected — Accepted.

Why — The local ECR repositories, lifecycle policies, and pinned `w7d1` image pushes are present in floci, while unsupported floci behaviors around Docker-layer immutable-tag enforcement and lifecycle preview are documented for repeat verification in real AWS.

## Entry 4

Asked — Complete Task 2 by keeping only the ALB public, placing Fargate tasks and Postgres privately, chaining `alb-sg`, `task-sg`, and `db-sg`, and separating the ECS execution role from the least-privilege application runtime role.

Produced — Added `alb/networking.json` with public ALB subnets, private app/database subnets, and SG-sourced private rules; updated ALB and ECS service definitions to use those placements; updated `ecs/task-definition.json` with distinct execution and task role ARNs; rewrote `iam/execution-role.json` with only the ECS task execution managed policy; rewrote `iam/task-role.json` with exact runtime actions and ARNs for Secrets Manager, DynamoDB, SNS, and SQS; created the local VPC, subnets, SGs, and IAM roles in floci where supported; and recorded verification in evidence.

Accepted or rejected — Accepted.

Why — Task 2 definitions now keep tasks and Postgres private, restrict private inbound rules to upstream security groups in code, use distinct least-privilege role documents, and pass JSON plus no-wildcard IAM checks.

## Entry 5

Asked — Complete Task 3 by defining ECS Fargate task definitions and services behind an ALB, routing `/v1` case traffic to the Core Case Service and calculation traffic to the Tax Engine, proving steady state and replacement behavior on floci, and recording ADR-0020.

Produced — Filled the ECS task definitions with valid Fargate sizing, `awsvpc`, pinned immutable `w7d1` ECR images, ports, readiness health checks, awslogs configuration, and distinct role ARNs; filled ECS services with private subnet placement, target-group registration, and desired count one; created the floci ALB, `ip` target groups, HTTPS listener, path rules, services, and synthetic local secrets needed for startup; verified both services running with healthy target groups before the replacement smoke; stopped an API task and observed ECS launch a replacement; and updated ADR-0020 plus evidence.

Accepted or rejected — Accepted.

Why — The version-controlled ECS/ALB definitions now deploy to floci with both services running on Fargate metadata, target groups registered on readiness endpoints, replacement behavior observed, and the Fargate-over-Kubernetes decision recorded in ADR-0020.
