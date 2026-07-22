import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";

import { REDACT_PATHS } from "../../src/logging/redaction-config.js";

/**
 * Helper to construct a logger writing to a memory stream for testing output logs.
 */
function createTestLogger() {
  const logs: string[] = [];
  const stream = new Writable({
    write(chunk, encoding, callback) {
      logs.push(chunk.toString());
      callback();
    }
  });

  const logger = pino({
    redact: {
      paths: REDACT_PATHS,
      censor: "[REDACTED]"
    }
  }, stream);

  return { logger, getLogs: () => logs };
}

describe("Node/Express Logging Redactor", () => {
  it("redacts top-level sensitive fields on success logging path", () => {
    const { logger, getLogs } = createTestLogger();
    logger.info({
      income: 150000,
      deductions: 35000,
      authorization: "Bearer secret-token",
      token: "some-raw-token",
      message: "all good"
    });

    const output = getLogs()[0];
    expect(output).toBeDefined();
    const logObj = JSON.parse(output);

    expect(logObj.income).toBe("[REDACTED]");
    expect(logObj.deductions).toBe("[REDACTED]");
    expect(logObj.authorization).toBe("[REDACTED]");
    expect(logObj.token).toBe("[REDACTED]");
    expect(logObj.message).toBe("all good");
  });

  it("redacts nested sensitive fields on success logging path", () => {
    const { logger, getLogs } = createTestLogger();
    logger.info({
      cycle: {
        id: "123",
        income: 250000,
        deductions: 45000,
        token: "nested-token"
      }
    });

    const output = getLogs()[0];
    expect(output).toBeDefined();
    const logObj = JSON.parse(output);

    expect(logObj.cycle.income).toBe("[REDACTED]");
    expect(logObj.cycle.deductions).toBe("[REDACTED]");
    expect(logObj.cycle.token).toBe("[REDACTED]");
    expect(logObj.cycle.id).toBe("123");
  });

  it("redacts sensitive fields on error logging path", () => {
    const { logger, getLogs } = createTestLogger();
    logger.error({
      err: new Error("Failed to compute"),
      income: 500000,
      deductions: 100000,
      password: "secret-password"
    });

    const output = getLogs()[0];
    expect(output).toBeDefined();
    const logObj = JSON.parse(output);

    expect(logObj.income).toBe("[REDACTED]");
    expect(logObj.deductions).toBe("[REDACTED]");
    expect(logObj.password).toBe("[REDACTED]");
  });
});
