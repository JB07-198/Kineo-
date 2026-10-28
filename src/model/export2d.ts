import type { GeometryEntity, KineoV3, Vector3 } from './jsonV3';
import { localToWorld2D, quaternionYaw } from './planarCoordinates';

interface Point2D {
  x: number;
  y: number;
}

interface ExportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SvgExport {
  markup: string;
  bounds: ExportBounds;
  width: number;
  height: number;
}

const EXPORT_PADDING = 28;
const MAX_PNG_DIMENSION = 8192;
const MAX_PNG_PIXELS = 32_000_000;

function worldPoints(entity: GeometryEntity, position: Vector3, rotation: number): Point2D[] {
  if (entity.kind === 'rectangle' && entity.localPoints.length >= 2) {
    const [first, second] = entity.localPoints;
    const minX = Math.min(first.x, second.x);
    const maxX = Math.max(first.x, second.x);
    const minY = Math.min(first.y, second.y);
    const maxY = Math.max(first.y, second.y);
    return [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ].map((point) => localToWorld2D({ ...point, z: 0 }, position, rotation));
  }
  return entity.localPoints.map((point) => localToWorld2D(point, position, rotation));
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character);
}

function boundsFor(points: Point2D[]): ExportBounds {
  if (!points.length) return { minX: -22, minY: -22, maxX: 22, maxY: 22 };
  return {
    minX: Math.min(...points.map(({ x }) => x)),
    minY: Math.min(...points.map(({ y }) => y)),
    maxX: Math.max(...points.map(({ x }) => x)),
    maxY: Math.max(...points.map(({ y }) => y)),
  };
}

function symbolMarkup(type: string, x: number, y: number, angle: number): string {
  const center = `transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${(-angle * 180 / Math.PI).toFixed(3)})"`;
  switch (type) {
    case 'PIVOT':
      return `<g ${center}><circle r="7" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.8"/><circle r="2" fill="#cbd5e1"/></g>`;
    case 'GLISSIERE':
      return `<g ${center} fill="none" stroke="#cbd5e1" stroke-width="1.8"><path d="M-12 -6H12 M-12 6H12"/><rect x="-5" y="-4" width="10" height="8" fill="#0f172a"/></g>`;
    case 'PIVOT_GLISSANT':
      return `<g ${center} fill="none" stroke="#cbd5e1" stroke-width="1.8"><path d="M-13 -7H13 M-13 7H13"/><circle r="4" fill="#0f172a"/></g>`;
    case 'ROTULE':
      return `<g ${center} fill="none" stroke="#cbd5e1" stroke-width="1.8"><circle r="8"/><circle r="3" fill="#0f172a"/></g>`;
    case 'APPUI_PLAN':
      return `<g ${center} fill="none" stroke="#cbd5e1" stroke-width="1.8"><path d="M-12 -2H12 M-7 8 0 0 7 8Z"/></g>`;
    case 'HELICOIDALE':
      return `<g ${center} fill="none" stroke="#cbd5e1" stroke-width="1.8"><circle r="7"/><path d="m-9 9 18-18"/></g>`;
    default:
      return `<g ${center} fill="none" stroke="#cbd5e1" stroke-width="1.8"><path d="M-9 -8H9 M-9 -4H9 M0 -4V10"/></g>`;
  }
}

export function createSvgExport(document: KineoV3): SvgExport {
  const classes = new Map(document.classesEquivalence.map((body) => [body.id, body]));
  const geometryByClass = new Map<string, Array<{ entity: GeometryEntity; points: Point2D[] }>>();
  const allPoints: Point2D[] = [];

  for (const entity of document.geometry.entities) {
    const body = classes.get(entity.classId);
    if (!body) throw new Error(`Cannot export geometry ${entity.id}: unknown body ${entity.classId}`);
    const points = worldPoints(entity, body.position ?? { x: 0, y: 0, z: 0 }, body.rotation ?? 0);
    allPoints.push(...points);
    geometryByClass.set(entity.classId, [...(geometryByClass.get(entity.classId) ?? []), { entity, points }]);
  }
  for (const joint of document.liaisons) {
    allPoints.push(
      { x: joint.position.x - 14, y: joint.position.y - 14 },
      { x: joint.position.x + 14, y: joint.position.y + 14 },
      { x: joint.position.x + 10 + (joint.name || joint.type).length * 5.5, y: joint.position.y + 24 },
    );
  }
  for (const body of document.classesEquivalence) {
    const position = body.position ?? { x: 0, y: 0, z: 0 };
    const bodyGeometry = geometryByClass.get(body.id) ?? [];
    const labelPoints = bodyGeometry.flatMap(({ points }) => points);
    const labelCenter = labelPoints.length
      ? {
          x: labelPoints.reduce((sum, point) => sum + point.x, 0) / labelPoints.length,
          y: labelPoints.reduce((sum, point) => sum + point.y, 0) / labelPoints.length,
        }
      : { x: position.x, y: position.y };
    allPoints.push(
      { x: labelCenter.x - 4, y: labelCenter.y - 12 },
      { x: labelCenter.x + 14 + (body.name.length + (body.isFixed ? 8 : 0)) * 6, y: labelCenter.y + 12 },
    );
    if (body.isFixed) {
      allPoints.push(
        localToWorld2D({ x: -16, y: -20, z: 0 }, position, body.rotation ?? 0),
        localToWorld2D({ x: 16, y: -20, z: 0 }, position, body.rotation ?? 0),
        localToWorld2D({ x: -16, y: -30, z: 0 }, position, body.rotation ?? 0),
        localToWorld2D({ x: 16, y: -30, z: 0 }, position, body.rotation ?? 0),
      );
    }
  }

  const bounds = boundsFor(allPoints);
  const width = Math.max(100, bounds.maxX - bounds.minX + 2 * EXPORT_PADDING);
  const height = Math.max(100, bounds.maxY - bounds.minY + 2 * EXPORT_PADDING);
  const toSvg = (point: Point2D): Point2D => ({
    x: point.x - bounds.minX + EXPORT_PADDING,
    y: bounds.maxY - point.y + EXPORT_PADDING,
  });
  const elements: string[] = [`<rect width="${width}" height="${height}" fill="#020617"/>`];

  for (const body of document.classesEquivalence) {
    const items = geometryByClass.get(body.id) ?? [];
    elements.push(`<g data-body-id="${escapeXml(body.id)}">`);
    for (const { entity, points: world } of items) {
      if (!world.length) continue;
      const points = world.map(toSvg);
      const pointList = points.map(({ x, y }) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
      const color = escapeXml(entity.style.color || body.color);
      const strokeWidth = Number.isFinite(entity.style.width) ? entity.style.width : 1;
      const dash = entity.style.stroke === 'dashed' ? ' stroke-dasharray="7 5"' : '';
      if (entity.kind === 'rectangle' && points.length >= 4) {
        elements.push(`<polygon data-geometry-id="${escapeXml(entity.id)}" points="${pointList}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="${strokeWidth}"${dash}/>`);
      } else {
        elements.push(`<polyline data-geometry-id="${escapeXml(entity.id)}" points="${pointList}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`);
      }
    }

    const labelPoints = items.flatMap(({ points }) => points);
    const position = body.position ?? { x: 0, y: 0, z: 0 };
    const center = labelPoints.length
      ? {
          x: labelPoints.reduce((sum, point) => sum + point.x, 0) / labelPoints.length,
          y: labelPoints.reduce((sum, point) => sum + point.y, 0) / labelPoints.length,
        }
      : { x: position.x, y: position.y };
    const label = toSvg({ x: center.x, y: center.y });
    elements.push(`<text x="${(label.x + 7).toFixed(3)}" y="${(label.y - 9).toFixed(3)}" fill="#cbd5e1" font-family="system-ui,sans-serif" font-size="11">${escapeXml(body.name)}${body.isFixed ? ' · FIXE' : ''}</text>`);

    if (body.isFixed) {
      const ground = toSvg(localToWorld2D({ x: 0, y: -20, z: 0 }, position, body.rotation ?? 0));
      elements.push(`<g data-ground-body="${escapeXml(body.id)}" transform="translate(${ground.x.toFixed(3)} ${ground.y.toFixed(3)}) rotate(${(-(body.rotation ?? 0) * 180 / Math.PI).toFixed(3)})" fill="none" stroke="#34d399" stroke-width="1.8"><path d="M-14 0H14 M-10 4l-4 6 m10-6-4 6 m10-6-4 6"/></g>`);
    }
    elements.push('</g>');
  }

  for (const joint of document.liaisons) {
    const point = toSvg({ x: joint.position.x, y: joint.position.y });
    elements.push(`<g data-joint-id="${escapeXml(joint.id)}" data-joint-type="${escapeXml(joint.type)}">${symbolMarkup(joint.type, point.x, point.y, quaternionYaw(joint.orientation))}</g>`);
    elements.push(`<text x="${(point.x + 10).toFixed(3)}" y="${(point.y + 18).toFixed(3)}" fill="#94a3b8" font-family="system-ui,sans-serif" font-size="9">${escapeXml(joint.name || joint.type)}</text>`);
  }

  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(document.meta.title)}">${elements.join('')}</svg>`;
  return { markup, bounds, width, height };
}

export async function renderSvgAsPng(svgMarkup: string, pixelScale = 2): Promise<Blob> {
  if (!Number.isFinite(pixelScale) || pixelScale <= 0) throw new Error('PNG pixel scale must be positive');
  const viewBox = svgMarkup.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"/);
  if (!viewBox) throw new Error('Cannot export PNG: SVG viewBox is missing or invalid');
  const width = Number(viewBox[1]);
  const height = Number(viewBox[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Cannot export PNG: SVG dimensions are invalid');
  }
  const pixelWidth = Math.ceil(width * pixelScale);
  const pixelHeight = Math.ceil(height * pixelScale);
  if (pixelWidth > MAX_PNG_DIMENSION || pixelHeight > MAX_PNG_DIMENSION ||
      pixelWidth * pixelHeight > MAX_PNG_PIXELS) {
    throw new Error('Cannot export PNG: image dimensions exceed the safe browser canvas limit');
  }
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    throw new Error('PNG export requires a browser canvas');
  }

  const url = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot export PNG: browser canvas is unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Cannot export PNG: browser failed to encode the image'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
