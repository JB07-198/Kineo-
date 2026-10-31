import { create } from 'zustand';
import type { KineoV3 } from '../model/jsonV3';
import { referenceBody } from '../model/nomenclature';
interface EditorToolState {
  tool: 'select' | 'joint' | 'fixation'; jointType: string; bodyA: string; bodyB: string; angle: number; autoOrientation: boolean; message: string;
  begin: (type: string, document: KineoV3, selectedId: string | null) => void;
  configure: (patch: Partial<Pick<EditorToolState, 'bodyA' | 'bodyB' | 'angle'>>) => void;
  setAutoOrientation: (automatic: boolean) => void;
  finish: () => void;
  report: (message: string) => void;
}
export const useEditorToolStore = create<EditorToolState>((set) => ({
  tool: 'select', jointType: 'PIVOT', bodyA: '', bodyB: '', angle: 0, autoOrientation: false, message: '',
  begin: (type, document, selectedId) => {
    const selected = document.classesEquivalence.find((b) => b.id === selectedId);
    const first = type === 'GROUND_FIXATION' ? selected ?? document.classesEquivalence[0] : referenceBody(document) ?? selected ?? document.classesEquivalence[0];
    const second = selected && selected.id !== first?.id ? selected : document.classesEquivalence.find((b) => b.id !== first?.id);
    set({
      tool: type === 'GROUND_FIXATION' ? 'fixation' : 'joint',
      jointType: type,
      bodyA: first?.id ?? '',
      bodyB: second?.id ?? '',
      angle: 0,
      autoOrientation: type === 'GROUND_FIXATION',
      message: '',
    });
  },
  configure: (patch) => set((state) => ({
    ...patch,
    message: '',
    autoOrientation: patch.angle === undefined ? state.autoOrientation : false,
  })),
  setAutoOrientation: (autoOrientation) => set({ autoOrientation, message: '' }),
  finish: () => set({ tool: 'select', autoOrientation: false, message: '' }),
  report: (message) => set({ message }),
}));
