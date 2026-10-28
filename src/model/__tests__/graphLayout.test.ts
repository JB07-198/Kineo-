import { describe, expect, it } from 'vitest';
import { createDefaultDocument } from '../defaultDocument';
import { layoutMechanicalGraph } from '../graphLayout';
import { buildMechanicalGraph } from '../mechanicalGraph';

describe('deterministic graph layout', () => {
  it('returns stable transient positions without modifying the canonical document', () => {
    const document = createDefaultDocument();
    const before = structuredClone(document);
    const first = layoutMechanicalGraph(buildMechanicalGraph(document));
    const second = layoutMechanicalGraph(buildMechanicalGraph(document));
    expect([...first.positions]).toEqual([...second.positions]);
    expect(first.bounds).toEqual(second.bounds);
    expect(document).toEqual(before);
  });

  it('separates disconnected components and places every isolated body', () => {
    const document = createDefaultDocument();
    document.classesEquivalence = document.classesEquivalence.slice(0, 3);
    document.liaisons = document.liaisons.slice(0, 1);
    const graph = buildMechanicalGraph(document);
    const layout = layoutMechanicalGraph(graph);
    expect(graph.components).toHaveLength(2);
    expect(layout.positions.size).toBe(3);
    const [first, second] = layout.componentBounds;
    expect(first.maxX < second.minX || second.maxX < first.minX ||
      first.maxY < second.minY || second.maxY < first.minY).toBe(true);
  });

  it('produces a valid fit bound for an empty graph', () => {
    const document = createDefaultDocument();
    document.classesEquivalence = [];
    document.liaisons = [];
    const layout = layoutMechanicalGraph(buildMechanicalGraph(document));
    expect(layout.positions.size).toBe(0);
    expect(layout.bounds.maxX).toBeGreaterThan(layout.bounds.minX);
    expect(layout.bounds.maxY).toBeGreaterThan(layout.bounds.minY);
  });
});
