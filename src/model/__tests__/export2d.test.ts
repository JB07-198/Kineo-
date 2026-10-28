import { describe, expect, it } from 'vitest';
import { createDefaultDocument } from '../defaultDocument';
import { createSvgExport, renderSvgAsPng } from '../export2d';

describe('2D SVG export', () => {
  it('creates a standalone, sized SVG with body geometry, labels, joints, and ground', () => {
    const document = createDefaultDocument();
    const before = structuredClone(document);
    const exported = createSvgExport(document);

    expect(exported.markup).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(exported.markup).toContain('viewBox="0 0 ');
    expect(exported.markup).toContain('data-geometry-id="ent_crank"');
    expect(exported.markup).toContain('data-joint-id="link_4"');
    expect(exported.markup).toContain('data-ground-body="eq_0"');
    expect(exported.markup).toContain('Bâti · FIXE');
    expect(document).toEqual(before);
  });

  it('applies body rotation to local geometry points in the exported path', () => {
    const document = createDefaultDocument();
    document.classesEquivalence.find(({ id }) => id === 'eq_1')!.rotation = Math.PI / 2;
    const markup = createSvgExport(document).markup;
    const points = markup.match(/data-geometry-id="ent_crank" points="([^"]+)"/)?.[1];
    expect(points).toBeDefined();
    const [start, end] = points!.split(' ').map((point) => point.split(',').map(Number));
    expect(end[0]).toBeCloseTo(start[0]);
    expect(end[1] - start[1]).toBeCloseTo(-70);
  });

  it('rotates the ground marker and joint symbols with their planar orientations', () => {
    const document = createDefaultDocument();
    document.classesEquivalence.find(({ id }) => id === 'eq_0')!.rotation = Math.PI / 2;
    document.liaisons[0].orientation = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
    const markup = createSvgExport(document).markup;
    expect(markup).toMatch(/data-ground-body="eq_0" transform="translate\([^"]+\) rotate\(-90\.000\)"/);
    expect(markup).toMatch(/<g transform="translate\([^"]+\) rotate\(-90\.000\)">/);
  });

  it('includes all actual liaison instances as distinct joint symbols and labels', () => {
    const document = createDefaultDocument();
    document.liaisons.push({
      ...structuredClone(document.liaisons[0]),
      id: 'parallel-joint',
      name: 'Parallel test pivot',
    });
    const markup = createSvgExport(document).markup;
    expect(markup.match(/data-joint-id=/g)).toHaveLength(5);
    expect(markup).toContain('data-joint-id="parallel-joint"');
    expect(markup).toContain('Parallel test pivot');
  });

  it('produces an intentional white empty-state image with non-zero bounds', () => {
    const document = createDefaultDocument();
    document.classesEquivalence = [];
    document.liaisons = [];
    document.geometry.entities = [];
    const exported = createSvgExport(document);
    expect(exported.width).toBeGreaterThan(100);
    expect(exported.height).toBeGreaterThan(100);
    expect(exported.markup).toContain('fill="#ffffff"');
    expect(exported.markup).toContain('Document vide — aucun élément');
  });

  it('rejects invalid geometry references rather than omitting the representation', () => {
    const document = createDefaultDocument();
    document.geometry.entities[0].classId = 'missing-body';
    expect(() => createSvgExport(document)).toThrow(/unknown body missing-body/);
  });

  it('rejects invalid or oversized PNG rendering requests before allocating a canvas', async () => {
    await expect(renderSvgAsPng('<svg/>')).rejects.toThrow(/viewBox/);
    await expect(renderSvgAsPng('<svg viewBox="0 0 100 100"/>', 0)).rejects.toThrow(/target width/);
    await expect(renderSvgAsPng('<svg viewBox="0 0 100 100"/>', 9000)).rejects.toThrow(/safe browser canvas limit/);
  });
});
