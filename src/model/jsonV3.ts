export interface Meta {
  schemaVersion: '3.0';
  appVersion: string;
  title: string;
  author: string;
  lengthUnit: string;
  angleUnit: string;
  [key: string]: unknown;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
  [key: string]: unknown;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
  [key: string]: unknown;
}

export interface AnchorSpec {
  onClassA: Vector3;
  onClassB: Vector3;
  _comment?: string;
  [key: string]: unknown;
}

export interface DOFSpec {
  id: string;
  type: string;
  axisLocal: Vector3;
  min: number;
  max: number;
  value: number;
  unit: string;
  [key: string]: unknown;
}

export interface Liaison {
  id: string;
  name: string;
  type: string;
  classA: string;
  classB: string;
  position: Vector3;
  orientation: Quaternion;
  anchors: AnchorSpec;
  dof: DOFSpec[];
  [key: string]: unknown;
}

export interface GroundFixation {
  id: string; type: 'GROUND_FIXATION'; localPoint: Vector3; angle: number; wasFixed: boolean;
  orientationMode?: 'automatic' | 'manual';
}

export interface EquivalenceClass {
  id: string;
  name: string;
  color: string;
  isFixed: boolean;
  groundFixation?: GroundFixation;
  parentId: string | null;
  position?: Vector3;
  rotation?: number;
  [key: string]: unknown;
}

export interface JointDOFTemplate {
  type: string;
  defaultAxisLocal: Vector3;
  defaultMin: number;
  defaultMax: number;
  unit: string;
  [key: string]: unknown;
}

export interface JointDefinitionTemplate {
  isoCode: string;
  dofCount: number;
  dofTemplate: JointDOFTemplate[];
  [key: string]: unknown;
}

export interface Kinematics {
  solverType: string;
  closedLoopMode: boolean;
  drivenDofs: Array<{
    dofId: string;
    controlType: string;
    targetValue: number;
    unit: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface GeometryStyle {
  fill?: string;
  fillOpacity?: number;
  stroke: string;
  width: number;
  color: string;
  [key: string]: unknown;
}

export interface GeometryEntity {
  cornerRadius?: number;
  id: string;
  kind: string;
  classId: string;
  localPoints: Vector3[];
  style: GeometryStyle;
  view: string;
  [key: string]: unknown;
}

export interface DisplaySettings { bodyIds: boolean; jointIds: boolean; anchors: boolean }

export interface Geometry {
  display?: DisplaySettings;
  entities: GeometryEntity[];
  [key: string]: unknown;
}

export interface KineoV3 {
  meta: Meta;
  jointDefinitions: Record<string, JointDefinitionTemplate>;
  classesEquivalence: EquivalenceClass[];
  liaisons: Liaison[];
  kinematics: Kinematics;
  geometry: Geometry;
  [key: string]: unknown;
}
