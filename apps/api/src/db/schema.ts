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

export { actionItem, type ActionItem, type NewActionItem } from "./schema/actionItem.js";

export { outbox, type NewOutboxEvent, type OutboxEvent } from "./schema/outbox.js";

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

export const role = pgTable(
  "role",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenant_id: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    name: text("name").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check(
      "role_name_check",
      sql`${table.name} IN ('Firm Admin', 'Advisor', 'Client', 'TaxPulse Platform Admin')`
    ),
    unique("role_tenant_id_name_unique").on(table.tenant_id, table.name)
  ]
);

export const user = pgTable(
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenant_id: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    email: text("email").notNull(),
    status: text("status").notNull().default("active"),
    role_id: uuid("role_id")
      .notNull()
      .references(() => role.id),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique("user_tenant_id_email_unique").on(table.tenant_id, table.email),
    unique("user_tenant_id_id_unique").on(table.tenant_id, table.id),
    check("user_status_check", sql`${table.status} IN ('active', 'inactive', 'pending')`)
  ]
);

export const credential = pgTable(
  "credential",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenant_id: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    user_id: uuid("user_id").notNull(),
    password_hash: text("password_hash").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique("credential_tenant_id_user_id_unique").on(table.tenant_id, table.user_id),
    foreignKey({
      columns: [table.tenant_id, table.user_id],
      foreignColumns: [user.tenant_id, user.id],
      name: "credential_user_fk"
    })
  ]
);

export const mfaEnrollment = pgTable(
  "mfa_enrollment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenant_id: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    user_id: uuid("user_id").notNull(),
    totp_secret: text("totp_secret").notNull(),
    enrolled: boolean("enrolled").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    unique("mfa_enrollment_tenant_id_user_id_unique").on(table.tenant_id, table.user_id),
    foreignKey({
      columns: [table.tenant_id, table.user_id],
      foreignColumns: [user.tenant_id, user.id],
      name: "mfa_enrollment_user_fk"
    })
  ]
);

export const refreshToken = pgTable(
  "refresh_token",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenant_id: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    user_id: uuid("user_id").notNull(),
    token_hash: text("token_hash").notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revoked_at: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => [
    foreignKey({
      columns: [table.tenant_id, table.user_id],
      foreignColumns: [user.tenant_id, user.id],
      name: "refresh_token_user_fk"
    })
  ]
);

export type Role = typeof role.$inferSelect;
export type NewRole = typeof role.$inferInsert;

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Credential = typeof credential.$inferSelect;
export type NewCredential = typeof credential.$inferInsert;

export type MfaEnrollment = typeof mfaEnrollment.$inferSelect;
export type NewMfaEnrollment = typeof mfaEnrollment.$inferInsert;

export type RefreshToken = typeof refreshToken.$inferSelect;
export type NewRefreshToken = typeof refreshToken.$inferInsert;

export const auditEntry = pgTable(
  "audit_entry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenant_id: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    case_id: uuid("case_id"),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    result: text("result").notNull(), // CLOSED enum: 'success' | 'failure'
    occurred_at: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    check("audit_entry_result_check", sql`${table.result} IN ('success', 'failure')`),
    foreignKey({
      columns: [table.tenant_id, table.case_id],
      foreignColumns: [taxPlanCycle.tenant_id, taxPlanCycle.id],
      name: "audit_entry_case_fk"
    }).onDelete("cascade")
  ]
);

export type AuditEntry = typeof auditEntry.$inferSelect;
export type NewAuditEntry = typeof auditEntry.$inferInsert;
