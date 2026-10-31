import type { KineoV3 } from '../../model/jsonV3';
import type { Pose2 } from './geometry';
export interface Driver { jointId: string; kind: 'angle' | 'translation'; target: number }
export interface MechanicalModel {
  document: KineoV3;
  mobileIds: string[];
  initialQ: number[];
  scale: number;
  warnings: string[];
  errors: string[];
  referenceRank: number;
}
export interface Analysis {
  mobileBodies: number; coordinates: number; constraints: number;
  rank: number; mobility: number; redundant: number; singular: boolean;
  residual: number; lengthResidual: number; angularResidual: number;
  singularValues: number[]; warnings: string[];
}
export type SolveStatus = 'converged' | 'nonconvergent' | 'singular' | 'incompatible' | 'invalid';
export interface SolveResult {
  status: SolveStatus; converged: boolean; q: number[]; poses: Record<string, Pose2>;
  iterations: number; analysis: Analysis; diagnostics: string[];
}
export interface SolverOptions {
  tolerance?: number; maxIterations?: number; rankTolerance?: number;
}
