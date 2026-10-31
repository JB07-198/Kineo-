import type { GeometryEntity, Vector3 } from './jsonV3';
import type { PlanarPoint } from './planarCoordinates';

export const SHAPE_LABELS = {
  segment: 'Segment', rectangle: 'Rectangle', roundedRectangle: 'Rectangle arrondi',
  circle: 'Cercle', ellipse: 'Ellipse', polygon: 'Polygone', freeform: 'Contour libre',
} as const;
export type ShapeKind = keyof typeof SHAPE_LABELS;
export function isClosedShape(kind: string): boolean { return kind in SHAPE_LABELS && kind !== 'segment'; }
const point = (x: number, y: number): Vector3 => ({ x, y, z: 0 });
export function localBounds(entity: GeometryEntity) {
  const points = entity.localPoints.length ? entity.localPoints : [point(0, 0)];
  const minX = Math.min(...points.map((p) => p.x)), maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y)), maxY = Math.max(...points.map((p) => p.y));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
export function changeShape(entity: GeometryEntity, kind: ShapeKind): GeometryEntity {
  const box = localBounds(entity), width = Math.max(10, box.width), height = Math.max(20, box.height);
  let localPoints: Vector3[];
  if (kind === 'polygon') localPoints = [point(-width / 2, -height / 2), point(width / 3, -height / 2), point(width / 2, height / 3), point(0, height / 2), point(-width / 2, height / 4)];
  else if (kind === 'freeform') localPoints = [point(-width / 2, -height / 2), point(0, -height / 3), point(width / 2, -height / 2), point(width / 3, 0), point(width / 2, height / 2), point(-width / 3, height / 2), point(-width / 2, 0)];
  else if (kind === 'segment') localPoints = [point(-width / 2, 0), point(width / 2, 0)];
  else { const h = kind === 'circle' ? width : height; localPoints = [point(-width / 2, -h / 2), point(width / 2, h / 2)]; }
  return { ...entity, kind, localPoints: localPoints.map((p) => ({ ...p, x: p.x + box.cx, y: p.y + box.cy })), cornerRadius: Math.min(width, height) / 5 };
}
export function resizeGeometry(entity: GeometryEntity, width: number, height: number): GeometryEntity {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height < 0 || (isClosedShape(entity.kind) && height <= 0)) throw new Error('Dimensions graphiques invalides.');
  const box = localBounds(entity);
  const h = entity.kind === 'circle' ? width : height;
  return { ...entity, localPoints: entity.localPoints.map((p, i) => ({ ...p,
    x: box.cx + (box.width ? (p.x - box.cx) / box.width : (i ? .5 : -.5)) * width,
    y: box.cy + (box.height ? (p.y - box.cy) / box.height : entity.kind === 'segment' ? (i ? .5 : -.5) : 0) * h,
  })) };
}
/** One exact SVG path shared by Path2D and SVG. Sampled outlines are only used for bounds/hit tests. */
export function geometryPath(entity: GeometryEntity): { path: string; outline: PlanarPoint[]; closed: boolean } {
  const b = localBounds(entity), { minX: x, minY: y, width: w, height: h, cx, cy } = b;
  const closed = isClosedShape(entity.kind);
  if (entity.kind === 'circle' || entity.kind === 'ellipse') {
    const rx = w / 2, ry = entity.kind === 'circle' ? rx : h / 2;
    return {
      path: `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`, closed,
      outline: Array.from({ length: 96 }, (_, i) => ({ x: cx + rx * Math.cos(i * Math.PI / 48), y: cy + ry * Math.sin(i * Math.PI / 48) })),
    };
  }
  if (entity.kind === 'roundedRectangle') {
    const r = Math.min(w / 2, h / 2, entity.cornerRadius ?? Math.min(w, h) / 5);
    const outline: PlanarPoint[] = [];
    for (const [ox, oy, start] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]]) {
      for (let i = 0; i <= 16; i++) { const a = start + i * Math.PI / 32; outline.push({ x: ox + r * Math.cos(a), y: oy + r * Math.sin(a) }); }
    }
    return { path: `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`, outline, closed };
  }
  const outline = entity.kind === 'rectangle' ? [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }] : entity.localPoints;
  const path = outline.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ') + (closed ? ' Z' : '');
  return { path, outline, closed };
}
export function geometryStyle(entity: GeometryEntity) {
  return { stroke: entity.style.color, width: entity.style.width,
    fill: isClosedShape(entity.kind) ? entity.style.fill ?? entity.style.color : 'none',
    fillOpacity: entity.style.fillOpacity ?? (isClosedShape(entity.kind) ? 0.18 : 1),
    dashed: entity.style.stroke === 'dashed' };
}
