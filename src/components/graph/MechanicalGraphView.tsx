import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { layoutMechanicalGraph, type GraphBounds, type GraphPoint } from '../../model/graphLayout';
import { buildMechanicalGraph } from '../../model/mechanicalGraph';
import { useKineoStore } from '../../store/useKineoStore';

interface Camera {
  scale: number;
  center: GraphPoint;
}

interface ViewportSize {
  width: number;
  height: number;
}

function screenPoint(point: GraphPoint, camera: Camera, size: ViewportSize): GraphPoint {
  return {
    x: size.width / 2 + (point.x - camera.center.x) * camera.scale,
    y: size.height / 2 - (point.y - camera.center.y) * camera.scale,
  };
}

function screenBounds(bounds: GraphBounds, camera: Camera, size: ViewportSize): GraphBounds {
  const topLeft = screenPoint({ x: bounds.minX, y: bounds.maxY }, camera, size);
  const bottomRight = screenPoint({ x: bounds.maxX, y: bounds.minY }, camera, size);
  return { minX: topLeft.x, minY: topLeft.y, maxX: bottomRight.x, maxY: bottomRight.y };
}

export const MechanicalGraphView: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const panRef = useRef<{ clientX: number; clientY: number; center: GraphPoint } | null>(null);
  const lastFitKeyRef = useRef('');
  const { document, selectedEntityId, selectedEntityType, selectEntity } = useKineoStore();
  const [size, setSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>({ scale: 1, center: { x: 0, y: 0 } });
  const graph = useMemo(
    () => buildMechanicalGraph(document),
    [document],
  );
  const layout = useMemo(() => layoutMechanicalGraph(graph), [graph]);
  const topologyKey = JSON.stringify({
    nodes: graph.nodes.map(({ id }) => id),
    edges: graph.edges.map(({ id, source, target }) => [id, source, target]),
  });

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitGraph = useCallback(() => {
    if (!size.width || !size.height) return;
    const { bounds } = layout;
    const spanX = Math.max(bounds.maxX - bounds.minX, 100);
    const spanY = Math.max(bounds.maxY - bounds.minY, 100);
    setCamera({
      scale: Math.max(0.2, Math.min(1.5, Math.min(size.width * 0.82 / spanX, size.height * 0.78 / spanY))),
      center: { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 },
    });
  }, [layout, size]);

  useEffect(() => {
    if (!size.width || !size.height || lastFitKeyRef.current === topologyKey) return;
    lastFitKeyRef.current = topologyKey;
    fitGraph();
  }, [fitGraph, size, topologyKey]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setCamera((current) => {
        const anchor = {
          x: (cursor.x - rect.width / 2) / current.scale + current.center.x,
          y: -(cursor.y - rect.height / 2) / current.scale + current.center.y,
        };
        const scale = Math.max(0.2, Math.min(3, current.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
        return {
          scale,
          center: {
            x: anchor.x - (cursor.x - rect.width / 2) / scale,
            y: anchor.y + (cursor.y - rect.height / 2) / scale,
          },
        };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const screenPositions = useMemo(
    () => new Map([...layout.positions].map(([id, point]) => [id, screenPoint(point, camera, size)])),
    [camera, layout, size],
  );

  const beginPan = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.target !== svgRef.current) return;
    panRef.current = { clientX: event.clientX, clientY: event.clientY, center: camera.center };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const continuePan = (event: React.PointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    setCamera((current) => ({
      ...current,
      center: {
        x: pan.center.x - (event.clientX - pan.clientX) / current.scale,
        y: pan.center.y + (event.clientY - pan.clientY) / current.scale,
      },
    }));
  };

  const componentRects = layout.componentBounds.map((bounds) => screenBounds(bounds, camera, size));
  const edgeGroups = new Map<string, typeof graph.edges>();
  for (const edge of graph.edges) {
    const pair = [edge.source, edge.target].sort((left, right) => left.localeCompare(right));
    const key = JSON.stringify(pair);
    edgeGroups.set(key, [...(edgeGroups.get(key) ?? []), edge]);
  }

  return (
    <div ref={viewportRef} className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-950" aria-label="Vue du graphe mécanique">
      <svg
        ref={svgRef}
        className="block h-full w-full touch-none"
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="application"
        aria-label="Graphe de connectivité mécanique"
        onPointerDown={beginPan}
        onPointerMove={continuePan}
        onPointerUp={() => { panRef.current = null; }}
        onPointerCancel={() => { panRef.current = null; }}
      >
        <rect width={size.width} height={size.height} fill="#020617" pointerEvents="none" />
        {graph.components.length > 1 && componentRects.map((bounds, index) => (
          <g key={`component-${index}`} pointerEvents="none">
            <rect
              x={bounds.minX}
              y={bounds.minY}
              width={bounds.maxX - bounds.minX}
              height={bounds.maxY - bounds.minY}
              rx="12"
              fill="#0f172a"
              fillOpacity="0.35"
              stroke="#334155"
              strokeDasharray="5 6"
            />
            <text x={bounds.minX + 10} y={bounds.minY + 18} fill="#64748b" fontSize="11">
              Composante {index + 1}
            </text>
          </g>
        ))}
        {graph.edges.map((edge) => {
          const start = screenPositions.get(edge.source);
          const end = screenPositions.get(edge.target);
          if (!start || !end) return null;
          const pair = [edge.source, edge.target].sort((left, right) => left.localeCompare(right));
          const group = edgeGroups.get(JSON.stringify(pair)) ?? [edge];
          const index = group.findIndex(({ id }) => id === edge.id);
          const offset = (index - (group.length - 1) / 2) * 28;
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const length = Math.max(Math.hypot(dx, dy), 1);
          const control = {
            x: (start.x + end.x) / 2 - dy / length * offset,
            y: (start.y + end.y) / 2 + dx / length * offset,
          };
          const label = {
            x: (start.x + 2 * control.x + end.x) / 4,
            y: (start.y + 2 * control.y + end.y) / 4,
          };
          const selected = selectedEntityType === 'Joint' && selectedEntityId === edge.id;
          return (
            <g
              key={edge.id}
              role="button"
              tabIndex={0}
              aria-label={`Liaison ${edge.name}, type ${edge.type}, ${edge.source} vers ${edge.target}`}
              data-entity-id={edge.id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => selectEntity(edge.id, 'Joint')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectEntity(edge.id, 'Joint');
                }
              }}
              className="cursor-pointer outline-none"
            >
              <path
                d={`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`}
                fill="none"
                stroke="transparent"
                strokeWidth="18"
              />
              <path
                d={`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`}
                fill="none"
                stroke={selected ? '#f8fafc' : '#64748b'}
                strokeWidth={selected ? 3.5 : 2}
              />
              <rect x={label.x - 42} y={label.y - 11} width="84" height="22" rx="6" fill="#020617" stroke="#334155" />
              <text x={label.x} y={label.y + 4} textAnchor="middle" fill={selected ? '#f8fafc' : '#cbd5e1'} fontSize="10">
                {edge.type}
              </text>
            </g>
          );
        })}
        {graph.nodes.map((node) => {
          const point = screenPositions.get(node.id);
          if (!point) return null;
          const selected = selectedEntityType === 'Class' && selectedEntityId === node.id;
          const isolated = graph.isolatedNodeIds.includes(node.id);
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`Solide ${node.name}, identifiant ${node.id}${node.isFixed ? ', bâti fixe' : ''}${isolated ? ', isolé' : ''}`}
              data-entity-id={node.id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => selectEntity(node.id, 'Class')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectEntity(node.id, 'Class');
                }
              }}
              className="cursor-pointer outline-none"
            >
              {node.isFixed && <circle cx={point.x} cy={point.y} r="46" fill="none" stroke="#34d399" strokeWidth="2" />}
              <circle
                cx={point.x}
                cy={point.y}
                r="40"
                fill={node.color}
                fillOpacity="0.25"
                stroke={selected ? '#f8fafc' : node.isFixed ? '#34d399' : node.color}
                strokeWidth={selected ? 4 : 2.5}
              />
              <text x={point.x} y={point.y + 5} textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="700">
                {node.name.length > 14 ? `${node.name.slice(0, 12)}…` : node.name}
              </text>
              <text x={point.x} y={point.y + 60} textAnchor="middle" fill="#cbd5e1" fontSize="11">{node.id}</text>
              {node.isFixed && <text x={point.x} y={point.y - 51} textAnchor="middle" fill="#6ee7b7" fontSize="10">BÂTI</text>}
              {isolated && <text x={point.x} y={point.y - 61} textAnchor="middle" fill="#fbbf24" fontSize="10">ISOLÉ</text>}
            </g>
          );
        })}
        {graph.nodes.length === 0 && size.width > 0 && (
          <text x={size.width / 2} y={size.height / 2} textAnchor="middle" fill="#64748b" fontSize="14">
            Aucun solide dans le mécanisme
          </text>
        )}
      </svg>
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/95 p-1.5 shadow-lg">
        <span className="px-1 text-[10px] text-slate-300">{graph.statistics.nodeCount} solides · {graph.statistics.edgeCount} liaisons</span>
        <button className="viewport-button" onClick={() => setCamera((current) => ({ ...current, scale: Math.max(0.2, current.scale / 1.2) }))} aria-label="Zoom arrière du graphe">−</button>
        <span className="min-w-10 text-center text-[10px] text-slate-400">{Math.round(camera.scale * 100)}%</span>
        <button className="viewport-button" onClick={() => setCamera((current) => ({ ...current, scale: Math.min(3, current.scale * 1.2) }))} aria-label="Zoom avant du graphe">+</button>
        <button className="viewport-button" onClick={fitGraph}>Ajuster</button>
      </div>
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded bg-slate-900/90 px-2 py-1 text-[10px] text-slate-400">
        <span>{graph.statistics.componentCount} composantes</span>
        <span>{graph.statistics.isolatedNodeCount} isolés</span>
        <span>{graph.statistics.parallelConnectionCount} liaisons parallèles</span>
        <span>{graph.statistics.hasCycles ? `${graph.statistics.cycleRank} cycle(s) indépendant(s)` : 'Aucun cycle'}</span>
        <span>Topologie uniquement — aucun calcul de mobilité</span>
      </div>
    </div>
  );
};
