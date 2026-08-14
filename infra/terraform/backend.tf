# ─────────────────────────────────────────────────────────────────────────────
# TaxPulse Capstone — S3 Remote Backend Configuration
#
# State lives in a private, versioned, encrypted S3 bucket on floci.
# State locking uses S3-native locking (use_lockfile = true).
# DynamoDB lock table is NOT used (deprecated in Terraform 1.11+).
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  backend "s3" {
    bucket       = "taxpulse-tfstate-dev"
    key          = "capstone/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true

    # floci endpoint overrides for local emulator
    endpoints = {
      s3 = "http://localhost:4566"
    }

    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_requesting_account_id  = true
    use_path_style              = true
  }
}
