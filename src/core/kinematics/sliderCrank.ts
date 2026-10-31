import { createDefaultDocument } from '../../model/defaultDocument';
import type { KineoV3 } from '../../model/jsonV3';
import { rotate, toLocal } from './geometry';
import type { Point2 } from './geometry';
export interface SliderCrankParameters {
  radius: number; rodLength: number; angle: number;
  origin?: Point2; axisAngle?: number; branch?: 1 | -1;
}
export function sliderCrankAnalytic(parameters: SliderCrankParameters) {
  const { radius: r, rodLength: l, angle, branch = 1 } = parameters;
  if (![r, l, angle, parameters.axisAngle ?? 0, parameters.origin?.x ?? 0, parameters.origin?.y ?? 0].every(Number.isFinite) || r <= 0 || l <= 0) throw new Error('Dimensions ou angles invalides.');
  const discriminant = l * l - (r * Math.sin(angle)) ** 2;
  if (discriminant < -1e-10 * l * l) throw new Error('Configuration inadmissible : la bielle ne peut atteindre le guide.');
  const root = Math.sqrt(Math.max(0, discriminant));
  const slider = r * Math.cos(angle) + branch * root;
  const rodAngle = Math.atan2(-r * Math.sin(angle), branch * root);
  const singular = root <= 1e-8 * l;
  const derivative = singular ? NaN : -r * Math.sin(angle) - branch * r * r * Math.sin(angle) * Math.cos(angle) / root;
  return { slider, rodAngle, discriminant, singular, deadCenter: !singular && Math.abs(derivative) <= 1e-8 * Math.max(r, l), derivative };
}
/** Parameterized reference document; the numerical solver itself has no mechanism-specific branch. */
export function createSliderCrank(parameters: SliderCrankParameters): KineoV3 {
  const solution = sliderCrankAnalytic(parameters);
  const { radius: r, rodLength: l, angle, origin = { x: 0, y: 0 }, axisAngle = 0 } = parameters;
  const document = createDefaultDocument();
  const global = (p: Point2) => { const v = rotate(p, axisAngle); return { x: v.x + origin.x, y: v.y + origin.y, z: 0 }; };
  const a = global({ x: r * Math.cos(angle), y: r * Math.sin(angle) }), b = global({ x: solution.slider, y: 0 });
  const poses = [
    { ...origin, theta: axisAngle }, { ...origin, theta: axisAngle + angle },
    { ...a, theta: axisAngle + solution.rodAngle }, { ...b, theta: axisAngle },
  ];
  document.classesEquivalence.forEach((body, i) => { body.position = { x: poses[i].x, y: poses[i].y, z: 0 }; body.rotation = poses[i].theta; });
  const positions = [global({ x: 0, y: 0 }), a, b, b];
  document.liaisons.forEach((joint, i) => {
    const indexA = document.classesEquivalence.findIndex((body) => body.id === joint.classA), indexB = document.classesEquivalence.findIndex((body) => body.id === joint.classB);
    const p = positions[i]; joint.position = p;
    joint.anchors = { onClassA: { ...toLocal(p, poses[indexA]), z: 0 }, onClassB: { ...toLocal(p, poses[indexB]), z: 0 } };
    joint.orientation = { x: 0, y: 0, z: Math.sin(axisAngle / 2), w: Math.cos(axisAngle / 2) };
  });
  for (const entity of document.geometry.entities) {
    if (entity.id === 'ent_crank') entity.localPoints[1].x = r;
    if (entity.id === 'ent_rod') entity.localPoints[1].x = l;
    if (entity.classId === 'eq_0') entity.localPoints.forEach((p) => { p.x += solution.slider - (70 * Math.cos(Math.PI / 4) + Math.sqrt(120 ** 2 - (70 * Math.sin(Math.PI / 4)) ** 2)); });
  }
  return document;
}
