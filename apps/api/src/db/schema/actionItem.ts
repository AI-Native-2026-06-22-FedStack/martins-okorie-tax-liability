import { index, pgTable, text, timestamp, uuid, boolean, date } from "drizzle-orm/pg-core";

export const actionItem = pgTable(
  "action_item",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenant_id: uuid("tenant_id").notNull(),
    case_id: uuid("case_id").notNull(),
    description: text("description").notNull(),
    deadline: date("deadline").notNull(),
    completed: boolean("completed").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("action_item_case_id_idx").on(table.case_id),
    index("action_item_tenant_case_idx").on(table.tenant_id, table.case_id)
  ]
);

export type ActionItem = typeof actionItem.$inferSelect;
export type NewActionItem = typeof actionItem.$inferInsert;
