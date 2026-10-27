// src/model/validation.ts
// Validation of the canonical JSON v3.0 specification using Zod.

import { z } from 'zod';
import type { KineoV3 } from './jsonV3';

const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const QuaternionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  w: z.number(),
});

const AnchorSpecSchema = z.object({
  _comment: z.string().optional(),
  onClassA: Vector3Schema,
  onClassB: Vector3Schema,
});

const DOFSpecSchema = z.object({
  id: z.string(),
  type: z.string(), // "rotation" | "translation"
  axisLocal: Vector3Schema,
  min: z.number(),
  max: z.number(),
  value: z.number(),
  unit: z.string(),
});

const LiaisonSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(), // must match a key of jointDefinitions
  classA: z.string(),
  classB: z.string(),
  position: Vector3Schema,
  orientation: QuaternionSchema,
  anchors: AnchorSpecSchema,
  dof: z.array(DOFSpecSchema),
});

const EquivalenceClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  isFixed: z.boolean(),
  parentId: z.string().nullable(),
});

const JointDefinitionTemplateSchema = z.object({
  isoCode: z.string(),
  dofCount: z.number(),
  dofTemplate: z.array(
    z.object({
      type: z.string(),
      defaultAxisLocal: Vector3Schema,
      defaultMin: z.number(),
      defaultMax: z.number(),
      unit: z.string(),
    })
  ),
});

const JointDefinitionsSchema = z.record(JointDefinitionTemplateSchema);

const DrivenDOFSchema = z.object({
  dofId: z.string(),
  controlType: z.string(),
  targetValue: z.number(),
  unit: z.string(),
});

const KinematicsSchema = z.object({
  solverType: z.string(),
  closedLoopMode: z.boolean(),
  drivenDofs: z.array(DrivenDOFSchema),
});

const GeometryEntitySchema = z.object({
  id: z.string(),
  kind: z.string(),
  classId: z.string(),
  localPoints: z.array(Vector3Schema),
  style: z.object({
    stroke: z.string(),
    width: z.number(),
    color: z.string(),
  }),
  view: z.string(),
});

const GeometrySchema = z.object({
  entities: z.array(GeometryEntitySchema),
});

export const KineoV3Schema = z.object({
  meta: z.object({
    schemaVersion: z.literal('3.0'),
    appVersion: z.string(),
    title: z.string(),
    author: z.string(),
    lengthUnit: z.string(),
    angleUnit: z.string(),
  }),
  jointDefinitions: JointDefinitionsSchema,
  classesEquivalence: z.array(EquivalenceClassSchema),
  liaisons: z.array(LiaisonSchema),
  kinematics: KinematicsSchema,
  geometry: GeometrySchema,
});

/**
 * Validate an unknown object against the JSON v3.0 schema.
 * @param data The raw data (e.g. parsed JSON).
 * @returns The typed KineoV3 document if validation succeeds.
 * @throws ZodError with detailed validation information otherwise.
 */
export function validateKineoV3(data: unknown): KineoV3 {
  return KineoV3Schema.parse(data);
}

