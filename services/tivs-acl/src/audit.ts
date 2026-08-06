import fs from "node:fs";

const configPath = new URL("../../../shared/redaction-config.json", import.meta.url);

interface RedactionConfig {
  camelCase: string[];
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as RedactionConfig;
const sensitiveKeys = new Set([...config.camelCase, "taxpayerId", "tin", "ssn", "ein"]);

type AuditValue = string | number | boolean | null | AuditObject | AuditValue[];

interface AuditObject {
  [key: string]: AuditValue;
}

export interface TivsAuditLine {
  event: "tivs_acl_call";
  operation: "VerifyTaxpayer" | "GetTaxpayerStatus";
  correlationId: string;
  outcome: "success" | "error";
  durationMs: number;
  request: AuditObject;
  errorCode?: string;
  timestamp: string;
}

export function renderAuditLine(line: TivsAuditLine): TivsAuditLine {
  return redactObject(line as unknown as AuditObject) as unknown as TivsAuditLine;
}

function redactObject(value: AuditValue): AuditValue {
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKeys.has(key) && typeof item === "string" ? maskIdentifier(item) : redactObject(item),
      ]),
    );
  }

  return value;
}

function maskIdentifier(value: string): string {
  const digits = value.replace(/\D/g, "");
  const last4 = digits.slice(-4).padStart(4, "*");
  return `***-**-${last4}`;
}
