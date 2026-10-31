import { createDefaultDocument, createEmptyKineoDocument } from '../defaultDocument';
import type { KineoV3 } from '../jsonV3';

export function emptyFixture(): KineoV3 {
  return createEmptyKineoDocument();
}

export function pivotFixture(): KineoV3 {
  const document = createEmptyKineoDocument();
  document.classesEquivalence = [
    { id: 'ground', name: 'Ground', color: '#334155', isFixed: true, parentId: null, position: { x: 0, y: 0, z: 0 }, rotation: 0 },
    { id: 'link', name: 'Link', color: '#2563eb', isFixed: false, parentId: null, position: { x: 40, y: 0, z: 0 }, rotation: 0 },
  ];
  const template = document.jointDefinitions.PIVOT;
  document.liaisons = [{
    id: 'pivot-1',
    name: 'Main pivot',
    type: 'PIVOT',
    classA: 'ground',
    classB: 'link',
    position: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    anchors: {
      onClassA: { x: 0, y: 0, z: 0 },
      onClassB: { x: -40, y: 0, z: 0 },
    },
    dof: template.dofTemplate.map((dof, index) => ({
      id: `pivot-1-dof-${index}`,
      type: dof.type,
      axisLocal: dof.defaultAxisLocal,
      min: dof.defaultMin,
      max: dof.defaultMax,
      value: 0,
      unit: dof.unit,
    })),
  }];
  document.geometry.entities = [
    { id: 'ground-line', kind: 'segment', classId: 'ground', localPoints: [{ x: -25, y: 0, z: 0 }, { x: 25, y: 0, z: 0 }], style: { stroke: 'solid', width: 2, color: '#334155' }, view: '2D' },
    { id: 'link-line', kind: 'segment', classId: 'link', localPoints: [{ x: -40, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], style: { stroke: 'solid', width: 2, color: '#2563eb' }, view: '2D' },
  ];
  return document;
}

export function sliderCrankFixture(): KineoV3 {
  return createDefaultDocument();
}

export function fourBarFixture(): KineoV3 {
  const document = createDefaultDocument();
  document.classesEquivalence[0] = { ...document.classesEquivalence[0], name: 'Ground', position: { x: 0, y: 0, z: 0 }, rotation: 0 };
  document.classesEquivalence[1] = { ...document.classesEquivalence[1], name: 'Crank', position: { x: 50, y: 0, z: 0 }, rotation: 0 };
  document.classesEquivalence[2] = { ...document.classesEquivalence[2], name: 'Coupler', position: { x: 100, y: 50, z: 0 }, rotation: 0 };
  document.classesEquivalence[3] = { ...document.classesEquivalence[3], name: 'Rocker', position: { x: 0, y: 50, z: 0 }, rotation: 0 };
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 50, y: 0, z: 0 },
    { x: 100, y: 50, z: 0 },
    { x: 0, y: 50, z: 0 },
  ];
  document.liaisons[0].position = points[0];
  document.liaisons[0].anchors.onClassA = { x: 0, y: 0, z: 0 };
  document.liaisons[0].anchors.onClassB = { x: -50, y: 0, z: 0 };
  document.liaisons[1].position = points[1];
  document.liaisons[1].anchors.onClassA = { x: 0, y: 0, z: 0 };
  document.liaisons[1].anchors.onClassB = { x: -50, y: -50, z: 0 };
  document.liaisons[2].position = points[2];
  document.liaisons[2].anchors.onClassA = { x: 0, y: 0, z: 0 };
  document.liaisons[2].anchors.onClassB = { x: 100, y: 0, z: 0 };
  document.liaisons[3].position = points[3];
  document.liaisons[3].anchors.onClassA = { x: 0, y: 0, z: 0 };
  document.liaisons[3].anchors.onClassB = { x: 0, y: 50, z: 0 };
  document.liaisons[3].type = 'PIVOT';
  document.liaisons[3].name = 'Rocker ground pivot';
  const pivotDof = document.jointDefinitions.PIVOT.dofTemplate[0];
  document.liaisons[3].dof = [{
    id: document.liaisons[3].dof[0].id,
    type: pivotDof.type,
    axisLocal: pivotDof.defaultAxisLocal,
    min: pivotDof.defaultMin,
    max: pivotDof.defaultMax,
    value: 0,
    unit: pivotDof.unit,
  }];
  const crank = document.geometry.entities.find(({ id }) => id === 'ent_crank');
  if (crank) crank.localPoints = [{ x: -50, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
  const coupler = document.geometry.entities.find(({ id }) => id === 'ent_rod');
  if (coupler) coupler.localPoints = [{ x: -50, y: -50, z: 0 }, { x: 0, y: 0, z: 0 }];
  const rocker = document.geometry.entities.find(({ id }) => id === 'ent_piston');
  if (rocker) {
    rocker.kind = 'segment';
    rocker.localPoints = [{ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }];
  }
  document.geometry.entities = [
    { id: 'ent_ground_rail', kind: 'segment', classId: 'eq_0', localPoints: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 50, z: 0 }], style: { stroke: 'solid', width: 2, color: '#334155' }, view: '2D' },
    ...document.geometry.entities.filter(({ id }) => id === 'ent_crank' || id === 'ent_rod' || id === 'ent_piston'),
  ];
  return document;
}

export function denseAnnotationFixture(): KineoV3 {
  const document = fourBarFixture();
  document.classesEquivalence.forEach((body, index) => {
    body.name = `Assembly member ${index + 1} with long annotation`;
    body.position = { x: index * 6, y: index % 2 ? 3 : 0, z: 0 };
  });
  document.liaisons.forEach((joint, index) => {
    joint.name = `Detailed joint ${index + 1} long label near neighboring components`;
    joint.position = { x: index * 5, y: index % 2 ? 2 : 0, z: 0 };
  });
  return document;
}

export function inconsistentAnchorFixture(): KineoV3 {
  const document = pivotFixture();
  document.liaisons[0].anchors.onClassB.x = -20;
  return document;
}
