import type { KineoV3 } from './jsonV3';

export interface MechanicalGraphNode {
  id: string;
  name: string;
  color: string;
  isFixed: boolean;
}

export interface MechanicalGraphEdge {
  id: string;
  name: string;
  type: string;
  source: string;
  target: string;
}

export interface ParallelConnection {
  nodeIds: [string, string];
  edgeIds: string[];
}

export interface MechanicalGraphStatistics {
  nodeCount: number;
  edgeCount: number;
  componentCount: number;
  isolatedNodeCount: number;
  fixedNodeCount: number;
  parallelConnectionCount: number;
  cycleRank: number;
  hasCycles: boolean;
}

export interface MechanicalGraph {
  nodes: MechanicalGraphNode[];
  edges: MechanicalGraphEdge[];
  nodeById: Map<string, MechanicalGraphNode>;
  edgeById: Map<string, MechanicalGraphEdge>;
  adjacency: Map<string, string[]>;
  components: string[][];
  isolatedNodeIds: string[];
  fixedNodeIds: string[];
  parallelConnections: ParallelConnection[];
  cycles: string[][];
  statistics: MechanicalGraphStatistics;
}

export function buildMechanicalGraph(document: Pick<KineoV3, 'classesEquivalence' | 'liaisons'>): MechanicalGraph {
  const nodes = [...document.classesEquivalence]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id, name, color, isFixed }) => ({ id, name, color, isFixed }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  if (nodeById.size !== nodes.length) throw new Error('Cannot build graph: duplicate rigid-body IDs');

  const edges = [...document.liaisons]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(({ id, name, type, classA, classB }) => ({
      id,
      name,
      type,
      source: classA,
      target: classB,
    }));
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  if (edgeById.size !== edges.length) throw new Error('Cannot build graph: duplicate liaison IDs');

  const adjacency = new Map(nodes.map(({ id }) => [id, [] as string[]]));
  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) {
      throw new Error(`Cannot build graph: liaison ${edge.id} references an unknown rigid body`);
    }
    if (edge.source === edge.target) {
      throw new Error(`Cannot build graph: liaison ${edge.id} connects a rigid body to itself`);
    }
    adjacency.get(edge.source)?.push(edge.id);
    adjacency.get(edge.target)?.push(edge.id);
  }
  for (const edgeIds of adjacency.values()) edgeIds.sort((left, right) => left.localeCompare(right));

  const components = findConnectedComponents(nodes, edges, adjacency);
  const isolatedNodeIds = nodes
    .filter(({ id }) => adjacency.get(id)?.length === 0)
    .map(({ id }) => id);
  const fixedNodeIds = nodes.filter(({ isFixed }) => isFixed).map(({ id }) => id);
  const parallelConnections = findParallelConnections(edges);
  const cycles = findCycles(nodes, edges, adjacency);
  const cycleRank = edges.length - nodes.length + components.length;

  return {
    nodes,
    edges,
    nodeById,
    edgeById,
    adjacency,
    components,
    isolatedNodeIds,
    fixedNodeIds,
    parallelConnections,
    cycles,
    statistics: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      componentCount: components.length,
      isolatedNodeCount: isolatedNodeIds.length,
      fixedNodeCount: fixedNodeIds.length,
      parallelConnectionCount: parallelConnections.length,
      cycleRank,
      hasCycles: cycleRank > 0,
    },
  };
}

export function getGraphNode(graph: MechanicalGraph, id: string): MechanicalGraphNode | undefined {
  return graph.nodeById.get(id);
}

export function getGraphEdge(graph: MechanicalGraph, id: string): MechanicalGraphEdge | undefined {
  return graph.edgeById.get(id);
}

export function getGraphNeighbors(graph: MechanicalGraph, nodeId: string): MechanicalGraphNode[] {
  if (!graph.nodeById.has(nodeId)) throw new Error(`Unknown graph node ${nodeId}`);
  const neighborIds = new Set<string>();
  for (const edgeId of graph.adjacency.get(nodeId) ?? []) {
    const edge = graph.edgeById.get(edgeId);
    if (edge) neighborIds.add(edge.source === nodeId ? edge.target : edge.source);
  }
  return [...neighborIds].sort((left, right) => left.localeCompare(right))
    .map((id) => graph.nodeById.get(id))
    .filter((node): node is MechanicalGraphNode => node !== undefined);
}

function findConnectedComponents(
  nodes: MechanicalGraphNode[],
  edges: MechanicalGraphEdge[],
  adjacency: Map<string, string[]>,
): string[][] {
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    const component: string[] = [];
    const pending = [node.id];
    seen.add(node.id);
    while (pending.length) {
      const current = pending.pop();
      if (!current) continue;
      component.push(current);
      for (const edgeId of adjacency.get(current) ?? []) {
        const edge = edgeById.get(edgeId);
        if (!edge) continue;
        const neighbor = edge.source === current ? edge.target : edge.source;
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
    component.sort((left, right) => left.localeCompare(right));
    components.push(component);
  }
  return components.sort((left, right) => left[0].localeCompare(right[0]));
}

function findParallelConnections(edges: MechanicalGraphEdge[]): ParallelConnection[] {
  const groups = new Map<string, ParallelConnection>();
  for (const edge of edges) {
    const nodeIds = [edge.source, edge.target].sort((left, right) => left.localeCompare(right)) as [string, string];
    const key = JSON.stringify(nodeIds);
    const existing = groups.get(key);
    if (existing) existing.edgeIds.push(edge.id);
    else groups.set(key, { nodeIds, edgeIds: [edge.id] });
  }
  return [...groups.values()]
    .filter(({ edgeIds }) => edgeIds.length > 1)
    .sort((left, right) => JSON.stringify(left.nodeIds).localeCompare(JSON.stringify(right.nodeIds)));
}

function findCycles(
  nodes: MechanicalGraphNode[],
  edges: MechanicalGraphEdge[],
  adjacency: Map<string, string[]>,
): string[][] {
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  const state = new Map<string, 'active' | 'complete'>();
  const nodeStack: string[] = [];
  const edgeStack: string[] = [];
  const cycles: string[][] = [];

  const visit = (nodeId: string, parentEdgeId: string | null): void => {
    state.set(nodeId, 'active');
    nodeStack.push(nodeId);
    for (const edgeId of adjacency.get(nodeId) ?? []) {
      if (edgeId === parentEdgeId) continue;
      const edge = edgeById.get(edgeId);
      if (!edge) continue;
      const neighborId = edge.source === nodeId ? edge.target : edge.source;
      const neighborState = state.get(neighborId);
      if (!neighborState) {
        edgeStack.push(edgeId);
        visit(neighborId, edgeId);
        edgeStack.pop();
      } else if (neighborState === 'active') {
        const ancestorIndex = nodeStack.lastIndexOf(neighborId);
        if (ancestorIndex >= 0) cycles.push([...edgeStack.slice(ancestorIndex), edgeId]);
      }
    }
    nodeStack.pop();
    state.set(nodeId, 'complete');
  };

  for (const { id } of nodes) if (!state.has(id)) visit(id, null);
  return cycles;
}
