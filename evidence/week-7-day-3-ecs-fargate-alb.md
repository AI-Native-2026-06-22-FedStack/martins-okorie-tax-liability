# Week 7 Day 3 Evidence: ECS Fargate & ALB

## Bootstrap Smoke

Command:

```sh
aws --version
docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}' | rg 'taxpulse-api|taxpulse-compute|apps/api|services/compute'
AWS_DEFAULT_REGION=us-east-1 AWS_ENDPOINT_URL=http://localhost:4566 aws --endpoint-url http://localhost:4566 ecr describe-repositories
docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr describe-repositories
```

Observed:

```text
aws-cli/2.35.9 Python/3.14.6 Darwin/25.5.0 source/arm64
taxpulse-api:w7d1 abdc5c722f1d
taxpulse-compute:w7d1 fbaa420625b8
```

The initial ECR probe reached the local endpoint command path but required local AWS test
credentials to be exported before ECR setup work:

```text
aws: [ERROR]: An error occurred (NoCredentials): Unable to locate credentials.
```

With `AWS_ACCESS_KEY_ID=test` and `AWS_SECRET_ACCESS_KEY=test`, the sandboxed host AWS
CLI could not connect to the published port, but the AWS CLI inside the floci container
confirmed the emulator ECR surface is reachable and empty:

```json
{
  "repositories": []
}
```

## Prep Files

- `ecr/lifecycle-policy.json`
- `ecs/task-definition.json`
- `ecs/service.json`
- `alb/load-balancer.json`
- `alb/target-group.json`
- `alb/listener.json`
- `iam/execution-role.json`
- `iam/task-role.json`
- `docs/adr/0020-ecs-fargate-vs-alternatives.md`
