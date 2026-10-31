import { describe, expect, it } from 'vitest';
import { buildNomenclature } from '../nomenclature';
import { createDefaultDocument } from '../defaultDocument';

describe('derived mechanical nomenclature', () => {
  it('assigns S0 to the fixed reference and short IDs to bodies and joints', () => {
    const nomenclature = buildNomenclature(createDefaultDocument());
    expect(nomenclature.bodies.map(({ reference }) => reference)).toEqual(['S0', 'S1', 'S2', 'S3']);
    expect(nomenclature.joints.map(({ reference }) => reference)).toEqual(['L1', 'L2', 'L3', 'L4']);
    expect(nomenclature.joints[0]).toMatchObject({ source: 'S0', target: 'S1', type: 'Pivot' });
    expect(nomenclature.bodies[1].name).toBe('Manivelle');
    expect(nomenclature.bodyReferences.get('eq_1')).toBe('S1');
  });

  it('derives new row numbers after removals without changing technical IDs', () => {
    const document = createDefaultDocument();
    document.classesEquivalence.splice(1, 1);
    document.liaisons.splice(0, 1);
    const nomenclature = buildNomenclature(document);
    expect(nomenclature.bodies.map(({ reference }) => reference)).toEqual(['S0', 'S1', 'S2']);
    expect(nomenclature.joints.map(({ reference }) => reference)).toEqual(['L1', 'L2', 'L3']);
    expect(nomenclature.joints[0].id).toBe('link_2');
  });
});
