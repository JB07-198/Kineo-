import { describe, expect, it } from 'vitest';
import { getJointGlyph } from '../jointSymbols';
import { buildPlanarScene } from '../planarScene';
import { createSvgExport } from '../export2d';
import {
  denseAnnotationFixture,
  emptyFixture,
  fourBarFixture,
  inconsistentAnchorFixture,
  pivotFixture,
  sliderCrankFixture,
} from './sceneFixtures';

function boxesOverlap(
  first: { minX: number; minY: number; maxX: number; maxY: number },
  second: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return first.minX < second.maxX && first.maxX > second.minX &&
    first.minY < second.maxY && first.maxY > second.minY;
}

describe('shared planar scene and mechanical anchors', () => {
  it('places the slider-crank links on the intended pivots and horizontal guide', () => {
    const document = sliderCrankFixture();
    const scene = buildPlanarScene(document);
    const geometry = new Map(scene.geometry.map((entity) => [entity.entity.id, entity]));
    const joints = new Map(scene.joints.map((joint) => [joint.id, joint]));
    const origin = { x: 0, y: 0 };
    const crankPin = joints.get('link_2')!.center;
    const sliderPin = joints.get('link_3')!.center;

    expect(document.classesEquivalence.find(({ id }) => id === 'eq_0')?.isFixed).toBe(true);
    expect(joints.get('link_1')?.center).toEqual(origin);
    expect(crankPin.y).toBeGreaterThan(0);
    expect(sliderPin.y).toBeCloseTo(0);
    expect(joints.get('link_4')?.type).toBe('GLISSIERE');
    expect(joints.get('link_4')?.angle).toBeCloseTo(0);
    for (const joint of scene.joints) {
      expect(joint.mismatch).toBeCloseTo(0);
      expect(joint.anchorA.x).toBeCloseTo(joint.center.x);
      expect(joint.anchorA.y).toBeCloseTo(joint.center.y);
      expect(joint.anchorB.x).toBeCloseTo(joint.center.x);
      expect(joint.anchorB.y).toBeCloseTo(joint.center.y);
    }

    const crank = geometry.get('ent_crank')!;
    const rod = geometry.get('ent_rod')!;
    const piston = geometry.get('ent_piston')!;
    expect(crank.points[0]).toEqual(origin);
    expect(crank.points[1]!.x).toBeCloseTo(crankPin.x);
    expect(crank.points[1]!.y).toBeCloseTo(crankPin.y);
    expect(rod.points[0]!.x).toBeCloseTo(crankPin.x);
    expect(rod.points[0]!.y).toBeCloseTo(crankPin.y);
    expect(rod.points[1]!.x).toBeCloseTo(sliderPin.x);
    expect(rod.points[1]!.y).toBeCloseTo(sliderPin.y);
    expect(piston.points.map(({ x }) => x).reduce((a, b) => a + b, 0) / 4).toBeCloseTo(sliderPin.x);
    expect(piston.points.map(({ y }) => y).reduce((a, b) => a + b, 0) / 4).toBeCloseTo(sliderPin.y);
    expect(geometry.get('ent_guide_upper')?.points.every(({ y }) => y === 9)).toBe(true);
    expect(geometry.get('ent_guide_lower')?.points.every(({ y }) => y === -9)).toBe(true);
    expect(Math.hypot(crank.points[1]!.x - crank.points[0]!.x, crank.points[1]!.y - crank.points[0]!.y)).toBeCloseTo(70);
    expect(Math.hypot(rod.points[1]!.x - rod.points[0]!.x, rod.points[1]!.y - rod.points[0]!.y)).toBeCloseTo(120);

    const exported = createSvgExport(document).markup;
    expect(exported).toContain('data-geometry-id="ent_guide_upper"');
    expect(exported).toContain('data-geometry-id="ent_guide_lower"');
    expect(exported).toContain('data-joint-type="GLISSIERE"');
    expect(exported).toContain('data-geometry-id="ent_crank"');
    expect(exported).toContain('data-geometry-id="ent_rod"');
    expect(exported.indexOf('data-joint-symbol-for="link_4"'))
      .toBeLessThan(exported.indexOf('data-joint-symbol-for="link_3"'));
    expect(exported).toContain('data-joint-symbol-for="link_3"');
    expect(exported).not.toContain('stroke-dasharray="2 2"');
  });

  it('keeps slider-crank labels clear of one another and its mechanism geometry', () => {
    const scene = buildPlanarScene(sliderCrankFixture());
    for (let first = 0; first < scene.labels.length; first += 1) {
      for (let second = first + 1; second < scene.labels.length; second += 1) {
        expect(boxesOverlap(scene.labels[first].bounds, scene.labels[second].bounds)).toBe(false);
      }
    }
    for (const label of scene.labels) {
      for (const geometry of scene.geometry.filter(({ points }) => points.length > 0)) {
        const bounds = {
          minX: Math.min(...geometry.points.map(({ x }) => x)) - 2,
          minY: Math.min(...geometry.points.map(({ y }) => y)) - 2,
          maxX: Math.max(...geometry.points.map(({ x }) => x)) + 2,
          maxY: Math.max(...geometry.points.map(({ y }) => y)) + 2,
        };
        expect(boxesOverlap(label.bounds, bounds)).toBe(false);
      }
    }
  });

  it('builds the empty, pivot, slider-crank, and four-bar scenes without clipping content bounds', () => {
    for (const fixture of [emptyFixture(), pivotFixture(), sliderCrankFixture(), fourBarFixture()]) {
      const exported = createSvgExport(fixture);
      expect(exported.width).toBeGreaterThan(0);
      expect(exported.height).toBeGreaterThan(0);
      expect(exported.markup).toContain('fill="#ffffff"');
      expect(exported.scene.bounds.minX).toBeLessThan(exported.scene.bounds.maxX);
      expect(exported.scene.bounds.minY).toBeLessThan(exported.scene.bounds.maxY);
    }
    expect(buildPlanarScene(emptyFixture()).empty).toBe(true);
    expect(buildPlanarScene(pivotFixture()).joints).toHaveLength(1);
    expect(buildPlanarScene(fourBarFixture()).joints).toHaveLength(4);
  });

  it('transforms both local anchors through each body frame and reports disagreement', () => {
    const document = pivotFixture();
    document.classesEquivalence[1].rotation = Math.PI / 2;
    document.liaisons[0].anchors.onClassB = { x: 0, y: 40, z: 0 };
    const scene = buildPlanarScene(document);
    expect(scene.joints[0].anchorA).toEqual({ x: 0, y: 0 });
    expect(scene.joints[0].anchorB.x).toBeCloseTo(0);
    expect(scene.joints[0].anchorB.y).toBeCloseTo(0);
    expect(scene.joints[0].mismatch).toBeCloseTo(0);

    const inconsistent = buildPlanarScene(inconsistentAnchorFixture());
    expect(inconsistent.joints[0].mismatch).toBeCloseTo(20);
    expect(inconsistent.labels.some(({ kind }) => kind === 'warning')).toBe(true);
    expect(createSvgExport(inconsistentAnchorFixture()).markup).toContain('data-anchor-warning="pivot-1"');
    expect(createSvgExport(inconsistentAnchorFixture()).markup).toContain('stroke-dasharray="2 2"');
  });

  it('places dense body and joint labels without label-to-label collisions', () => {
    const scene = buildPlanarScene(denseAnnotationFixture());
    for (let first = 0; first < scene.labels.length; first += 1) {
      for (let second = first + 1; second < scene.labels.length; second += 1) {
        expect(boxesOverlap(scene.labels[first].bounds, scene.labels[second].bounds)).toBe(false);
      }
    }
    for (const label of scene.labels) {
      for (const geometry of scene.geometry.filter(({ points }) => points.length > 0)) {
        const bounds = {
          minX: Math.min(...geometry.points.map(({ x }) => x)) - 2,
          minY: Math.min(...geometry.points.map(({ y }) => y)) - 2,
          maxX: Math.max(...geometry.points.map(({ x }) => x)) + 2,
          maxY: Math.max(...geometry.points.map(({ y }) => y)) + 2,
        };
        expect(boxesOverlap(label.bounds, bounds)).toBe(false);
      }
    }
  });

  it('uses distinguishable reusable glyph geometry for supported joint types', () => {
    const supported = ['PIVOT', 'GLISSIERE', 'PIVOT_GLISSANT', 'ROTULE', 'APPUI_PLAN', 'HELICOIDALE', 'ENCASTREMENT'];
    const signatures = supported.map((type) => JSON.stringify(getJointGlyph(type)));
    expect(new Set(signatures).size).toBe(supported.length);
    expect(signatures).not.toContain(JSON.stringify(getJointGlyph('CUSTOM_EXTENSION')));
    const prismatic = getJointGlyph('GLISSIERE');
    expect(prismatic.filter((shape) => shape.kind === 'path')).toHaveLength(9);
    expect(getJointGlyph('PIVOT').every((shape) => shape.kind === 'circle')).toBe(true);
    const markup = createSvgExport(fourBarFixture()).markup;
    expect(markup.match(/data-joint-id=/g)).toHaveLength(4);
  });

  it('preserves the source document when generating a scene and visual export', () => {
    const document = sliderCrankFixture();
    const original = structuredClone(document);
    buildPlanarScene(document);
    createSvgExport(document);
    expect(document).toEqual(original);
  });
});
