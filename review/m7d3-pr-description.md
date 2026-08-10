# Week 7 Day 3 PR — ECS Fargate Services Behind an ALB

## Summary

Adds version-controlled AWS-shaped deployment definitions for the TaxPulse Core Case
Service and Tax Engine. The deliverable creates immutable floci ECR repositories and
lifecycle policy rules, defines Fargate task definitions and services from the pinned
`w7d1` images, places the services behind an internet-facing ALB with `ip` target groups,
keeps tasks and Postgres private, separates ECS execution and runtime IAM roles, and
records the Fargate decision in ADR-0020.

All AWS CLI work targets floci at `http://localhost:4566`; no cloud account is used.

## Related ADR

ADR: [ADR-0020: ECS Fargate vs Alternatives](../docs/adr/0020-ecs-fargate-vs-alternatives.md)

## Testing

- `jq empty ecr/lifecycle-policy.json ecs/task-definition.json ecs/service.json alb/load-balancer.json alb/target-group.json alb/listener.json alb/networking.json iam/execution-role.json iam/task-role.json`
- `docker compose config --quiet`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr describe-repositories --repository-names taxpulse-api taxpulse-compute`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr describe-images --repository-name taxpulse-api`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr describe-images --repository-name taxpulse-compute`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr get-lifecycle-policy --repository-name taxpulse-api`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecs describe-task-definition --task-definition taxpulse-api:2`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecs describe-task-definition --task-definition taxpulse-compute:2`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecs describe-services --cluster taxpulse-cluster --services taxpulse-api taxpulse-compute`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-load-balancers --names taxpulse-alb`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-target-groups --names taxpulse-api-tg taxpulse-compute-tg`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/taxpulse-api-tg/9fda5367923a4d11`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/taxpulse-compute-tg/23066ec2f8ba4317`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-rules --listener-arn arn:aws:elasticloadbalancing:us-east-1:000000000000:listener/app/taxpulse-alb/89fcd392b0674cad/3adae4526d0a4617`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecs stop-task --cluster taxpulse-cluster --task arn:aws:ecs:us-east-1:000000000000:task/taxpulse-cluster/a66df51a9acf4604b5ae7df9e913fbc8 --reason 'Task 3 replacement smoke test'`
- `jq -e '([.. | objects | select(has("Resource")) | .Resource | (if type == "array" then .[] else . end) | select(. == "*")] | length) == 0 and ([.. | objects | select(has("Action")) | .Action | (if type == "array" then .[] else . end) | select(. == "*" or test(":\\*$"))] | length) == 0' iam/task-role.json`
- `git diff --check`

Verification output:

```text
$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr describe-repositories --repository-names taxpulse-api taxpulse-compute
[
  {
    "name": "taxpulse-api",
    "mutability": "IMMUTABLE",
    "uri": "000000000000.dkr.ecr.us-east-1.localhost:5100/taxpulse-api"
  },
  {
    "name": "taxpulse-compute",
    "mutability": "IMMUTABLE",
    "uri": "000000000000.dkr.ecr.us-east-1.localhost:5100/taxpulse-compute"
  }
]

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr describe-images --repository-name taxpulse-api --image-ids imageTag=w7d1
{"tags":["w7d1"],"digest":"sha256:abdc5c722f1db4838918f07fd2a52d6dde6dd22394daa94ab00a19177c672be1"}

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr describe-images --repository-name taxpulse-compute --image-ids imageTag=w7d1
{"tags":["w7d1"],"digest":"sha256:fbaa420625b8ed81d89e02bfafba55119adfcf5ed2ed762eb43"}

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr get-lifecycle-policy --repository-name taxpulse-api
Rule 1: tagged images only, expire images older than the most recent 10.
Rule 2: untagged images only, expire images older than the most recent 1.

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecr put-image --repository-name taxpulse-api --image-tag w7d1 --image-manifest '{"schemaVersion":2}'
An error occurred (UnsupportedOperation) when calling the PutImage operation: Operation PutImage is not supported.

Duplicate-tag note:
The repositories report IMMUTABLE, but floci does not support ECR PutImage and its backing
Docker registry accepted an overwrite during local fidelity testing. The deployed digest was
restored to the expected w7d1 API digest above. Repeat duplicate-tag rejection in real AWS.

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecs describe-task-definition --task-definition taxpulse-api:2
family=taxpulse-api compat=FARGATE networkMode=awsvpc cpu=256 memory=512
executionRoleArn=arn:aws:iam::000000000000:role/taxpulse-ecs-execution
taskRoleArn=arn:aws:iam::000000000000:role/taxpulse-ecs-task
image=000000000000.dkr.ecr.us-east-1.localhost:5100/000000000000/us-east-1/taxpulse-api:w7d1

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecs describe-task-definition --task-definition taxpulse-compute:2
family=taxpulse-compute compat=FARGATE networkMode=awsvpc cpu=256 memory=512
executionRoleArn=arn:aws:iam::000000000000:role/taxpulse-ecs-execution
taskRoleArn=arn:aws:iam::000000000000:role/taxpulse-ecs-task
image=000000000000.dkr.ecr.us-east-1.localhost:5100/000000000000/us-east-1/taxpulse-compute:w7d1

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecs describe-services --cluster taxpulse-cluster --services taxpulse-api taxpulse-compute
taxpulse-api     taskDefinition=taxpulse-api:2     desired=1 running=1 pending=0 status=ACTIVE assignPublicIp=DISABLED
taxpulse-compute taskDefinition=taxpulse-compute:2 desired=1 running=1 pending=0 status=ACTIVE assignPublicIp=DISABLED

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-load-balancers --names taxpulse-alb
name=taxpulse-alb scheme=internet-facing type=application state=active
subnets=subnet-f6b22bc8,subnet-e9005df2
securityGroups=sg-a8540ab47c2a3ccb2

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-target-groups --names taxpulse-api-tg taxpulse-compute-tg
taxpulse-api-tg     targetType=ip port=3000 healthPath=/ready  healthProtocol=HTTP
taxpulse-compute-tg targetType=ip port=8000 healthPath=/health healthProtocol=HTTP

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/taxpulse-api-tg/9fda5367923a4d11
target=172.18.0.9:3000 state=healthy

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/taxpulse-compute-tg/23066ec2f8ba4317
target=172.18.0.8:8000 state=healthy

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-rules --listener-arn arn:aws:elasticloadbalancing:us-east-1:000000000000:listener/app/taxpulse-alb/89fcd392b0674cad/3adae4526d0a4617
priority 5:  /v1/calculate, /v1/scenario, /compute/* -> taxpulse-compute-tg
priority 10: /v1/*, /v1 -> taxpulse-api-tg
default: fixed 404

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecs stop-task --cluster taxpulse-cluster --task arn:aws:ecs:us-east-1:000000000000:task/taxpulse-cluster/a66df51a9acf4604b5ae7df9e913fbc8 --reason 'Task 3 replacement smoke test'
stoppedReason="Task 3 replacement smoke test"

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecs list-tasks --cluster taxpulse-cluster --desired-status RUNNING
arn:aws:ecs:us-east-1:000000000000:task/taxpulse-cluster/d1151c95489f482e8860051cdc5dd8ca
arn:aws:ecs:us-east-1:000000000000:task/taxpulse-cluster/092e2e2577384062ab9f621615c6a846

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 ecs describe-services --cluster taxpulse-cluster --services taxpulse-api
taxpulse-api desired=1 running=1 pending=0

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 elbv2 describe-target-health --target-group-arn arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/taxpulse-api-tg/9fda5367923a4d11
replacement target health=healthy

$ docker compose exec -T floci python3 -c "import urllib.request; print(urllib.request.urlopen('http://172.18.0.9:3000/ready', timeout=3).read().decode())"
{"database":"ok","service":"taxpulse-api","status":"ready"}

$ docker compose exec -T floci python3 -c "import urllib.request; print(urllib.request.urlopen('http://172.18.0.8:8000/health', timeout=3).read().decode())"
{"status":"ok"}

$ docker compose exec -T floci python3 -c "import ssl, urllib.request; ctx=ssl._create_unverified_context(); print(urllib.request.urlopen('https://taxpulse-alb-89fcd392b0674cad.elb.floci/v1/health', timeout=5, context=ctx).status)"
urllib.error.URLError: <urlopen error [Errno -2] Name or service not known>

ALB smoke note:
The ALB, listener, path rules, target groups, and healthy registered targets exist in floci,
but floci's generated ALB DNS name did not resolve from inside the emulator container.
Direct readiness to both registered task targets succeeded. Repeat through-ALB smoke in real AWS.

$ jq -r '.securityGroups[] | [.groupName, ([.inboundRules[]? | {fromPort,toPort,cidrBlocks,sourceSecurityGroup}] | tostring)] | @tsv' alb/networking.json
alb-sg  [{"fromPort":443,"toPort":443,"cidrBlocks":["0.0.0.0/0"],"sourceSecurityGroup":null}]
task-sg [{"fromPort":3000,"toPort":3000,"cidrBlocks":null,"sourceSecurityGroup":"alb-sg"},{"fromPort":8000,"toPort":8000,"cidrBlocks":null,"sourceSecurityGroup":"alb-sg"}]
db-sg   [{"fromPort":5432,"toPort":5432,"cidrBlocks":null,"sourceSecurityGroup":"task-sg"}]

$ jq -e '([.. | objects | select(has("Resource")) | .Resource | (if type == "array" then .[] else . end) | select(. == "*")] | length) == 0 and ([.. | objects | select(has("Action")) | .Action | (if type == "array" then .[] else . end) | select(. == "*" or test(":\\*$"))] | length) == 0' iam/task-role.json
true

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 iam list-attached-role-policies --role-name taxpulse-ecs-execution
AttachedPolicies=[AmazonECSTaskExecutionRolePolicy]

$ jq -r '.inlinePolicies[].policyDocument.Statement[] | [(.Action|join(",")),(.Resource|join(","))] | @tsv' iam/task-role.json
secretsmanager:GetSecretValue arn:aws:secretsmanager:us-east-1:000000000000:secret:taxpulse/local/db-password,arn:aws:secretsmanager:us-east-1:000000000000:secret:taxpulse/local/jwt-signing-keys
dynamodb:BatchWriteItem,dynamodb:CreateTable,dynamodb:DescribeTable,dynamodb:PutItem,dynamodb:Query arn:aws:dynamodb:us-east-1:000000000000:table/taxpulse-plan-cycle-read-model,arn:aws:dynamodb:us-east-1:000000000000:table/taxpulse-plan-cycle-read-model/index/GSI1
sns:CreateTopic,sns:Publish,sns:Subscribe arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed
sqs:CreateQueue,sqs:DeleteMessage,sqs:GetQueueAttributes,sqs:ReceiveMessage,sqs:SendMessage,sqs:SetQueueAttributes arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-projection,arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-dlq

$ jq empty ecr/lifecycle-policy.json ecs/task-definition.json ecs/service.json alb/load-balancer.json alb/target-group.json alb/listener.json alb/networking.json iam/execution-role.json iam/task-role.json
Result: all JSON parsed successfully.

$ docker compose config --quiet
Result: parsed successfully.

$ git diff --check
Result: no whitespace errors.
```

## AI review evidence

Codex review output:

```text
Rubric result: Pass with two floci fidelity caveats.

- ECR: taxpulse-api and taxpulse-compute repositories exist with imageTagMutability
  IMMUTABLE; both deployed images are present as w7d1 and no :latest tag appears in the
  ECS task definitions. Lifecycle policy has separate tagged and untagged expiry rules.
- Fargate/ALB: both task definitions use requiresCompatibilities FARGATE, networkMode
  awsvpc, cpu 256, memory 512, distinct execution/task roles, pinned ECR images, awslogs,
  and m7d1 readiness health checks. ECS services are ACTIVE with desired=1 and running=1.
  ALB is active and internet-facing; target groups are TargetType ip and report healthy.
- Networking: alb/networking.json keeps ALB in public subnets, tasks in private app
  subnets, Postgres in private DB subnets, and chains alb-sg -> task-sg -> db-sg with no
  private 0.0.0.0/0 inbound.
- IAM: execution role has only AmazonECSTaskExecutionRolePolicy and no inline policies;
  task role lists exact Secrets Manager, DynamoDB, SNS, and SQS actions/resources with no
  Action or Resource wildcards.
```

What it missed:

```text
The first pass could have overstated floci fidelity. A human-readable evidence check
caught that floci ECR does not support PutImage and its backing registry does not enforce
immutable-tag overwrite rejection, and that floci's ALB DNS name did not resolve for the
through-ALB smoke. The PR documents both as repeat checks for real AWS instead of claiming
local pass signals that the emulator did not provide.
```

## AI-tool reflection

I accepted Codex's suggestion to keep the ECS task definitions on `requiresCompatibilities:
FARGATE`, `networkMode: awsvpc`, valid `256/512` sizing, and `TargetType: ip` target
groups because those are the real Fargate constraints that floci may not fully protect
us from. I rejected an early path that would have treated the emulator's convenience
behavior as proof of AWS behavior: no mutable `:latest` image was allowed in the deploy
path, no health check was pointed at `/`, no private security group received a
`0.0.0.0/0` rule, and the duplicate-tag/ALB-DNS gaps were recorded as emulator caveats
instead of being papered over.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli`.

## AI code-review checklist

- [X] stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [X] Workflow changes keep stage transitions gated by role and current stage.
- [X] typed boundaries are preserved with the existing TypeScript schema or Python Pydantic validation patterns.
- [X] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [X] Tests or documented verification cover the changed behavior, including relevant negative paths.
- [X] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [X] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

## Deliverables checklist

- [X] Summary explains what changed.
- [X] Related ADR is linked, or `N/A` is stated for no architectural decision change.
- [X] Testing lists only checks or verification actually performed.
- [X] Verification output included as a code block.
- [X] Verification output includes duplicate-tag rejection attempt and floci caveat.
- [X] Verification output includes service steady state with healthy target groups.
- [X] Verification output includes a stopped task being replaced.
- [X] Verification output includes smoke request attempt through the ALB and floci DNS caveat.
- [X] Verification output includes security-group reads showing least exposure.
- [X] Verification output includes task-role reads showing no wildcards.
- [X] AI review output is pasted above as a quote or code block.
- [X] "What it missed" note is pasted above as a quote or code block.
- [X] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [X] AI code-review checklist is completed.
- [X] PR is self-assigned in Assignees.
- [X] `Isaiah Muli` is requested under Reviewers.
