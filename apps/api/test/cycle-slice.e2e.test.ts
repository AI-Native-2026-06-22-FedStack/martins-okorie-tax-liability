import { and, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { app } from "../src/app.js";
import { closeDefaultDb, createDrizzleDb, type TaxPulseDb } from "../src/db/client.js";
import { stageTransition } from "../src/db/schema.js";
import "./factories/make-cycle.js";

const TENANT_A_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_B_ID = "22222222-2222-4222-8222-222222222222";

const describeWithDatabase = process.env.TAXPULSE_TEST_DATABASE_URL ? describe : describe.skip;

let db: TaxPulseDb;
let pool: ReturnType<typeof createDrizzleDb>["pool"];

describeWithDatabase("cycle create-and-read slice", () => {
  beforeAll(() => {
    const connectionString = process.env.TAXPULSE_TEST_DATABASE_URL;

    if (!connectionString) {
      throw new Error("TAXPULSE_TEST_DATABASE_URL is required for cycle slice E2E tests.");
    }

    const connection = createDrizzleDb(connectionString);
    db = connection.db;
    pool = connection.pool;
  });

  afterAll(async () => {
    await closeDefaultDb();
    await pool.end();
  });

  it("creates a cycle, reads it back tenant-scoped, and writes the initial transition", async () => {
    const createBody = {
      client_id: "client-fictional-slice-001",
      due_date: "2026-09-30",
      hold_reason: null,
      on_hold: false,
      owner: "Fictional Advisor",
      planning_period: "2026 Q3",
      priority: "P1"
    };

    const createResponse = await request(app)
      .post("/cycles")
      .set("x-tenant-id", TENANT_A_ID)
      .send(createBody)
      .expect(201);

    expect(createResponse.body).toEqual({
      id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      )
    });

    const caseId = createResponse.body.id as string;

    const readResponse = await request(app)
      .get(`/cycles/${caseId}`)
      .set("x-tenant-id", TENANT_A_ID)
      .expect(200);

    expect(readResponse.body).toMatchObject({
      ...createBody,
      id: caseId,
      stage: "Intake",
      tenant_id: TENANT_A_ID
    });

    await request(app).get(`/cycles/${caseId}`).set("x-tenant-id", TENANT_B_ID).expect(404);

    const transitions = await db
      .select()
      .from(stageTransition)
      .where(and(eq(stageTransition.tenant_id, TENANT_A_ID), eq(stageTransition.case_id, caseId)));

    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      actor: "TaxPulse System",
      case_id: caseId,
      from_stage: null,
      tenant_id: TENANT_A_ID,
      to_stage: "Intake"
    });
  });
});
