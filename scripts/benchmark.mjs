import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
const server = await createServer({ server: { middlewareMode: true } });
try {
  const { compileMechanism, analyzeMechanism } = await server.ssrLoadModule('/src/core/kinematics/model.ts');
  const { createSliderCrank, sliderCrankAnalytic } = await server.ssrLoadModule('/src/core/kinematics/sliderCrank.ts');
  const { createSimulation, advanceSimulation } = await server.ssrLoadModule('/src/core/kinematics/simulation.ts');
  const { angleDifference } = await server.ssrLoadModule('/src/core/kinematics/geometry.ts');
  const cases = [];
  for (const params of [
    { radius: 70, rodLength: 120, angle: Math.PI / 4 },
    { radius: 30, rodLength: 80, angle: .4, axisAngle: .8, origin: { x: 123, y: -67 } },
    { radius: 20, rodLength: 65, angle: .2, branch: -1 },
  ]) {
    const document = createSliderCrank(params), model = compileMechanism(document);
    let session = createSimulation(model, { jointId: 'link_1', kind: 'angle' }, 1);
    let maxPositionError = 0, maxAngleError = 0, maxNormalizedResidual = 0, maxLengthResidual = 0, maxAngularResidual = 0, maxIterations = 0;
    const start = performance.now();
    const samples = [];
    for (let i = 0; i <= 360; i++) {
      session = advanceSimulation(session, i * 2 * Math.PI / 360);
      if (!session.result.converged || session.result.status !== 'converged') throw new Error(`Frame ${i}: ${session.result.status}`);
      const exact = sliderCrankAnalytic({ ...params, angle: params.angle + session.time });
      const origin = params.origin ?? { x: 0, y: 0 }, axis = params.axisAngle ?? 0;
      const pose = session.result.poses.eq_3, rod = session.result.poses.eq_2;
      maxPositionError = Math.max(maxPositionError, Math.hypot(pose.x - origin.x - exact.slider * Math.cos(axis), pose.y - origin.y - exact.slider * Math.sin(axis)));
      maxAngleError = Math.max(maxAngleError, Math.abs(angleDifference(rod.theta, exact.rodAngle + axis)));
      maxNormalizedResidual = Math.max(maxNormalizedResidual, session.result.analysis.residual);
      maxLengthResidual = Math.max(maxLengthResidual, session.result.analysis.lengthResidual);
      maxAngularResidual = Math.max(maxAngularResidual, session.result.analysis.angularResidual);
      maxIterations = Math.max(maxIterations, session.result.iterations);
      if (i % 90 === 0) samples.push({ time: session.time, x: pose.x, y: pose.y, analyticSlider: exact.slider });
    }
    const durationMs = performance.now() - start;
    if (maxPositionError > 1e-6 || maxAngleError > 1e-7 || maxNormalizedResidual > 1e-9) throw new Error('Benchmark tolerance exceeded');
    cases.push({ parameters: params, frames: 361, analysis: analyzeMechanism(model), maxPositionError, maxAngleError, maxNormalizedResidual, maxLengthResidual, maxAngularResidual, maxIterations, durationMs, samples });
  }
  const result = { date: '2026-10-31', version: '0.3.0', cases };
  await writeFile('docs/evidence/benchmark-v0.3.json', JSON.stringify(result, null, 2) + '\n');
  await writeFile('examples/slider-crank-v3.json', JSON.stringify(createSliderCrank({ radius: 70, rodLength: 120, angle: Math.PI / 4 }), null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await server.close(); }
