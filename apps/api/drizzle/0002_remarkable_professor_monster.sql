CREATE TABLE "audit_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"case_id" uuid,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"result" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_entry_result_check" CHECK ("audit_entry"."result" IN ('success', 'failure'))
);
--> statement-breakpoint
ALTER TABLE "audit_entry" ADD CONSTRAINT "audit_entry_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_entry" ADD CONSTRAINT "audit_entry_case_fk" FOREIGN KEY ("tenant_id","case_id") REFERENCES "public"."tax_plan_cycle"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE OR REPLACE FUNCTION block_audit_entry_mutations()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Table audit_entry is append-only. UPDATE and DELETE are prohibited.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER limit_audit_entry_updates
BEFORE UPDATE OR DELETE ON audit_entry
FOR EACH ROW
EXECUTE FUNCTION block_audit_entry_mutations();