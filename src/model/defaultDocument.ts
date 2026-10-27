import type { JointDefinitionTemplate, KineoV3, Vector3 } from './jsonV3';

const axis = (x: number, y: number, z: number): Vector3 => ({ x, y, z });
const rotation = axis(0, 0, 1);
const translation = axis(1, 0, 0);

export const JOINT_DEFINITIONS: Record<string, JointDefinitionTemplate> = {
  PIVOT: {
    isoCode: 'ISO 3952-1',
    dofCount: 1,
    dofTemplate: [{ type: 'rotation', defaultAxisLocal: rotation, defaultMin: -180, defaultMax: 180, unit: 'deg' }],
  },
  GLISSIERE: {
    isoCode: 'ISO 3952-1',
    dofCount: 1,
    dofTemplate: [{ type: 'translation', defaultAxisLocal: translation, defaultMin: -100, defaultMax: 100, unit: 'mm' }],
  },
  PIVOT_GLISSANT: {
    isoCode: 'ISO 3952-1',
    dofCount: 2,
    dofTemplate: [
      { type: 'translation', defaultAxisLocal: translation, defaultMin: -100, defaultMax: 100, unit: 'mm' },
      { type: 'rotation', defaultAxisLocal: translation, defaultMin: -180, defaultMax: 180, unit: 'deg' },
    ],
  },
  ROTULE: {
    isoCode: 'ISO 3952-1',
    dofCount: 3,
    dofTemplate: [
      { type: 'rotation', defaultAxisLocal: axis(1, 0, 0), defaultMin: -180, defaultMax: 180, unit: 'deg' },
      { type: 'rotation', defaultAxisLocal: axis(0, 1, 0), defaultMin: -180, defaultMax: 180, unit: 'deg' },
      { type: 'rotation', defaultAxisLocal: rotation, defaultMin: -180, defaultMax: 180, unit: 'deg' },
    ],
  },
  APPUI_PLAN: {
    isoCode: 'ISO 3952-1',
    dofCount: 3,
    dofTemplate: [
      { type: 'translation', defaultAxisLocal: translation, defaultMin: -100, defaultMax: 100, unit: 'mm' },
      { type: 'translation', defaultAxisLocal: axis(0, 1, 0), defaultMin: -100, defaultMax: 100, unit: 'mm' },
      { type: 'rotation', defaultAxisLocal: rotation, defaultMin: -180, defaultMax: 180, unit: 'deg' },
    ],
  },
  HELICOIDALE: {
    isoCode: 'ISO 3952-1',
    dofCount: 1,
    dofTemplate: [{ type: 'rotation', defaultAxisLocal: translation, defaultMin: -180, defaultMax: 180, unit: 'deg' }],
  },
  ENCASTREMENT: {
    isoCode: 'ISO 3952-1',
    dofCount: 0,
    dofTemplate: [],
  },
};

const point = (x: number, y: number): Vector3 => ({ x, y, z: 0 });
const quaternion = { x: 0, y: 0, z: 0, w: 1 };

function createJoint(
  id: string,
  name: string,
  type: string,
  classA: string,
  classB: string,
  position: Vector3,
  anchorA: Vector3,
  anchorB: Vector3,
  values: number[],
) {
  const definition = JOINT_DEFINITIONS[type];
  return {
    id,
    name,
    type,
    classA,
    classB,
    position,
    orientation: quaternion,
    anchors: { onClassA: anchorA, onClassB: anchorB },
    dof: definition.dofTemplate.map((template, index) => ({
      id: `${id}_dof_${index + 1}`,
      type: template.type,
      axisLocal: template.defaultAxisLocal,
      min: template.defaultMin,
      max: template.defaultMax,
      value: values[index] ?? 0,
      unit: template.unit,
    })),
  };
}

export function createDefaultDocument(): KineoV3 {
  return {
    meta: {
      schemaVersion: '3.0',
      appVersion: '0.1.0',
      title: 'Bielle-manivelle-piston',
      author: '',
      lengthUnit: 'mm',
      angleUnit: 'deg',
    },
    jointDefinitions: structuredClone(JOINT_DEFINITIONS),
    classesEquivalence: [
      { id: 'eq_0', name: 'Bâti', color: '#64748b', isFixed: true, parentId: null, position: point(0, 0), rotation: 0 },
      { id: 'eq_1', name: 'Manivelle', color: '#e63946', isFixed: false, parentId: null, position: point(0, 0), rotation: 0 },
      { id: 'eq_2', name: 'Bielle', color: '#2a9d8f', isFixed: false, parentId: null, position: point(70, 0), rotation: 0 },
      { id: 'eq_3', name: 'Piston', color: '#457b9d', isFixed: false, parentId: null, position: point(190, 0), rotation: 0 },
    ],
    liaisons: [
      createJoint('link_1', 'Pivot bâti - manivelle', 'PIVOT', 'eq_0', 'eq_1', point(0, 0), point(0, 0), point(0, 0), [0]),
      createJoint('link_2', 'Pivot manivelle - bielle', 'PIVOT', 'eq_1', 'eq_2', point(70, 0), point(70, 0), point(0, 0), [0]),
      createJoint('link_3', 'Pivot bielle - piston', 'PIVOT', 'eq_2', 'eq_3', point(190, 0), point(120, 0), point(0, 0), [0]),
      createJoint('link_4', 'Glissière piston - bâti', 'GLISSIERE', 'eq_3', 'eq_0', point(190, 0), point(0, 0), point(190, 0), [0]),
    ],
    kinematics: { solverType: 'none', closedLoopMode: true, drivenDofs: [] },
    geometry: {
      entities: [
        { id: 'ent_ground_rail', kind: 'segment', classId: 'eq_0', localPoints: [point(-15, -28), point(225, -28)], style: { stroke: 'dashed', width: 2, color: '#94a3b8' }, view: '2D' },
        { id: 'ent_crank', kind: 'segment', classId: 'eq_1', localPoints: [point(0, 0), point(70, 0)], style: { stroke: 'solid', width: 4, color: '#e63946' }, view: '2D' },
        { id: 'ent_rod', kind: 'segment', classId: 'eq_2', localPoints: [point(0, 0), point(120, 0)], style: { stroke: 'solid', width: 4, color: '#2a9d8f' }, view: '2D' },
        { id: 'ent_piston', kind: 'rectangle', classId: 'eq_3', localPoints: [point(-20, -14), point(20, 14)], style: { stroke: 'solid', width: 2, color: '#457b9d' }, view: '2D' },
      ],
    },
  };
}
