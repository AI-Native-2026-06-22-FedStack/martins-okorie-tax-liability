#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    exit 1
  fi
}

require_tool docker
require_tool openssl
require_tool python3

aws_in_floci() {
  docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 "$@"
}

wait_for_floci() {
  for _ in $(seq 1 30); do
    if aws_in_floci sts get-caller-identity >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "floci did not become ready for AWS CLI calls." >&2
  exit 1
}

secret_exists() {
  aws_in_floci secretsmanager get-secret-value --secret-id "$1" >/dev/null 2>&1
}

create_secret_from_stdin() {
  local secret_id="$1"
  local payload_file
  payload_file="$(mktemp)"
  cat >"$payload_file"

  if secret_exists "$secret_id"; then
    echo "secret exists: $secret_id"
    rm -f "$payload_file"
    return 0
  fi

  docker compose exec -T floci sh -lc \
    "cat >/tmp/taxpulse-secret.json && aws secretsmanager create-secret --name '$secret_id' --secret-string file:///tmp/taxpulse-secret.json >/dev/null" \
    <"$payload_file"
  rm -f "$payload_file"
  echo "secret created: $secret_id"
}

seed_database() {
  docker compose exec -T postgres psql -U taxpulse_app -d taxpulse_l -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenant (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tax_plan_cycle (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenant(id),
    client_id text NOT NULL,
    planning_period text NOT NULL,
    stage text NOT NULL CHECK (
        stage IN (
            'Intake',
            'Data Aggregation',
            'Modeling',
            'Review',
            'Client Approval',
            'Executed',
            'Archived'
        )
    ),
    owner text NOT NULL,
    priority text NOT NULL,
    due_date date NOT NULL,
    on_hold boolean NOT NULL DEFAULT false,
    hold_reason text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tax_plan_cycle_hold_reason_requires_hold
        CHECK (on_hold OR hold_reason IS NULL),
    CONSTRAINT tax_plan_cycle_tenant_id_id_unique
        UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS tax_plan_cycle_tenant_due_date_idx
    ON tax_plan_cycle (tenant_id, due_date);

INSERT INTO tenant (id, name)
VALUES
    ('11111111-1111-4111-8111-111111111111', 'Evergreen Advisory Local'),
    ('22222222-2222-4222-8222-222222222222', 'Harbor Point Wealth Local')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO tax_plan_cycle (
    id,
    tenant_id,
    client_id,
    planning_period,
    stage,
    owner,
    priority,
    due_date,
    metadata
)
VALUES
    (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '11111111-1111-4111-8111-111111111111',
        'client-local-001',
        '2026-Q3',
        'Modeling',
        'advisor.local@example.test',
        'high',
        '2026-09-15',
        '{"source":"local-seed","scenarioCount":3}'::jsonb
    ),
    (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        '22222222-2222-4222-8222-222222222222',
        'client-local-002',
        '2026-Q3',
        'Review',
        'advisor.review@example.test',
        'medium',
        '2026-09-30',
        '{"source":"local-seed","scenarioCount":2}'::jsonb
    )
ON CONFLICT (tenant_id, id) DO UPDATE
SET
    client_id = EXCLUDED.client_id,
    planning_period = EXCLUDED.planning_period,
    stage = EXCLUDED.stage,
    owner = EXCLUDED.owner,
    priority = EXCLUDED.priority,
    due_date = EXCLUDED.due_date,
    metadata = EXCLUDED.metadata,
    updated_at = now();
SQL
}

seed_runtime_secrets() {
  local tmpdir
  tmpdir="$(mktemp -d)"

  if ! secret_exists "taxpulse/local/db-password"; then
    printf '%s' "$(openssl rand -base64 24)" |
      create_secret_from_stdin "taxpulse/local/db-password"
  else
    echo "secret exists: taxpulse/local/db-password"
  fi

  if ! secret_exists "taxpulse/local/jwt-signing-keys"; then
    openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$tmpdir/private.pem" >/dev/null 2>&1
    openssl rsa -pubout -in "$tmpdir/private.pem" -out "$tmpdir/public.pem" >/dev/null 2>&1

    python3 - "$tmpdir/private.pem" "$tmpdir/public.pem" >"$tmpdir/jwt-secret.json" <<'PY'
import json
import pathlib
import sys

private_key = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
public_key = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
print(json.dumps({
    "keyId": "2026-local",
    "privateKey": private_key,
    "publicKey": public_key,
}))
PY
    create_secret_from_stdin "taxpulse/local/jwt-signing-keys" <"$tmpdir/jwt-secret.json"
  else
    echo "secret exists: taxpulse/local/jwt-signing-keys"
  fi

  rm -rf "$tmpdir"
}

wait_for_floci
seed_runtime_secrets
seed_database

echo "TaxPulse local seed complete."
