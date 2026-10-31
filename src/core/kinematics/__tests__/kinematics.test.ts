import { describe, expect, it } from 'vitest';
import { createDefaultDocument, createEmptyKineoDocument } from '../../../model/defaultDocument';
import { angleDifference, toLocal, toWorld } from '../geometry';
import { leastSquares, matrixRank } from '../linearAlgebra';
import { analyzeMechanism, compileMechanism, jacobian, residuals } from '../model';
import { solveMechanism } from '../solver';
import { createSimulation, advanceSimulation, documentAtConfiguration, pointOnBody } from '../simulation';
import { createSliderCrank, sliderCrankAnalytic } from '../sliderCrank';

describe('Géométrie et algèbre numérique', () => {
  it('inverse les transformations locales et globales, y compris avec rotation', () => {
    const pose = { x: 12, y: -7, theta: 1.3 }, point = { x: -3, y: 11 };
    const roundtrip = toLocal(toWorld(point, pose), pose);
    expect(roundtrip.x).toBeCloseTo(point.x, 12); expect(roundtrip.y).toBeCloseTo(point.y, 12);
    expect(angleDifference(-Math.PI + .01, Math.PI - .01)).toBeCloseTo(.02, 12);
  });
  it.each([
    { a: [[1, 0], [0, 1]], rank: 2 }, { a: [[1, 2], [2, 4]], rank: 1 },
    { a: [[0, 0], [0, 0]], rank: 0 }, { a: [[1, 0, 0]], rank: 1 },
    { a: [[1, 0], [0, 1e-11]], rank: 1 }, { a: [[1, 0], [0, 1e-5]], rank: 2 },
  ])('calcule le rang SVD : $a', ({ a, rank }) => expect(matrixRank(a)).toBe(rank));
  it('résout les systèmes rectangulaires et dépendants par pseudo-inverse', () => {
    expect(leastSquares([[1, 2], [2, 4]], [3, 6], 2)[0]).toBeCloseTo(.6, 10);
    expect(leastSquares([[1, 2], [2, 4]], [3, 6], 2)[1]).toBeCloseTo(1.2, 10);
    expect(leastSquares([[1, 1]], [4], 2)).toEqual(expect.arrayContaining([expect.closeTo(2, 10)]));
  });
});

describe('Contraintes, jacobienne et mobilité', () => {
  it('analyse le mécanisme de référence : 9 coordonnées, 8 contraintes, mobilité 1', () => {
    const m = compileMechanism(createDefaultDocument());
    expect(m.errors).toEqual([]);
    expect(analyzeMechanism(m)).toMatchObject({ coordinates: 9, constraints: 8, rank: 8, mobility: 1, singular: false });
    expect(analyzeMechanism(m).residual).toBeLessThan(1e-12);
  });
  it('valide la jacobienne par une dérivée directionnelle indépendante', () => {
    const m = compileMechanism(createDefaultDocument()), q = m.initialQ;
    const direction = q.map((_, i) => Math.sin(i + 1));
    const epsilon = 1e-5;
    const plus = q.map((v, i) => v + epsilon * direction[i] * (i % 3 === 2 ? 1 : m.scale));
    const minus = q.map((v, i) => v - epsilon * direction[i] * (i % 3 === 2 ? 1 : m.scale));
    const a = residuals(m, plus), b = residuals(m, minus);
    jacobian(m, q).forEach((row, i) => expect(row.reduce((sum, value, j) => sum + value * direction[j], 0)).toBeCloseTo((a[i] - b[i]) / (2 * epsilon), 6));
  });
  it.each([
    ['PIVOT', 2, 1], ['GLISSIERE', 2, 1], ['ENCASTREMENT', 3, 0],
    ['ROTULE', 2, 1], ['PIVOT_GLISSANT', 2, 1], ['APPUI_PLAN', 0, 3],
  ])('réduction plane %s : %i contraintes, mobilité %i', (type, constraints, mobility) => {
    const d = createDefaultDocument(); d.classesEquivalence = d.classesEquivalence.slice(0, 2); d.geometry.entities = [];
    d.liaisons = [{ ...d.liaisons[0], type, dof: type === 'GLISSIERE' || type === 'PIVOT_GLISSANT' ? [{ ...d.liaisons[3].dof[0] }] : [] }];
    const m = compileMechanism(d); expect(m.errors).toEqual([]);
    expect(analyzeMechanism(m)).toMatchObject({ constraints, mobility });
  });
  it('refuse la liaison hélicoïdale sans sémantique de pas', () => {
    const d = createDefaultDocument(); d.liaisons[0].type = 'HELICOIDALE';
    expect(solveMechanism(compileMechanism(d)).status).toBe('invalid');
  });
  it('refuse les documents vides, sans bâti, hors plan, axes invalides et références inconnues', () => {
    expect(solveMechanism(compileMechanism(createEmptyKineoDocument())).status).toBe('invalid');
    for (const change of [
      (d: ReturnType<typeof createDefaultDocument>) => { d.classesEquivalence[0].isFixed = false; },
      (d: ReturnType<typeof createDefaultDocument>) => { d.classesEquivalence[1].position!.z = 1; },
      (d: ReturnType<typeof createDefaultDocument>) => { d.liaisons[3].dof[0].axisLocal = { x: 0, y: 0, z: 1 }; },
      (d: ReturnType<typeof createDefaultDocument>) => { d.liaisons[0].classA = 'absent'; },
    ]) { const d = createDefaultDocument(); change(d); expect(compileMechanism(d).errors.length).toBeGreaterThan(0); }
  });
  it('compte les redondances sans les assimiler à un hyperstatisme', () => {
    const d = createDefaultDocument(); d.liaisons.push({ ...structuredClone(d.liaisons[0]), id: 'duplicate', dof: [] });
    const a = analyzeMechanism(compileMechanism(d)); expect(a).toMatchObject({ rank: 8, mobility: 1, redundant: 2 });
    expect(a.warnings.join(' ')).toContain('ne prouve pas');
  });
  it('détecte une perte de rang sur un quadrilatère aplati', () => {
    const d = createDefaultDocument(); d.geometry.entities = [];
    d.classesEquivalence[3].isFixed = true;
    d.classesEquivalence.forEach((b) => { b.position = { x: 0, y: 0, z: 0 }; b.rotation = 0; });
    d.liaisons = d.liaisons.slice(0, 3);
    d.liaisons[0].anchors = { onClassA: { x: 0, y: 0, z: 0 }, onClassB: { x: 0, y: 0, z: 0 } };
    d.liaisons[1].anchors = { onClassA: { x: 1, y: 0, z: 0 }, onClassB: { x: 0, y: 0, z: 0 } };
    d.liaisons[2].anchors = { onClassA: { x: 1, y: 0, z: 0 }, onClassB: { x: 2, y: 0, z: 0 } };
    d.classesEquivalence[2].position!.x = 1;
    const m = compileMechanism(d); expect(analyzeMechanism(m).singular).toBe(true);
  });
});

describe('Solveur et benchmark bielle-manivelle', () => {
  it.each([0, .1, Math.PI / 4, Math.PI / 2, Math.PI, 4, 2 * Math.PI])('compare la solution numérique à θ=%f rad', (theta) => {
    const m = compileMechanism(createDefaultDocument());
    const driver = { jointId: 'link_1', kind: 'angle' as const, target: theta };
    let result = solveMechanism(m);
    const steps = Math.ceil(Math.abs(theta - Math.PI / 4) / .05) + 1;
    for (let i = 1; i <= steps; i++) result = solveMechanism(m, result.q, { ...driver, target: Math.PI / 4 + (theta - Math.PI / 4) * i / steps });
    const analytic = sliderCrankAnalytic({ radius: 70, rodLength: 120, angle: theta });
    expect(result.converged).toBe(true);
    expect(result.poses.eq_3.x).toBeCloseTo(analytic.slider, 6);
    expect(angleDifference(result.poses.eq_2.theta, analytic.rodAngle)).toBeCloseTo(0, 7);
    expect(result.analysis.residual).toBeLessThan(1e-9);
  });
  it('assemble une configuration légèrement perturbée', () => {
    const m = compileMechanism(createDefaultDocument());
    const q = m.initialQ.map((v, i) => v + (i % 3 === 2 ? .02 : .5));
    const r = solveMechanism(m, q, { jointId: 'link_1', kind: 'angle', target: Math.PI / 4 });
    expect(r.converged).toBe(true); expect(r.analysis.residual).toBeLessThan(1e-9);
  });
  it('distingue non-convergence et géométrie invalide', () => {
    const m = compileMechanism(createDefaultDocument());
    expect(solveMechanism(m, m.initialQ, { jointId: 'link_1', kind: 'angle', target: 1 }, { maxIterations: 0 }).status).toBe('nonconvergent');
    expect(solveMechanism(m, [NaN]).status).toBe('invalid');
  });
  it('signale des contraintes fixes incompatibles', () => {
    const d = createDefaultDocument(); d.classesEquivalence.forEach((b) => { b.isFixed = true; });
    d.liaisons[0].anchors.onClassB.x = 5;
    const r = solveMechanism(compileMechanism(d)); expect(r.status).toBe('incompatible'); expect(r.converged).toBe(false);
  });
  it('supporte paramètres, axe tourné, origine translatée et seconde branche', () => {
    for (const branch of [1, -1] as const) {
      const m = compileMechanism(createSliderCrank({ radius: 30, rodLength: 80, angle: 1.2, origin: { x: 123, y: -67 }, axisAngle: .8, branch }));
      expect(m.errors).toEqual([]); expect(analyzeMechanism(m).mobility).toBe(1);
      expect(solveMechanism(m).analysis.residual).toBeLessThan(1e-12);
    }
  });
  it('distingue point mort de transmission et singularité géométrique', () => {
    expect(sliderCrankAnalytic({ radius: 70, rodLength: 120, angle: 0 })).toMatchObject({ deadCenter: true, singular: false });
    expect(sliderCrankAnalytic({ radius: 70, rodLength: 70, angle: Math.PI / 2 }).singular).toBe(true);
    expect(() => sliderCrankAnalytic({ radius: 120, rodLength: 70, angle: Math.PI / 2 })).toThrow('inadmissible');
  });
  it('simule un tour complet par continuation et conserve les contraintes', () => {
    const m = compileMechanism(createDefaultDocument()); const original = structuredClone(m.document);
    let s = createSimulation(m, { jointId: 'link_1', kind: 'angle' }, 1);
    let maxError = 0, maxResidual = 0;
    for (let i = 1; i <= 180; i++) {
      s = advanceSimulation(s, i * 2 * Math.PI / 180);
      expect(s.result.converged).toBe(true);
      const exact = sliderCrankAnalytic({ radius: 70, rodLength: 120, angle: Math.PI / 4 + s.time });
      maxError = Math.max(maxError, Math.abs(s.result.poses.eq_3.x - exact.slider));
      maxResidual = Math.max(maxResidual, s.result.analysis.residual);
      const doc = documentAtConfiguration(m, s.q);
      expect(doc.classesEquivalence[3].position!.x).toBeCloseTo(s.result.poses.eq_3.x, 10);
      expect(pointOnBody(m, s.q, 'eq_3', { x: 0, y: 0 }).x).toBeCloseTo(exact.slider, 6);
    }
    console.info(JSON.stringify({ benchmark: 'r=70 L=120, 180 frames, full turn', maxError, maxResidual }));
    expect(maxError).toBeLessThan(1e-6); expect(maxResidual).toBeLessThan(1e-9); expect(m.document).toEqual(original);
  });
  it('interdit de piloter un système à plusieurs mobilités avec une seule entrée', () => {
    const d = createDefaultDocument(); d.liaisons = []; d.geometry.entities = [];
    expect(() => createSimulation(compileMechanism(d), { jointId: 'link_1', kind: 'angle' }, 1)).toThrow('mobilité');
  });
  it('arrête un pilotage singulier au point mort du coulisseau', () => {
    const m = compileMechanism(createSliderCrank({ radius: 70, rodLength: 120, angle: 0 }));
    expect(() => createSimulation(m, { jointId: 'link_4', kind: 'translation' }, 1)).toThrow('singulier');
  });
});

describe('Cas particuliers supplémentaires', () => {
  it('reconnaît la singularité géométrique de L = r à 90 degrés', () => {
    const m = compileMechanism(createSliderCrank({ radius: 70, rodLength: 70, angle: Math.PI / 2 }));
    expect(analyzeMechanism(m).singular).toBe(true);
    expect(solveMechanism(m).status).toBe('singular');
  });
  it('résout un guide incliné depuis une pose perturbée, avec axe attaché au repère A', () => {
    const m = compileMechanism(createSliderCrank({ radius: 30, rodLength: 80, angle: .7, axisAngle: 1.1 }));
    const q = m.initialQ.map((v, i) => v + (i % 3 === 2 ? .01 : .3));
    const r = solveMechanism(m, q, { jointId: 'link_1', kind: 'angle', target: .7 });
    expect(r.converged).toBe(true); expect(r.analysis.residual).toBeLessThan(1e-9);
    expect(r.poses.eq_3.theta).toBeCloseTo(1.1, 8);
  });
  it('refuse les paramètres de rang invalides et les quaternions non unitaires', () => {
    const d = createDefaultDocument(), m = compileMechanism(d);
    expect(solveMechanism(m, m.initialQ, undefined, { rankTolerance: -1 }).status).toBe('invalid');
    d.liaisons[0].orientation.w = 0;
    expect(solveMechanism(compileMechanism(d)).status).toBe('invalid');
  });
});
