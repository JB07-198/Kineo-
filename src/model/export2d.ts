import type { KineoV3 } from './jsonV3';
import { getJointGlyph } from './jointSymbols';
import { buildPlanarScene, type PlanarScene, type SceneBounds, type SceneLabel } from './planarScene';
import { geometryPath, geometryStyle } from './graphics';

export interface SvgExport {
  markup: string;
  bounds: SceneBounds;
  width: number;
  height: number;
  scene: PlanarScene;
}

const EXPORT_PADDING = 24;
const MAX_PNG_DIMENSION = 8192;
const MAX_PNG_PIXELS = 32_000_000;

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[character] ?? character);
}

function svgPoint(point: { x: number; y: number }, bounds: SceneBounds): { x: number; y: number } {
  return { x: point.x - bounds.minX + EXPORT_PADDING, y: bounds.maxY - point.y + EXPORT_PADDING };
}

function labelMarkup(label: SceneLabel, bounds: SceneBounds): string {
  const topLeft = svgPoint({ x: label.bounds.minX, y: label.bounds.maxY }, bounds);
  const anchor = svgPoint(label.anchor, bounds);
  const textPoint = { x: topLeft.x + 4, y: topLeft.y + 12 };
  const color = label.kind === 'warning' ? '#b91c1c' : '#111827';
  const edge = svgPoint({
    x: Math.max(label.bounds.minX, Math.min(label.bounds.maxX, label.anchor.x)),
    y: Math.max(label.bounds.minY, Math.min(label.bounds.maxY, label.anchor.y)),
  }, bounds);
  const leader = label.kind === 'warning' && Math.hypot(edge.x - anchor.x, edge.y - anchor.y) > 50
    ? `<path d="M${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)}L${edge.x.toFixed(2)} ${edge.y.toFixed(2)}" fill="none" stroke="${color}" stroke-width="0.8" stroke-dasharray="2 2"/>`
    : '';
  return `${leader}<rect x="${topLeft.x.toFixed(2)}" y="${topLeft.y.toFixed(2)}" width="${(label.bounds.maxX - label.bounds.minX).toFixed(2)}" height="${(label.bounds.maxY - label.bounds.minY).toFixed(2)}" rx="2" fill="#ffffff" fill-opacity="0.94"/><text data-label-id="${escapeXml(label.id)}" x="${textPoint.x.toFixed(2)}" y="${textPoint.y.toFixed(2)}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="11">${escapeXml(label.text)}</text>`;
}

function glyphMarkup(type: string, x: number, y: number, angle: number): string {
  const shapes = getJointGlyph(type).map((shape) => {
    if (shape.kind === 'circle') {
      return `<circle r="${shape.radius}" fill="${shape.filled ? '#1f2937' : '#ffffff'}" stroke="#1f2937" stroke-width="1.5"/>`;
    }
    const points = shape.points.map(({ x: px, y: py }) => `${px},${-py}`).join(' ');
    if (shape.closed) {
      return `<polygon points="${points}" fill="${shape.filled ? '#1f2937' : '#ffffff'}" stroke="#1f2937" stroke-width="1.5" stroke-linejoin="round"/>`;
    }
    return `<polyline points="${points}" fill="none" stroke="#1f2937" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(-angle * 180 / Math.PI).toFixed(3)})">${shapes}</g>`;
}

function groundMarkup(
  marker: PlanarScene['groundMarkers'][number],
  bounds: SceneBounds,
): string {
  const point = svgPoint(marker.center, bounds);
  const symbol = glyphMarkup('GROUND_FIXATION', 0, 0, 0);
  return `<g data-ground-body="${escapeXml(marker.bodyId)}"${marker.fixation ? ` data-fixation-id="${escapeXml(marker.id)}"` : ''} transform="translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) rotate(${(-marker.angle * 180 / Math.PI).toFixed(3)})" fill="none" stroke="#1f2937" stroke-width="1.5">${symbol}</g>`;
}

export function createSvgExport(document: KineoV3): SvgExport {
  const scene = buildPlanarScene(document);
  const bounds = scene.bounds;
  const width = Math.max(100, bounds.maxX - bounds.minX + 2 * EXPORT_PADDING);
  const height = Math.max(100, bounds.maxY - bounds.minY + 2 * EXPORT_PADDING);
  const elements: string[] = [`<rect width="${width}" height="${height}" fill="#ffffff"/>`];

  for (const { entity, bodyId, bodyPosition, bodyRotation, points } of scene.geometry) {
    const { path } = geometryPath(entity);
    if (!path) continue;
    const style = geometryStyle(entity);
    const position = svgPoint(bodyPosition, bounds);
    if (!points.length) continue;
    const transform = `translate(${position.x.toFixed(2)} ${position.y.toFixed(2)}) rotate(${(-bodyRotation * 180 / Math.PI).toFixed(3)}) scale(1 -1)`;
    const dash = style.dashed ? ' stroke-dasharray="5 3"' : '';
    elements.push(`<path data-body-id="${escapeXml(bodyId)}" data-geometry-id="${escapeXml(entity.id)}" d="${escapeXml(path)}" transform="${transform}" fill="${escapeXml(style.fill)}" fill-opacity="${style.fillOpacity}" stroke="${escapeXml(style.stroke)}" stroke-width="${Math.max(0.8, Math.min(20, style.width))}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`);
  }

  for (const marker of scene.groundMarkers) {
    elements.push(groundMarkup(marker, bounds));
  }

  if (scene.displayAnchors) {
    for (const joint of scene.joints) {
      for (const [frame, anchor] of [['A', joint.anchorA], ['B', joint.anchorB]] as const) {
        const point = svgPoint(anchor, bounds);
        elements.push(`<circle data-anchor="${frame}" data-joint-anchor="${escapeXml(joint.id)}" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3" fill="#38bdf8" stroke="#0f172a" stroke-width="1"/>`);
      }
    }
  }

  for (const joint of scene.joints) {
    const center = svgPoint(joint.center, bounds);
    const anchorA = svgPoint(joint.anchorA, bounds);
    const anchorB = svgPoint(joint.anchorB, bounds);
    const inconsistent = joint.mismatch > 1e-6;
    elements.push(`<g data-joint-id="${escapeXml(joint.id)}" data-joint-type="${escapeXml(joint.type)}">`);
    for (const anchor of joint.type === 'APPUI_PLAN' || (['GLISSIERE', 'PIVOT_GLISSANT'].includes(joint.type) && !inconsistent) ? [] : [anchorA, anchorB]) {
      if (Math.hypot(anchor.x - center.x, anchor.y - center.y) > 0.5) {
        elements.push(`<path d="M${anchor.x.toFixed(2)} ${anchor.y.toFixed(2)}L${center.x.toFixed(2)} ${center.y.toFixed(2)}" fill="none" stroke="${inconsistent ? '#b91c1c' : '#6b7280'}" stroke-width="1" stroke-dasharray="3 3"/>`);
      }
    }
    if (inconsistent) {
      elements.push(`<path data-anchor-warning="${escapeXml(joint.id)}" d="M${anchorA.x.toFixed(2)} ${anchorA.y.toFixed(2)}L${anchorB.x.toFixed(2)} ${anchorB.y.toFixed(2)}" fill="none" stroke="#b91c1c" stroke-width="1.6" stroke-dasharray="4 2"/>`);
    }
    if (joint.type === 'PIVOT') {
      elements.push(`<circle cx="${anchorA.x.toFixed(2)}" cy="${anchorA.y.toFixed(2)}" r="3.5" fill="#1f2937" stroke="#ffffff" stroke-width="0.8"/>`);
      elements.push(`<circle cx="${anchorB.x.toFixed(2)}" cy="${anchorB.y.toFixed(2)}" r="2" fill="#ffffff" stroke="#1f2937" stroke-width="1"/>`);
    }
    if (inconsistent) {
      elements.push(`<text x="${(anchorA.x + 4).toFixed(2)}" y="${(anchorA.y - 4).toFixed(2)}" font-family="Arial, Helvetica, sans-serif" font-size="8" fill="#1f2937">A</text>`);
      elements.push(`<text x="${(anchorB.x + 4).toFixed(2)}" y="${(anchorB.y - 4).toFixed(2)}" font-family="Arial, Helvetica, sans-serif" font-size="8" fill="#1f2937">B</text>`);
    }
    elements.push('</g>');
  }

  const jointSymbols = [...scene.joints].sort((first, second) =>
    Number(first.type === 'PIVOT') - Number(second.type === 'PIVOT'));
  for (const joint of jointSymbols) {
    const center = svgPoint(joint.center, bounds);
    elements.push(`<g data-joint-symbol-for="${escapeXml(joint.id)}" data-joint-type="${escapeXml(joint.type)}">${glyphMarkup(joint.type, center.x, center.y, joint.angle)}</g>`);
  }

  for (const label of scene.labels) elements.push(labelMarkup(label, bounds));
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(document.meta.title)}"><title>${escapeXml(document.meta.title)}</title>${elements.join('')}</svg>`;
  return { markup, bounds, width, height, scene };
}

export async function renderSvgAsPng(svgMarkup: string, targetWidth = 1600): Promise<Blob> {
  if (!Number.isFinite(targetWidth) || targetWidth <= 0) throw new Error('PNG target width must be positive');
  const viewBox = svgMarkup.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"/);
  if (!viewBox) throw new Error('Cannot export PNG: SVG viewBox is missing or invalid');
  const width = Number(viewBox[1]);
  const height = Number(viewBox[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('Cannot export PNG: SVG dimensions are invalid');
  }
  const pixelWidth = Math.ceil(targetWidth);
  const pixelHeight = Math.ceil(targetWidth * height / width);
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
