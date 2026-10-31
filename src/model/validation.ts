import { z } from 'zod';
import type { KineoV3 } from './jsonV3';

const Vector3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
}).passthrough();

const QuaternionSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
  w: z.number().finite(),
}).passthrough();

const AnchorSpecSchema = z.object({
  onClassA: Vector3Schema,
  onClassB: Vector3Schema,
  _comment: z.string().optional(),
}).passthrough();

const DOFSpecSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  axisLocal: Vector3Schema,
  min: z.number().finite(),
  max: z.number().finite(),
  value: z.number().finite(),
  unit: z.string(),
}).passthrough().superRefine((dof, context) => {
  if (dof.min > dof.max) {
    context.addIssue({ code: 'custom', message: 'DOF minimum must not exceed its maximum', path: ['min'] });
  }
  if (dof.value < dof.min || dof.value > dof.max) {
    context.addIssue({ code: 'custom', message: 'DOF value must be within its limits', path: ['value'] });
  }
});

const LiaisonSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.string().min(1),
  classA: z.string().min(1),
  classB: z.string().min(1),
  position: Vector3Schema,
  orientation: QuaternionSchema,
  anchors: AnchorSpecSchema,
  dof: z.array(DOFSpecSchema),
}).passthrough();

const EquivalenceClassSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string(),
  isFixed: z.boolean(),
  groundFixation: z.object({
    id: z.string().min(1), type: z.literal('GROUND_FIXATION'), localPoint: Vector3Schema,
    angle: z.number().finite(), wasFixed: z.boolean(), orientationMode: z.enum(['automatic', 'manual']).optional(),
  }).passthrough().optional(),
  parentId: z.string().nullable(),
  position: Vector3Schema.optional(),
  rotation: z.number().finite().optional(),
}).passthrough();

const JointDefinitionTemplateSchema = z.object({
  isoCode: z.string(),
  dofCount: z.number().int().nonnegative(),
  dofTemplate: z.array(z.object({
    type: z.string(),
    defaultAxisLocal: Vector3Schema,
    defaultMin: z.number().finite(),
    defaultMax: z.number().finite(),
    unit: z.string(),
  }).passthrough()),
}).passthrough().superRefine((definition, context) => {
  if (definition.dofCount !== definition.dofTemplate.length) {
    context.addIssue({ code: 'custom', message: 'DOF count must match the template length', path: ['dofCount'] });
  }
});

const JointDefinitionsSchema = z.record(z.string(), JointDefinitionTemplateSchema);

const DrivenDOFSchema = z.object({
  dofId: z.string().min(1),
  controlType: z.string(),
  targetValue: z.number().finite(),
  unit: z.string(),
}).passthrough();

const KinematicsSchema = z.object({
  solverType: z.string(),
  closedLoopMode: z.boolean(),
  drivenDofs: z.array(DrivenDOFSchema),
}).passthrough();

const GeometryEntitySchema = z.object({
  id: z.string().min(1),
  kind: z.string(),
  cornerRadius: z.number().finite().nonnegative().optional(),
  classId: z.string().min(1),
  localPoints: z.array(Vector3Schema),
  style: z.object({
    fill: z.string().optional(),
    fillOpacity: z.number().min(0).max(1).optional(),
    stroke: z.string(),
    width: z.number().finite().nonnegative(),
    color: z.string(),
  }).passthrough(),
  view: z.string(),
}).passthrough().superRefine((entity, context) => {
  const minimumPoints = entity.kind === 'polygon' || entity.kind === 'freeform'
    ? 3
    : ['segment', 'rectangle', 'roundedRectangle', 'circle', 'ellipse'].includes(entity.kind) ? 2 : 0;
  if (entity.localPoints.length < minimumPoints) {
    context.addIssue({
      code: 'custom',
      message: `${entity.kind} geometry requires at least ${minimumPoints} local points`,
      path: ['localPoints'],
    });
  }
});

const GeometrySchema = z.object({
  display: z.object({ bodyIds: z.boolean(), jointIds: z.boolean(), anchors: z.boolean() }).passthrough().optional(),
  entities: z.array(GeometryEntitySchema),
}).passthrough();

export const KineoV3Schema = z.object({
  meta: z.object({
    schemaVersion: z.literal('3.0'),
    appVersion: z.string(),
    title: z.string(),
    author: z.string(),
    lengthUnit: z.string(),
    angleUnit: z.string(),
  }).passthrough(),
  jointDefinitions: JointDefinitionsSchema,
  classesEquivalence: z.array(EquivalenceClassSchema),
  liaisons: z.array(LiaisonSchema),
  kinematics: KinematicsSchema,
  geometry: GeometrySchema,
}).passthrough();

export function validateKineoV3(data: unknown): KineoV3 {
  return KineoV3Schema.parse(data);
}
