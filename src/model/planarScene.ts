import type { GeometryEntity, KineoV3, Vector3 } from './jsonV3';
import { localToWorld2D, quaternionYaw, type PlanarPoint } from './planarCoordinates';
import { getJointGlyph } from './jointSymbols';
import { geometryPath } from './graphics';
import { buildNomenclature } from './nomenclature';

export interface SceneBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SceneGeometry {
  entity: GeometryEntity;
  bodyId: string;
  bodyPosition: PlanarPoint;
  bodyRotation: number;
  points: PlanarPoint[];
}

export interface SceneLabel {
  id: string;
  text: string;
  kind: 'body' | 'joint' | 'warning';
  bounds: SceneBounds;
  anchor: PlanarPoint;
}

export interface SceneJoint {
  id: string;
  type: string;
  name: string;
  center: PlanarPoint;
  anchorA: PlanarPoint;
  anchorB: PlanarPoint;
  mismatch: number;
  angle: number;
}

export interface PlanarScene {
  geometry: SceneGeometry[];
  joints: SceneJoint[];
  labels: SceneLabel[];
  groundMarkers: Array<{ id: string; bodyId: string; center: PlanarPoint; angle: number; fixation: boolean }>;
  displayAnchors: boolean;
  bounds: SceneBounds;
  empty: boolean;
}

type Rect = SceneBounds;

const LABEL_HEIGHT = 16;
const LABEL_PADDING = 5;
const LABEL_GAP = 14;
const DEFAULT_SYMBOL_RADIUS = 12;

function boundsOfPoints(points: PlanarPoint[], padding = 0): Rect {
  return {
    minX: Math.min(...points.map(({ x }) => x)) - padding,
    minY: Math.min(...points.map(({ y }) => y)) - padding,
    maxX: Math.max(...points.map(({ x }) => x)) + padding,
    maxY: Math.max(...points.map(({ y }) => y)) + padding,
  };
}

function glyphBounds(type: string, center: PlanarPoint, angle: number): Rect {
  const points: PlanarPoint[] = [];
  for (const shape of getJointGlyph(type)) {
    if (shape.kind === 'circle') {
      for (let step = 0; step < 16; step += 1) {
        const circleAngle = 2 * Math.PI * step / 16;
        points.push({
          x: shape.radius * Math.cos(circleAngle),
          y: shape.radius * Math.sin(circleAngle),
        });
      }
    } else {
      points.push(...shape.points);
    }
  }
  const rotated = points.map(({ x, y }) => ({
    x: center.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: center.y + x * Math.sin(angle) + y * Math.cos(angle),
  }));
  return rotated.length ? boundsOfPoints(rotated) : {
    minX: center.x - DEFAULT_SYMBOL_RADIUS,
    maxX: center.x + DEFAULT_SYMBOL_RADIUS,
    minY: center.y - DEFAULT_SYMBOL_RADIUS,
    maxY: center.y + DEFAULT_SYMBOL_RADIUS,
  };
}

function unionBounds(bounds: Rect[]): Rect {
  if (!bounds.length) return { minX: -50, minY: -35, maxX: 50, maxY: 35 };
  return {
    minX: Math.min(...bounds.map(({ minX }) => minX)),
    minY: Math.min(...bounds.map(({ minY }) => minY)),
    maxX: Math.max(...bounds.map(({ maxX }) => maxX)),
    maxY: Math.max(...bounds.map(({ maxY }) => maxY)),
  };
}

function intersects(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function estimateLabelWidth(text: string): number {
  return Math.max(20, [...text].reduce((width, character) => width + (/[MW@]/.test(character) ? 8 : /[il.,' ]/.test(character) ? 3.5 : 6), 0)) +
    2 * LABEL_PADDING;
}

function labelCandidates(anchor: PlanarPoint, obstacle: Rect, width: number): Rect[] {
  const centerX = (obstacle.minX + obstacle.maxX) / 2;
  const centerY = (obstacle.minY + obstacle.maxY) / 2;
  const gap = LABEL_GAP;
  const candidates = [
    { minX: centerX - width / 2, maxX: centerX + width / 2, minY: obstacle.maxY + gap, maxY: obstacle.maxY + gap + LABEL_HEIGHT },
    { minX: centerX - width / 2, maxX: centerX + width / 2, minY: obstacle.minY - gap - LABEL_HEIGHT, maxY: obstacle.minY - gap },
    { minX: obstacle.maxX + gap, maxX: obstacle.maxX + gap + width, minY: centerY - LABEL_HEIGHT / 2, maxY: centerY + LABEL_HEIGHT / 2 },
    { minX: obstacle.minX - gap - width, maxX: obstacle.minX - gap, minY: centerY - LABEL_HEIGHT / 2, maxY: centerY + LABEL_HEIGHT / 2 },
    { minX: obstacle.maxX + gap, maxX: obstacle.maxX + gap + width, minY: obstacle.maxY + gap, maxY: obstacle.maxY + gap + LABEL_HEIGHT },
    { minX: obstacle.minX - gap - width, maxX: obstacle.minX - gap, minY: obstacle.maxY + gap, maxY: obstacle.maxY + gap + LABEL_HEIGHT },
    { minX: obstacle.maxX + gap, maxX: obstacle.maxX + gap + width, minY: obstacle.minY - gap - LABEL_HEIGHT, maxY: obstacle.minY - gap },
    { minX: obstacle.minX - gap - width, maxX: obstacle.minX - gap, minY: obstacle.minY - gap - LABEL_HEIGHT, maxY: obstacle.minY - gap },
  ];
  const radius = Math.hypot(obstacle.maxX - obstacle.minX, obstacle.maxY - obstacle.minY) / 2 + width / 2 + gap;
  for (let ring = 0; ring < 40; ring += 1) {
    const distance = radius + ring * (LABEL_HEIGHT + gap);
    for (let step = 0; step < 16; step += 1) {
      const angle = 2 * Math.PI * step / 16;
      const centerX = anchor.x + distance * Math.cos(angle);
      const centerY = anchor.y + distance * Math.sin(angle);
      candidates.push({
        minX: centerX - width / 2,
        maxX: centerX + width / 2,
        minY: centerY - LABEL_HEIGHT / 2,
        maxY: centerY + LABEL_HEIGHT / 2,
      });
    }
  }
  return candidates.sort((a, b) => {
    const distance = (rect: Rect) => Math.hypot((rect.minX + rect.maxX) / 2 - anchor.x, (rect.minY + rect.maxY) / 2 - anchor.y);
    return distance(a) - distance(b);
  });
}

function placeLabel(
  id: string,
  text: string,
  kind: SceneLabel['kind'],
  anchor: PlanarPoint,
  obstacle: Rect,
  reserved: Rect[],
): SceneLabel {
  const width = estimateLabelWidth(text);
  const candidates = labelCandidates(anchor, obstacle, width);
  const bounds = candidates.find((candidate) =>
    !reserved.some((other) => intersects(candidate, other))) ?? candidates[0];
  reserved.push(bounds);
  return { id, text, kind, bounds, anchor };
}

function entityPoints(entity: GeometryEntity, position: Vector3, rotation: number): PlanarPoint[] {
  return geometryPath(entity).outline.map((point) =>
    localToWorld2D({ ...point, z: 0 }, position, rotation));
}

export function buildPlanarScene(document: KineoV3): PlanarScene {
  const bodies = new Map(document.classesEquivalence.map((body) => [body.id, body]));
  const geometry: SceneGeometry[] = document.geometry.entities.map((entity) => {
    const body = bodies.get(entity.classId);
    if (!body) throw new Error(`Cannot render geometry ${entity.id}: unknown body ${entity.classId}`);
    const position = body.position ?? { x: 0, y: 0, z: 0 };
    const rotation = body.rotation ?? 0;
    return {
      entity,
      bodyId: body.id,
      bodyPosition: { x: position.x, y: position.y },
      bodyRotation: rotation,
      points: entityPoints(entity, position, rotation),
    };
  });
  const joints: SceneJoint[] = document.liaisons.map((joint) => {
    const bodyA = bodies.get(joint.classA);
    const bodyB = bodies.get(joint.classB);
    if (!bodyA || !bodyB) throw new Error(`Cannot render liaison ${joint.id}: unknown rigid-body endpoint`);
    const anchorA = localToWorld2D(joint.anchors.onClassA, bodyA.position ?? { x: 0, y: 0, z: 0 }, bodyA.rotation ?? 0);
    const anchorB = localToWorld2D(joint.anchors.onClassB, bodyB.position ?? { x: 0, y: 0, z: 0 }, bodyB.rotation ?? 0);
    const sliding = joint.type === 'GLISSIERE' || joint.type === 'PIVOT_GLISSANT';
    const axis = joint.dof.find((dof) => dof.type === 'translation')?.axisLocal;
    const axisAngle = axis ? Math.atan2(axis.y, axis.x) + (bodyA.rotation ?? 0) : quaternionYaw(joint.orientation);
    const dx = anchorB.x - anchorA.x, dy = anchorB.y - anchorA.y;
    const mismatch = joint.type === 'APPUI_PLAN' ? 0 : sliding
      ? Math.abs(-Math.sin(axisAngle) * dx + Math.cos(axisAngle) * dy)
      : Math.hypot(dx, dy);
    return {
      id: joint.id,
      type: joint.type,
      name: joint.name || joint.type,
      center: { x: joint.position.x, y: joint.position.y },
      anchorA,
      anchorB,
      mismatch,
      angle: quaternionYaw(joint.orientation),
    };
  });

  const geometryBounds = geometry
    .filter(({ points }) => points.length)
    .map(({ points }) => boundsOfPoints(points, 2));
  const symbolBounds = joints.map(({ center, type, angle }) => glyphBounds(type, center, angle));
  const nomenclature = buildNomenclature(document);
  const display = { bodyIds: true, jointIds: true, anchors: false, ...document.geometry.display };
  const reservedLabels: Rect[] = [...geometryBounds, ...symbolBounds];
  const labels: SceneLabel[] = [];

  for (const body of document.classesEquivalence) {
    if (!display.bodyIds) continue;
    const items = geometry.filter((item) => item.bodyId === body.id);
    const bodyPoints = items.flatMap(({ points }) => points);
    const position = body.position ?? { x: 0, y: 0, z: 0 };
    const anchor = bodyPoints.length
      ? {
          x: bodyPoints.reduce((sum, point) => sum + point.x, 0) / bodyPoints.length,
          y: bodyPoints.reduce((sum, point) => sum + point.y, 0) / bodyPoints.length,
        }
      : { x: position.x, y: position.y };
    const obstacle = bodyPoints.length
      ? boundsOfPoints(bodyPoints, 3)
      : { minX: anchor.x - 12, maxX: anchor.x + 12, minY: anchor.y - 12, maxY: anchor.y + 12 };
    const reference = nomenclature.bodies.find((item) => item.id === body.id)?.reference;
    if (reference) labels.push(placeLabel(`body:${body.id}`, reference, 'body', anchor, obstacle, reservedLabels));
  }

  for (const joint of joints) {
    const obstacle = glyphBounds(joint.type, joint.center, joint.angle);
    const reference = nomenclature.joints.find((item) => item.id === joint.id)?.reference;
    if (display.jointIds && reference) {
      labels.push(placeLabel(`joint:${joint.id}`, reference, 'joint', joint.center, obstacle, reservedLabels));
    }
    if (joint.mismatch > 1e-6) {
      const midpoint = { x: (joint.anchorA.x + joint.anchorB.x) / 2, y: (joint.anchorA.y + joint.anchorB.y) / 2 };
      const warning = `Ancrages séparés: ${joint.mismatch.toFixed(1)} ${document.meta.lengthUnit}`;
      const warningObstacle = { minX: midpoint.x - 8, maxX: midpoint.x + 8, minY: midpoint.y - 8, maxY: midpoint.y + 8 };
      labels.push(placeLabel(`warning:${joint.id}`, warning, 'warning', midpoint, warningObstacle, reservedLabels));
    }
  }

  const groundMarkers = document.classesEquivalence
    .filter((body) => body.isFixed)
    .map((body) => {
      const position = body.position ?? { x: 0, y: 0, z: 0 };
      if (body.groundFixation) {
        return {
          id: body.groundFixation.id,
          bodyId: body.id,
          center: localToWorld2D(body.groundFixation.localPoint, position, body.rotation ?? 0),
          angle: body.groundFixation.angle + (body.rotation ?? 0),
          fixation: true,
        };
      }
      return {
        id: body.id,
        bodyId: body.id,
        center: localToWorld2D({ x: 0, y: -20, z: 0 }, position, body.rotation ?? 0),
        angle: body.rotation ?? 0,
        fixation: false,
      };
    });

  const bounds = unionBounds([
    ...geometryBounds,
    ...symbolBounds,
    ...joints.flatMap(({ anchorA, anchorB }) => [
      { minX: anchorA.x - 4, maxX: anchorA.x + 4, minY: anchorA.y - 4, maxY: anchorA.y + 4 },
      { minX: anchorB.x - 4, maxX: anchorB.x + 4, minY: anchorB.y - 4, maxY: anchorB.y + 4 },
    ]),
    ...groundMarkers.map(({ center }) => ({ minX: center.x - 22, maxX: center.x + 22, minY: center.y - 18, maxY: center.y + 12 })),
    ...labels.map(({ bounds: box }) => box),
  ]);
  return { geometry, joints, labels, groundMarkers, displayAnchors: display.anchors, bounds, empty: !geometry.length && !joints.length && !document.classesEquivalence.length };
}
