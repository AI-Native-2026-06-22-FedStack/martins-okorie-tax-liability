# Evidence — Week 8 Day 1 (Terraform & IaC Scanning)

This file documents verification outputs for the modular Terraform foundation, S3-native state locking, plan/apply discipline, zero-drift verification, and the Day-1 scanning gate checks.

## 1. Remote S3 State Bucket Configuration

The remote S3 state bucket `taxpulse-tfstate-dev` was created locally on floci with versioning enabled, public access blocked, and server-side encryption configured.

Verify queries output:
```bash
$ aws --endpoint-url=http://localhost:4566 s3api get-bucket-versioning --bucket taxpulse-tfstate-dev
{
    "Status": "Enabled"
}

$ aws --endpoint-url=http://localhost:4566 s3api get-public-access-block --bucket taxpulse-tfstate-dev
{
    "PublicAccessBlockConfiguration": {
        "BlockPublicAcls": true,
        "IgnorePublicAcls": true,
        "BlockPublicPolicy": true,
        "RestrictPublicBuckets": true
    }
}

$ aws --endpoint-url=http://localhost:4566 s3api get-bucket-encryption --bucket taxpulse-tfstate-dev
{
    "ServerSideEncryptionConfiguration": {
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                },
                "BucketKeyEnabled": false
            }
        ]
    }
}
```

---

## 2. Reviewed Terraform Plan & Apply Output

Terraform initialized successfully using the S3 remote backend on floci (`use_lockfile = true`, no DynamoDB table) and deployed 38 base resources cleanly against floci:

```bash
$ cd infra/terraform
$ terraform init -reconfigure
Initializing modules...
- iam in modules/iam
- network in modules/network
Initializing provider plugins found in the configuration...
- Finding hashicorp/aws versions matching "~> 6.0"...
- Reusing previous version of hashicorp/aws from the dependency lock file
- Using previously-installed hashicorp/aws v6.59.0

Initializing the backend...
Successfully configured the backend "s3"!

$ terraform plan -out=tfplan
Plan: 38 to add, 0 to change, 0 to destroy.

$ terraform apply "tfplan"
Apply complete! Resources: 38 added, 0 changed, 0 destroyed.

Outputs:

alb_security_group_id = "sg-76f81472e7fd4303b"
db_security_group_id = "sg-cb654e580bfbe6803"
execution_role_arn = "arn:aws:iam::000000000000:role/taxpulse-ecs-execution"
private_app_subnet_ids = [
  "subnet-6df2844c",
  "subnet-ce078d69",
]
private_db_subnet_ids = [
  "subnet-3f972b79",
  "subnet-161197ad",
]
public_subnet_ids = [
  "subnet-25cb927c",
  "subnet-e4406b58",
]
task_role_arn = "arn:aws:iam::000000000000:role/taxpulse-ecs-task"
task_security_group_id = "sg-4543024d036cdf700"
vpc_id = "vpc-cbdddebc"
```

The state list confirms all 38 base resources are tracked in our locked remote S3 backend:
```bash
$ terraform state list
module.iam.data.aws_iam_policy_document.ecs_assume_role
module.iam.data.aws_iam_policy_document.flow_log_assume_role
module.iam.data.aws_iam_policy_document.flow_log_permissions
module.iam.data.aws_iam_policy_document.task_runtime
module.iam.aws_iam_role.ecs_execution
module.iam.aws_iam_role.ecs_task
module.iam.aws_iam_role.flow_log
module.iam.aws_iam_role_policy.flow_log
module.iam.aws_iam_role_policy.task_runtime
module.iam.aws_iam_role_policy_attachment.ecs_execution_policy
module.network.data.aws_availability_zones.available
module.network.aws_cloudwatch_log_group.vpc_flow_log
module.network.aws_default_security_group.default
module.network.aws_flow_log.vpc
module.network.aws_internet_gateway.main
module.network.aws_route.public_internet
module.network.aws_route_table.private_app
module.network.aws_route_table.private_db
module.network.aws_route_table.public
module.network.aws_route_table_association.private_app[0]
module.network.aws_route_table_association.private_app[1]
module.network.aws_route_table_association.private_db[0]
module.network.aws_route_table_association.private_db[1]
module.network.aws_route_table_association.public[0]
module.network.aws_route_table_association.public[1]
module.network.aws_security_group.alb
module.network.aws_security_group.db
module.network.aws_security_group.task
module.network.aws_subnet.private_app[0]
module.network.aws_subnet.private_app[1]
module.network.aws_subnet.private_db[0]
module.network.aws_subnet.private_db[1]
module.network.aws_subnet.public[0]
module.network.aws_subnet.public[1]
module.network.aws_vpc.main
module.network.aws_vpc_security_group_egress_rule.alb_to_api
module.network.aws_vpc_security_group_egress_rule.alb_to_compute
module.network.aws_vpc_security_group_egress_rule.task_to_aws
module.network.aws_vpc_security_group_egress_rule.task_to_db
module.network.aws_vpc_security_group_ingress_rule.alb_https
module.network.aws_vpc_security_group_ingress_rule.db_from_task
module.network.aws_vpc_security_group_ingress_rule.task_from_alb_api
module.network.aws_vpc_security_group_ingress_rule.task_from_alb_compute
```

---

## 3. Zero-Drift Re-Plan Verification

Running `terraform plan` following apply proves zero configuration drift between code and floci:

```bash
$ terraform plan
No changes. Your infrastructure matches the configuration.

Terraform has compared your real infrastructure against your configuration
and found no differences, so no changes are needed.
```

---

## 4. IaC Security Scan Gate Output

Running `scan.sh` yields passing results for both Checkov and Trivy scanners.

```bash
$ bash terraform/scripts/scan.sh
▸ Running Checkov...
✔ Checkov passed.

▸ Running Trivy config scan...
✔ Trivy passed.

Report Summary
┌─────────────────────────┬───────────┬───────────────────┐
│         Target          │   Type    │ Misconfigurations │
├─────────────────────────┼───────────┼───────────────────┤
│ .                       │ terraform │         0         │
├─────────────────────────┼───────────┼───────────────────┤
│ modules/network/main.tf │ terraform │         0         │
└─────────────────────────┴───────────┴───────────────────┘
```

Static scanning evidence files generated under compliance sink (`artifacts/security/`):
- Checkov SARIF: `artifacts/security/results_sarif.sarif`
- Trivy SARIF: `artifacts/security/trivy-results.sarif`
- Human CLI output: `artifacts/security/results_cli.txt`
