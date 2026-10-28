import type { MechanicalGraph } from './mechanicalGraph';

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface GraphLayout {
  positions: Map<string, GraphPoint>;
  componentBounds: GraphBounds[];
  bounds: GraphBounds;
}

const NODE_RADIUS = 42;
const COMPONENT_GAP = 100;

export function layoutMechanicalGraph(graph: MechanicalGraph): GraphLayout {
  const componentSpecs = graph.components.map((nodeIds) => {
    const radius = nodeIds.length < 2
      ? 0
      : Math.max(100, 62 / Math.sin(Math.PI / nodeIds.length));
    const halfExtent = radius + NODE_RADIUS;
    return {
      nodeIds,
      radius,
      width: Math.max(2 * halfExtent, 180),
      height: Math.max(2 * halfExtent, 180),
    };
  });
  if (!componentSpecs.length) {
    return {
      positions: new Map(),
      componentBounds: [],
      bounds: { minX: -90, minY: -90, maxX: 90, maxY: 90 },
    };
  }

  const columnCount = Math.ceil(Math.sqrt(componentSpecs.length));
  const rowCount = Math.ceil(componentSpecs.length / columnCount);
  const columnWidths = Array.from({ length: columnCount }, (_, column) =>
    Math.max(...componentSpecs.filter((_, index) => index % columnCount === column).map(({ width }) => width)));
  const rowHeights = Array.from({ length: rowCount }, (_, row) =>
    Math.max(...componentSpecs.slice(row * columnCount, (row + 1) * columnCount).map(({ height }) => height)));
  const columnCenters: number[] = [];
  let totalWidth = 0;
  for (const width of columnWidths) totalWidth += width + COMPONENT_GAP;
  totalWidth -= COMPONENT_GAP;
  let left = -totalWidth / 2;
  for (const width of columnWidths) {
    columnCenters.push(left + width / 2);
    left += width + COMPONENT_GAP;
  }
  const rowCenters: number[] = [];
  let totalHeight = 0;
  for (const height of rowHeights) totalHeight += height + COMPONENT_GAP;
  totalHeight -= COMPONENT_GAP;
  let top = totalHeight / 2;
  for (const height of rowHeights) {
    rowCenters.push(top - height / 2);
    top -= height + COMPONENT_GAP;
  }

  const positions = new Map<string, GraphPoint>();
  const componentBounds: GraphBounds[] = [];
  componentSpecs.forEach(({ nodeIds, radius }, componentIndex) => {
    const column = componentIndex % columnCount;
    const row = Math.floor(componentIndex / columnCount);
    const center = { x: columnCenters[column], y: rowCenters[row] };
    const points = nodeIds.map((id, index) => {
      const angle = nodeIds.length === 1 ? 0 : -Math.PI / 2 + 2 * Math.PI * index / nodeIds.length;
      const point = {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
      positions.set(id, point);
      return point;
    });
    componentBounds.push({
      minX: Math.min(...points.map(({ x }) => x)) - NODE_RADIUS - 12,
      minY: Math.min(...points.map(({ y }) => y)) - NODE_RADIUS - 12,
      maxX: Math.max(...points.map(({ x }) => x)) + NODE_RADIUS + 12,
      maxY: Math.max(...points.map(({ y }) => y)) + NODE_RADIUS + 12,
    });
  });
  return {
    positions,
    componentBounds,
    bounds: {
      minX: Math.min(...componentBounds.map(({ minX }) => minX)),
      minY: Math.min(...componentBounds.map(({ minY }) => minY)),
      maxX: Math.max(...componentBounds.map(({ maxX }) => maxX)),
      maxY: Math.max(...componentBounds.map(({ maxY }) => maxY)),
    },
  };
}
