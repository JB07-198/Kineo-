import { create } from 'zustand';
import type { KineoV3 } from '../model/jsonV3';
import { useKineoStore } from './useKineoStore';
import { analyzeMechanism, compileMechanism, driverValue } from '../core/kinematics/model';
import { solveMechanism } from '../core/kinematics/solver';
import { advanceSimulation, createSimulation, documentAtConfiguration, pointOnBody } from '../core/kinematics/simulation';
import type { SimulationSession } from '../core/kinematics/simulation';
import type { Point2 } from '../core/kinematics/geometry';
import type { Analysis, SolveResult } from '../core/kinematics/types';

interface SimulationState {
  playing: boolean; session: SimulationSession | null; preview: KineoV3 | null;
  source: KineoV3 | null; result: SolveResult | null; analysis: Analysis | null;
  jointId: string; speed: number; message: string;
  trackedBodyId: string; trackedLocal: Point2; trace: Point2[]; traceBodyId: string;
  analyze: () => void; play: () => void; pause: () => void; reset: () => void;
  seek: (time: number) => void; tick: (dt: number) => void;
  configure: (jointId: string, speed: number) => void;
  track: (bodyId: string, local: Point2) => void;
  invalidate: () => void;
}
const cleanState = { playing: false, session: null, preview: null, source: null, result: null, analysis: null, message: '', trace: [], traceBodyId: '' };
export const useSimulationStore = create<SimulationState>((set, get) => ({
  ...cleanState, jointId: '', speed: 30, trackedBodyId: '', trackedLocal: { x: 0, y: 0 },
  invalidate: () => set({ ...cleanState, message: 'Document modifié : relancez l’analyse.' }),
  analyze: () => {
    const source = useKineoStore.getState().document;
    const model = compileMechanism(source), result = solveMechanism(model);
    const joint = source.liaisons.find((j) => j.id === get().jointId && ['PIVOT', 'GLISSIERE'].includes(j.type)) ?? source.liaisons.find((j) => ['PIVOT', 'GLISSIERE'].includes(j.type));
    set({ ...cleanState, source, result, analysis: analyzeMechanism(model, result.q), jointId: joint?.id ?? '',
      preview: result.converged ? documentAtConfiguration(model, result.q) : null,
      message: result.converged ? 'Assemblage convergé. Mobilité locale calculée hors entrée motrice.' : result.diagnostics.join('\n'),
    });
  },
  configure: (jointId, speed) => {
    if (!Number.isFinite(speed) || Math.abs(speed) > 1000) { set({ message: 'Vitesse attendue entre −1000 et 1000.' }); return; }
    set({ jointId, speed, playing: false, session: null, preview: null, trace: [] });
  },
  play: () => {
    try {
      const state = get(), source = useKineoStore.getState().document;
      let session = state.source === source ? state.session : null;
      if (!session) {
        const model = compileMechanism(source);
        const joint = source.liaisons.find((j) => j.id === state.jointId) ?? source.liaisons.find((j) => ['PIVOT', 'GLISSIERE'].includes(j.type));
        if (!joint) throw new Error('Choisissez une liaison pivot ou glissière motrice.');
        const kind = ['PIVOT', 'ROTULE'].includes(joint.type) ? 'angle' : 'translation';
        session = createSimulation(model, { jointId: joint.id, kind }, kind === 'angle' ? state.speed * Math.PI / 180 : state.speed);
      }
      set({ source, session, playing: true, preview: documentAtConfiguration(session.model, session.q),
        result: session.result, analysis: analyzeMechanism(session.model, session.q),
        message: 'Simulation par continuation numérique.', jointId: session.driver.jointId,
      });
    } catch (error) { set({ playing: false, message: error instanceof Error ? error.message : String(error) }); }
  },
  pause: () => set({ playing: false, message: 'Simulation en pause.' }),
  reset: () => set({ ...cleanState, message: 'Configuration initiale de l’éditeur restaurée.' }),
  seek: (time) => {
    try {
      let session = get().session;
      if (!session) { get().play(); get().pause(); session = get().session; }
      if (!session) return;
      const next = advanceSimulation(session, time);
      const ok = next.result.converged && next.result.status !== 'singular' && next.result.analysis.mobility === 0;
      const state = get();
      const tracked = session.model.document.classesEquivalence.some((body) => body.id === state.trackedBodyId) ? state.trackedBodyId :
        useKineoStore.getState().selectedEntityType === 'Class' ? useKineoStore.getState().selectedEntityId : null;
      const trace = tracked ? [...(time < session.time || tracked !== state.traceBodyId ? [] : state.trace), pointOnBody(session.model, next.q, tracked, state.trackedLocal)].slice(-2000) : state.trace;
      set({ session: next, preview: documentAtConfiguration(session.model, next.q), result: next.result,
        analysis: analyzeMechanism(session.model, next.q), trace, traceBodyId: tracked ?? '', playing: ok && state.playing,
        message: ok ? 'Contraintes respectées à chaque pas.' : `Arrêt à ${next.time.toFixed(3)} s : ${next.result.status}. ${next.result.diagnostics.join(' ')}`,
      });
    } catch (error) { set({ playing: false, message: error instanceof Error ? error.message : String(error) }); }
  },
  tick: (dt) => {
    const state = get();
    if (!state.playing || !state.session) return;
    const next = Math.min(3600, state.session.time + Math.min(.05, Math.max(0, dt)));
    state.seek(next);
    if (next >= 3600) set({ playing: false, message: 'Durée maximale de 3600 s atteinte.' });
  },
  track: (trackedBodyId, trackedLocal) => set({ trackedBodyId, trackedLocal, trace: [] }),
}));

/** Displayed relative joint coordinate, never taken from stale DOF metadata. */
export function currentInputValue(): number | null {
  const { session } = useSimulationStore.getState();
  return session ? driverValue(session.model, session.q, session.driver) : null;
}
