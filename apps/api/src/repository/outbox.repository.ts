import type { PresentToClientCloudEvent, StageChangedCloudEvent } from "@capstone/shared-schemas";

import { getDb, type TaxPulseDb } from "../db/client.js";
import { outbox } from "../db/schema.js";

type TaxPulseTransaction = Parameters<Parameters<TaxPulseDb["transaction"]>[0]>[0];
type TaxPulseDbExecutor = TaxPulseDb | TaxPulseTransaction;

export async function insertStageChangedOutboxEvent(
  event: StageChangedCloudEvent,
  db: TaxPulseDbExecutor = getDb()
): Promise<void> {
  await db.insert(outbox).values({
    aggregate_id: event.data.cycle_id,
    aggregate_type: "tax_plan_cycle",
    event_type: event.type,
    id: event.id,
    payload: event
  });
}

export async function insertPresentToClientOutboxEvent(
  event: PresentToClientCloudEvent,
  db: TaxPulseDbExecutor = getDb()
): Promise<void> {
  await db.insert(outbox).values({
    aggregate_id: event.data.cycle_id,
    aggregate_type: "tax_plan_cycle",
    event_type: event.type,
    id: event.id,
    payload: event
  });
}
