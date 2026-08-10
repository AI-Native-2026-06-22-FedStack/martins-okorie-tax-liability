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

## Task 2: Private Network, Security Groups, and ECS IAM Roles

Version-controlled placement:

```text
alb=alb-sg
tasks=subnet-taxpulse-private-app-a,subnet-taxpulse-private-app-b publicIp=DISABLED sg=task-sg
postgres=subnet-taxpulse-private-db-a,subnet-taxpulse-private-db-b publiclyAccessible=false sg=db-sg
```

Security-group chain in `alb/networking.json`:

- `alb-sg` allows TCP 443 from `0.0.0.0/0`.
- `task-sg` allows TCP 3000 and TCP 8000 from `alb-sg` only.
- `db-sg` allows TCP 5432 from `task-sg` only.
- No private inbound rule uses an IP range or `0.0.0.0/0`.

ECS service placement:

```text
taxpulse-api assignPublicIp=DISABLED subnets=subnet-taxpulse-private-app-a,subnet-taxpulse-private-app-b securityGroups=task-sg
taxpulse-compute assignPublicIp=DISABLED subnets=subnet-taxpulse-private-app-a,subnet-taxpulse-private-app-b securityGroups=task-sg
```

Task-definition role references:

```text
executionRole=arn:aws:iam::000000000000:role/taxpulse-ecs-execution
taskRole=arn:aws:iam::000000000000:role/taxpulse-ecs-task
rolesDistinct=true
```

IAM role verification:

```text
iam/execution-role.json:
- role: arn:aws:iam::000000000000:role/taxpulse-ecs-execution
- assume principal: ecs-tasks.amazonaws.com
- managed policy: arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
- inline policies: none

iam/task-role.json:
- role: arn:aws:iam::000000000000:role/taxpulse-ecs-task
- assume principal: ecs-tasks.amazonaws.com
- exact runtime actions only:
  secretsmanager:GetSecretValue
  dynamodb:BatchWriteItem
  dynamodb:CreateTable
  dynamodb:DescribeTable
  dynamodb:PutItem
  dynamodb:Query
  sns:CreateTopic
  sns:Publish
  sns:Subscribe
  sqs:CreateQueue
  sqs:DeleteMessage
  sqs:GetQueueAttributes
  sqs:ReceiveMessage
  sqs:SendMessage
  sqs:SetQueueAttributes
- exact resources only:
  arn:aws:secretsmanager:us-east-1:000000000000:secret:taxpulse/local/db-password
  arn:aws:secretsmanager:us-east-1:000000000000:secret:taxpulse/local/jwt-signing-keys
  arn:aws:dynamodb:us-east-1:000000000000:table/taxpulse-plan-cycle-read-model
  arn:aws:dynamodb:us-east-1:000000000000:table/taxpulse-plan-cycle-read-model/index/GSI1
  arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed
  arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-projection
  arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-dlq
```

Wildcard check:

```sh
jq -e '([.. | objects | select(has("Resource")) | .Resource | (if type == "array" then .[] else . end) | select(. == "*")] | length) == 0 and ([.. | objects | select(has("Action")) | .Action | (if type == "array" then .[] else . end) | select(. == "*" or test(":\\*$"))] | length) == 0' iam/task-role.json
```

Observed:

```text
true
```

floci IAM state:

```json
{
  "AttachedPolicies": [
    {
      "PolicyName": "AmazonECSTaskExecutionRolePolicy",
      "PolicyArn": "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    }
  ]
}
```

floci network state:

```text
created vpc vpc-dbc97338
created subnet taxpulse-public-a subnet-f6b22bc8
created subnet taxpulse-public-b subnet-e9005df2
created subnet taxpulse-private-app-a subnet-4eaa5854
created subnet taxpulse-private-app-b subnet-e4f198b8
created subnet taxpulse-private-db-a subnet-654c5d9f
created subnet taxpulse-private-db-b subnet-63331f96
created sg alb-sg sg-a8540ab47c2a3ccb2
created sg task-sg sg-82e6e539d1e4b33fa
created sg db-sg sg-6f4d40a7e232e1b10
```

Local floci fidelity note:

- floci EC2 accepted SG-sourced ingress commands, but `describe-security-groups` returned
  empty `UserIdGroupPairs` for those rules. The version-controlled `alb/networking.json`
  is therefore the source of truth for the SG-source chain, and this SG-source readback
  should be repeated against real AWS in Week 8.

## Task 3: ECS Fargate Tasks, Services, ALB, and ADR-0020

Task definitions:

```text
taxpulse-api:2
- requiresCompatibilities=FARGATE
- networkMode=awsvpc
- cpu=256 memory=512
- image=000000000000.dkr.ecr.us-east-1.localhost:5100/000000000000/us-east-1/taxpulse-api:w7d1
- containerPort=3000
- healthCheck=/ready
- logConfiguration=awslogs /ecs/taxpulse-api
- executionRoleArn=arn:aws:iam::000000000000:role/taxpulse-ecs-execution
- taskRoleArn=arn:aws:iam::000000000000:role/taxpulse-ecs-task

taxpulse-compute:2
- requiresCompatibilities=FARGATE
- networkMode=awsvpc
- cpu=256 memory=512
- image=000000000000.dkr.ecr.us-east-1.localhost:5100/000000000000/us-east-1/taxpulse-compute:w7d1
- containerPort=8000
- healthCheck=/health
- logConfiguration=awslogs /ecs/taxpulse-compute
- executionRoleArn=arn:aws:iam::000000000000:role/taxpulse-ecs-execution
- taskRoleArn=arn:aws:iam::000000000000:role/taxpulse-ecs-task
```

Created ALB:

```text
arn:aws:elasticloadbalancing:us-east-1:000000000000:loadbalancer/app/taxpulse-alb/89fcd392b0674cad
dns=taxpulse-alb-89fcd392b0674cad.elb.floci
scheme=internet-facing
subnets=subnet-f6b22bc8,subnet-e9005df2
securityGroups=sg-a8540ab47c2a3ccb2
```

Created target groups:

```text
taxpulse-api-tg
- arn=arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/taxpulse-api-tg/9fda5367923a4d11
- TargetType=ip
- port=3000
- healthCheckPath=/ready

taxpulse-compute-tg
- arn=arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/taxpulse-compute-tg/23066ec2f8ba4317
- TargetType=ip
- port=8000
- healthCheckPath=/health
```

Listener and rules:

```text
listener=arn:aws:elasticloadbalancing:us-east-1:000000000000:listener/app/taxpulse-alb/89fcd392b0674cad/3adae4526d0a4617
port=443
protocol=HTTPS
default=fixed 404
priority 5: /v1/calculate, /v1/scenario, /compute/* -> taxpulse-compute-tg
priority 10: /v1/*, /v1 -> taxpulse-api-tg
```

Service steady state:

```json
[
  {
    "name": "taxpulse-api",
    "taskDefinition": "taxpulse-api:2",
    "desired": 1,
    "running": 1,
    "pending": 0,
    "status": "ACTIVE"
  },
  {
    "name": "taxpulse-compute",
    "taskDefinition": "taxpulse-compute:2",
    "desired": 1,
    "running": 1,
    "pending": 0,
    "status": "ACTIVE"
  }
]
```

Target health before the replacement smoke:

```json
{
  "api": {
    "target": "172.18.0.9:3000",
    "state": "healthy"
  },
  "compute": {
    "target": "172.18.0.8:8000",
    "state": "healthy"
  }
}
```

Direct readiness probes from inside floci:

```text
GET http://172.18.0.9:3000/ready -> {"database":"ok","service":"taxpulse-api","status":"ready"}
GET http://172.18.0.8:8000/health -> {"status":"ok"}
```

Replacement smoke:

```text
stopped task arn:aws:ecs:us-east-1:000000000000:task/taxpulse-cluster/a66df51a9acf4604b5ae7df9e913fbc8
reason=Task 3 replacement smoke test

replacement running tasks:
arn:aws:ecs:us-east-1:000000000000:task/taxpulse-cluster/d1151c95489f482e8860051cdc5dd8ca
arn:aws:ecs:us-east-1:000000000000:task/taxpulse-cluster/092e2e2577384062ab9f621615c6a846

taxpulse-api desired=1 running=1 pending=0
replacement target health=healthy
```

Local floci fidelity notes:

- The first API task revisions failed until the local Secrets Manager values were seeded.
  The JWT signing secret must be a JSON object with `keyId`, `privateKey`, and `publicKey`.
- After stopping the API task, ECS launched a replacement immediately, direct `/ready`
  returned ready, and the replacement target later reported `healthy`.
- The floci ALB DNS name `taxpulse-alb-89fcd392b0674cad.elb.floci` did not resolve from
  inside the floci container, so the smoke-through-ALB request could not be completed in
  this local emulator run. Repeat this smoke against real AWS in Week 8.

ADR:

- `docs/adr/0020-ecs-fargate-vs-alternatives.md` is `Accepted` and records why ECS
  Fargate was selected, including the why-not-Kubernetes rationale.
