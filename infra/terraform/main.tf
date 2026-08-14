# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse Capstone — Root module: composition of all five layers
#
# Layering: network -> iam -> data -> app -> observability
# All five child modules share this root backend and state.
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. Network Layer (Base) ──────────────────────────────────────────────────
module "network" {
  source = "./modules/network"

  project_name             = var.project_name
  environment              = var.environment
  vpc_cidr                 = var.vpc_cidr
  public_subnet_cidrs      = ["10.42.0.0/24", "10.42.1.0/24"]
  private_app_subnet_cidrs = ["10.42.10.0/24", "10.42.11.0/24"]
  private_db_subnet_cidrs  = ["10.42.20.0/24", "10.42.21.0/24"]
  flow_log_role_arn        = module.iam.flow_log_role_arn
}

# ── 2. IAM Layer (Base) ─────────────────────────────────────────────────────
module "iam" {
  source = "./modules/iam"

  project_name = var.project_name
  environment  = var.environment
}

# ── 3. Data Layer (Stateful Stores & Event Fabric) ───────────────────────────
module "data" {
  source = "./modules/data"

  project_name         = var.project_name
  environment          = var.environment
  vpc_id               = module.network.vpc_id
  db_subnet_ids        = module.network.private_db_subnet_ids
  db_security_group_id = module.network.db_security_group_id
}

# ── 4. App Layer (ECS, ALB, SPA Delivery) ───────────────────────────────────
module "app" {
  source = "./modules/app"

  project_name                           = var.project_name
  environment                            = var.environment
  aws_region                             = var.aws_region
  vpc_id                                 = module.network.vpc_id
  public_subnet_ids                      = module.network.public_subnet_ids
  private_app_subnet_ids                 = module.network.private_app_subnet_ids
  alb_security_group_id                  = module.network.alb_security_group_id
  task_security_group_id                 = module.network.task_security_group_id
  execution_role_arn                     = module.iam.execution_role_arn
  task_role_arn                          = module.iam.task_role_arn
  db_address                             = module.data.db_address
  db_port                                = module.data.db_port
  db_name                                = module.data.db_name
  db_password_secret_arn                 = module.data.db_password_secret_arn
  jwt_signing_keys_secret_arn            = module.data.jwt_signing_keys_secret_arn
  dynamodb_read_model_table_name         = module.data.dynamodb_read_model_table_name
  redis_endpoint                         = module.data.redis_endpoint
  redis_port                             = module.data.redis_port
  sns_stage_changed_topic_arn            = module.data.sns_stage_changed_topic_arn
  sqs_stage_changed_projection_queue_url = module.data.sqs_stage_changed_projection_queue_url
}

# ── 5. Observability Layer (Seam) ───────────────────────────────────────────
module "observability" {
  source = "./modules/observability"

  project_name = var.project_name
  environment  = var.environment
  service_name = module.app.service_name
  alb_arn      = module.app.alb_arn
  alb_dns_name = module.app.alb_dns_name
}
