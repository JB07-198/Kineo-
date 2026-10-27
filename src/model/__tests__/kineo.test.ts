import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { detectConversionLosses, fromInternalModel, toInternalModel, validateReferences } from '../conversion';
import { createDefaultDocument } from '../defaultDocument';
import type { KineoV3 } from '../jsonV3';
import { validateKineoV3 } from '../validation';
import { useKineoStore } from '../../store/useKineoStore';

function readCanonicalExample(): KineoV3 {
  const specification = readFileSync(
    new URL('../../../documentation_etape1_etape2.txt', import.meta.url),
    'utf8',
  );
  const specStart = specification.indexOf('Spécification du Modèle de Données (JSON v3.0)');
  const jsonStart = specification.indexOf('{', specStart);
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = jsonStart; index < specification.length; index += 1) {
    const character = specification[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) {
      return JSON.parse(specification.slice(jsonStart, index + 1)) as KineoV3;
    }
  }
  throw new Error('Could not find the JSON v3 example in the project specification');
}

const canonicalExample = readCanonicalExample();

describe('Kineo JSON v3.0 foundation', () => {
  beforeEach(() => {
    useKineoStore.getState().replaceDocument(createDefaultDocument());
  });

  it('validates the original specification example', () => {
    expect(validateKineoV3(canonicalExample).meta.schemaVersion).toBe('3.0');
    expect(() => validateReferences(canonicalExample)).not.toThrow();
  });

  it('adds a supported joint definition when the imported catalogue does not contain it', () => {
    useKineoStore.getState().replaceDocument(canonicalExample);
    useKineoStore.getState().addJoint('HELICOIDALE', 'eq_0', 'eq_1', { x: 10, y: 0, z: 0 });
    const updated = useKineoStore.getState().document;
    expect(updated.jointDefinitions.HELICOIDALE.isoCode).toBe('ISO 3952-1');
    expect(updated.liaisons.at(-1)?.type).toBe('HELICOIDALE');
    expect(() => validateReferences(updated)).not.toThrow();
  });

  it('round-trips the canonical document without dropping nested or extension fields', () => {
    const source = structuredClone(canonicalExample) as KineoV3;
    source.meta.customMetadata = { source: 'user', preserved: true };
    source.liaisons[0].anchors.customAnchorData = ['kept', 17];
    source.classesEquivalence[0].customClassData = { value: 42 };
    const parsed = validateKineoV3(source);
    const roundTrip = fromInternalModel(toInternalModel(parsed));
    const reopened = validateKineoV3(JSON.parse(JSON.stringify(roundTrip)));

    expect(detectConversionLosses(source, roundTrip)).toEqual([]);
    expect(detectConversionLosses(source, reopened)).toEqual([]);
    expect(() => validateReferences(reopened)).not.toThrow();
    expect(roundTrip.liaisons[0].anchors.customAnchorData).toEqual(['kept', 17]);
  });

  it('imports a valid JSON v3 document into the active store without altering its data', () => {
    useKineoStore.getState().replaceDocument(canonicalExample);
    expect(useKineoStore.getState().document).toEqual(canonicalExample);
    expect(() => validateReferences(useKineoStore.getState().document)).not.toThrow();
  });

  it('rejects broken class, joint-type, geometry and driven-DOF references', () => {
    const invalid = structuredClone(canonicalExample);
    invalid.liaisons[0].classA = 'missing-class';
    expect(() => validateReferences(invalid)).toThrow(/unknown classA/);

    const invalidType = structuredClone(canonicalExample);
    invalidType.liaisons[0].type = 'UNKNOWN';
    expect(() => validateReferences(invalidType)).toThrow(/unknown type/);

    const invalidGeometry = structuredClone(canonicalExample);
    invalidGeometry.geometry.entities[0].classId = 'missing-class';
    expect(() => validateReferences(invalidGeometry)).toThrow(/unknown class/);

    const invalidDriver = structuredClone(canonicalExample);
    invalidDriver.kinematics.drivenDofs[0].dofId = 'missing-dof';
    expect(() => validateReferences(invalidDriver)).toThrow(/unknown id/);

    const cyclicParents = structuredClone(canonicalExample);
    cyclicParents.classesEquivalence[0].parentId = cyclicParents.classesEquivalence[1].id;
    cyclicParents.classesEquivalence[1].parentId = cyclicParents.classesEquivalence[0].id;
    expect(() => validateReferences(cyclicParents)).toThrow(/contains a cycle/);
  });

  it('rejects non-finite numeric values during runtime validation', () => {
    const invalid = structuredClone(canonicalExample);
    invalid.liaisons[0].position.x = Number.NaN;
    expect(() => validateKineoV3(invalid)).toThrow();

    const invalidLimits = structuredClone(canonicalExample);
    invalidLimits.liaisons[0].dof[0].value = 1000;
    expect(() => validateKineoV3(invalidLimits)).toThrow(/within its limits/);
  });

  it('cascades class deletion and preserves references after undo and redo', () => {
    const store = useKineoStore.getState();
    const bodyId = store.addClass('Test body', { x: 250, y: 20, z: 0 });
    const current = useKineoStore.getState();
    current.addJoint('PIVOT', 'eq_0', bodyId, { x: 250, y: 20, z: 0 });
    useKineoStore.getState().removeEntity(bodyId, 'Class');

    const afterDelete = useKineoStore.getState().document;
    expect(afterDelete.classesEquivalence.some((body) => body.id === bodyId)).toBe(false);
    expect(afterDelete.liaisons.some((joint) => joint.classA === bodyId || joint.classB === bodyId)).toBe(false);
    expect(afterDelete.geometry.entities.some((entity) => entity.classId === bodyId)).toBe(false);
    expect(() => validateReferences(afterDelete)).not.toThrow();

    useKineoStore.getState().undo();
    expect(() => validateReferences(useKineoStore.getState().document)).not.toThrow();
    expect(useKineoStore.getState().document.classesEquivalence.some((body) => body.id === bodyId)).toBe(true);
    useKineoStore.getState().redo();
    expect(() => validateReferences(useKineoStore.getState().document)).not.toThrow();
  });

  it('moves attached joints with a body and stores newly placed anchors in local frames', () => {
    const store = useKineoStore.getState();
    store.updateClass('eq_2', { position: { x: 80, y: 10, z: 0 } });
    let document = useKineoStore.getState().document;
    expect(document.liaisons.find((joint) => joint.id === 'link_2')?.position).toMatchObject({ x: 80, y: 10 });
    expect(document.liaisons.find((joint) => joint.id === 'link_3')?.position).toMatchObject({ x: 200, y: 10 });

    const bodyId = useKineoStore.getState().addClass('Rotated body', { x: 300, y: 40, z: 0 });
    useKineoStore.getState().updateClass(bodyId, { rotation: Math.PI / 2 });
    useKineoStore.getState().addJoint('PIVOT', 'eq_0', bodyId, { x: 300, y: 40, z: 0 });
    document = useKineoStore.getState().document;
    const joint = document.liaisons.at(-1);
    expect(joint?.anchors.onClassB).toMatchObject({ x: 0, y: 0, z: 0 });
    useKineoStore.getState().moveJoint(joint!.id, { x: 300, y: 50, z: 0 });
    document = useKineoStore.getState().document;
    expect(document.liaisons.at(-1)?.anchors.onClassB.x).toBeCloseTo(10);
    expect(() => validateReferences(document)).not.toThrow();
  });

  it('removes driven DOF references when deleting their joint', () => {
    const document = createDefaultDocument();
    document.kinematics.drivenDofs.push({
      dofId: document.liaisons[0].dof[0].id,
      controlType: 'POSITION',
      targetValue: 0,
      unit: 'deg',
    });
    useKineoStore.getState().replaceDocument(document);
    useKineoStore.getState().removeEntity('link_1', 'Joint');
    const afterDelete = useKineoStore.getState().document;
    expect(afterDelete.kinematics.drivenDofs).toEqual([]);
    expect(() => validateReferences(afterDelete)).not.toThrow();
  });

  it('keeps the ground body and document unchanged after invalid import or deletion', () => {
    const store = useKineoStore.getState();
    const documentBefore = structuredClone(store.document);
    expect(() => store.removeEntity('eq_0', 'Class')).toThrow(/ground body/);
    expect(() => store.replaceDocument({ ...documentBefore, liaisons: [{ ...documentBefore.liaisons[0], classB: 'missing' }] }))
      .toThrow(/unknown classB/);
    expect(useKineoStore.getState().document).toEqual(documentBefore);
  });
});
