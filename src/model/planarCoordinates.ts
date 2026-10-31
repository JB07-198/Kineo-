import type { Quaternion, Vector3 } from './jsonV3';

export interface PlanarPoint {
  x: number;
  y: number;
}

export function localToWorld2D(local: Vector3, position: Vector3, rotation: number): PlanarPoint {
  return {
    x: position.x + local.x * Math.cos(rotation) - local.y * Math.sin(rotation),
    y: position.y + local.x * Math.sin(rotation) + local.y * Math.cos(rotation),
  };
}

export function quaternionYaw(orientation: Quaternion): number {
  return Math.atan2(
    2 * (orientation.w * orientation.z + orientation.x * orientation.y),
    1 - 2 * (orientation.y * orientation.y + orientation.z * orientation.z),
  );
}
