#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# bootstrap-state.sh — Pre-create the S3 state bucket on floci
#
# The Terraform S3 backend requires the bucket to exist before terraform init.
# This script creates the bucket, enables versioning, blocks public access,
# and sets default encryption. Idempotent — safe to re-run.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

export AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localhost:4566}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-us-east-1}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"

BUCKET="taxpulse-tfstate-dev"

echo "▸ Creating state bucket: ${BUCKET}"
aws s3api create-bucket \
  --bucket "${BUCKET}" \
  --region "${AWS_DEFAULT_REGION}" \
  2>/dev/null || echo "  Bucket already exists — continuing."

echo "▸ Enabling versioning"
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled

echo "▸ Blocking public access"
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "▸ Enabling default encryption (AES256)"
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

echo "✔ State bucket ${BUCKET} is ready."
echo ""
echo "Verify:"
echo "  aws s3api get-bucket-versioning --bucket ${BUCKET}"
echo "  aws s3api get-public-access-block --bucket ${BUCKET}"
echo "  aws s3api get-bucket-encryption --bucket ${BUCKET}"
