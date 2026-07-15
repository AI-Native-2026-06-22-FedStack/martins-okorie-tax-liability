import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn
} from "drizzle-orm/pg-core";

export const taxPlanCycleStages = [
  "Intake",
  "Data Aggregation",
  "Modeling",
  "Review",
  "Client Approval",
  "Executed",
  "Archived"
] as const;

const stageCheckSql = (stageColumn: AnyPgColumn) => sql`${stageColumn} IN (
  'Intake',
  'Data Aggregation',
  'Modeling',
  'Review',
  'Client Approval',
  'Executed',
  'Archived'
)`;

export const tenant = pgTable("tenant", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const taxPlanCycle = pgTable(
  "tax_plan_cycle",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenant_id: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    client_id: text("client_id").notNull(),
    planning_period: text("planning_period").notNull(),
    stage: text("stage", { enum: taxPlanCycleStages }).notNull(),
    owner: text("owner").notNull(),
    priority: text("priority").notNull(),
    due_date: date("due_date").notNull(),
    on_hold: boolean("on_hold").notNull().default(false),
    hold_reason: text("hold_reason"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("tax_plan_cycle_stage_check", stageCheckSql(table.stage)),
    check(
      "tax_plan_cycle_hold_reason_requires_hold",
      sql`${table.on_hold} OR ${table.hold_reason} IS NULL`
    ),
    unique("tax_plan_cycle_tenant_id_id_unique").on(table.tenant_id, table.id),
    index("tax_plan_cycle_tenant_due_date_idx").on(table.tenant_id, table.due_date)
  ]
);

export const stageTransition = pgTable(
  "stage_transition",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenant_id: uuid("tenant_id").notNull(),
    case_id: uuid("case_id").notNull(),
    from_stage: text("from_stage", { enum: taxPlanCycleStages }),
    to_stage: text("to_stage", { enum: taxPlanCycleStages }).notNull(),
    actor: text("actor").notNull(),
    occurred_at: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check(
      "stage_transition_from_stage_check",
      sql`${table.from_stage} IS NULL OR ${stageCheckSql(table.from_stage)}`
    ),
    check("stage_transition_to_stage_check", stageCheckSql(table.to_stage)),
    foreignKey({
      columns: [table.tenant_id],
      foreignColumns: [tenant.id],
      name: "stage_transition_tenant_fk"
    }),
    foreignKey({
      columns: [table.tenant_id, table.case_id],
      foreignColumns: [taxPlanCycle.tenant_id, taxPlanCycle.id],
      name: "stage_transition_case_fk"
    }),
    index("stage_transition_case_id_idx").on(table.case_id)
  ]
);

export type Tenant = typeof tenant.$inferSelect;
export type NewTenant = typeof tenant.$inferInsert;

export type TaxPlanCycleStage = (typeof taxPlanCycleStages)[number];
export type TaxPlanCycle = typeof taxPlanCycle.$inferSelect;
export type NewTaxPlanCycle = typeof taxPlanCycle.$inferInsert;

export type StageTransition = typeof stageTransition.$inferSelect;
export type NewStageTransition = typeof stageTransition.$inferInsert;
