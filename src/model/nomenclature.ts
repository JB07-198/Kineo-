import type { EquivalenceClass, KineoV3 } from './jsonV3';
import { SHAPE_LABELS } from './graphics';
import type { ShapeKind } from './graphics';
export const JOINT_LABELS: Record<string, string> = { PIVOT: 'Pivot', GLISSIERE: 'Glissière', PIVOT_GLISSANT: 'Pivot glissant', ROTULE: 'Rotule', APPUI_PLAN: 'Appui plan', HELICOIDALE: 'Hélicoïdale', ENCASTREMENT: 'Encastrement', GROUND_FIXATION: 'Encastrement au bâti' };
export function referenceBody(document: KineoV3): EquivalenceClass | undefined {
  return document.classesEquivalence.find((b) => b.id === document.meta.groundBodyId && b.isFixed) ??
    document.classesEquivalence.find((b) => b.isFixed && !b.groundFixation) ?? document.classesEquivalence.find((b) => b.isFixed);
}
/** Derived drawing references, never substitutes for technical model IDs. Deletions renumber current rows. */
export function buildNomenclature(document: KineoV3) {
  const ground = referenceBody(document);
  let index = 1;
  const bodies = document.classesEquivalence.map((body) => ({
    id: body.id, reference: ground?.id === body.id ? 'S0' : `S${index++}`, name: body.name,
    shape: document.geometry.entities.filter((g) => g.classId === body.id).map((g) => SHAPE_LABELS[g.kind as ShapeKind] ?? g.kind).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Aucune',
    position: body.position ?? { x: 0, y: 0, z: 0 }, fixed: ground?.id === body.id ? 'Référence' : body.isFixed ? 'Fixé au sol' : 'Mobile',
  }));
  const bodyReferences = new Map(bodies.map((b) => [b.id, b.reference]));
  const joints = document.liaisons.map((joint, i) => ({ id: joint.id, reference: `L${i + 1}`, name: joint.name,
    type: JOINT_LABELS[joint.type] ?? joint.type, source: bodyReferences.get(joint.classA) ?? '?', target: bodyReferences.get(joint.classB) ?? '?', position: joint.position }));
  return { bodies, joints, bodyReferences, jointReferences: new Map(joints.map((j) => [j.id, j.reference])) };
}
