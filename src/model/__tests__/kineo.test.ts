// src/model/__tests__/kineo.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateKineoV3 } from '../validation';
import { toInternalModel, fromInternalModel, validateReferences, detectConversionLosses } from '../conversion';

// Load the canonical spec JSON (the first 400 lines of the spec file contain the full JSON object)
const specPath = resolve('C:/Users/Toshiba/Kineo-/documentation_etape1_etape2.txt');
const specContent = readFileSync(specPath, { encoding: 'utf8' });
// Extract the JSON block (between the first "{" and the matching closing "}")
const jsonStart = specContent.indexOf('{');
const jsonEnd = specContent.lastIndexOf('}');
const jsonString = specContent.slice(jsonStart, jsonEnd + 1);
const specJson = JSON.parse(jsonString);

describe('Kineo JSON v3 canonical model', () => {
  it('validates the spec against Zod schema', () => {
    const parsed = validateKineoV3(specJson);
    expect(parsed.meta.schemaVersion).toBe('3.0');
  });

  it('converts to internal model and back without loss', () => {
    const internal = toInternalModel(specJson);
    const roundTrip = fromInternalModel(internal);
    const losses = detectConversionLosses(specJson, roundTrip);
    expect(losses).toEqual([]);
  });

  it('detects reference integrity', () => {
    const internal = toInternalModel(specJson);
    expect(() => validateReferences(internal)).not.toThrow();
  });
});

