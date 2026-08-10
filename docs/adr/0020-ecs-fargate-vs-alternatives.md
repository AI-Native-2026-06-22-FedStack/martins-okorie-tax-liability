# ADR-0020: ECS Fargate vs Alternatives

## Status

Proposed

## Context

Week 7 Day 3 will stand up the TaxPulse backend services on AWS-shaped compute through
floci at `http://localhost:4566`. The service definitions must remain version-controlled
and must not be hand-edited in a console.

## Decision

Use ECS Fargate task definitions and services behind an Application Load Balancer for the
Core Case Service and Tax Engine.

## Consequences

- The team avoids operating Kubernetes control planes, nodes, and cluster add-ons for the
  capstone backend.
- Each service needs an immutable ECR image tag, a Fargate-compatible task definition,
  a service definition, target group wiring, and separate execution and task IAM roles.
- Local verification runs against floci first; any LocalStack or floci fidelity gaps must
  be recorded and repeated against real AWS in Week 8.
