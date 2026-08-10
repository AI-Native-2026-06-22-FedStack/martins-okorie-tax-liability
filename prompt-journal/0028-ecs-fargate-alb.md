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
