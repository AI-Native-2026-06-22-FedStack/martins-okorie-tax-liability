import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

describe('Shared Schema Contract Validation (Express side)', () => {
  const schemaPath = resolve(
    process.cwd(),
    'packages/shared-schemas/calculation.schema.json'
  );
  const schemaContent = readFileSync(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaContent);

  const ajv = new Ajv();
  const validate = ajv.compile(schema);

  it('validates a correct calculation request payload against shared JSON schema', () => {
    const payload = {
      filing_status: 'single',
      income: 120000.0,
      deductions: 14600.0,
      state: 'CA',
    };
    const valid = validate(payload);
    expect(valid).toBe(true);
  });

  it('rejects an invalid calculation request payload (negative income)', () => {
    const payload = {
      filing_status: 'single',
      income: -500.0,
      deductions: 14600.0,
      state: 'CA',
    };
    const valid = validate(payload);
    expect(valid).toBe(false);
  });

  it('rejects an invalid calculation request payload (missing required field)', () => {
    const payload = {
      income: 120000.0,
      deductions: 14600.0,
      state: 'CA',
    };
    const valid = validate(payload);
    expect(valid).toBe(false);
  });
});
