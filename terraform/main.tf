# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse Capstone — Root module: backend, provider, child modules
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  backend "s3" {
    bucket       = "taxpulse-tfstate-dev"
    key          = "capstone/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true

    # floci endpoint overrides — remove for real AWS
    endpoints = {
      s3 = "http://localhost:4566"
    }

    # floci compatibility flags — remove for real AWS
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    use_path_style              = true
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# AWS Provider — pinned in versions.tf, configured for floci here
# ─────────────────────────────────────────────────────────────────────────────

provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  # Point every AWS service at floci
  endpoints {
    ec2            = "http://localhost:4566"
    iam            = "http://localhost:4566"
    s3             = "http://localhost:4566"
    sts            = "http://localhost:4566"
    secretsmanager = "http://localhost:4566"
    dynamodb       = "http://localhost:4566"
    sns            = "http://localhost:4566"
    sqs            = "http://localhost:4566"
    cloudwatch     = "http://localhost:4566"
    cloudwatchlogs = "http://localhost:4566"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Child modules
# ─────────────────────────────────────────────────────────────────────────────

module "iam" {
  source = "./modules/iam"

  project_name = var.project_name
  environment  = var.environment
}

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

