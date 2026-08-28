-- path: apps/api/db/migrations/0006_ai_assist_audit.sql
-- Append-only audit trail for AI Assist calls.
-- Records the REDACTED prompt (never plaintext financial data), response, citations,
-- requester identity, measured latency, and token cost.

CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.ai_assist_call (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL,
    requester text NOT NULL,
    redacted_prompt text NOT NULL,
    response_answer text NOT NULL,
    citations jsonb NOT NULL DEFAULT '[]'::jsonb,
    latency_ms double precision NOT NULL,
    token_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
    estimated_cost_usd double precision NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_assist_call_tenant_created_idx
    ON audit.ai_assist_call (tenant_id, created_at DESC);
