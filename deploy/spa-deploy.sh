#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_ENDPOINT_URL="${AWS_ENDPOINT_URL:-http://localhost:4566}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
SPA_BUCKET_NAME="${SPA_BUCKET_NAME:-taxpulse-spa-floci}"
DIST_DIR="${SPA_DIST_DIR:-$ROOT_DIR/apps/web/dist}"
CLOUDFRONT_CONFIG_TEMPLATE="$ROOT_DIR/infra/cloudfront/distribution.json"
BUCKET_POLICY_TEMPLATE="$ROOT_DIR/infra/s3/bucket-policy.json"

export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY
export AWS_REGION

aws_local() {
  aws --endpoint-url "$AWS_ENDPOINT_URL" "$@"
}

if [[ ! -f "$DIST_DIR/index.html" ]]; then
  echo "Missing $DIST_DIR/index.html. Run ( cd apps/web && npm run build ) before deploying." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "Ensuring private SPA bucket exists in floci: $SPA_BUCKET_NAME"
aws_local s3api create-bucket --bucket "$SPA_BUCKET_NAME" >/dev/null 2>&1 || true
aws_local s3api put-public-access-block \
  --bucket "$SPA_BUCKET_NAME" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

oac_config="$tmp_dir/oac.json"
cat > "$oac_config" <<JSON
{
  "Name": "taxpulse-spa-floci-oac",
  "Description": "OAC for the private TaxPulse SPA bucket in floci",
  "SigningProtocol": "sigv4",
  "SigningBehavior": "always",
  "OriginAccessControlOriginType": "s3"
}
JSON

echo "Creating CloudFront Origin Access Control"
oac_id="$(aws_local cloudfront create-origin-access-control \
  --origin-access-control-config "file://$oac_config" \
  --query 'OriginAccessControl.Id' \
  --output text)"

distribution_config="$tmp_dir/distribution.json"
sed "s/__OAC_ID__/$oac_id/g" "$CLOUDFRONT_CONFIG_TEMPLATE" > "$distribution_config"

existing_distribution_id="$(aws_local cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='TaxPulse local SPA distribution for floci'].Id | [0]" \
  --output text 2>/dev/null || true)"

if [[ -z "$existing_distribution_id" || "$existing_distribution_id" == "None" ]]; then
  echo "Creating CloudFront distribution"
  distribution_id="$(aws_local cloudfront create-distribution \
    --distribution-config "file://$distribution_config" \
    --query 'Distribution.Id' \
    --output text)"
else
  distribution_id="$existing_distribution_id"
  echo "Reusing CloudFront distribution: $distribution_id"
fi

account_id="$(aws_local sts get-caller-identity --query Account --output text 2>/dev/null || echo "000000000000")"
distribution_arn="arn:aws:cloudfront::$account_id:distribution/$distribution_id"
bucket_policy="$tmp_dir/bucket-policy.json"
sed \
  -e "s/__BUCKET_NAME__/$SPA_BUCKET_NAME/g" \
  -e "s#__DISTRIBUTION_ARN__#$distribution_arn#g" \
  "$BUCKET_POLICY_TEMPLATE" > "$bucket_policy"

echo "Applying OAC-only bucket policy"
aws_local s3api put-bucket-policy --bucket "$SPA_BUCKET_NAME" --policy "file://$bucket_policy"

echo "Uploading immutable SPA assets"
aws_local s3 sync "$DIST_DIR/" "s3://$SPA_BUCKET_NAME/" \
  --exclude "index.html" \
  --cache-control "max-age=31536000, immutable" \
  --delete

echo "Uploading fresh SPA entry point"
aws_local s3 cp "$DIST_DIR/index.html" "s3://$SPA_BUCKET_NAME/index.html" \
  --cache-control "no-cache" \
  --content-type "text/html"

echo "Invalidating CloudFront entry point"
aws_local cloudfront create-invalidation \
  --distribution-id "$distribution_id" \
  --paths "/index.html" >/dev/null

echo "SPA deploy complete"
echo "Bucket: $SPA_BUCKET_NAME"
echo "DistributionId: $distribution_id"
echo "DistributionArn: $distribution_arn"
