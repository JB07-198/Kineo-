import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { detectConversionLosses, fromInternalModel, toInternalModel, validateReferences } from '../conversion';
import { createDefaultDocument, createEmptyKineoDocument } from '../defaultDocument';
import type { KineoV3 } from '../jsonV3';
import { validateKineoV3 } from '../validation';
import { selectDocumentDirty, useKineoStore } from '../../store/useKineoStore';

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

  it('creates a valid empty JSON v3 document without demonstration mechanism data', () => {
    const empty = createEmptyKineoDocument();
    expect(validateKineoV3(empty)).toEqual(empty);
    expect(empty.meta.schemaVersion).toBe('3.0');
    expect(empty.classesEquivalence).toEqual([]);
    expect(empty.liaisons).toEqual([]);
    expect(empty.geometry.entities).toEqual([]);
    expect(empty.kinematics.drivenDofs).toEqual([]);
    expect(Object.keys(empty.jointDefinitions).length).toBeGreaterThan(0);
    expect(() => validateReferences(empty)).not.toThrow();
    expect(fromInternalModel(toInternalModel(empty))).toEqual(empty);
    const example = createDefaultDocument();
    expect(example.classesEquivalence.length).toBeGreaterThan(0);
    expect(() => validateReferences(validateKineoV3(example))).not.toThrow();
    expect(fromInternalModel(toInternalModel(example))).toEqual(example);
  });

  it('replaces document history and selection when creating a new empty document', () => {
    const store = useKineoStore.getState();
    const bodyId = store.addClass('Temporary', { x: 10, y: 0, z: 0 });
    useKineoStore.getState().selectEntity(bodyId, 'Class');
    const revisionBeforeReplacement = useKineoStore.getState().documentRevision;
    useKineoStore.getState().replaceDocument(createEmptyKineoDocument());
    const replaced = useKineoStore.getState();
    expect(replaced.documentRevision).toBe(revisionBeforeReplacement + 1);
    expect(replaced.document.classesEquivalence).toEqual([]);
    expect(replaced.document.liaisons).toEqual([]);
    expect(replaced.document.geometry.entities).toEqual([]);
    expect(replaced.selectedEntityId).toBeNull();
    expect(replaced.undoStack).toEqual([]);
    expect(replaced.redoStack).toEqual([]);
    expect(selectDocumentDirty(replaced)).toBe(false);
    replaced.undo();
    replaced.redo();
    expect(useKineoStore.getState().document).toEqual(createEmptyKineoDocument());
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
    source.meta.title = 'Round-trip verification mechanism';
    source.meta.author = 'Kineo audit fixture';
    source.meta.lengthUnit = 'cm';
    source.meta.angleUnit = 'rad';
    source.meta.customMetadata = { source: 'user', preserved: true };
    source.liaisons[0].anchors.customAnchorData = ['kept', 17];
    source.liaisons[0].dof[0].customControlData = { mode: 'verified' };
    source.liaisons[0].orientation = { x: 0, y: 0, z: 0.3826834324, w: 0.9238795325 };
    source.classesEquivalence[0].customClassData = { value: 42 };
    source.jointDefinitions.PIVOT.customDefinitionData = { revision: 3 };
    source.geometry.entities[0].style.customStyleData = ['kept'];
    source.kinematics.customSolverData = { preserved: true };
    source.kinematics.drivenDofs.push({
      dofId: source.liaisons[0].dof[0].id,
      controlType: 'POSITION',
      targetValue: 25,
      unit: 'deg',
    });
    const parsed = validateKineoV3(source);
    const roundTrip = fromInternalModel(toInternalModel(parsed));
    const reopened = validateKineoV3(JSON.parse(JSON.stringify(roundTrip)));

    expect(roundTrip).toEqual(source);
    expect(reopened).toEqual(source);
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

    const duplicateClass = structuredClone(canonicalExample);
    duplicateClass.classesEquivalence[1].id = duplicateClass.classesEquivalence[0].id;
    expect(() => validateReferences(duplicateClass)).toThrow(/Duplicate class id/);

    const duplicateJoint = structuredClone(canonicalExample);
    duplicateJoint.liaisons[1].id = duplicateJoint.liaisons[0].id;
    expect(() => validateReferences(duplicateJoint)).toThrow(/Duplicate joint id/);

    const duplicateGeometry = structuredClone(canonicalExample);
    duplicateGeometry.geometry.entities[1].id = duplicateGeometry.geometry.entities[0].id;
    expect(() => validateReferences(duplicateGeometry)).toThrow(/Duplicate geometry id/);

    const duplicateDof = structuredClone(canonicalExample);
    duplicateDof.liaisons[1].dof[0].id = duplicateDof.liaisons[0].dof[0].id;
    expect(() => validateReferences(duplicateDof)).toThrow(/Duplicate degree-of-freedom id/);

    const invalidDriver = structuredClone(canonicalExample);
    invalidDriver.kinematics.drivenDofs[0].dofId = 'missing-dof';
    expect(() => validateReferences(invalidDriver)).toThrow(/unknown id/);

    const cyclicParents = structuredClone(canonicalExample);
    cyclicParents.classesEquivalence[0].parentId = cyclicParents.classesEquivalence[1].id;
    cyclicParents.classesEquivalence[1].parentId = cyclicParents.classesEquivalence[0].id;
    expect(() => validateReferences(cyclicParents)).toThrow(/contains a cycle/);
  });

  it('does not accept inherited JavaScript properties as joint definitions', () => {
    const invalid = structuredClone(canonicalExample);
    invalid.liaisons[0].type = 'toString';
    expect(() => validateReferences(invalid)).toThrow(/unknown type/);
    expect(() => useKineoStore.getState().addJoint('toString', 'eq_0', 'eq_1', { x: 0, y: 0, z: 0 }))
      .toThrow(/Unknown joint type/);
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
    expect(useKineoStore.getState().selectedEntityId).toBeNull();
    expect(() => validateReferences(afterDelete)).not.toThrow();

    useKineoStore.getState().undo();
    expect(() => validateReferences(useKineoStore.getState().document)).not.toThrow();
    expect(useKineoStore.getState().document.classesEquivalence.some((body) => body.id === bodyId)).toBe(true);
    useKineoStore.getState().redo();
    expect(() => validateReferences(useKineoStore.getState().document)).not.toThrow();
  });

  it('moves attached joints with a body and stores newly placed anchors in local frames', () => {
    const store = useKineoStore.getState();
    const bodyBeforeMove = store.document.classesEquivalence.find(({ id }) => id === 'eq_2')!;
    const endJointBeforeMove = store.document.liaisons.find(({ id }) => id === 'link_3')!;
    store.updateClass('eq_2', { position: { x: 80, y: 10, z: 0 } });
    let document = useKineoStore.getState().document;
    expect(document.liaisons.find((joint) => joint.id === 'link_2')?.position.x).toBeCloseTo(80);
    expect(document.liaisons.find((joint) => joint.id === 'link_2')?.position.y).toBeCloseTo(10);
    expect(document.liaisons.find((joint) => joint.id === 'link_3')?.position.x).toBeCloseTo(
      endJointBeforeMove.position.x + 80 - bodyBeforeMove.position!.x,
    );
    expect(document.liaisons.find((joint) => joint.id === 'link_3')?.position.y).toBeCloseTo(
      endJointBeforeMove.position.y + 10 - bodyBeforeMove.position!.y,
    );

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

  it('supports body and joint CRUD, local-anchor editing, and multi-step undo/redo', () => {
    const bodyId = useKineoStore.getState().addClass('New link', { x: 50, y: 0, z: 0 });
    useKineoStore.getState().updateClass(bodyId, { name: 'Renamed link', rotation: Math.PI / 2 });
    let document = useKineoStore.getState().document;
    expect(document.classesEquivalence.find((body) => body.id === bodyId)?.name).toBe('Renamed link');

    const jointId = useKineoStore.getState().addJoint('PIVOT', 'eq_0', bodyId, { x: 50, y: 0, z: 0 });
    useKineoStore.getState().updateJoint(jointId, { name: 'Editable pivot' });
    useKineoStore.getState().updateJointAnchor(jointId, 'onClassB', { x: 10, y: 0, z: 0 });
    document = useKineoStore.getState().document;
    const editedJoint = document.liaisons.find((joint) => joint.id === jointId);
    expect(editedJoint?.name).toBe('Editable pivot');
    expect(editedJoint?.position).toMatchObject({ x: 50, y: 10, z: 0 });
    expect(editedJoint?.anchors.onClassB.x).toBeCloseTo(10);
    expect(editedJoint?.anchors.onClassB.y).toBeCloseTo(0);
    expect(editedJoint?.anchors.onClassB.z).toBe(0);
    expect(editedJoint?.anchors.onClassA.x).toBeCloseTo(50);
    expect(editedJoint?.anchors.onClassA.y).toBeCloseTo(10);
    expect(() => validateReferences(document)).not.toThrow();

    useKineoStore.getState().removeEntity(jointId, 'Joint');
    expect(useKineoStore.getState().document.liaisons.some((joint) => joint.id === jointId)).toBe(false);
    useKineoStore.getState().undo();
    expect(useKineoStore.getState().document.liaisons.some((joint) => joint.id === jointId)).toBe(true);
    expect(() => validateReferences(useKineoStore.getState().document)).not.toThrow();
    useKineoStore.getState().redo();
    expect(useKineoStore.getState().document.liaisons.some((joint) => joint.id === jointId)).toBe(false);
    useKineoStore.getState().undo();
    useKineoStore.getState().removeEntity(bodyId, 'Class');

    const afterCascade = useKineoStore.getState();
    expect(afterCascade.selectedEntityId).toBeNull();
    expect(afterCascade.document.liaisons.some((joint) => joint.classA === bodyId || joint.classB === bodyId)).toBe(false);
    expect(() => validateReferences(afterCascade.document)).not.toThrow();
    useKineoStore.getState().undo();
    expect(useKineoStore.getState().document.classesEquivalence.some((body) => body.id === bodyId)).toBe(true);
    expect(() => validateReferences(useKineoStore.getState().document)).not.toThrow();
    useKineoStore.getState().redo();
    expect(useKineoStore.getState().document.classesEquivalence.some((body) => body.id === bodyId)).toBe(false);
    expect(() => validateReferences(useKineoStore.getState().document)).not.toThrow();
  });

  it('does not record a deletion for an unknown geometry id', () => {
    const before = useKineoStore.getState();
    const historyLength = before.undoStack.length;
    before.removeEntity('missing-geometry', 'Geometry');
    expect(useKineoStore.getState().undoStack).toHaveLength(historyLength);
    expect(useKineoStore.getState().document).toEqual(before.document);
  });

  it('clears selection when undo removes the selected addition', () => {
    const bodyId = useKineoStore.getState().addClass('Temporary link', { x: 30, y: 0, z: 0 });
    expect(useKineoStore.getState().selectedEntityId).toBe(bodyId);
    useKineoStore.getState().undo();
    expect(useKineoStore.getState().document.classesEquivalence.some((body) => body.id === bodyId)).toBe(false);
    expect(useKineoStore.getState().selectedEntityId).toBeNull();
    useKineoStore.getState().redo();
    expect(useKineoStore.getState().document.classesEquivalence.some((body) => body.id === bodyId)).toBe(true);
    expect(() => validateReferences(useKineoStore.getState().document)).not.toThrow();
  });

  it('tracks dirty state through edits, undo/redo, save, replacement, and view switching', () => {
    const store = useKineoStore.getState();
    expect(selectDocumentDirty(store)).toBe(false);

    store.setTitle('Edited mechanism');
    expect(selectDocumentDirty(useKineoStore.getState())).toBe(true);
    useKineoStore.getState().undo();
    expect(selectDocumentDirty(useKineoStore.getState())).toBe(false);
    useKineoStore.getState().redo();
    expect(selectDocumentDirty(useKineoStore.getState())).toBe(true);
    useKineoStore.getState().markDocumentSaved();
    expect(selectDocumentDirty(useKineoStore.getState())).toBe(false);

    const savedSnapshot = JSON.stringify(useKineoStore.getState().document);
    useKineoStore.getState().setViewMode('Graph');
    useKineoStore.getState().setViewMode('Split');
    expect(JSON.stringify(useKineoStore.getState().document)).toBe(savedSnapshot);
    expect(selectDocumentDirty(useKineoStore.getState())).toBe(false);

    const imported = structuredClone(canonicalExample);
    imported.meta.title = 'Imported mechanism';
    useKineoStore.getState().replaceDocument(imported);
    expect(selectDocumentDirty(useKineoStore.getState())).toBe(false);
    expect(useKineoStore.getState().undoStack).toEqual([]);
    expect(() => validateReferences(useKineoStore.getState().document)).not.toThrow();
  });

  it('keeps the ground body and document unchanged after invalid import or deletion', () => {
    const store = useKineoStore.getState();
    const documentBefore = structuredClone(store.document);
    expect(() => store.removeEntity('eq_0', 'Class')).toThrow(/ground body/);
    expect(() => store.updateClass('eq_0', { position: { x: 1, y: 0, z: 0 } })).toThrow(/ground body/);
    expect(() => store.updateClass('eq_0', { rotation: 1 })).toThrow(/ground body/);
    expect(() => store.replaceDocument({ ...documentBefore, liaisons: [{ ...documentBefore.liaisons[0], classB: 'missing' }] }))
      .toThrow(/unknown classB/);
    expect(() => store.replaceDocument({ meta: { schemaVersion: '3.0' } }))
      .toThrow(/invalid|expected/i);
    expect(useKineoStore.getState().document).toEqual(documentBefore);
  });
});
