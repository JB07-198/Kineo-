import type { Driver, MechanicalModel, SolveResult, SolverOptions } from './types';
import { analyzeMechanism, jacobian, posesFor, residuals } from './model';
import { leastSquares, maxAbs, norm } from './linearAlgebra';

export function solveMechanism(model: MechanicalModel, initial = model.initialQ, driver?: Driver, options: SolverOptions = {}): SolveResult {
  const tolerance = options.tolerance ?? 1e-9, limit = options.maxIterations ?? 60;
  let q = [...initial], iterations = 0;
  const diagnostics = [...model.errors];
  const result = (status: SolveResult['status'], converged = false): SolveResult => ({
    status, converged, q, poses: posesFor(model, q), iterations,
    analysis: analyzeMechanism(model, q, driver, options.rankTolerance), diagnostics,
  });
  if (q.length !== model.initialQ.length || !q.every(Number.isFinite) || !Number.isFinite(tolerance) || tolerance <= 0 || !Number.isInteger(limit) || limit < 0 || (options.rankTolerance !== undefined && (!Number.isFinite(options.rankTolerance) || options.rankTolerance <= 0))) diagnostics.push('Configuration ou paramètres numériques invalides.');
  if (driver) {
    const joint = model.document.liaisons.find((j) => j.id === driver.jointId);
    if (!joint || !Number.isFinite(driver.target) || (driver.kind === 'angle' ? !['PIVOT', 'ROTULE'].includes(joint.type) : !['GLISSIERE', 'PIVOT_GLISSANT'].includes(joint.type))) diagnostics.push('Entrée cinématique incompatible avec la liaison.');
  }
  if (diagnostics.length) return result('invalid');
  try {
    for (iterations = 0; iterations <= limit; iterations++) {
      const f = residuals(model, q, driver);
      if (!f.every(Number.isFinite)) { diagnostics.push('Résidus non finis : divergence numérique.'); return result('nonconvergent'); }
      if (maxAbs(f) <= tolerance) {
        const analysis = analyzeMechanism(model, q, driver, options.rankTolerance);
        diagnostics.push(...analysis.warnings);
        if (driver && analysis.mobility > 0) {
          diagnostics.push('Entrée insuffisante ou singularité de pilotage : configuration non déterminée.');
          return result('singular', true);
        }
        return result(analysis.singular ? 'singular' : 'converged', true);
      }
      if (iterations === limit) break;
      const j = jacobian(model, q, driver);
      let accepted = false;
      for (const damping of [0, 1e-8, 1e-5, 1e-2]) {
        const step = leastSquares(j, f.map((value) => -value), q.length, damping);
        // Bound angular/normalized translational steps to stay on the local assembly branch.
        const cap = Math.min(1, 0.5 / Math.max(0.5, maxAbs(step)));
        for (let factor = cap; factor >= cap / 1024; factor /= 2) {
          const candidate = q.map((value, i) => value + step[i] * factor * (i % 3 === 2 ? 1 : model.scale));
          const next = residuals(model, candidate, driver);
          if (norm(next) < norm(f) * (1 - 1e-5 * factor)) { q = candidate; accepted = true; break; }
        }
        if (accepted) break;
      }
      if (!accepted) {
        const projected = leastSquares(j, f.map((value) => -value), q.length);
        const linearResidual = f.map((value, i) => value + j[i].reduce((sum, a, k) => sum + a * projected[k], 0));
        const analysis = analyzeMechanism(model, q, driver, options.rankTolerance);
        if (norm(linearResidual) > Math.max(tolerance * 10, norm(f) * 0.1)) {
          diagnostics.push('Résidu irréductible dans la linéarisation : contraintes localement incompatibles. Ce diagnostic ne prouve pas une impossibilité globale.');
          return result('incompatible');
        }
        diagnostics.push('Recherche linéaire bloquée ; essayez une configuration initiale plus proche.');
        return result(analysis.singular || analysis.mobility > 0 && !!driver ? 'singular' : 'nonconvergent');
      }
    }
  } catch (error) { diagnostics.push(error instanceof Error ? error.message : String(error)); return result('nonconvergent'); }
  diagnostics.push(`Limite de ${limit} itérations atteinte.`);
  return result('nonconvergent');
}
