CREATE TABLE "stage_transition" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"actor" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stage_transition_from_stage_check" CHECK ("stage_transition"."from_stage" IS NULL OR "stage_transition"."from_stage" IN (
  'Intake',
  'Data Aggregation',
  'Modeling',
  'Review',
  'Client Approval',
  'Executed',
  'Archived'
)),
	CONSTRAINT "stage_transition_to_stage_check" CHECK ("stage_transition"."to_stage" IN (
  'Intake',
  'Data Aggregation',
  'Modeling',
  'Review',
  'Client Approval',
  'Executed',
  'Archived'
))
);
--> statement-breakpoint
CREATE TABLE "tax_plan_cycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"planning_period" text NOT NULL,
	"stage" text NOT NULL,
	"owner" text NOT NULL,
	"priority" text NOT NULL,
	"due_date" date NOT NULL,
	"on_hold" boolean DEFAULT false NOT NULL,
	"hold_reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_plan_cycle_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "tax_plan_cycle_stage_check" CHECK ("tax_plan_cycle"."stage" IN (
  'Intake',
  'Data Aggregation',
  'Modeling',
  'Review',
  'Client Approval',
  'Executed',
  'Archived'
)),
	CONSTRAINT "tax_plan_cycle_hold_reason_requires_hold" CHECK ("tax_plan_cycle"."on_hold" OR "tax_plan_cycle"."hold_reason" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "stage_transition" ADD CONSTRAINT "stage_transition_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_transition" ADD CONSTRAINT "stage_transition_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."tax_plan_cycle"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_plan_cycle" ADD CONSTRAINT "tax_plan_cycle_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stage_transition_case_id_idx" ON "stage_transition" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "tax_plan_cycle_tenant_due_date_idx" ON "tax_plan_cycle" USING btree ("tenant_id","due_date");