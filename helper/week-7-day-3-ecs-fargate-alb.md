🕐 Last Updated: 2026-07-18 19:31:15 UTC
📌 Commit: e9c558d5
Week 7 · Day 3
ECS Fargate & ALB
Stand the capstone backend up on AWS compute — push images to ECR with immutable tags and a lifecycle policy, define ECS Fargate tasks and services behind an Application Load Balancer, place them in a VPC with public and private subnets and least-exposure security groups, and grant separate least-privilege task and execution IAM roles — all against LocalStack, with the choice recorded in ADR-0020.

1
Topic 1 of 5
ECR — image lifecycle policies and immutable tags
Why Do I Need to Know This?
ECS pulls the images you built in 7.1 Docker & Multi-stage Builds from a registry, so the registry is the first thing to stand up. For a federal cohort its hygiene matters: immutable tags mean a deployed tag can never be silently overwritten (you can prove what shipped), and a lifecycle policy stops old images from piling up as cost and audit surface. Get the registry right and everything downstream — the task definition, the service, the deploy — pulls from a trustworthy source.

Scenario
The team needs a home for the Express and FastAPI images that ECS can pull. They create an ECR repository per service, turn on tag immutability so :1.4.2 always means the same bytes, and add a lifecycle policy that expires untagged and old images automatically.

Theory
ECR is the registry ECS pulls from
ECR is AWS’s managed container registry. After the build-and-scan step from 7.1 Docker & Multi-stage Builds, the image is pushed to an ECR repository, and the ECS task definition later references it by its repository URI and tag. On LocalStack, ECR is emulated so the team can push and pull locally before using a real registry in Week 8 — note that ECR/ALB fidelity is limited on LocalStack’s free Community tier, so this cohort’s paid tier is assumed.

Immutable tags make deploys reproducible and auditable
ECR repositories can be configured with tag immutability. With immutable tags, pushing a tag that already exists is rejected — so once :1.4.2 is pushed, that tag always points to the same image. With mutable tags, a new push can overwrite the tag, and the old image silently becomes untagged. Immutable tags are what let an auditor confirm exactly which bytes a given version deployed, which is why they are the federal default.

Lifecycle policies expire old images by rule
A lifecycle policy is a set of rules that expire images automatically. Each rule has a rulePriority, a selection (which images it matches — by tagStatus, a tagPrefixList when tagStatus is "tagged", a count type like imageCountMoreThan, and a countNumber), and an action (expire). A common pair of rules keeps only the most recent N tagged images and expires untagged images down to one, so the registry does not grow without bound.

!
Warning
Lifecycle rules delete images — test them carefully. A rule meant to "keep images for a long time" can instead expire them if the selection criteria are wrong; ECR evaluates all rules together and applies by priority. Verify a policy expires only what you intend before trusting it on a real registry.

An image flows into ECR and is pulled by ECS
The built, scanned image is pushed to ECR under an immutable tag; ECS pulls it by tag, and a lifecycle policy expires old and untagged images.

Build + scan (7.1)

Push to ECR (immutable tag)

ECS pulls the image by tag

Lifecycle policy expires old and untagged images

Example
a lifecycle policy that expires old and untagged images
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep only the last 10 tagged images",
      "selection": {
        "tagStatus": "tagged",
        "tagPrefixList": ["v", "1", "2"],
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": { "type": "expire" }
    },
    {
      "rulePriority": 2,
      "description": "Expire untagged images beyond the most recent one",
      "selection": {
        "tagStatus": "untagged",
        "countType": "imageCountMoreThan",
        "countNumber": 1
      },
      "action": { "type": "expire" }
    }
  ]
}
Copy
Rule 1 keeps the 10 most recent tagged images and expires older ones — recent rollback targets stay, ancient ones go. tagPrefixList matches which tags the rule applies to; ["v", "1", "2"] here catches both a v-prefixed convention and this service’s own 1.4.2-style version tags.
Rule 2 keeps a single untagged image and expires the rest; untagged images accumulate when a mutable tag is overwritten, but with immutable tags this mostly catches stray pushes.
Combined with tag immutability (set on the repository, not in this policy), the registry stays small and every retained tag is provably unchanged.
AI Practice
Prompt it
Have Codex draft the ECR repository config and lifecycle policy, then verify the retention matches intent.

Write the ECR setup for our filing-api service: a repository with image tag
immutability enabled, and a lifecycle policy with two rules — keep the last 10
tagged images, and expire untagged images beyond the most recent one. Show the
repository setting and the lifecycle policy JSON, and explain which images each
rule expires.
Copy
Watch out
Codex sometimes writes a lifecycle rule whose selection is broader than intended (for example, tagStatus: any), which can expire images you meant to keep, or leaves tags mutable so a deploy can overwrite a released tag. Confirm tag immutability is on and trace, rule by rule, exactly which images each rule expires before applying it.

Verify
Push the same tag twice to the (LocalStack) repository and confirm the second push is rejected because tags are immutable. Push several images and confirm the lifecycle policy retains exactly the count you intended and expires the rest. Read each rule’s selection aloud and name the images it matches. Record any over-broad rule or mutable tag in your prompt journal.

Knowledge Check
1. Why enable image tag immutability on the ECR repository?
It compresses each image so the repository uses less storage overall.
A pushed tag can’t be overwritten, so a version is provably fixed.
It allows the same tag to point at several images for canary tests.
It automatically scans every pushed image for vulnerabilities first.
2. What does an ECR lifecycle policy do?
It signs each image so consumers can verify its provenance on pull.
It mirrors the repository to a second region for disaster recovery.
It promotes images from a staging tag to a production tag on a schedule.
It expires images by rule so the registry doesn’t grow forever.
3. With immutable tags, what happens if you try to push :1.4.2 when it already exists?
The push is rejected; the existing tag keeps its image.
The new image is stored and the old one is deleted immediately.
Both images are kept and the tag points to whichever is newer.
The push succeeds and the previous image becomes untagged.
4. Why does the team add a rule to expire untagged images?
Because untagged images cannot be pulled by ECS under any condition.
Because ECR refuses new pushes once any untagged image exists.
Because untagged images accumulate and waste registry space.
Because untagged images are a security vulnerability by definition.
2
Topic 2 of 5
ECS Fargate — tasks, services, target groups, and the ALB
Why Do I Need to Know This?
This is the heart of the lesson: the model that runs the long-lived capstone services on AWS. Fargate removes server management — there is no EC2 host to patch or scale — and the task/service/ALB triad turns a container into a load-balanced, self-healing service that deploys new versions without dropping traffic. Choosing Fargate over Kubernetes for this cohort is a real architectural decision, recorded in ADR-0020.

Scenario
The team must run the Express and FastAPI services as always-on, load-balanced workloads with no servers to manage, and ship new versions without downtime. They write an ECS task definition for each service, wrap it in a service behind an Application Load Balancer, and deploy against LocalStack to confirm the service reaches steady state before Week 8’s real-AWS deploy.

Theory
Task definition, task, and service
A task definition is the blueprint: which image (from ECR), how much CPU and memory, which ports, which environment, and the two IAM roles (covered in the Two IAM roles — task role versus execution role topic). A task is one running instance of that blueprint. A service keeps a desired number of tasks running, replacing any that become unhealthy — that is what makes the workload self-healing. For Fargate, the task definition must set requiresCompatibilities: ["FARGATE"], networkMode: "awsvpc", and a valid CPU/memory pair (for example 256 CPU units with 512 MiB).

Fargate is serverless containers
With the Fargate launch type, AWS runs your task without you managing any EC2 hosts — no cluster of servers to patch, scale, or right-size. You specify CPU and memory; AWS provides the capacity. This is the basis of ADR-0020: for this federal cohort, ECS Fargate is chosen over Kubernetes specifically to avoid the operational overhead of running a cluster, while still getting containerized, scalable services.

i
Note
Why not Kubernetes? Kubernetes is powerful but carries a large operational surface — control-plane upgrades, node pools, networking add-ons. For a small federal delivery team shipping a handful of services, ECS Fargate delivers containerized, load-balanced, self-healing workloads with far less to operate and secure. ADR-0020 records this trade-off so the next engineer sees the reasoning, not just the result.

The ALB routes to a target group of tasks
An Application Load Balancer is the public entry point. The ECS service registers its tasks into a target group, and the ALB routes traffic across the healthy targets. The ALB runs its own HTTP health check against each task — polling the same readiness endpoint the app exposes for the Docker HEALTHCHECK from 7.1 Docker & Multi-stage Builds, not the Docker healthcheck command itself — and only sends traffic to tasks that pass. A task that fails the check is taken out of rotation.

Rolling deploys ship new versions without downtime
When you update the service to a new task-definition revision, ECS performs a rolling deploy: it starts new-version tasks, waits for them to pass the health check, registers them with the target group, then drains and stops the old tasks. Because draining lets in-flight requests finish — which works only if the service handles SIGTERM as set up in 7.1 Docker & Multi-stage Builds — the deploy drops zero requests. (Blue/green deploys come in Week 8; this week is rolling).

The ALB routes traffic to healthy Fargate tasks
The ALB sends traffic to a target group of Fargate tasks; the ECS service keeps the desired number healthy, and the ALB health check decides which tasks receive traffic.

replaces unhealthy

health check decides routing

Internet

Application Load Balancer

Target group

Fargate task 1

Fargate task 2

ECS service keeps N tasks running

Example
a trimmed fargate task definition
{
  "family": "filing-api",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::000000000000:role/filing-api-execution",
  "taskRoleArn": "arn:aws:iam::000000000000:role/filing-api-task",
  "containerDefinitions": [
    {
      "name": "filing-api",
      "image": "000000000000.dkr.ecr.us-east-1.amazonaws.com/filing-api:1.4.2",
      "portMappings": [{ "containerPort": 3000 }],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": { "awslogs-group": "/ecs/filing-api", "awslogs-region": "us-east-1", "awslogs-stream-prefix": "ecs" }
      }
    }
  ]
}
Copy
requiresCompatibilities, networkMode: "awsvpc", and the cpu/memory pair are mandatory for Fargate; 256/512 is one of the valid combinations.
The image is the immutable ECR tag from the ECR — image lifecycle policies and immutable tags topic — the service pulls exactly those bytes.
Two distinct role ARNs (executionRoleArn, taskRoleArn) keep launch-time and runtime permissions separate — the subject of the Two IAM roles — task role versus execution role topic.
AGENTS.md rule: task definitions live in version-controlled IaC and are never hand-edited in the console.
{
  "serviceName": "filing-api-service",
  "taskDefinition": "filing-api",
  "desiredCount": 2,
  "loadBalancers": [
    { "targetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:000000000000:targetgroup/filing-api/abc123", "containerName": "filing-api", "containerPort": 3000 }
  ],
  "healthCheckGracePeriodSeconds": 30
}
Copy
loadBalancers is what registers the service’s tasks into the target group; containerName/containerPort must match the container definition above.
healthCheckGracePeriodSeconds gives a new task time to start before a failed health check counts against it, mirroring the start_period idea from 7.2 Docker Compose & LocalStack’s healthchecks.
AI Practice
Prompt it
Have Codex draft the task definition and service, then verify it reaches steady state on LocalStack.

Write a Fargate task definition for our filing-api service: requiresCompatibilities
FARGATE, awsvpc network mode, 256 CPU / 512 memory, the image from our ECR repo at
tag 1.4.2, container port 3000, awslogs logging, and separate executionRoleArn and
taskRoleArn. Then write an ECS service that runs 2 tasks behind a target group with
an ALB health check on our readiness endpoint. We deploy to LocalStack first.
Copy
Watch out
Codex frequently omits networkMode: awsvpc or picks an invalid CPU/memory pair (which Fargate rejects), collapses the two IAM roles into one, or points the ALB health check at / instead of the real readiness endpoint. It may also hard-code a mutable :latest image. Confirm the Fargate fields are valid, the two roles are separate, the health check targets readiness, and the image tag is immutable.

Verify
Deploy the task definition and service to LocalStack and confirm the service reaches steady state with the desired task count running. Confirm the target group reports its tasks healthy against the readiness endpoint. Note where LocalStack diverges from real AWS — health-check timing and some routing behaviors are approximate — and flag those checks to repeat on real AWS in Week 8. Record any invalid Fargate field or single-role task definition in your prompt journal.

Knowledge Check
1. What is the difference between a task definition, a task, and a service in ECS?
A blueprint, one running instance, and a manager keeping N healthy.
A network, a subnet inside it, and a load balancer that fronts the subnet.
Three names for the same running container, used in different AWS consoles.
A build step, a test step, and a deploy step in the CI pipeline.
2. Why does this cohort choose ECS Fargate over Kubernetes (per ADR-0020)?
Because Kubernetes cannot run containers behind a load balancer at all.
Because Fargate is the only AWS option that supports container images.
Because Kubernetes is not available in any AWS region this year.
Fargate runs containers with no cluster for the team to operate.
3. What makes an ECS service "self-healing"?
It patches the operating system on each task automatically every night.
It rewrites the application code when a task returns errors to clients.
It replaces tasks that fail their health check to keep N running.
It increases each task’s CPU and memory whenever traffic rises sharply.
4. During a rolling deploy, why does the old task need to handle SIGTERM?
So the ALB can assign it a new IP address before traffic shifts over.
So it drains in-flight requests before stopping, dropping none.
So ECS can skip the health check on the replacement tasks entirely.
So the task definition revision number increments on each deploy.
3
Topic 3 of 5
Networking — VPC, subnets, and security groups
Why Do I Need to Know This?
A federal service does not put its application tasks or database on the public internet. The VPC layout — public subnets for the load balancer, private subnets for the tasks and data — together with security groups that allow only the necessary traffic, is the network posture an auditor checks first. Getting least-exposure networking right is what makes the Fargate service from the ECS Fargate — tasks, services, target groups, and the ALB topic safe to expose.

Scenario
Only the ALB should be reachable from the internet. The Fargate tasks and Postgres must sit in private subnets, reachable only from the ALB and from each other on specific ports. The team designs the VPC, subnets, and security groups so nothing is exposed that does not need to be, and draws the topology diagram that goes into the ADR-0020 package.

Theory
A VPC with public and private subnets
A VPC is the private network the stack runs in; subnets partition it. Public subnets have a route to an internet gateway and hold internet-facing resources — here, the ALB. Private subnets have no direct inbound internet route and hold the Fargate tasks and the database. Traffic from the internet reaches the tasks only by passing through the ALB in the public subnet.

Security groups are stateful allow-rules
A security group is a virtual firewall attached to a resource that allows specific inbound (and outbound) traffic; everything not allowed is denied. Security groups are stateful — if an inbound request is allowed, its response is automatically allowed back out, so you write rules in one direction. Crucially, a rule can reference another security group as its source rather than an IP range, which is how you express "only the ALB may reach the tasks."

Chain the groups for least exposure
The three security groups form a chain, each allowing traffic only from the one in front of it:

The ALB security group allows 443 from the internet.
The task security group allows the app port (3000) only from the ALB security group.
The database security group allows 5432 only from the task security group.
Nothing is reachable that does not need to be: the tasks accept traffic only from the ALB, and the database accepts traffic only from the tasks.

!
Important
Never open a private resource to 0.0.0.0/0 (CIDR). A task or database security group that allows its port from anywhere defeats the private-subnet design and is an immediate audit finding. Source every private allow-rule from the security group in front of it, not from an IP range.

Public ALB, private tasks and database, chained security groups
The ALB sits in a public subnet; tasks and the database sit in private subnets, each reachable only from the tier in front of it.

VPC

Private subnet

Public subnet

Internet gateway

ALB (SG allows 443 from internet)

Fargate tasks (SG allows 3000 from ALB SG)

Postgres (SG allows 5432 from task SG)

Example
chained security-group rules
ALB security group (alb-sg)
  inbound: allow TCP 443 from 0.0.0.0/0        # the only internet-facing rule

Task security group (task-sg)
  inbound: allow TCP 3000 from alb-sg          # only the ALB may reach the app port

Database security group (db-sg)
  inbound: allow TCP 5432 from task-sg         # only the tasks may reach Postgres
Copy
The ALB security group is the only one with an internet-facing rule; it terminates public traffic.
The task security group sources its rule from alb-sg (a security group, not an IP), so only the ALB can reach port 3000 — no matter how the ALB’s address changes.
The database security group sources from task-sg, so Postgres is reachable only from the application tasks. Each tier trusts only the tier directly in front of it.
AI Practice
Prompt it
Have Codex design the VPC and security groups, then verify nothing private is open to the internet.

Design the network for our Fargate service on LocalStack: a VPC with public and
private subnets, an ALB in the public subnet, and the Fargate tasks plus Postgres
in private subnets. Write three security groups — ALB allows 443 from the internet,
the task SG allows port 3000 only from the ALB SG, and the DB SG allows 5432 only
from the task SG. Source each private rule from a security group, not an IP range.
Copy
Watch out
Codex often places the tasks in a public subnet for convenience, or sources the task/DB rules from 0.0.0.0/0 instead of the upstream security group — both expose private resources. It may also merge everything into one security group. Confirm tasks and the database are in private subnets and every private allow-rule references the security group in front of it, never an open CIDR.

Verify
Inspect the security groups and confirm only the ALB SG has an internet-facing rule; the task and DB groups must source from the SG in front of them. Confirm the tasks and database are in private subnets with no direct internet route. Because LocalStack’s enforcement of subnet routing and SG rules is approximate, treat this as the design of record and re-verify the actual enforcement on real AWS in Week 8. Record any public-subnet task or 0.0.0.0/0 rule in your prompt journal.

Knowledge Check
1. Why place the Fargate tasks in a private subnet rather than a public one?
Private subnets give containers more CPU and memory than public ones.
Public subnets cannot run Fargate tasks for technical reasons.
Private subnets automatically encrypt all traffic between the tasks.
So the tasks aren’t reachable from the internet except via the ALB.
2. What does it mean that security groups are "stateful"?
They store the contents of each request for later audit and replay.
An allowed request’s response is permitted back automatically.
They keep their rules even after the attached resource is deleted.
They apply their rules to every resource in the VPC at once.
3. How should the task security group allow traffic on the app port?
From 0.0.0.0/0, so the service is reachable for easy testing.
From the database security group, so the DB can call the tasks.
From the ALB security group, so only the ALB reaches it.
From the entire VPC CIDR, so any resource in the VPC can connect.
4. Why source a private security-group rule from another security group instead of an IP range?
It ties access to a role, surviving IP changes, with least exposure.
Because security groups cannot accept IP ranges as a source at all.
Because IP-based rules are billed at a higher rate than SG references.
Because an SG reference automatically encrypts the allowed traffic.
4
Topic 4 of 5
Two IAM roles — task role versus execution role
Why Do I Need to Know This?
A common and dangerous mistake is collapsing ECS’s two IAM roles into one over-permissioned role. They exist for different actors at different moments, and least privilege — a graded, federal requirement and an explicit exit criterion for this module — depends on getting them right. This is the permission half of the safe Fargate service you have been building all lesson.

Scenario
The team’s first task definition uses one broad role for everything, and the review flags it. ECS needs a role to pull the image and write logs before the app even starts; the app needs a separate role to call AWS APIs while it runs. The team splits them and scopes each to exactly what it needs.

Theory
The execution role: infrastructure-time permissions
The task execution role is assumed by the ECS/Fargate agent — not your code — to do the work of launching the task: pull the image from ECR, fetch secrets, and write logs to CloudWatch. AWS provides a managed policy, AmazonECSTaskExecutionRolePolicy, that grants exactly these common permissions (ECR pull plus CloudWatch Logs). These credentials are used by the agent and are not accessible to your container’s code.

The task role: runtime permissions
The task role is assumed by your application code inside the container to call AWS APIs while it runs — read an object from S3, publish to SNS, query DynamoDB. It is scoped to exactly the APIs the app actually uses, and nothing broader. This is the role that answers "what is this service allowed to do in AWS?"

Why they must stay separate
The two roles serve different actors at different times, so least privilege requires keeping them apart. The execution role should not carry your app’s S3 or SNS permissions; the task role should not carry image-pull or log-write permissions. Combining them into one role grants the application far more than it needs and grants the launch agent far more than it needs — exactly the over-privilege an audit flags.

!
Warning
A single shared role is the easy wrong answer. If the app’s runtime permissions and the launch agent’s pull/log permissions live in one role, every container runs with the union of both — a broad blast radius if the app is ever compromised. Keep executionRoleArn and taskRoleArn distinct and minimal.

Execution role at launch, task role at runtime
The execution role is used by the agent to launch the task; the task role is used by the application code while the task runs.

Task launch (ECS/Fargate agent)

Execution role: pull ECR image, fetch secrets, write logs

Task running (your app code)

Task role: read S3, publish SNS, query DynamoDB

Example
the two roles, scoped separately
// Execution role — used by the ECS agent at launch
{
  "managedPolicy": "AmazonECSTaskExecutionRolePolicy",
  "grants": ["ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage", "logs:CreateLogStream", "logs:PutLogEvents"]
}

// Task role — used by the app code at runtime, scoped to just what it calls
{
  "grants": [
    "s3:GetObject on arn:aws:s3:::filing-uploads/*",
    "sns:Publish on arn:aws:sns:us-east-1:000000000000:filing-events"
  ]
}
Copy
The execution role uses the AWS-managed AmazonECSTaskExecutionRolePolicy — image pull and log writes, the launch-time essentials, and nothing about the app’s domain.
The task role lists only the specific actions and resources the application calls — one S3 prefix and one SNS topic — not a wildcard.
Splitting them means a compromised app can reach only its two declared resources, and the launch agent can never touch the app’s data.
AI Practice
Prompt it
Have Codex write both roles separately, then verify each is scoped to only what it needs.

Write two IAM roles for our filing-api Fargate task. The execution role should use
the AmazonECSTaskExecutionRolePolicy managed policy (ECR pull + CloudWatch Logs).
The task role should grant only the app's runtime calls: s3:GetObject on the
filing-uploads bucket prefix and sns:Publish on the filing-events topic — no
wildcards. Reference them as executionRoleArn and taskRoleArn in the task definition.
Copy
Watch out
Codex often merges the two roles or grants the task role broad wildcards (s3:*, Resource: "*"). It may put the app’s S3/SNS permissions on the execution role, or the ECR/logs permissions on the task role. Confirm the two roles are separate, the execution role carries only launch-time permissions, and the task role lists only the specific resources the app calls.

Verify
Read the task role and confirm it grants only the exact actions and resource ARNs the app uses — no wildcards. Read the execution role and confirm it carries only image-pull and log permissions. Confirm the task definition references them as two distinct ARNs. Because LocalStack’s IAM enforcement is approximate, treat least privilege as verified by inspection now and confirm actual enforcement on real AWS in Week 8. Record any merged role or wildcard grant in your prompt journal.

Knowledge Check
1. What is the execution role used for?
The app code uses it at runtime to read from S3 and publish to SNS.
The ECS agent uses it to pull the image and write logs.
It defines which developers may deploy a new task-definition revision.
It encrypts the container’s filesystem while the task is running.
2. Which role does the application’s code use to call AWS APIs while it runs?
The task role.
The execution role, which the agent shares with the app at startup.
The ALB’s security group, which doubles as the runtime IAM role.
The repository’s lifecycle policy role created alongside the image.
3. What does the managed AmazonECSTaskExecutionRolePolicy grant?
Full administrative access to the account for convenience during deploys.
Permission for the app to read and write every S3 bucket in the account.
The right for developers to open a shell into a running task.
Permission to pull images from ECR and write logs to CloudWatch.
4. Why keep the task role and execution role separate instead of using one role?
Because ECS bills separately for each distinct IAM role attached to a task.
Because a single role cannot hold both ECR and S3 permissions at once.
Least privilege — neither actor gets the other’s permissions.
Because the execution role must live in a different region than the task role.
5
Topic 5 of 5
Practice — deploy the backend to ECS Fargate on LocalStack
Why Do I Need to Know This?
This lesson’s payoff is the capstone backend running on AWS compute: images in ECR with immutable tags, a Fargate service behind an ALB that reaches steady state and self-heals, a VPC where only the ALB faces the internet, and two least-privilege IAM roles. The way to know you have it is to deploy the whole thing to LocalStack with Codex and then attack it — push a duplicate tag and watch immutability reject it, confirm the service replaces a killed task, check that nothing private is open to the internet, and read the task role for wildcards. These definitions are exactly what Week 8 turns into real-AWS Terraform.

AI Practice
Prompt it
Hands-on practice for this lesson — stand the backend up on ECS Fargate against LocalStack with Codex, then break each guarantee.

Deploy our filing-api backend to ECS Fargate on LocalStack: (1) an ECR repo with
immutable tags and a lifecycle policy (keep last 10 tagged, expire untagged beyond
one); (2) a Fargate task definition (awsvpc, valid CPU/memory, the ECR image,
container port 3000, separate execution and task roles) and a service of 2 tasks
behind an ALB with a health check on the readiness endpoint; (3) a VPC with the ALB
public and tasks plus Postgres private, security groups chained ALB→tasks→DB; (4)
the execution role using AmazonECSTaskExecutionRolePolicy and a task role scoped to
just s3:GetObject and sns:Publish. Show the ECR policy, task definition, service,
SGs, and both roles.
Copy
Watch out
Codex is likely to leave tags mutable, pick an invalid Fargate CPU/memory pair or omit awsvpc, place tasks in a public subnet or source SG rules from 0.0.0.0/0, merge the two IAM roles, and grant the task role wildcards. Each may still "deploy" on LocalStack while breaking a real guarantee. Read tag immutability, the Fargate fields, subnet placement and SG sources, role separation, and task-role scope before trusting it.

Verify
Push the same image tag twice and confirm immutability rejects the second. Deploy the service and confirm it reaches steady state, then stop a task and confirm the service launches a replacement. Inspect the SGs and confirm only the ALB faces the internet and private rules source from the SG in front of them. Read the task role and confirm no wildcards. Because LocalStack approximates IAM enforcement, health-check timing, and routing, list every check to repeat on real AWS in Week 8. Record each guarantee that failed on the first pass in your prompt journal.

