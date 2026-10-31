import type { KineoV3, Liaison } from '../../model/jsonV3';
import { validateKineoV3 } from '../../model/validation';
import { validateReferences } from '../../model/conversion';
import { angleDifference, rotate, toWorld } from './geometry';
import type { Pose2 } from './geometry';
import { matrixRank, maxAbs, svd } from './linearAlgebra';
import type { Analysis, Driver, MechanicalModel } from './types';

export function posesFor(model: MechanicalModel, q: number[]): Record<string, Pose2> {
  return Object.fromEntries(model.document.classesEquivalence.map((body) => {
    const i = model.mobileIds.indexOf(body.id) * 3;
    return [body.id, i >= 0 ? { x: q[i], y: q[i + 1], theta: q[i + 2] } : {
      x: body.position?.x ?? 0, y: body.position?.y ?? 0, theta: body.rotation ?? 0,
    }];
  }));
}
function referenceAngle(model: MechanicalModel, joint: Liaison): number {
  const bodies = model.document.classesEquivalence;
  return typeof joint.referenceAngle === 'number' ? joint.referenceAngle :
    (bodies.find((b) => b.id === joint.classB)?.rotation ?? 0) - (bodies.find((b) => b.id === joint.classA)?.rotation ?? 0);
}
export function jointAxis(joint: Liaison, poseA: Pose2) {
  const axis = joint.dof.find((dof) => dof.type === 'translation')?.axisLocal ?? { x: 1, y: 0 };
  const length = Math.hypot(axis.x, axis.y);
  return rotate({ x: axis.x / length, y: axis.y / length }, poseA.theta);
}
export function driverValue(model: MechanicalModel, q: number[], driver: Pick<Driver, 'jointId' | 'kind'>): number {
  const joint = model.document.liaisons.find((item) => item.id === driver.jointId);
  if (!joint) throw new Error('Liaison motrice introuvable');
  const poses = posesFor(model, q), a = poses[joint.classA], b = poses[joint.classB];
  if (driver.kind === 'angle') return b.theta - a.theta;
  const pa = toWorld(joint.anchors.onClassA, a), pb = toWorld(joint.anchors.onClassB, b), axis = jointAxis(joint, a);
  return (pb.x - pa.x) * axis.x + (pb.y - pa.y) * axis.y;
}
/** Dimensionless residuals: lengths / characteristic length; angular rows in radians. */
export function constraintRows(model: MechanicalModel, q: number[], driver?: Driver): { value: number; angular: boolean }[] {
  const poses = posesFor(model, q), rows: { value: number; angular: boolean }[] = [];
  const length = (value: number) => rows.push({ value: value / model.scale, angular: false });
  const angle = (value: number) => rows.push({ value, angular: true });
  for (const joint of model.document.liaisons) {
    const a = poses[joint.classA], b = poses[joint.classB];
    const pa = toWorld(joint.anchors.onClassA, a), pb = toWorld(joint.anchors.onClassB, b);
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    switch (joint.type) {
      case 'PIVOT': case 'ROTULE': length(dx); length(dy); break;
      case 'ENCASTREMENT': length(dx); length(dy); angle(angleDifference(b.theta - a.theta, referenceAngle(model, joint))); break;
      case 'GLISSIERE': case 'PIVOT_GLISSANT': {
        const axis = jointAxis(joint, a);
        length(-axis.y * dx + axis.x * dy);
        angle(angleDifference(b.theta - a.theta, referenceAngle(model, joint)));
        break;
      }
      case 'APPUI_PLAN': break;
    }
  }
  if (driver) {
    const value = driverValue(model, q, driver);
    if (driver.kind === 'angle') angle(angleDifference(value, driver.target));
    else length(value - driver.target);
  }
  return rows;
}
export const residuals = (model: MechanicalModel, q: number[], driver?: Driver): number[] => constraintRows(model, q, driver).map((row) => row.value);
export function jacobian(model: MechanicalModel, q: number[], driver?: Driver): number[][] {
  const baseRows = constraintRows(model, q, driver);
  const rows = baseRows.map(() => Array<number>(q.length).fill(0));
  for (let j = 0; j < q.length; j++) {
    const scale = j % 3 === 2 ? 1 : model.scale;
    const h = 1e-6 * scale;
    const plus = [...q], minus = [...q]; plus[j] += h; minus[j] -= h;
    const a = residuals(model, plus, driver), b = residuals(model, minus, driver);
    for (let i = 0; i < rows.length; i++) {
      // Angular wrap differences require a circular subtraction near ±pi.
      const delta = baseRows[i].angular ? angleDifference(a[i], b[i]) : a[i] - b[i];
      rows[i][j] = delta / (2 * h) * scale;
    }
  }
  return rows;
}
export function compileMechanism(input: unknown): MechanicalModel {
  const empty: KineoV3 = { meta: { schemaVersion: '3.0', appVersion: '', title: '', author: '', lengthUnit: 'mm', angleUnit: 'deg' }, jointDefinitions: {}, classesEquivalence: [], liaisons: [], kinematics: { solverType: '', closedLoopMode: false, drivenDofs: [] }, geometry: { entities: [] } };
  const model: MechanicalModel = { document: empty, mobileIds: [], initialQ: [], scale: 1, warnings: [], errors: [], referenceRank: 0 };
  try {
    model.document = structuredClone(validateKineoV3(input)); validateReferences(model.document);
    const doc = model.document;
    if (!doc.classesEquivalence.length) model.errors.push('Le mécanisme est vide. Ajoutez un bâti et des solides.');
    if (!doc.classesEquivalence.some((body) => body.isFixed)) model.errors.push('Aucun bâti fixe : définissez un solide de référence.');
    for (const body of doc.classesEquivalence) {
      if (Math.abs(body.position?.z ?? 0) > 1e-9) model.errors.push(`${body.name} : position hors du plan XY.`);
      if (body.parentId !== null) model.errors.push(`${body.name} : hiérarchie de repères non prise en charge par le solveur plan.`);
      if (!body.isFixed) { model.mobileIds.push(body.id); model.initialQ.push(body.position?.x ?? 0, body.position?.y ?? 0, body.rotation ?? 0); }
    }
    const lengths = doc.liaisons.flatMap((joint) => [Math.hypot(joint.anchors.onClassA.x, joint.anchors.onClassA.y), Math.hypot(joint.anchors.onClassB.x, joint.anchors.onClassB.y)]);
    model.scale = Math.max(1e-6, ...lengths.filter((l) => l > 0), 1);
    for (const joint of doc.liaisons) {
      if (!['PIVOT', 'GLISSIERE', 'ENCASTREMENT', 'ROTULE', 'PIVOT_GLISSANT', 'APPUI_PLAN'].includes(joint.type)) model.errors.push(`${joint.name} : ${joint.type} non résolue en 2D (hélicoïdale : pas et axes spatiaux absents).`);
      if (Math.abs(joint.anchors.onClassA.z) > 1e-9 || Math.abs(joint.anchors.onClassB.z) > 1e-9 || Math.abs(joint.orientation.x) > 1e-9 || Math.abs(joint.orientation.y) > 1e-9) model.errors.push(`${joint.name} : ancrage ou orientation hors du plan XY.`);
      if (Math.abs(Math.hypot(joint.orientation.x, joint.orientation.y, joint.orientation.z, joint.orientation.w) - 1) > 1e-6) model.errors.push(`${joint.name} : quaternion non unitaire ou nul.`);
      if (joint.referenceAngle !== undefined && (typeof joint.referenceAngle !== 'number' || !Number.isFinite(joint.referenceAngle))) model.errors.push(`${joint.name} : angle de référence invalide.`);
      if (['GLISSIERE', 'PIVOT_GLISSANT'].includes(joint.type)) {
        const axis = joint.dof.find((dof) => dof.type === 'translation')?.axisLocal;
        if (!axis || Math.hypot(axis.x, axis.y) < 1e-10 || Math.abs(axis.z) > 1e-9) model.errors.push(`${joint.name} : axe de translation plan absent ou invalide.`);
      }
      if (joint.type === 'PIVOT' && joint.dof.some((dof) => dof.type === 'rotation' && (Math.hypot(dof.axisLocal.x, dof.axisLocal.y) > 1e-9 || Math.abs(dof.axisLocal.z) < 1e-9))) model.errors.push(`${joint.name} : le pivot plan exige un axe normal Z.`);
      if (joint.type === 'ROTULE') model.warnings.push(`${joint.name} : rotule réduite au plan (2 contraintes de coïncidence, rotation Z libre).`);
      if (joint.type === 'PIVOT_GLISSANT') model.warnings.push(`${joint.name} : pivot glissant d'axe dans XY réduit à une glissière ; rotation hors plan supprimée.`);
      if (joint.type === 'APPUI_PLAN') model.warnings.push(`${joint.name} : appui de normale Z, aucun blocage supplémentaire dans XY.`);
    }
    if (!model.errors.length) {
      model.referenceRank = matrixRank(jacobian(model, model.initialQ), model.initialQ.length);
      for (let k = 1; k <= 3; k++) {
        const perturbed = model.initialQ.map((v, i) => v + Math.sin((i + 1) * k * 1.7) * 0.08 * (i % 3 === 2 ? 1 : model.scale));
        model.referenceRank = Math.max(model.referenceRank, matrixRank(jacobian(model, perturbed), model.initialQ.length));
      }
    }
  } catch (error) { model.errors.push(error instanceof Error ? error.message : String(error)); }
  return model;
}
export function analyzeMechanism(model: MechanicalModel, q = model.initialQ, driver?: Driver, rankTolerance = 1e-8): Analysis {
  if (model.errors.length) return { mobileBodies: model.mobileIds.length, coordinates: q.length, constraints: 0, rank: 0, mobility: q.length, redundant: 0, singular: false, residual: Infinity, lengthResidual: Infinity, angularResidual: Infinity, singularValues: [], warnings: [...model.errors] };
  const rows = constraintRows(model, q, driver), j = jacobian(model, q, driver);
  const singularValues = svd(j, q.length).singularValues.sort((a, b) => b - a);
  const rank = matrixRank(j, q.length, rankTolerance);
  return {
    mobileBodies: model.mobileIds.length, coordinates: q.length, constraints: rows.length,
    rank, mobility: q.length - rank, redundant: rows.length - rank,
    singular: rank < model.referenceRank,
    residual: maxAbs(rows.map((r) => r.value)),
    lengthResidual: maxAbs(rows.filter((r) => !r.angular).map((r) => r.value * model.scale)),
    angularResidual: maxAbs(rows.filter((r) => r.angular).map((r) => r.value)), singularValues,
    warnings: [...model.warnings, ...(rank < model.referenceRank ? ['Perte de rang par rapport aux configurations perturbées : singularité locale suspectée.'] : []), ...(rows.length > rank ? ['Contraintes numériquement dépendantes ; ceci ne prouve pas un hyperstatisme physique.'] : [])],
  };
}
