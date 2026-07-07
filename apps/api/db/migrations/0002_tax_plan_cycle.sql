-- Tax Plan Cycle case table and stage-transition history.
-- Lifecycle is modeled by tax_plan_cycle.stage; do not add a separate status.

CREATE TABLE tax_plan_cycle (
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

CREATE INDEX tax_plan_cycle_tenant_due_date_idx
    ON tax_plan_cycle (tenant_id, due_date);

CREATE TABLE stage_transition (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    case_id uuid NOT NULL,
    from_stage text CHECK (
        from_stage IS NULL
        OR from_stage IN (
            'Intake',
            'Data Aggregation',
            'Modeling',
            'Review',
            'Client Approval',
            'Executed',
            'Archived'
        )
    ),
    to_stage text NOT NULL CHECK (
        to_stage IN (
            'Intake',
            'Data Aggregation',
            'Modeling',
            'Review',
            'Client Approval',
            'Executed',
            'Archived'
        )
    ),
    actor text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT stage_transition_tenant_fk
        FOREIGN KEY (tenant_id) REFERENCES tenant(id),
    CONSTRAINT stage_transition_case_fk
        FOREIGN KEY (tenant_id, case_id)
        REFERENCES tax_plan_cycle(tenant_id, id)
);

CREATE INDEX stage_transition_case_id_idx
    ON stage_transition (case_id);
