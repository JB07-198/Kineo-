import { describe, expect, it } from 'vitest';
import { createDefaultDocument } from '../defaultDocument';
import { createSvgExport, renderSvgAsPng } from '../export2d';

describe('2D SVG export', () => {
  it('creates a standalone, sized SVG with body geometry, short identifiers, joints, and ground', () => {
    const document = createDefaultDocument();
    const before = structuredClone(document);
    const exported = createSvgExport(document);

    expect(exported.markup).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(exported.markup).toContain('viewBox="0 0 ');
    expect(exported.markup).toContain('data-geometry-id="ent_crank"');
    expect(exported.markup).toContain('data-joint-id="link_4"');
    expect(exported.markup).toContain('data-ground-body="eq_0"');
    expect(exported.markup).toContain('>S0</text>');
    expect(exported.markup).toContain('>L1</text>');
    expect(document).toEqual(before);
  });

  it('applies body rotation to local geometry paths in SVG', () => {
    const document = createDefaultDocument();
    document.classesEquivalence.find(({ id }) => id === 'eq_1')!.rotation = Math.PI / 2;
    const markup = createSvgExport(document).markup;
    expect(markup).toMatch(/data-geometry-id="ent_crank" d="M 0 0 L 70 0" transform="translate\([^"]+\) rotate\(-90\.000\) scale\(1 -1\)"/);
  });

  it('rotates the ground marker and joint symbols with their planar orientations', () => {
    const document = createDefaultDocument();
    document.classesEquivalence.find(({ id }) => id === 'eq_0')!.rotation = Math.PI / 2;
    document.liaisons[0].orientation = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
    const markup = createSvgExport(document).markup;
    expect(markup).toMatch(/data-ground-body="eq_0" transform="translate\([^"]+\) rotate\(-90\.000\)"/);
    expect(markup).toMatch(/<g transform="translate\([^"]+\) rotate\(-90\.000\)">/);
  });

  it('includes all actual liaison instances as distinct symbols and short labels', () => {
    const document = createDefaultDocument();
    document.liaisons.push({
      ...structuredClone(document.liaisons[0]),
      id: 'parallel-joint',
      name: 'Parallel test pivot',
    });

    const markup = createSvgExport(document).markup;
    expect(markup.match(/data-joint-id=/g)).toHaveLength(5);
    expect(markup).toContain('data-joint-id="parallel-joint"');
    expect(markup).toContain('>L5</text>');
    expect(markup).not.toContain('Parallel test pivot');
  });

  it('exports curved shape paths, graphic styles, anchors, and configurable short IDs', () => {
    const document = createDefaultDocument();
    const bodyShape = document.geometry.entities.find(({ id }) => id === 'ent_piston')!;
    bodyShape.kind = 'roundedRectangle';
    bodyShape.cornerRadius = 6;
    bodyShape.style.fill = '#ff8800';
    bodyShape.style.fillOpacity = 0.4;
    document.geometry.display = { bodyIds: true, jointIds: true, anchors: true };
    const markup = createSvgExport(document).markup;
    expect(markup).toContain('data-geometry-id="ent_piston"');
    expect(markup).toContain(' A ');
    expect(markup).toContain('fill="#ff8800"');
    expect(markup).toContain('fill-opacity="0.4"');
    expect(markup).toContain('data-anchor="A"');
    expect(markup).toContain('>S0</text>');
    expect(markup).not.toContain('Nomenclature');

    document.geometry.display = { bodyIds: false, jointIds: false, anchors: false };
    const hiddenIds = createSvgExport(document).markup;
    expect(hiddenIds).not.toContain('>S0</text>');
    expect(hiddenIds).not.toContain('>L1</text>');
    expect(hiddenIds).not.toContain('data-anchor="A"');
  });

  it('produces an intentional clean white empty-state image with non-zero bounds', () => {
    const document = createDefaultDocument();
    document.classesEquivalence = [];
    document.liaisons = [];
    document.geometry.entities = [];
    const exported = createSvgExport(document);
    expect(exported.width).toBeGreaterThan(100);
    expect(exported.height).toBeGreaterThan(100);
    expect(exported.markup).toContain('fill="#ffffff"');
    expect(exported.markup).not.toContain('Document vide');
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
