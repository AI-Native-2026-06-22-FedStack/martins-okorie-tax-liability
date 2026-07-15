import fs from "node:fs";
import path from "node:url";

// Load path relative to this ES module
const __filename = path.fileURLToPath(import.meta.url);
const __dirname = path.fileURLToPath(new URL(".", import.meta.url));
const configPath = new URL("../../../../shared/redaction-config.json", import.meta.url);

interface RedactionConfig {
  camelCase: string[];
  snake_case: string[];
}

// Read the shared JSON configuration file synchronously
const configContent = fs.readFileSync(configPath, "utf8");
const config: RedactionConfig = JSON.parse(configContent);

/**
 * Declared sensitive fields list for Express boundary logging redaction.
 */
export const REDACT_PATHS = config.camelCase;
