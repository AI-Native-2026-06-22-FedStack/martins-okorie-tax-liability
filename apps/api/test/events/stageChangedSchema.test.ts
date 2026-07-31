import {
  parseStageChangedCloudEvent,
  stageChangedEventSource,
  stageChangedEventType,
  validateStageChangedCloudEvent
} from "@capstone/shared-schemas";
import { describe, expect, it } from "vitest";

const validEvent = {
  specversion: "1.0",
  id: "11111111-1111-4111-8111-111111111111",
  source: stageChangedEventSource,
  type: stageChangedEventType,
  time: "2026-07-31T04:00:00.000Z",
  subject: "tax-plan-cycle/22222222-2222-4222-8222-222222222222",
  datacontenttype: "application/json",
  data: {
    tenant_id: "33333333-3333-4333-8333-333333333333",
    cycle_id: "22222222-2222-4222-8222-222222222222",
    from_stage: "Intake",
    to_stage: "Data Aggregation",
    changed_by: "advisor@taxpulse.test",
    changed_at: "2026-07-31T04:00:00.000Z"
  }
};

describe("stage-changed CloudEvents schema", () => {
  it("accepts a valid CloudEvents 1.0 stage-changed fact", () => {
    const parsed = parseStageChangedCloudEvent(validEvent);

    expect(parsed.specversion).toBe("1.0");
    expect(parsed.type).toBe(stageChangedEventType);
    expect(parsed.data.to_stage).toBe("Data Aggregation");
    expect(validateStageChangedCloudEvent(validEvent)).toBe(true);
  });

  it("rejects a malformed envelope missing required CloudEvents attributes", () => {
    const { id: _id, specversion: _specversion, ...malformed } = validEvent;

    expect(() => parseStageChangedCloudEvent(malformed)).toThrow();
    expect(validateStageChangedCloudEvent(malformed)).toBe(false);
  });

  it("rejects commands disguised as events", () => {
    expect(() =>
      parseStageChangedCloudEvent({
        ...validEvent,
        type: "com.taxpulse.tax-plan-cycle.stage.change"
      })
    ).toThrow();
  });
});
