export type Matrix = number[][];
export const norm = (v: number[]): number => Math.hypot(...v);
export const maxAbs = (v: number[]): number => v.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);

/** One-sided Jacobi SVD, operating on A directly (no squaring of its condition number). */
export function svd(matrix: Matrix, columns = matrix[0]?.length ?? 0) {
  const b = matrix.map((row) => [...row]);
  const v = Array.from({ length: columns }, (_, i) => Array.from({ length: columns }, (_, j) => Number(i === j)));
  let converged = columns < 2;
  for (let sweep = 0; sweep < Math.max(40, columns * 8); sweep++) {
    let changed = false;
    for (let p = 0; p < columns; p++) for (let q = p + 1; q < columns; q++) {
      let alpha = 0, beta = 0, gamma = 0;
      for (const row of b) { alpha += row[p] ** 2; beta += row[q] ** 2; gamma += row[p] * row[q]; }
      if (Math.abs(gamma) <= 1e-14 * Math.sqrt(alpha * beta) || alpha * beta === 0) continue;
      changed = true;
      const zeta = (beta - alpha) / (2 * gamma);
      const t = (zeta >= 0 ? 1 : -1) / (Math.abs(zeta) + Math.hypot(1, zeta));
      const c = 1 / Math.hypot(1, t), s = c * t;
      for (const rows of [b, v]) for (const row of rows) {
        const x = row[p], y = row[q]; row[p] = c * x - s * y; row[q] = s * x + c * y;
      }
    }
    if (!changed) { converged = true; break; }
  }
  const singularValues = Array.from({ length: columns }, (_, j) => Math.hypot(...b.map((row) => row[j])));
  return { b, v, singularValues, converged };
}
export function matrixRank(matrix: Matrix, columns = matrix[0]?.length ?? 0, tolerance = 1e-8): number {
  const { singularValues } = svd(matrix, columns);
  const threshold = tolerance * Math.max(1, ...singularValues);
  return singularValues.filter((value) => value > threshold).length;
}
export function leastSquares(matrix: Matrix, rhs: number[], columns: number, damping = 0): number[] {
  const { b, v, singularValues, converged } = svd(matrix, columns);
  if (!converged) throw new Error('La décomposition SVD ne converge pas.');
  const cutoff = 1e-10 * Math.max(1, ...singularValues);
  const weights = singularValues.map((sigma, j) => sigma <= cutoff ? 0 :
    b.reduce((sum, row, i) => sum + row[j] * rhs[i], 0) / (sigma * sigma + damping));
  return v.map((row) => row.reduce((sum, value, j) => sum + value * weights[j], 0));
}
