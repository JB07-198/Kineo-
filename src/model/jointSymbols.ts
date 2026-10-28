import type { PlanarPoint } from './planarCoordinates';

export type JointGlyphShape =
  | { kind: 'circle'; radius: number; filled: boolean }
  | { kind: 'path'; points: PlanarPoint[]; closed?: boolean; filled?: boolean };

export function getJointGlyph(type: string): JointGlyphShape[] {
  const line = (...points: PlanarPoint[]): JointGlyphShape => ({ kind: 'path', points });
  const polygon = (...points: PlanarPoint[]): JointGlyphShape => ({ kind: 'path', points, closed: true });
  switch (type) {
    case 'PIVOT':
      return [{ kind: 'circle', radius: 7, filled: false }, { kind: 'circle', radius: 2, filled: true }];
    case 'GLISSIERE':
      return [
        line({ x: -22, y: -7 }, { x: 22, y: -7 }),
        line({ x: -22, y: 7 }, { x: 22, y: 7 }),
        polygon({ x: -10, y: -6 }, { x: 10, y: -6 }, { x: 10, y: 6 }, { x: -10, y: 6 }),
        line({ x: -19, y: -12 }, { x: 19, y: -12 }),
        ...[-17, -9, -1, 7, 15].map((x) =>
          line({ x, y: -12 }, { x: x + 6, y: -19 })),
      ];
    case 'PIVOT_GLISSANT':
      return [
        line({ x: -13, y: -7 }, { x: 13, y: -7 }),
        line({ x: -13, y: 7 }, { x: 13, y: 7 }),
        { kind: 'circle', radius: 4, filled: false },
      ];
    case 'ROTULE':
      return [{ kind: 'circle', radius: 8, filled: false }, { kind: 'circle', radius: 3, filled: true }];
    case 'APPUI_PLAN':
      return [
        line({ x: -13, y: -3 }, { x: 13, y: -3 }),
        polygon({ x: -7, y: 8 }, { x: 0, y: 0 }, { x: 7, y: 8 }),
      ];
    case 'HELICOIDALE':
      return [{ kind: 'circle', radius: 7, filled: false }, line({ x: -9, y: 9 }, { x: 9, y: -9 })];
    case 'ENCASTREMENT':
      return [
        line({ x: -5, y: -10 }, { x: -5, y: 10 }),
        line({ x: -5, y: -8 }, { x: 8, y: -8 }),
        line({ x: -5, y: -3 }, { x: 8, y: -3 }),
        line({ x: -5, y: 2 }, { x: 8, y: 2 }),
        line({ x: -5, y: 7 }, { x: 8, y: 7 }),
      ];
    default:
      return [
        polygon({ x: 0, y: -9 }, { x: 9, y: 0 }, { x: 0, y: 9 }, { x: -9, y: 0 }),
        line({ x: -4, y: -4 }, { x: 4, y: 4 }),
        line({ x: -4, y: 4 }, { x: 4, y: -4 }),
      ];
  }
}
