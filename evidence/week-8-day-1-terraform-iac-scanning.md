# Evidence — Week 8 Day 1 (Terraform & IaC Scanning)

This file documents verification outputs for the modular Terraform foundation, S3-native state locking, and the Day-1 scanning gate checks.

## 1. Remote S3 State Bucket Configuration

The remote S3 state bucket `taxpulse-tfstate-dev` was created locally on floci with versioning enabled, public access blocked, and server-side encryption configured.

Verify queries output:
```bash
$ aws s3api get-bucket-versioning --bucket taxpulse-tfstate-dev
{
    "Status": "Enabled"
}

$ aws s3api get-public-access-block --bucket taxpulse-tfstate-dev
{
    "PublicAccessBlockConfiguration": {
        "BlockPublicAcls": true,
        "IgnorePublicAcls": true,
        "BlockPublicPolicy": true,
        "RestrictPublicBuckets": true
    }
}

$ aws s3api get-bucket-encryption --bucket taxpulse-tfstate-dev
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

## 2. Terraform Apply Output

Terraform initialized successfully using the S3 backend and deployed 38 resources cleanly against floci:

```bash
$ cd terraform
$ terraform init
Initializing modules...
- iam in modules/iam
- network in modules/network
Initializing provider plugins found in the configuration...
- Finding hashicorp/aws versions matching "~> 6.0"...
- Installing hashicorp/aws v6.59.0...
- Installed hashicorp/aws v6.59.0 (signed by HashiCorp)

Initializing the backend...
Successfully configured the backend "s3"!

$ terraform apply -auto-approve
module.iam.aws_iam_role.flow_log: Creating...
module.iam.aws_iam_role.ecs_execution: Creating...
module.network.aws_cloudwatch_log_group.vpc_flow_log: Creating...
module.iam.aws_iam_role.ecs_task: Creating...
module.network.aws_vpc.main: Creating...
...
module.network.aws_subnet.public[1]: Creation complete after 10s [id=subnet-764ee817]
module.network.aws_subnet.public[0]: Creation complete after 10s [id=subnet-042a5a03]
module.network.aws_route_table_association.public[1]: Creating...
module.network.aws_route_table_association.public[0]: Creating...
module.network.aws_route_table_association.public[0]: Creation complete after 0s [id=rtbassoc-dc66a724]
module.network.aws_route_table_association.public[1]: Creation complete after 0s [id=rtbassoc-89552a61]

Apply complete! Resources: 38 added, 0 changed, 0 destroyed.

Outputs:

alb_security_group_id = "sg-433a4924e22946f68"
db_security_group_id = "sg-dc2d0e5ae92a4fa29"
execution_role_arn = "arn:aws:iam::000000000000:role/taxpulse-ecs-execution"
private_app_subnet_ids = [
  "subnet-abc0c040",
  "subnet-7159c096",
]
private_db_subnet_ids = [
  "subnet-2b901b09",
  "subnet-46479406",
]
public_subnet_ids = [
  "subnet-042a5a03",
  "subnet-764ee817",
]
task_role_arn = "arn:aws:iam::000000000000:role/taxpulse-ecs-task"
task_security_group_id = "sg-c5f6865608a3e7177"
vpc_id = "vpc-86ec4a10"
```

The state list shows all 38 resources are tracked in our S3-native locked backend:
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

## 3. IaC Security Scan Output

Running `scan.sh` yields passing results for both Checkov and Trivy scanners.

```bash
$ bash terraform/scripts/scan.sh
▸ Running Checkov...
...
Check: CKV_AWS_111: "Ensure IAM policies does not allow write access without constraints"
	SKIPPED for resource: module.iam.aws_iam_policy_document.flow_log_permissions
Check: CKV_AWS_356: "Ensure no IAM policies documents allow "*" as a statement's resource for restrictable actions"
	SKIPPED for resource: module.iam.aws_iam_policy_document.flow_log_permissions
Check: CKV_AWS_158: "Ensure that CloudWatch Log Group is encrypted by KMS"
	SKIPPED for resource: module.network.aws_cloudwatch_log_group.vpc_flow_log
Check: CKV_AWS_130: "Ensure VPC subnets do not assign public IP by default"
	SKIPPED for resource: module.network.aws_subnet.public[0]
Check: CKV_AWS_130: "Ensure VPC subnets do not assign public IP by default"
	SKIPPED for resource: module.network.aws_subnet.public[1]
Check: CKV2_AWS_5: "Ensure that Security Groups are attached to another resource"
	SKIPPED for resource: module.network.aws_security_group.alb
Check: CKV2_AWS_5: "Ensure that Security Groups are attached to another resource"
	SKIPPED for resource: module.network.aws_security_group.task
Check: CKV2_AWS_5: "Ensure that Security Groups are attached to another resource"
	SKIPPED for resource: module.network.aws_security_group.db

✔ Checkov passed.

▸ Running Trivy config scan...
2026-08-13T12:11:42-04:00	INFO	[misconfig] Misconfiguration scanning is enabled
2026-08-13T12:11:42-04:00	INFO	[terraform scanner] Scanning root module	file_path="."
2026-08-13T12:11:42-04:00	INFO	[terraform executor] Ignore finding	rule="aws-ec2-no-public-egress-sgr" range="modules/network/main.tf:279"
2026-08-13T12:11:42-04:00	INFO	[terraform executor] Ignore finding	rule="aws-ec2-no-public-ip-subnet" range="modules/network/main.tf:89"
2026-08-13T12:11:42-04:00	INFO	[terraform executor] Ignore finding	rule="aws-ec2-no-public-ip-subnet" range="modules/network/main.tf:89"
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

The static scanning gate correctly generated compliance evidence files under the compliance sink directory:
- Checkov SARIF: `artifacts/security/results_sarif.sarif`
- Trivy SARIF: `artifacts/security/trivy-results.sarif`
