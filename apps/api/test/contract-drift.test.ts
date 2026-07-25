import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

export interface SchemaDiff {
  breakingChanges: string[];
  minorChanges: string[];
}

export function detectSchemaChanges(
  prevSchema: Record<string, any>,
  currSchema: Record<string, any>
): SchemaDiff {
  const breakingChanges: string[] = [];
  const minorChanges: string[] = [];

  const prevRequired: string[] = prevSchema.required || [];
  const currRequired: string[] = currSchema.required || [];

  const prevProps: string[] = Object.keys(prevSchema.properties || {});
  const currProps: string[] = Object.keys(currSchema.properties || {});

  // 1. Newly required fields (breaking change)
  for (const field of currRequired) {
    if (!prevRequired.includes(field)) {
      breakingChanges.push(`Newly required field added: ${field}`);
    }
  }

  // 2. Removed properties (breaking change)
  for (const field of prevProps) {
    if (!currProps.includes(field)) {
      breakingChanges.push(`Property removed: ${field}`);
    }
  }

  // 3. Newly added optional fields (backward-compatible minor change)
  for (const field of currProps) {
    if (!prevProps.includes(field) && !currRequired.includes(field)) {
      minorChanges.push(`Optional property added: ${field}`);
    }
  }

  return { breakingChanges, minorChanges };
}

export function checkContractCompatibility(
  prevVersion: string,
  currVersion: string,
  diff: SchemaDiff
): { valid: boolean; reason?: string } {
  const [prevMajor] = prevVersion.split('.').map(Number);
  const [currMajor] = currVersion.split('.').map(Number);

  if (diff.breakingChanges.length > 0 && currMajor <= prevMajor) {
    return {
      valid: false,
      reason: `Backward-incompatible breaking change (${diff.breakingChanges.join(
        '; '
      )}) requires a major version bump. Previous version: ${prevVersion}, current version: ${currVersion}.`,
    };
  }

  return { valid: true };
}

describe('Contract Drift Test (Semver Compatibility)', () => {
  const packagePath = resolve(
    process.cwd(),
    'packages/shared-schemas/package.json'
  );
  const currentSchemaPath = resolve(
    process.cwd(),
    'packages/shared-schemas/calculation.schema.json'
  );
  const prevSchemaPath = resolve(
    process.cwd(),
    'packages/shared-schemas/previous-calculation.schema.json'
  );

  const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  const currentSchema = JSON.parse(readFileSync(currentSchemaPath, 'utf-8'));
  const previousSchema = JSON.parse(readFileSync(prevSchemaPath, 'utf-8'));

  it('passes drift check for identical current and snapshot schema v1.0.0', () => {
    const diff = detectSchemaChanges(previousSchema, currentSchema);
    const check = checkContractCompatibility('1.0.0', pkg.version, diff);
    expect(check.valid).toBe(true);
  });

  it('fails drift check when a newly required field is added without a major version bump', () => {
    const modifiedSchema = {
      ...previousSchema,
      required: [...previousSchema.required, 'taxYear'],
      properties: {
        ...previousSchema.properties,
        taxYear: { type: 'integer' },
      },
    };

    const diff = detectSchemaChanges(previousSchema, modifiedSchema);
    expect(diff.breakingChanges.length).toBeGreaterThan(0);

    const check = checkContractCompatibility('1.0.0', '1.1.0', diff);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('Newly required field added: taxYear');
  });

  it('fails drift check when a field is removed without a major version bump', () => {
    const { state, ...remainingProps } = previousSchema.properties;
    const modifiedSchema = {
      ...previousSchema,
      properties: remainingProps,
    };

    const diff = detectSchemaChanges(previousSchema, modifiedSchema);
    expect(diff.breakingChanges.length).toBeGreaterThan(0);

    const check = checkContractCompatibility('1.0.0', '1.1.0', diff);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('Property removed: state');
  });

  it('passes drift check when an optional field is added with a minor version bump', () => {
    const modifiedSchema = {
      ...previousSchema,
      properties: {
        ...previousSchema.properties,
        taxCredits: { type: 'number', minimum: 0 },
      },
    };

    const diff = detectSchemaChanges(previousSchema, modifiedSchema);
    expect(diff.breakingChanges.length).toBe(0);
    expect(diff.minorChanges.length).toBe(1);

    const check = checkContractCompatibility('1.0.0', '1.1.0', diff);
    expect(check.valid).toBe(true);
  });

  it('passes drift check when a breaking change is accompanied by a major version bump', () => {
    const modifiedSchema = {
      ...previousSchema,
      required: [...previousSchema.required, 'taxYear'],
      properties: {
        ...previousSchema.properties,
        taxYear: { type: 'integer' },
      },
    };

    const diff = detectSchemaChanges(previousSchema, modifiedSchema);
    const check = checkContractCompatibility('1.0.0', '2.0.0', diff);
    expect(check.valid).toBe(true);
  });
});
