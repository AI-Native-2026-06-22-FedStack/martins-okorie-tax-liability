CREATE TABLE "action_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"description" text NOT NULL,
	"deadline" date NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "action_item_case_id_idx" ON "action_item" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "action_item_tenant_case_idx" ON "action_item" USING btree ("tenant_id","case_id");