export interface Point2 { x: number; y: number }
export interface Pose2 extends Point2 { theta: number }
export const rotate = (p: Point2, angle: number): Point2 => ({
  x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
  y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
});
export const toWorld = (local: Point2, pose: Pose2): Point2 => {
  const p = rotate(local, pose.theta); return { x: p.x + pose.x, y: p.y + pose.y };
};
export const toLocal = (world: Point2, pose: Pose2): Point2 => rotate({ x: world.x - pose.x, y: world.y - pose.y }, -pose.theta);
export const angleDifference = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
