-- Migration 0003: Analytics Schema Isolation
-- Creates a dedicated 'analytics' schema for analytical pipeline rollups and metrics.
-- Guarantees the operational 'public' tables (tax_plan_cycle, tenant, users) remain untouched.

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.income_rollup (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id text NOT NULL,
    cycle_id text NOT NULL,
    client_id text NOT NULL,
    planning_period text NOT NULL,
    tax_year integer NOT NULL,
    gross_income_cents bigint NOT NULL,
    total_tax_cents bigint NOT NULL,
    effective_rate_bps bigint NOT NULL,
    event_count bigint NOT NULL,
    yoy_income_delta_cents bigint,
    loaded_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT income_rollup_tenant_cycle_period_unique
        UNIQUE (tenant_id, cycle_id, planning_period)
);

CREATE INDEX IF NOT EXISTS income_rollup_tenant_period_idx
    ON analytics.income_rollup (tenant_id, planning_period);

CREATE INDEX IF NOT EXISTS income_rollup_client_year_idx
    ON analytics.income_rollup (client_id, tax_year);

CREATE TABLE IF NOT EXISTS analytics.pipeline_run (
    run_id text PRIMARY KEY,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    status text NOT NULL CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    count_in integer NOT NULL DEFAULT 0,
    count_out integer NOT NULL DEFAULT 0,
    count_bad integer NOT NULL DEFAULT 0,
    quarantine_rate numeric(6, 4) NOT NULL DEFAULT 0.0,
    error_message text
);
