import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const aclFacingFiles = ["src/acl/dto.ts", "src/server.ts"];

describe("SOAP type boundary", () => {
  it("keeps SOAP-shaped types out of ACL-facing DTO and REST signatures", () => {
    for (const relativePath of aclFacingFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

      expect(source).not.toMatch(/\bVerifyTaxpayer(Result|Response|Request)\b/);
      expect(source).not.toMatch(/\bGetTaxpayerStatus(Response|Request)\b/);
      expect(source).not.toMatch(/\bTIN(Type)?\b/);
    }
  });
});
