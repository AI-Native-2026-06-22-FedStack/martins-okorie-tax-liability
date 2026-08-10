# ADR-0020: ECS Fargate vs Alternatives

## Status

Accepted

## Context

TaxPulse has two long-lived backend services for this cohort: the TypeScript/Express Core
Case Service and the FastAPI Tax Engine. They need immutable image deployment, service
health replacement, private networking, log capture, and load-balanced ingress. The
deployment definitions must remain version-controlled and must be exercised against floci
at `http://localhost:4566` before any real AWS account is used.

The runtime options considered were ECS on Fargate, ECS on EC2 capacity, Kubernetes, and
running the services directly on virtual machines.

## Decision

Use ECS Fargate services behind an internet-facing Application Load Balancer. Each service
has its own Fargate task definition, immutable ECR image tag, awslogs configuration, m7d1
readiness health check, target group with `TargetType: ip`, and ECS service definition that
registers healthy tasks to the ALB. The ALB is public; the tasks and Postgres stay in
private subnets.

## Consequences

- The cohort gets managed scheduling, task replacement, health-based load balancing, and
  CloudWatch-compatible logs without operating hosts.
- The deployment path stays close to production behavior because ECS pulls the same
  immutable ECR tags scanned in m7d1.
- Networking remains explicit: ALB in public subnets, tasks in private subnets with
  `awsvpc`, and Postgres private behind the task security group.
- Fargate constrains CPU and memory to valid pairs, so task sizing changes must use
  supported combinations.
- The team still needs version-controlled JSON inputs for the ALB, target groups, listener,
  ECS task definitions, ECS services, and IAM roles.

## Alternatives Considered

ECS on EC2 capacity would keep ECS semantics, but this cohort would still own the instance
fleet, AMI lifecycle, patching, capacity headroom, and scaling policies. That work does not
add value for two services.

Kubernetes would provide a portable control plane and a large ecosystem, but it adds the
operational surface of cluster upgrades, node pools, ingress controllers, service accounts,
network policies, and add-on management. Avoiding that surface is the point for this cohort:
the platform needs reliable long-lived services, not a Kubernetes operations track.

Virtual machines would be familiar but would push service supervision, deployment rollout,
health replacement, log wiring, and load balancer registration into custom scripts. That
would make the deployment less declarative and harder to review.
