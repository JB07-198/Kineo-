import { describe, expect, it } from 'vitest';
import type { GeometryEntity } from '../jsonV3';
import { changeShape, geometryPath, geometryStyle, localBounds, resizeGeometry, SHAPE_LABELS } from '../graphics';

const line: GeometryEntity = {
  id: 'geometry-1',
  classId: 'body-1',
  kind: 'segment',
  localPoints: [{ x: 10, y: 20, z: 0 }, { x: 70, y: 20, z: 0 }],
  style: { color: '#336699', stroke: 'solid', width: 2 },
  view: '2D',
};

describe('independent solid representations', () => {
  it('creates valid paths for all supported shapes and closes area representations', () => {
    for (const kind of Object.keys(SHAPE_LABELS) as Array<keyof typeof SHAPE_LABELS>) {
      const entity = changeShape(line, kind);
      const result = geometryPath(entity);
      expect(result.path).toMatch(/^M /);
      expect(result.closed).toBe(kind !== 'segment');
      expect(result.outline.length).toBeGreaterThanOrEqual(kind === 'segment' ? 2 : 4);
    }
    expect(geometryPath(changeShape(line, 'circle')).path).toContain(' A ');
    expect(geometryPath(changeShape(line, 'ellipse')).path).toContain(' A ');
    expect(geometryPath(changeShape(line, 'roundedRectangle')).path).toContain(' A ');
  });

  it('resizes representations without changing their local center or style', () => {
    const circle = changeShape(line, 'circle');
    const resized = resizeGeometry(circle, 100, 40);
    expect(localBounds(resized).width).toBeCloseTo(100);
    expect(localBounds(resized).height).toBeCloseTo(100);
    expect(localBounds(resized).cx).toBeCloseTo(40);
    expect(localBounds(resized).cy).toBeCloseTo(20);
    expect(resized.style).toEqual(circle.style);
  });

  it('uses configured stroke and fill properties with a light default fill', () => {
    const rectangle = changeShape(line, 'rectangle');
    expect(geometryStyle(rectangle)).toMatchObject({ stroke: '#336699', fill: '#336699', fillOpacity: 0.18 });
    const styled = { ...rectangle, style: { ...rectangle.style, fill: '#ff0000', fillOpacity: 0.7, stroke: 'dashed' } };
    expect(geometryStyle(styled)).toMatchObject({ fill: '#ff0000', fillOpacity: 0.7, dashed: true });
  });

  it('rejects invalid dimensions', () => {
    expect(() => resizeGeometry(changeShape(line, 'rectangle'), 0, 10)).toThrow(/Dimensions graphiques invalides/);
    expect(() => resizeGeometry(changeShape(line, 'ellipse'), 10, 0)).toThrow(/Dimensions graphiques invalides/);
  });
});
