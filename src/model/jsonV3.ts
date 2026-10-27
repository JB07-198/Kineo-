// src/model/jsonV3.ts
// TypeScript types that exactly mirror the canonical JSON v3.0 specification
// (as defined in documentation_etape1_etape2.txt). These are the *external* model
// used for import/export and validation.

export interface Meta {
  schemaVersion: string; // "3.0"
  appVersion: string;
  title: string;
  author: string;
  lengthUnit: string; // e.g. "mm"
  angleUnit: string; // e.g. "deg"
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface AnchorSpec {
  onClassA: Vector3;
  onClassB: Vector3;
  _comment?: string;
}

export interface DOFSpec {
  id: string;
  type: string; // "rotation" | "translation"
  axisLocal: Vector3;
  min: number;
  max: number;
  value: number;
  unit: string;
}

export interface Liaison {
  id: string;
  name: string;
  type: string; // matches a key in jointDefinitions (e.g. "PIVOT")
  classA: string;
  classB: string;
  position: Vector3;
  orientation: Quaternion;
  anchors: AnchorSpec;
  dof: DOFSpec[];
}

export interface EquivalenceClass {
  id: string;
  name: string;
  color: string;
  isFixed: boolean;
  parentId: string | null;
}

export interface JointDefinition {
  [key: string]: {
    isoCode: string;
    dofCount: number;
    dofTemplate: Array<{
      type: string;
      defaultAxisLocal: Vector3;
      defaultMin: number;
      defaultMax: number;
      unit: string;
    }>;
  };
}

export interface Kinematics {
  solverType: string;
  closedLoopMode: boolean;
  drivenDofs: Array<{
    dofId: string;
    controlType: string;
    targetValue: number;
    unit: string;
  }>;
}

export interface GeometryEntity {
  id: string;
  kind: string; // "segment", "rectangle", …
  classId: string;
  localPoints: Vector3[];
  style: {
    stroke: string;
    width: number;
    color: string;
  };
  view: string;
}

export interface Geometry {
  entities: GeometryEntity[];
}

export interface KineoV3 {
  meta: Meta;
  jointDefinitions: JointDefinition;
  classesEquivalence: EquivalenceClass[];
  liaisons: Liaison[];
  kinematics: Kinematics;
  geometry: Geometry;
}

