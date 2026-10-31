import { useSimulationStore } from '../../store/useSimulationStore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useKineoStore } from '../../store/useKineoStore';
import { buildPlanarScene, type SceneLabel } from '../../model/planarScene';
import { getJointGlyph } from '../../model/jointSymbols';
import type { Vector3 } from '../../model/jsonV3';

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

function drawJointGlyph(
  context: CanvasRenderingContext2D,
  type: string,
  center: Point,
  angle: number,
  selected: boolean,
  scale: number,
): void {
  context.save();
  context.translate(center.x, center.y);
  context.rotate(-angle);
  context.scale(scale, scale);
  context.strokeStyle = selected ? '#ffffff' : '#cbd5e1';
  context.fillStyle = '#ffffff';
  context.lineWidth = selected ? 2.5 : 1.8;
  for (const shape of getJointGlyph(type)) {
    context.beginPath();
    if (shape.kind === 'circle') {
      context.arc(0, 0, shape.radius, 0, Math.PI * 2);
      if (shape.filled) context.fill();
      context.stroke();
    } else {
      context.moveTo(shape.points[0].x, -shape.points[0].y);
      for (const point of shape.points.slice(1)) context.lineTo(point.x, -point.y);
      if (shape.closed) context.closePath();
      if (shape.filled) context.fill();
      context.stroke();
    }
  }
  context.restore();
}

function drawSceneLabel(context: CanvasRenderingContext2D, label: SceneLabel, view: View, width: number, height: number): void {
  const topLeft = worldToScreen({ x: label.bounds.minX, y: label.bounds.maxY }, view, width, height);
  const bottomRight = worldToScreen({ x: label.bounds.maxX, y: label.bounds.minY }, view, width, height);
  const anchor = worldToScreen(label.anchor, view, width, height);
  const labelWidth = bottomRight.x - topLeft.x;
  const labelHeight = bottomRight.y - topLeft.y;
  const labelCenter = { x: topLeft.x + labelWidth / 2, y: topLeft.y + labelHeight / 2 };
  if (label.kind === 'warning' && Math.hypot(anchor.x - labelCenter.x, anchor.y - labelCenter.y) > 50 * view.scale) {
    context.beginPath();
    context.strokeStyle = label.kind === 'warning' ? '#fb7185' : '#64748b';
    context.setLineDash([3, 3]);
    context.moveTo(anchor.x, anchor.y);
    context.lineTo(labelCenter.x, labelCenter.y);
    context.stroke();
    context.setLineDash([]);
  }
  context.fillStyle = label.kind === 'warning' ? '#fff1f2' : '#0f172a';
  context.strokeStyle = label.kind === 'warning' ? '#be123c' : '#475569';
  context.lineWidth = 0.8;
  context.beginPath();
  context.roundRect(topLeft.x, topLeft.y, labelWidth, labelHeight, 3);
  context.fill();
  context.stroke();
  context.fillStyle = label.kind === 'warning' ? '#9f1239' : '#f8fafc';
  context.font = `${11 * view.scale}px ui-sans-serif, system-ui`;
  context.textBaseline = 'top';
  context.fillText(label.text, topLeft.x + 4 * view.scale, topLeft.y + 2 * view.scale);
}

export const Viewport2D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const hasInitialFit = useRef(false);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const {
    document: editorDocument,
    documentRevision,
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

  const { preview, trace } = useSimulationStore();
  const document = preview ?? editorDocument;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const scene = buildPlanarScene(document);

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

      for (const { entity, bodyId, points: worldPoints } of scene.geometry) {
        const body = document.classesEquivalence.find((item) => item.id === bodyId);
        if (!body) continue;
        const points = worldPoints.map((point) => worldToScreen(point, view, width, height));
        if (!points.length) continue;
        const active = selectedEntityType === 'Class' && selectedEntityId === body.id;
        context.save();
        context.strokeStyle = active ? '#ffffff' : entity.style.color || body.color;
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
        context.restore();
      }

      if (trace.length) {
        context.beginPath(); context.strokeStyle = '#22d3ee'; context.lineWidth = 2;
        trace.forEach((point, index) => {
          const p = worldToScreen(point, view, width, height);
          if (index === 0) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y);
        });
        context.stroke();
        const current = worldToScreen(trace[trace.length - 1], view, width, height);
        context.beginPath(); context.arc(current.x, current.y, 4, 0, Math.PI * 2); context.fillStyle = '#22d3ee'; context.fill();
      }

      for (const marker of scene.groundMarkers) {
        const center = worldToScreen(marker.center, view, width, height);
        context.save();
        context.translate(center.x, center.y);
        context.rotate(-marker.angle);
        context.strokeStyle = '#cbd5e1';
        context.lineWidth = 1.6;
        context.beginPath();
        context.moveTo(-14, 0);
        context.lineTo(14, 0);
        for (let x = -10; x <= 10; x += 5) {
          context.moveTo(x, 4);
          context.lineTo(x - 4, 11);
        }
        context.stroke();
        context.restore();
      }

      for (const joint of scene.joints) {
        const center = worldToScreen(joint.center, view, width, height);
        const anchorA = worldToScreen(joint.anchorA, view, width, height);
        const anchorB = worldToScreen(joint.anchorB, view, width, height);
        const inconsistent = joint.mismatch > 1e-6;
        context.save();
        context.strokeStyle = inconsistent ? '#fb7185' : '#94a3b8';
        context.lineWidth = 1;
        context.setLineDash([4, 4]);
        for (const anchor of joint.type === 'APPUI_PLAN' || (['GLISSIERE', 'PIVOT_GLISSANT'].includes(joint.type) && !inconsistent) ? [] : [anchorA, anchorB]) {
          if (Math.hypot(anchor.x - center.x, anchor.y - center.y) > 0.5) {
            context.beginPath();
            context.moveTo(anchor.x, anchor.y);
            context.lineTo(center.x, center.y);
            context.stroke();
          }
        }
        if (inconsistent) {
          context.strokeStyle = '#fb7185';
          context.lineWidth = 2;
          context.beginPath();
          context.moveTo(anchorA.x, anchorA.y);
          context.lineTo(anchorB.x, anchorB.y);
          context.stroke();
        }
        context.setLineDash([]);
        if (joint.type === 'PIVOT') {
          context.beginPath();
          context.arc(anchorA.x, anchorA.y, 3.5, 0, Math.PI * 2);
          context.fillStyle = '#f8fafc';
          context.fill();
          context.strokeStyle = '#0f172a';
          context.stroke();
          context.beginPath();
          context.arc(anchorB.x, anchorB.y, 2, 0, Math.PI * 2);
          context.fillStyle = '#0f172a';
          context.fill();
          context.strokeStyle = '#f8fafc';
          context.stroke();
        }
        context.restore();
      }

      const jointSymbols = [...scene.joints].sort((first, second) =>
        Number(first.type === 'PIVOT') - Number(second.type === 'PIVOT'));
      for (const joint of jointSymbols) {
        const center = worldToScreen(joint.center, view, width, height);
        drawJointGlyph(context, joint.type, center, joint.angle, selectedEntityType === 'Joint' && selectedEntityId === joint.id, view.scale);
      }

      for (const label of scene.labels) drawSceneLabel(context, label, view, width, height);
      if (scene.empty) {
        context.fillStyle = '#94a3b8';
        context.font = '14px ui-sans-serif, system-ui';
        context.textAlign = 'center';
        context.fillText('Document vide — ajoutez un solide pour commencer', width / 2, height / 2);
        context.textAlign = 'start';
      }
      context.fillStyle = '#64748b';
      context.font = '10px ui-sans-serif, system-ui';
      context.fillText(`Échelle ${document.meta.lengthUnit} · ${view.scale.toFixed(2)} px/${document.meta.lengthUnit}`, 12, height - 12);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [document, gridVisible, selectedEntityId, selectedEntityType, view, trace]);

  const fitToScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const scene = buildPlanarScene(document);
    if (scene.empty) {
      setView(INITIAL_VIEW);
      return;
    }
    const { minX, maxX, minY, maxY } = scene.bounds;
    const spanX = Math.max(maxX - minX, 40);
    const spanY = Math.max(maxY - minY, 40);
    const scale = Math.max(0.25, Math.min(8, Math.min((bounds.width * 0.75) / spanX, (bounds.height * 0.7) / spanY)));
    setView({ scale, center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } });
  }, [document]);

  useEffect(() => {
    if (hasInitialFit.current) return;
    const frame = window.requestAnimationFrame(() => { hasInitialFit.current = true; fitToScene(); });
    return () => window.cancelAnimationFrame(frame);
  }, [fitToScene]);

  const lastRevision = useRef(documentRevision);
  useEffect(() => {
    if (lastRevision.current === documentRevision) return;
    lastRevision.current = documentRevision;
    const frame = window.requestAnimationFrame(fitToScene);
    return () => window.cancelAnimationFrame(frame);
  }, [documentRevision, fitToScene]);

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
    for (const { entity, bodyId, points: worldPoints } of [...buildPlanarScene(document).geometry].reverse()) {
      const points = worldPoints
        .map((point) => worldToScreen(point, view, bounds.width, bounds.height));
      if (entity.kind === 'rectangle' && points.length >= 4) {
        if (isPointInPolygon(screenPoint, points) ||
            points.some((point, index) => distanceToSegment(screenPoint, point, points[(index + 1) % points.length]) <= 8)) {
          return bodyId;
        }
      } else {
        for (let index = 1; index < points.length; index += 1) {
          if (distanceToSegment(screenPoint, points[index - 1], points[index]) <= 9) return bodyId;
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
      if (preview) return;
      dragRef.current = { kind: 'joint', id: hitJoint.id, startWorld: pointerToWorld(event), position: hitJoint.position, edited: false };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    const classId = hitTestClass(localPoint);
    if (classId) {
      selectEntity(classId, 'Class');
      const body = document.classesEquivalence.find((item) => item.id === classId);
      if (body && !body.isFixed && !preview) {
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
        {preview ? 'Prévisualisation calculée · sélection active · Maj + glisser : vue · Molette : zoomer' : 'Glisser : déplacer · Maj + glisser : translater la vue · Molette : zoomer'}
      </div>
    </div>
  );
};
