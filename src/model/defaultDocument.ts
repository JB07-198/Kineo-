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
const quaternion = () => ({ x: 0, y: 0, z: 0, w: 1 });
export const APP_VERSION = '0.3.1';

function createDocumentMetadata(title: string) {
  return {
    schemaVersion: '3.0' as const,
    appVersion: APP_VERSION,
    title,
    author: '',
    lengthUnit: 'mm',
    angleUnit: 'deg',
  };
}

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
    orientation: quaternion(),
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
  const crankRadius = 70;
  const crankAngle = Math.PI / 4;
  const rodLength = 120;
  const crankEnd = point(crankRadius * Math.cos(crankAngle), crankRadius * Math.sin(crankAngle));
  const sliderPosition = point(crankEnd.x + Math.sqrt(rodLength ** 2 - crankEnd.y ** 2), 0);
  const rodDelta = { x: sliderPosition.x - crankEnd.x, y: sliderPosition.y - crankEnd.y };
  const rodAngle = Math.atan2(rodDelta.y, rodDelta.x);
  const crankEndLocal = point(crankRadius, 0);
  const rodEndLocal = point(rodLength, 0);
  const guideStart = sliderPosition.x - 45;
  const guideEnd = sliderPosition.x + 45;
  const groundStyle = { stroke: 'solid' as const, width: 2, color: '#94a3b8' };
  const hatchStyle = { stroke: 'solid' as const, width: 1.5, color: '#94a3b8' };

  return {
    meta: createDocumentMetadata('Bielle-manivelle-piston'),
    jointDefinitions: structuredClone(JOINT_DEFINITIONS),
    classesEquivalence: [
      { id: 'eq_0', name: 'Bâti', color: '#64748b', isFixed: true, parentId: null, position: point(0, 0), rotation: 0 },
      { id: 'eq_1', name: 'Manivelle', color: '#e63946', isFixed: false, parentId: null, position: point(0, 0), rotation: crankAngle },
      { id: 'eq_2', name: 'Bielle', color: '#2a9d8f', isFixed: false, parentId: null, position: crankEnd, rotation: rodAngle },
      { id: 'eq_3', name: 'Piston', color: '#457b9d', isFixed: false, parentId: null, position: sliderPosition, rotation: 0 },
    ],
    liaisons: [
      createJoint('link_1', 'Pivot O', 'PIVOT', 'eq_0', 'eq_1', point(0, 0), point(0, 0), point(0, 0), [0]),
      createJoint('link_2', 'Pivot A', 'PIVOT', 'eq_1', 'eq_2', crankEnd, crankEndLocal, point(0, 0), [0]),
      createJoint('link_3', 'Pivot B', 'PIVOT', 'eq_2', 'eq_3', sliderPosition, rodEndLocal, point(0, 0), [0]),
      createJoint('link_4', 'Glissière horizontale', 'GLISSIERE', 'eq_3', 'eq_0', sliderPosition, point(0, 0), sliderPosition, [0]),
    ],
    kinematics: { solverType: 'none', closedLoopMode: true, drivenDofs: [] },
    geometry: {
      entities: [
        { id: 'ent_guide_upper', kind: 'segment', classId: 'eq_0', localPoints: [point(guideStart, 9), point(guideEnd, 9)], style: groundStyle, view: '2D' },
        { id: 'ent_guide_lower', kind: 'segment', classId: 'eq_0', localPoints: [point(guideStart, -9), point(guideEnd, -9)], style: groundStyle, view: '2D' },
        ...Array.from({ length: 9 }, (_, index) => {
          const x = guideStart + 4 + index * 9;
          return {
            id: `ent_guide_hatch_${index + 1}`,
            kind: 'segment' as const,
            classId: 'eq_0',
            localPoints: [point(x, -12), point(x + 7, -19)],
            style: hatchStyle,
            view: '2D' as const,
          };
        }),
        { id: 'ent_crank', kind: 'segment', classId: 'eq_1', localPoints: [point(0, 0), crankEndLocal], style: { stroke: 'solid', width: 4, color: '#e63946' }, view: '2D' },
        { id: 'ent_rod', kind: 'segment', classId: 'eq_2', localPoints: [point(0, 0), rodEndLocal], style: { stroke: 'solid', width: 4, color: '#2a9d8f' }, view: '2D' },
        { id: 'ent_piston', kind: 'rectangle', classId: 'eq_3', localPoints: [point(-18, -9), point(18, 9)], style: { stroke: 'solid', width: 2, color: '#457b9d' }, view: '2D' },
      ],
    },
  };
}

export function createEmptyKineoDocument(): KineoV3 {
  return {
    meta: createDocumentMetadata('Nouveau mécanisme'),
    jointDefinitions: structuredClone(JOINT_DEFINITIONS),
    classesEquivalence: [],
    liaisons: [],
    kinematics: { solverType: 'none', closedLoopMode: false, drivenDofs: [] },
    geometry: { entities: [] },
  };
}
