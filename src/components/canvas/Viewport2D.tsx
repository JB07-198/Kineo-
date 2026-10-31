import { useSimulationStore } from '../../store/useSimulationStore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKineoStore } from '../../store/useKineoStore';
import { buildPlanarScene, type SceneLabel } from '../../model/planarScene';
import { getJointGlyph } from '../../model/jointSymbols';
import type { Vector3 } from '../../model/jsonV3';
import { geometryPath, geometryStyle, isClosedShape } from '../../model/graphics';
import { useEditorToolStore } from '../../store/useEditorToolStore';
import { localToWorld2D } from '../../model/planarCoordinates';

type Point = { x: number; y: number };
type View = { scale: number; center: Point };
type DragState =
  | { kind: 'pan'; start: Point; center: Point }
  | { kind: 'class'; id: string; startWorld: Point; position: Vector3; edited: boolean }
  | { kind: 'joint'; id: string; startWorld: Point; position: Vector3; edited: boolean }
  | { kind: 'fixation'; id: string; bodyId: string; startWorld: Point; localPoint: Vector3; edited: boolean };

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
  preview = false,
): void {
  context.save();
  context.translate(center.x, center.y);
  context.rotate(-angle);
  context.scale(scale, scale);
  context.globalAlpha = preview ? 0.6 : 1;
  context.strokeStyle = preview ? '#67e8f9' : selected ? '#ffffff' : '#cbd5e1';
  context.fillStyle = preview ? '#67e8f9' : '#ffffff';
  context.lineWidth = selected ? 2.5 : 1.8;
  if (preview) context.setLineDash([3, 2]);
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

function nearestJointAnchor(point: Point, document: ReturnType<typeof useKineoStore.getState>['document'], bodyIds: string[], radius: number): Point | null {
  const allowed = new Set(bodyIds);
  const bodies = new Map(document.classesEquivalence.map((body) => [body.id, body]));
  const candidates = document.liaisons.flatMap((joint) => {
    if (!allowed.has(joint.classA) && !allowed.has(joint.classB)) return [];
    const bodyA = bodies.get(joint.classA), bodyB = bodies.get(joint.classB);
    if (!bodyA || !bodyB) return [];
    return [
      localToWorld2D(joint.anchors.onClassA, bodyA.position ?? { x: 0, y: 0, z: 0 }, bodyA.rotation ?? 0),
      localToWorld2D(joint.anchors.onClassB, bodyB.position ?? { x: 0, y: 0, z: 0 }, bodyB.rotation ?? 0),
    ];
  });
  const nearest = candidates
    .map((candidate) => ({ point: candidate, distance: Math.hypot(candidate.x - point.x, candidate.y - point.y) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return nearest && nearest.distance <= radius ? nearest.point : null;
}

function closestPointOnSegment(point: Point, start: Point, end: Point): Point {
  const dx = end.x - start.x, dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared
    ? Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
    : 0;
  return { x: start.x + ratio * dx, y: start.y + ratio * dy };
}

function closestBodySurface(
  bodyId: string,
  point: Point,
  document: ReturnType<typeof useKineoStore.getState>['document'],
  scene: ReturnType<typeof buildPlanarScene>,
): { point: Point; distance: number; angle: number } | null {
  const body = document.classesEquivalence.find((item) => item.id === bodyId);
  if (!body) return null;
  const candidates = scene.geometry.filter((item) => item.bodyId === bodyId);
  if (!candidates.length) {
    const bodyPoint = { x: body.position?.x ?? 0, y: body.position?.y ?? 0 };
    return { point: bodyPoint, distance: Math.hypot(point.x - bodyPoint.x, point.y - bodyPoint.y), angle: 0 };
  }
  let closest: { point: Point; distance: number; angle: number } | null = null;
  for (const candidate of candidates) {
    const points = candidate.points;
    const edgeCount = isClosedShape(candidate.entity.kind) ? points.length : points.length - 1;
    for (let index = 0; index < edgeCount; index += 1) {
      const projected = closestPointOnSegment(point, points[index], points[(index + 1) % points.length]);
      const distance = Math.hypot(projected.x - point.x, projected.y - point.y);
      if (!closest || distance < closest.distance) {
        const start = points[index], end = points[(index + 1) % points.length];
        closest = { point: projected, distance, angle: Math.atan2(end.y - start.y, end.x - start.x) };
      }
    }
  }
  return closest;
}

export const Viewport2D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const hasInitialFit = useRef(false);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [placementPoint, setPlacementPoint] = useState<Point | null>(null);
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
  const tool = useEditorToolStore();

  const { preview, trace } = useSimulationStore();
  const document = preview ?? editorDocument;
  const scene = useMemo(() => buildPlanarScene(document), [document]);

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

      for (const { entity, bodyId, bodyPosition, bodyRotation } of scene.geometry) {
        const body = document.classesEquivalence.find((item) => item.id === bodyId);
        if (!body) continue;
        const active = selectedEntityType === 'Class' && selectedEntityId === body.id;
        const style = geometryStyle(entity);
        const center = worldToScreen(bodyPosition, view, width, height);
        context.save();
        context.translate(center.x, center.y);
        context.rotate(-bodyRotation);
        context.scale(view.scale, -view.scale);
        context.strokeStyle = active ? '#ffffff' : style.stroke || body.color;
        context.fillStyle = style.fill;
        context.lineWidth = Math.max(1.2, style.width + (active ? 1.5 : 0)) / view.scale;
        context.setLineDash(style.dashed ? [7 / view.scale, 5 / view.scale] : []);
        const path = new Path2D(geometryPath(entity).path);
        if (isClosedShape(entity.kind) && style.fill !== 'none') {
          context.globalAlpha = style.fillOpacity;
          context.fill(path);
          context.globalAlpha = 1;
        }
        context.stroke(path);
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
        drawJointGlyph(context, 'GROUND_FIXATION', center, marker.angle,
          selectedEntityType === 'Fixation' && selectedEntityId === marker.id, view.scale);
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

      if (scene.displayAnchors) {
        for (const joint of scene.joints) {
          for (const anchor of [joint.anchorA, joint.anchorB]) {
            const point = worldToScreen(anchor, view, width, height);
            context.beginPath();
            context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
            context.fillStyle = '#38bdf8';
            context.fill();
            context.strokeStyle = '#0f172a';
            context.lineWidth = 1;
            context.stroke();
          }
        }
      }

      for (const label of scene.labels) drawSceneLabel(context, label, view, width, height);

      if (tool.tool !== 'select' && placementPoint) {
        const fixationPoint = tool.tool === 'fixation'
          ? closestBodySurface(tool.bodyA, placementPoint, document, scene)
          : null;
        const snapped = tool.tool === 'fixation'
          ? fixationPoint && fixationPoint.distance <= 18 / view.scale ? fixationPoint.point : null
          : nearestJointAnchor(placementPoint, document, [tool.bodyA, tool.bodyB], 12 / view.scale);
        const previewCenter = worldToScreen(snapped ?? placementPoint, view, width, height);
        const previewAngle = tool.tool === 'fixation' && tool.autoOrientation && fixationPoint
          ? fixationPoint.angle
          : tool.angle;
        drawJointGlyph(context, tool.tool === 'fixation' ? 'GROUND_FIXATION' : tool.jointType,
          previewCenter, previewAngle, false, view.scale, true);
        if (snapped) {
          context.beginPath();
          context.arc(previewCenter.x, previewCenter.y, 8, 0, Math.PI * 2);
          context.strokeStyle = '#38bdf8';
          context.lineWidth = 1.5;
          context.stroke();
        }
      }
      context.fillStyle = '#64748b';
      context.font = '10px ui-sans-serif, system-ui';
      context.fillText(`Échelle ${document.meta.lengthUnit} · ${view.scale.toFixed(2)} px/${document.meta.lengthUnit}`, 12, height - 12);
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [document, scene, gridVisible, selectedEntityId, selectedEntityType, view, trace, tool.tool, tool.jointType, tool.bodyA, tool.bodyB, tool.angle, tool.autoOrientation, placementPoint]);

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
      if (isClosedShape(entity.kind) && points.length >= 3) {
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
    const worldPoint = pointerToWorld(event);
    if (tool.tool !== 'select') {
      if (preview) {
        tool.finish();
        return;
      }
    try {
      if (tool.tool === 'fixation') {
        if (!tool.bodyA) throw new Error('Ajoutez un solide avant de placer un encastrement au bâti.');
        const attachment = closestBodySurface(tool.bodyA, worldPoint, document, scene);
        if (!attachment || attachment.distance > 18 / view.scale) {
          throw new Error('Cliquez près du contour du solide sélectionné pour y attacher la fixation.');
        }
        const snapPoint: Vector3 = { ...attachment.point, z: 0 };
        useKineoStore.getState().fixBody(tool.bodyA, snapPoint,
          tool.autoOrientation ? attachment.angle : tool.angle,
          tool.autoOrientation ? 'automatic' : 'manual');
      } else {
        const snap = nearestJointAnchor(worldPoint, document, [tool.bodyA, tool.bodyB], 12 / view.scale);
        const snapPoint: Vector3 = { ...(snap ?? worldPoint), z: 0 };
        useKineoStore.getState().addJoint(tool.jointType, tool.bodyA, tool.bodyB, snapPoint, tool.angle);
      }
      tool.report('');
      } catch (error) {
        tool.report(error instanceof Error ? error.message : 'Placement impossible.');
      }
      setPlacementPoint(worldPoint);
      return;
    }
    const hitFixation = [...buildPlanarScene(document).groundMarkers].reverse().find((marker) => {
      const screen = worldToScreen(marker.center, view, rect.width, rect.height);
      return Math.hypot(screen.x - localPoint.x, screen.y - localPoint.y) <= 18;
    });
    if (hitFixation) {
      selectEntity(hitFixation.id, hitFixation.fixation ? 'Fixation' : 'Class');
      if (preview) return;
      const body = document.classesEquivalence.find((item) => item.id === hitFixation.bodyId);
      if (body?.groundFixation) {
        dragRef.current = {
          kind: 'fixation',
          id: hitFixation.id,
          bodyId: body.id,
          startWorld: worldPoint,
          localPoint: body.groundFixation.localPoint,
          edited: false,
        };
        canvas.setPointerCapture(event.pointerId);
      }
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
    const world = pointerToWorld(event);
    if (tool.tool !== 'select') setPlacementPoint(world);
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
    if (drag.kind === 'fixation') {
      if (!drag.edited) {
        beginEdit();
        drag.edited = true;
      }
      const body = document.classesEquivalence.find((item) => item.id === drag.bodyId);
      if (!body) return;
      const angle = body.rotation ?? 0;
      const surface = closestBodySurface(body.id, world, document, scene);
      const point = surface?.point ?? world;
      const dx = point.x - (body.position?.x ?? 0), dy = point.y - (body.position?.y ?? 0);
      useKineoStore.getState().updateFixation(drag.id, {
        localPoint: { x: dx * Math.cos(angle) + dy * Math.sin(angle), y: -dx * Math.sin(angle) + dy * Math.cos(angle), z: 0 },
        ...(body.groundFixation?.orientationMode === 'automatic' && surface
          ? { angle: surface.angle - angle }
          : {}),
      }, false);
      return;
    }
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
        {tool.tool !== 'select'
          ? `${tool.tool === 'fixation' ? 'Encastrement au bâti' : 'Placement de liaison'} · cliquer pour placer · Échap pour terminer`
          : preview ? 'Prévisualisation calculée · sélection active · Maj + glisser : vue · Molette : zoomer' : 'Glisser : déplacer · Maj + glisser : translater la vue · Molette : zoomer'}
      </div>
    </div>
  );
};
