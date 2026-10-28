import { describe, expect, it } from 'vitest';
import { createDefaultDocument } from '../defaultDocument';
import {
  buildMechanicalGraph,
  getGraphEdge,
  getGraphNeighbors,
  getGraphNode,
} from '../mechanicalGraph';
import type { KineoV3 } from '../jsonV3';

function documentWithTopology(bodyIds: string[], connections: Array<[string, string, string]>): KineoV3 {
  const document = createDefaultDocument();
  const template = document.liaisons[0];
  document.classesEquivalence = bodyIds.map((id, index) => ({
    id,
    name: `Body ${id}`,
    color: ['#ff0000', '#00ff00', '#0000ff', '#ffaa00'][index % 4],
    isFixed: index === 0,
    parentId: null,
    position: { x: index * 10, y: 0, z: 0 },
    rotation: 0,
  }));
  document.liaisons = connections.map(([id, source, target]) => ({
    ...structuredClone(template),
    id,
    name: `Joint ${id}`,
    classA: source,
    classB: target,
  }));
  document.geometry.entities = [];
  return document;
}

describe('mechanical connectivity multigraph', () => {
  it('represents an empty mechanism', () => {
    const graph = buildMechanicalGraph(documentWithTopology([], []));
    expect(graph.statistics).toEqual({
      nodeCount: 0,
      edgeCount: 0,
      componentCount: 0,
      isolatedNodeCount: 0,
      fixedNodeCount: 0,
      parallelConnectionCount: 0,
      cycleRank: 0,
      hasCycles: false,
    });
    expect(graph.components).toEqual([]);
  });

  it('represents a single isolated rigid body and identifies its ground designation', () => {
    const graph = buildMechanicalGraph(documentWithTopology(['ground'], []));
    expect(graph.components).toEqual([['ground']]);
    expect(graph.isolatedNodeIds).toEqual(['ground']);
    expect(graph.fixedNodeIds).toEqual(['ground']);
  });

  it('builds one stable edge for a connection between two bodies', () => {
    const graph = buildMechanicalGraph(documentWithTopology(['a', 'b'], [['link-b-a', 'b', 'a']]));
    expect(graph.nodes.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(graph.edges).toEqual([{
      id: 'link-b-a',
      name: 'Joint link-b-a',
      type: 'PIVOT',
      source: 'b',
      target: 'a',
    }]);
    expect(getGraphNode(graph, 'b')?.name).toBe('Body b');
    expect(getGraphEdge(graph, 'link-b-a')?.source).toBe('b');
    expect(getGraphNeighbors(graph, 'a').map(({ id }) => id)).toEqual(['b']);
  });

  it('finds disconnected components and isolated bodies', () => {
    const graph = buildMechanicalGraph(documentWithTopology(
      ['a', 'b', 'c', 'd', 'e'],
      [['ab', 'a', 'b'], ['cd', 'c', 'd']],
    ));
    expect(graph.components).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    expect(graph.isolatedNodeIds).toEqual(['e']);
    expect(graph.statistics.componentCount).toBe(3);
  });

  it('preserves parallel joints and detects their two-edge cycle', () => {
    const graph = buildMechanicalGraph(documentWithTopology(
      ['a', 'b'],
      [['pivot-a', 'a', 'b'], ['slider-a', 'b', 'a']],
    ));
    expect(graph.edges).toHaveLength(2);
    expect(graph.parallelConnections).toEqual([{ nodeIds: ['a', 'b'], edgeIds: ['pivot-a', 'slider-a'] }]);
    expect(graph.cycles).toEqual([['pivot-a', 'slider-a']]);
    expect(graph.statistics.cycleRank).toBe(1);
  });

  it('recognizes an open chain without reporting a closed loop', () => {
    const graph = buildMechanicalGraph(documentWithTopology(
      ['a', 'b', 'c', 'd'],
      [['ab', 'a', 'b'], ['bc', 'b', 'c'], ['cd', 'c', 'd']],
    ));
    expect(graph.statistics.hasCycles).toBe(false);
    expect(graph.statistics.cycleRank).toBe(0);
    expect(graph.cycles).toEqual([]);
  });

  it('detects a triangular closed-loop topology', () => {
    const graph = buildMechanicalGraph(documentWithTopology(
      ['a', 'b', 'c'],
      [['ab', 'a', 'b'], ['bc', 'b', 'c'], ['ca', 'c', 'a']],
    ));
    expect(graph.statistics.hasCycles).toBe(true);
    expect(graph.statistics.cycleRank).toBe(1);
    expect(graph.cycles).toEqual([['ab', 'bc', 'ca']]);
  });

  it('identifies the slider-crank topology as a closed graph loop', () => {
    const graph = buildMechanicalGraph(createDefaultDocument());
    expect(graph.statistics).toMatchObject({
      nodeCount: 4,
      edgeCount: 4,
      componentCount: 1,
      fixedNodeCount: 1,
      hasCycles: true,
      cycleRank: 1,
    });
    expect(graph.fixedNodeIds).toEqual(['eq_0']);
    expect(graph.edges.map(({ id }) => id)).toEqual(['link_1', 'link_2', 'link_3', 'link_4']);
  });

  it('represents a four-bar linkage as one four-edge loop', () => {
    const graph = buildMechanicalGraph(documentWithTopology(
      ['ground', 'crank', 'coupler', 'rocker'],
      [['j1', 'ground', 'crank'], ['j2', 'crank', 'coupler'], ['j3', 'coupler', 'rocker'], ['j4', 'rocker', 'ground']],
    ));
    expect(graph.statistics).toMatchObject({ nodeCount: 4, edgeCount: 4, componentCount: 1, hasCycles: true, cycleRank: 1 });
    expect(graph.cycles[0]).toHaveLength(4);
  });

  it('counts independent cycles in a multigraph with multiple loops', () => {
    const graph = buildMechanicalGraph(documentWithTopology(
      ['a', 'b', 'c', 'd'],
      [
        ['ab', 'a', 'b'], ['ac', 'a', 'c'], ['ad', 'a', 'd'],
        ['bc', 'b', 'c'], ['bd', 'b', 'd'], ['cd', 'c', 'd'],
      ],
    ));
    expect(graph.statistics.cycleRank).toBe(3);
    expect(graph.cycles).toHaveLength(3);
  });

  it('rejects invalid endpoints and self-connections rather than fabricating nodes', () => {
    expect(() => buildMechanicalGraph(documentWithTopology(['a'], [['bad-link', 'a', 'missing']])))
      .toThrow(/bad-link references an unknown rigid body/);
    expect(() => buildMechanicalGraph(documentWithTopology(['a'], [['self-link', 'a', 'a']])))
      .toThrow(/self-link connects a rigid body to itself/);
  });

  it('produces deterministic graph analysis and does not mutate document data', () => {
    const document = documentWithTopology(
      ['z', 'a', 'm'],
      [['parallel-2', 'z', 'a'], ['parallel-1', 'a', 'z'], ['tail', 'a', 'm']],
    );
    const before = structuredClone(document);
    const graphA = buildMechanicalGraph(document);
    const graphB = buildMechanicalGraph(document);
    expect(graphA.nodes).toEqual(graphB.nodes);
    expect(graphA.edges).toEqual(graphB.edges);
    expect(graphA.components).toEqual(graphB.components);
    expect(graphA.cycles).toEqual(graphB.cycles);
    expect(document).toEqual(before);
  });

  it('does not interpret parent relationships or geometry as mechanical edges', () => {
    const document = documentWithTopology(['a', 'b'], []);
    document.classesEquivalence[1].parentId = 'a';
    document.geometry.entities.push({
      id: 'visual-link',
      kind: 'segment',
      classId: 'a',
      localPoints: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }],
      style: { stroke: 'solid', width: 1, color: '#000000' },
      view: '2D',
    });
    const graph = buildMechanicalGraph(document);
    expect(graph.edges).toEqual([]);
    expect(graph.components).toEqual([['a'], ['b']]);
  });

  it('throws on unknown neighbor lookup and returns undefined for missing IDs', () => {
    const graph = buildMechanicalGraph(documentWithTopology(['a'], []));
    expect(getGraphNode(graph, 'missing')).toBeUndefined();
    expect(getGraphEdge(graph, 'missing')).toBeUndefined();
    expect(() => getGraphNeighbors(graph, 'missing')).toThrow(/Unknown graph node/);
  });

  it('keeps graph data isolated from edits to the source document after construction', () => {
    const document = createDefaultDocument();
    const graph = buildMechanicalGraph(document);
    document.classesEquivalence[0].name = 'Renamed ground';
    document.liaisons[0].type = 'CHANGED';
    expect(graph.nodeById.get('eq_0')?.name).toBe('Bâti');
    expect(graph.edgeById.get('link_1')?.type).toBe('PIVOT');
  });
});
