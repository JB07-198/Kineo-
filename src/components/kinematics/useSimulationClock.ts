import { useEffect } from 'react';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useKineoStore } from '../../store/useKineoStore';
export function useSimulationClock() {
  const playing = useSimulationStore((s) => s.playing);
  useEffect(() => useKineoStore.subscribe((state, previous) => {
    if (state.document !== previous.document) useSimulationStore.getState().invalidate();
  }), []);
  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = 0;
    const tick = (now: number) => {
      if (last && window.document.visibilityState === 'visible') useSimulationStore.getState().tick((now - last) / 1000);
      last = now;
      if (useSimulationStore.getState().playing) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);
}
