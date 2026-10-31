import type { KineoV3 } from '../../model/jsonV3';
import type { Point2 } from './geometry';
import { toWorld } from './geometry';
import { analyzeMechanism, driverValue, jointAxis, posesFor } from './model';
import { solveMechanism } from './solver';
import type { Driver, MechanicalModel, SolveResult } from './types';

export interface SimulationSession {
  model: MechanicalModel; driver: Omit<Driver, 'target'>;
  initialValue: number; speed: number; time: number; q: number[];
  result: SolveResult;
}
export function createSimulation(model: MechanicalModel, driver: Omit<Driver, 'target'>, speed: number): SimulationSession {
  if (!Number.isFinite(speed)) throw new Error('Vitesse non finie.');
  if (model.errors.length) throw new Error(model.errors.join('\n'));
  const assembled = solveMechanism(model);
  if (!assembled.converged) throw new Error(`Assemblage initial impossible : ${assembled.status}`);
  const analysis = analyzeMechanism(model, assembled.q);
  if (analysis.mobility !== 1 || analysis.singular) throw new Error(`Simulation : mobilité locale ${analysis.mobility}, exactement une entrée indépendante est nécessaire.`);
  const initialValue = driverValue(model, assembled.q, driver);
  const result = solveMechanism(model, assembled.q, { ...driver, target: initialValue });
  if (!result.converged || result.analysis.mobility !== 0) throw new Error('Cette entrée ne détermine pas le mouvement (pilotage singulier).');
  return { model, driver, speed, initialValue, time: 0, q: result.q, result };
}
/** Continuation with bounded input increments. Failure returns the last valid pose and time. */
export function advanceSimulation(session: SimulationSession, targetTime: number): SimulationSession {
  if (!Number.isFinite(targetTime) || targetTime < 0 || targetTime > 3600) throw new Error('Temps hors limites [0, 3600 s].');
  const maxIncrement = session.driver.kind === 'angle' ? 0.04 : session.model.scale * 0.02;
  const steps = Math.max(1, Math.ceil(Math.abs(targetTime - session.time) * Math.abs(session.speed) / maxIncrement));
  if (steps > 5000) throw new Error('Saut temporel trop grand ; réduisez le temps ou la vitesse.');
  let current = session;
  for (let i = 1; i <= steps; i++) {
    const time = session.time + (targetTime - session.time) * i / steps;
    const result = solveMechanism(session.model, current.q, { ...session.driver, target: session.initialValue + session.speed * time });
    if (!result.converged || result.analysis.mobility !== 0 || result.status === 'singular') return { ...current, result };
    current = { ...current, time, q: result.q, result };
  }
  return current;
}
export function pointOnBody(model: MechanicalModel, q: number[], bodyId: string, local: Point2): Point2 {
  const pose = posesFor(model, q)[bodyId];
  if (!pose) throw new Error('Solide du point suivi introuvable.');
  return toWorld(local, pose);
}
/** Preview only: cloned document, no mutation, no history entries, no autosave of animation frames. */
export function documentAtConfiguration(model: MechanicalModel, q: number[]): KineoV3 {
  const document = structuredClone(model.document), poses = posesFor(model, q);
  for (const body of document.classesEquivalence) {
    const pose = poses[body.id];
    body.position = { ...body.position, x: pose.x, y: pose.y, z: 0 }; body.rotation = pose.theta;
  }
  for (const joint of document.liaisons) {
    const a = poses[joint.classA];
    const p = toWorld(joint.anchors.onClassA, a);
    joint.position = { ...joint.position, ...p, z: 0 };
    if (['GLISSIERE', 'PIVOT_GLISSANT'].includes(joint.type)) {
      const axis = jointAxis(joint, a), angle = Math.atan2(axis.y, axis.x);
      joint.orientation = { x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) };
    }
    // DOF metadata is preserved; q is the geometric solution, not an arbitrary DOF value rewrite.
  }
  return document;
}
