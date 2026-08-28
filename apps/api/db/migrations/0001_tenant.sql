-- Tenant isolation anchor for TaxPulse wealth-advisor firms.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE tenant (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW tenants AS
SELECT id, name, created_at
FROM tenant;
