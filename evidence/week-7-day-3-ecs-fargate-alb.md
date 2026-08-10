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

## Task 1: ECR Images, Immutability, and Lifecycle Policy

Lifecycle policy selection:

- Rule 1 matches tagged images only with `tagPatternList: ["*"]` and expires tagged
  images older than the most recent 10. It does not match untagged images.
- Rule 2 matches untagged images only and expires untagged images older than the most
  recent one. It does not match tagged rollback candidates.

Command:

```sh
docker compose up -d --force-recreate floci
docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr create-repository --repository-name taxpulse-api --image-tag-mutability IMMUTABLE
docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr create-repository --repository-name taxpulse-compute --image-tag-mutability IMMUTABLE
docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr put-lifecycle-policy --repository-name taxpulse-api --lifecycle-policy-text file:///tmp/taxpulse-ecr-lifecycle-policy.json
docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr put-lifecycle-policy --repository-name taxpulse-compute --lifecycle-policy-text file:///tmp/taxpulse-ecr-lifecycle-policy.json
docker tag taxpulse-api:w7d1 000000000000.dkr.ecr.us-east-1.localhost:5100/000000000000/us-east-1/taxpulse-api:w7d1
docker tag taxpulse-compute:w7d1 000000000000.dkr.ecr.us-east-1.localhost:5100/000000000000/us-east-1/taxpulse-compute:w7d1
NO_PROXY=localhost,127.0.0.1,.localhost,000000000000.dkr.ecr.us-east-1.localhost docker push 000000000000.dkr.ecr.us-east-1.localhost:5100/000000000000/us-east-1/taxpulse-api:w7d1
NO_PROXY=localhost,127.0.0.1,.localhost,000000000000.dkr.ecr.us-east-1.localhost docker push 000000000000.dkr.ecr.us-east-1.localhost:5100/000000000000/us-east-1/taxpulse-compute:w7d1
```

Observed repository metadata:

```json
[
  {
    "name": "taxpulse-compute",
    "mutability": "IMMUTABLE",
    "uri": "000000000000.dkr.ecr.us-east-1.localhost:5100/taxpulse-compute"
  },
  {
    "name": "taxpulse-api",
    "mutability": "IMMUTABLE",
    "uri": "000000000000.dkr.ecr.us-east-1.localhost:5100/taxpulse-api"
  }
]
```

Observed pushed image details:

```json
[
  {
    "tags": [
      "w7d1"
    ],
    "digest": "sha256:abdc5c722f1db4838918f07fd2a52d6dde6dd22394daa94ab00a19177c672be1"
  }
]
[
  {
    "tags": [
      "w7d1"
    ],
    "digest": "sha256:fbaa420625b8ed81d89e02bfafba55119adfc10ac7b58f53fcf5ed2ed762eb43"
  }
]
```

Observed lifecycle policy readback:

```json
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep the 10 most recent tagged images",
      "selection": {
        "tagStatus": "tagged",
        "tagPatternList": [
          "*"
        ],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    },
    {
      "rulePriority": 2,
      "description": "Keep only the most recent untagged image",
      "selection": {
        "tagStatus": "untagged",
        "countType": "imageCountMoreThan",
        "countNumber": 1
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
```

Local floci fidelity notes:

- floci ECR required the floci container to mount `/var/run/docker.sock` so it could
  start its backing registry container.
- `docker push` of the same manifest to the same tag is accepted as a no-op.
- `docker push` of a different manifest to an existing `w7d1` tag was accepted by the
  backing registry even though the ECR repository metadata reports `IMMUTABLE`. The
  `taxpulse-api:w7d1` tag was restored to the original API digest shown above.
- `ecr put-image` returned `UnsupportedOperation`, so API-level overwrite rejection
  could not be tested through floci.
- `ecr start-lifecycle-policy-preview` returned `UnsupportedOperation`, so lifecycle
  expiration preview/run must be repeated against real AWS in Week 8.
