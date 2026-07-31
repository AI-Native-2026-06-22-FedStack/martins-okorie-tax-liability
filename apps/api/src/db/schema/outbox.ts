import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { StageChangedCloudEvent } from "@capstone/shared-schemas";

export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey(),
    event_type: text("event_type").notNull(),
    aggregate_type: text("aggregate_type").notNull(),
    aggregate_id: uuid("aggregate_id").notNull(),
    payload: jsonb("payload").$type<StageChangedCloudEvent>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    claimed_at: timestamp("claimed_at", { withTimezone: true }),
    sent_at: timestamp("sent_at", { withTimezone: true }),
    last_error: text("last_error"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("outbox_unsent_created_at_idx").on(table.sent_at, table.claimed_at, table.created_at),
    index("outbox_aggregate_idx").on(table.aggregate_type, table.aggregate_id)
  ]
);

export type OutboxEvent = typeof outbox.$inferSelect;
export type NewOutboxEvent = typeof outbox.$inferInsert;
