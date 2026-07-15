import fs from "node:fs";

const configPath = new URL("../../../../shared/redaction-config.json", import.meta.url);

interface RedactionConfig {
  camelCase: string[];
  snake_case: string[];
}

// Read the shared JSON configuration file synchronously and cast as unknown first to avoid unsafe any assignment
const configContent = fs.readFileSync(configPath, "utf8");
const config = JSON.parse(configContent) as unknown as RedactionConfig;

/**
 * Declared sensitive fields list for Express boundary logging redaction.
 */
export const REDACT_PATHS = config.camelCase;
