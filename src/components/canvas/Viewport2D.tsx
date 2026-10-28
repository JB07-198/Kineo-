import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useKineoStore } from '../../store/useKineoStore';
import { localToWorld2D, quaternionYaw } from '../../model/planarCoordinates';
import type { GeometryEntity, Quaternion, Vector3 } from '../../model/jsonV3';

type Point = { x: number; y: number };
type View = { scale: number; center: Point };
type DragState =
  | { kind: 'pan'; start: Point; center: Point }
  | { kind: 'class'; id: string; startWorld: Point; position: Vector3; edited: boolean }
  | { kind: 'joint'; id: string; startWorld: Point; position: Vector3; edited: boolean };

const INITIAL_VIEW: View = { scale: 0.9, center: { x: 105, y: 0 } };

function worldToScreen(point: Point, view: View, width: number, height: number): Point {
  return {
    x: (point.x - view.center.x) * view.scale + width / 2,
    y: height / 2 - (point.y - view.center.y) * view.scale,
  };
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - start.x - ratio * dx, point.y - start.y - ratio * dy);
}

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y) &&
      point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) /
        (previousPoint.y - currentPoint.y) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function entityWorldPoints(entity: GeometryEntity, position: Vector3, rotation: number): Point[] {
  const localPoints = entity.localPoints;
  if (entity.kind === 'rectangle' && localPoints.length >= 2) {
    const first = localPoints[0];
    const second = localPoints[1];
    const left = Math.min(first.x, second.x);
    const right = Math.max(first.x, second.x);
    const bottom = Math.min(first.y, second.y);
    const top = Math.max(first.y, second.y);
    return [
      { x: left, y: bottom },
      { x: right, y: bottom },
      { x: right, y: top },
      { x: left, y: top },
    ].map((point) => localToWorld2D({ ...point, z: 0 }, position, rotation));
  }
  return localPoints.map((point) => localToWorld2D(point, position, rotation));
}

function drawJointSymbol(
  context: CanvasRenderingContext2D,
  type: string,
  center: Point,
  selected: boolean,
  orientation: Quaternion,
): void {
  const { x, y } = center;
  context.save();
  context.translate(x, y);
  context.rotate(-quaternionYaw(orientation));
  context.strokeStyle = selected ? '#f8fafc' : '#cbd5e1';
  context.fillStyle = '#0f172a';
  context.lineWidth = selected ? 2.5 : 1.8;
  context.beginPath();
  if (type === 'PIVOT') {
    context.arc(0, 0, 7, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 2, 0, Math.PI * 2);
    context.fillStyle = '#cbd5e1';
    context.fill();
  } else if (type === 'GLISSIERE') {
    context.moveTo(-12, -6);
    context.lineTo(12, -6);
    context.moveTo(-12, 6);
    context.lineTo(12, 6);
    context.stroke();
    context.strokeRect(-5, -4, 10, 8);
  } else if (type === 'PIVOT_GLISSANT') {
    context.moveTo(-13, -7);
    context.lineTo(13, -7);
    context.moveTo(-13, 7);
    context.lineTo(13, 7);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (type === 'ROTULE') {
    context.arc(0, 0, 8, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 3, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else if (type === 'APPUI_PLAN') {
    context.moveTo(-12, -2);
    context.lineTo(12, -2);
    context.moveTo(-7, 8);
    context.lineTo(0, 0);
    context.lineTo(7, 8);
    context.closePath();
    context.stroke();
  } else if (type === 'HELICOIDALE') {
    context.arc(0, 0, 7, 0, Math.PI * 2);
    context.moveTo(-9, 9);
    context.lineTo(9, -9);
    context.stroke();
  } else {
    context.moveTo(-9, -8);
    context.lineTo(9, -8);
    context.moveTo(-9, -4);
    context.lineTo(9, -4);
    context.moveTo(0, -4);
    context.lineTo(0, 10);
    context.stroke();
  }
  context.restore();
}

export const Viewport2D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const hasInitialFit = useRef(false);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const {
    document,
    selectedEntityId,
    selectedEntityType,
    selectEntity,
    gridVisible,
    snapEnabled,
    toggleGrid,
    toggleSnap,
    beginEdit,
    moveClass,
    moveJoint,
  } = useKineoStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const render = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      if (!width || !height) return;
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#020617';
      context.fillRect(0, 0, width, height);

      const gridStep = view.scale * 10 < 12 ? 50 : view.scale * 10 < 25 ? 20 : 10;
      if (gridVisible) {
        const left = view.center.x - width / (2 * view.scale);
        const right = view.center.x + width / (2 * view.scale);
        const bottom = view.center.y - height / (2 * view.scale);
        const top = view.center.y + height / (2 * view.scale);
        const startX = Math.floor(left / gridStep) * gridStep;
        const startY = Math.floor(bottom / gridStep) * gridStep;
        context.beginPath();
        context.strokeStyle = '#172033';
        context.lineWidth = 1;
        for (let x = startX; x <= right; x += gridStep) {
          const screenX = worldToScreen({ x, y: 0 }, view, width, height).x;
          context.moveTo(screenX, 0);
          context.lineTo(screenX, height);
        }
        for (let y = startY; y <= top; y += gridStep) {
          const screenY = worldToScreen({ x: 0, y }, view, width, height).y;
          context.moveTo(0, screenY);
          context.lineTo(width, screenY);
        }
        context.stroke();
      }

      const origin = worldToScreen({ x: 0, y: 0 }, view, width, height);
      context.lineWidth = 1.5;
      context.strokeStyle = '#ef4444';
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(origin.x + 42, origin.y);
      context.stroke();
      context.strokeStyle = '#22c55e';
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(origin.x, origin.y - 42);
      context.stroke();
      context.fillStyle = '#cbd5e1';
      context.font = '11px ui-sans-serif, system-ui';
      context.fillText('X', origin.x + 44, origin.y + 4);
      context.fillText('Y', origin.x - 4, origin.y - 46);

      for (const entity of document.geometry.entities) {
        const body = document.classesEquivalence.find((item) => item.id === entity.classId);
        if (!body) continue;
        const bodyPosition = body.position ?? { x: 0, y: 0, z: 0 };
        const points = entityWorldPoints(entity, bodyPosition, body.rotation ?? 0)
          .map((point) => worldToScreen(point, view, width, height));
        if (!points.length) continue;
        const active = selectedEntityType === 'Class' && selectedEntityId === body.id;
        context.save();
        context.strokeStyle = active ? '#f8fafc' : entity.style.color || body.color;
        context.fillStyle = entity.style.color || body.color;
        context.lineWidth = Math.max(1.5, entity.style.width + (active ? 2 : 0));
        context.setLineDash(entity.style.stroke === 'dashed' ? [7, 5] : []);
        context.beginPath();
        if (entity.kind === 'rectangle' && points.length >= 4) {
          context.moveTo(points[0].x, points[0].y);
          points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
          context.closePath();
          context.globalAlpha = 0.18;
          context.fill();
          context.globalAlpha = 1;
        } else {
          context.moveTo(points[0].x, points[0].y);
          points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        }
        context.stroke();
        context.setLineDash([]);
        const labelCenter = points.reduce(
          (center, point) => ({ x: center.x + point.x / points.length, y: center.y + point.y / points.length }),
          { x: 0, y: 0 },
        );
        const labelPoint = {
          x: labelCenter.x,
          y: (entity.kind === 'rectangle' ? Math.min(...points.map(({ y }) => y)) : labelCenter.y) - 12,
        };
        context.font = '11px ui-sans-serif, system-ui';
        context.fillStyle = active ? '#f8fafc' : '#cbd5e1';
        context.fillText(body.name, labelPoint.x + 6, labelPoint.y - 7);
        context.restore();
      }

      for (const joint of document.liaisons) {
        const position = worldToScreen(joint.position, view, width, height);
        drawJointSymbol(context, joint.type, position, selectedEntityType === 'Joint' && selectedEntityId === joint.id, joint.orientation);
      }

      context.fillStyle = '#64748b';
      context.font = '10px ui-sans-serif, system-ui';
      context.fillText(`Échelle ${document.meta.lengthUnit} · ${view.scale.toFixed(2)} px/${document.meta.lengthUnit}`, 12, height - 12);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [document, gridVisible, selectedEntityId, selectedEntityType, view]);

  const fitToScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const points: Point[] = [];
    for (const entity of document.geometry.entities) {
      const body = document.classesEquivalence.find((item) => item.id === entity.classId);
      if (body) points.push(...entityWorldPoints(entity, body.position ?? { x: 0, y: 0, z: 0 }, body.rotation ?? 0));
    }
    points.push(...document.liaisons.map((joint) => joint.position));
    if (!points.length) {
      setView(INITIAL_VIEW);
      return;
    }
    const minX = Math.min(...points.map(({ x }) => x));
    const maxX = Math.max(...points.map(({ x }) => x));
    const minY = Math.min(...points.map(({ y }) => y));
    const maxY = Math.max(...points.map(({ y }) => y));
    const spanX = Math.max(maxX - minX, 40);
    const spanY = Math.max(maxY - minY, 40);
    const scale = Math.max(0.25, Math.min(8, Math.min((bounds.width * 0.75) / spanX, (bounds.height * 0.7) / spanY)));
    setView({ scale, center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } });
  }, [document]);

  useEffect(() => {
    if (hasInitialFit.current) return;
    hasInitialFit.current = true;
    const frame = window.requestAnimationFrame(fitToScene);
    return () => window.cancelAnimationFrame(frame);
  }, [fitToScene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setView((current) => {
        const anchor = {
          x: (cursor.x - rect.width / 2) / current.scale + current.center.x,
          y: -(cursor.y - rect.height / 2) / current.scale + current.center.y,
        };
        const scale = Math.max(0.25, Math.min(12, current.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12)));
        return {
          scale,
          center: {
            x: anchor.x - (cursor.x - rect.width / 2) / scale,
            y: anchor.y + (cursor.y - rect.height / 2) / scale,
          },
        };
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const pointerToWorld = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - rect.width / 2) / view.scale + view.center.x,
      y: -(event.clientY - rect.top - rect.height / 2) / view.scale + view.center.y,
    };
  };

  const hitTestClass = (screenPoint: Point): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    for (const entity of [...document.geometry.entities].reverse()) {
      const body = document.classesEquivalence.find((item) => item.id === entity.classId);
      if (!body) continue;
      const points = entityWorldPoints(entity, body.position ?? { x: 0, y: 0, z: 0 }, body.rotation ?? 0)
        .map((point) => worldToScreen(point, view, bounds.width, bounds.height));
      if (entity.kind === 'rectangle' && points.length >= 4) {
        if (isPointInPolygon(screenPoint, points) ||
            points.some((point, index) => distanceToSegment(screenPoint, point, points[(index + 1) % points.length]) <= 8)) {
          return body.id;
        }
      } else {
        for (let index = 1; index < points.length; index += 1) {
          if (distanceToSegment(screenPoint, points[index - 1], points[index]) <= 9) return body.id;
        }
      }
    }
    return null;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const localPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (event.button === 1 || event.button === 2 || event.shiftKey) {
      dragRef.current = { kind: 'pan', start: localPoint, center: view.center };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    const hitJoint = [...document.liaisons].reverse().find((joint) => {
      const screen = worldToScreen(joint.position, view, rect.width, rect.height);
      return Math.hypot(screen.x - localPoint.x, screen.y - localPoint.y) <= 12;
    });
    if (hitJoint) {
      selectEntity(hitJoint.id, 'Joint');
      dragRef.current = { kind: 'joint', id: hitJoint.id, startWorld: pointerToWorld(event), position: hitJoint.position, edited: false };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    const classId = hitTestClass(localPoint);
    if (classId) {
      selectEntity(classId, 'Class');
      const body = document.classesEquivalence.find((item) => item.id === classId);
      if (body && !body.isFixed) {
        dragRef.current = {
          kind: 'class',
          id: classId,
          startWorld: pointerToWorld(event),
          position: body.position ?? { x: 0, y: 0, z: 0 },
          edited: false,
        };
        canvas.setPointerCapture(event.pointerId);
      }
      return;
    }
    selectEntity(null, null);
    dragRef.current = null;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const localPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (drag.kind === 'pan') {
      setView((current) => ({
        ...current,
        center: {
          x: drag.center.x - (localPoint.x - drag.start.x) / current.scale,
          y: drag.center.y + (localPoint.y - drag.start.y) / current.scale,
        },
      }));
      return;
    }
    const world = pointerToWorld(event);
    const delta = { x: world.x - drag.startWorld.x, y: world.y - drag.startWorld.y };
    const snap = (value: number) => snapEnabled ? Math.round(value / 10) * 10 : value;
    const position = { ...drag.position, x: snap(drag.position.x + delta.x), y: snap(drag.position.y + delta.y) };
    if (!drag.edited && position.x === drag.position.x && position.y === drag.position.y) return;
    if (!drag.edited) {
      beginEdit();
      drag.edited = true;
    }
    if (drag.kind === 'class') moveClass(drag.id, position);
    else moveJoint(drag.id, position);
  };

  const endDrag = () => { dragRef.current = null; };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none cursor-crosshair"
        aria-label="Scène mécanique 2D interactive"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onContextMenu={(event) => event.preventDefault()}
      />
      <div className="absolute left-3 top-3 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/95 p-1 shadow-lg">
        <button className={`viewport-button ${gridVisible ? 'viewport-button-active' : ''}`} onClick={toggleGrid} title="Afficher ou masquer la grille">
          Grille
        </button>
        <button className={`viewport-button ${snapEnabled ? 'viewport-button-active' : ''}`} onClick={toggleSnap} title="Activer ou désactiver l'aimantation">
          Aimantation
        </button>
        <span className="mx-1 h-5 border-l border-slate-700" />
        <button className="viewport-button" onClick={() => setView((current) => ({ ...current, scale: Math.max(0.25, current.scale / 1.2) }))} title="Zoom arrière">−</button>
        <span className="min-w-12 text-center text-[10px] text-slate-400">{Math.round(view.scale * 100)}%</span>
        <button className="viewport-button" onClick={() => setView((current) => ({ ...current, scale: Math.min(12, current.scale * 1.2) }))} title="Zoom avant">+</button>
        <button className="viewport-button" onClick={fitToScene}>Ajuster</button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-slate-900/80 px-2 py-1 text-[10px] text-slate-500">
        Glisser : déplacer · Maj + glisser : translater la vue · Molette : zoomer
      </div>
    </div>
  );
};
