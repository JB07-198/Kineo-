import React, { useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { PropertyInspector } from './components/layout/PropertyInspector';
import { StatusBar } from './components/layout/StatusBar';
import { Viewport2D } from './components/canvas/Viewport2D';
import { MechanicalGraphView } from './components/graph/MechanicalGraphView';
import { useKineoStore } from './store/useKineoStore';

export const App: React.FC = () => {
  const { activeViewMode } = useKineoStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement &&
          (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      const store = useKineoStore.getState();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        store.redo();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!store.selectedEntityId || !store.selectedEntityType) return;
        const body = store.document.classesEquivalence.find((item) => item.id === store.selectedEntityId);
        if (body?.isFixed) return;
        event.preventDefault();
        store.removeEntity(store.selectedEntityId, store.selectedEntityType);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 font-sans">
      <Header />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />

        <main className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden border-r border-slate-800 bg-slate-950">
          {activeViewMode === '2D' ? <Viewport2D /> : activeViewMode === 'Graph' ? (
            <MechanicalGraphView />
          ) : activeViewMode === 'Split' ? (
            <div className="flex h-full min-h-0 w-full min-w-0 flex-col md:flex-row">
              <section className="relative min-h-0 min-w-0 flex-1 border-b border-slate-800 md:border-b-0 md:border-r" aria-label="Vue mécanique 2D">
                <span className="pointer-events-none absolute right-3 top-3 z-10 rounded bg-slate-900/90 px-2 py-1 text-[10px] text-slate-400">2D</span>
                <Viewport2D />
              </section>
              <section className="relative min-h-0 min-w-0 flex-1" aria-label="Vue du graphe mécanique">
                <span className="pointer-events-none absolute right-3 top-3 z-10 rounded bg-slate-900/90 px-2 py-1 text-[10px] text-slate-400">Graphe</span>
                <MechanicalGraphView />
              </section>
            </div>
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
              <div className="z-10 max-w-sm px-6 text-center">
                <h2 className="text-base font-semibold text-slate-300">Vue {activeViewMode} non disponible</h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  La modélisation et la résolution 3D sont prévues pour une version ultérieure.
                </p>
              </div>
            </>
          )}
        </main>

        <PropertyInspector />
      </div>

      <StatusBar />
    </div>
  );
};

export default App;
