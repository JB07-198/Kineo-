import React from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { PropertyInspector } from './components/layout/PropertyInspector';
import { StatusBar } from './components/layout/StatusBar';
import { Viewport2D } from './components/canvas/Viewport2D';
import { useKineoStore } from './store/useKineoStore';

export const App: React.FC = () => {
  const { activeViewMode } = useKineoStore();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Viewport Central (Canvas) */}
        <main className="flex-1 bg-slate-950 relative flex items-center justify-center border-r border-slate-800 overflow-hidden">
          {activeViewMode === '2D' ? (
            <Viewport2D />
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />

              <div className="z-10 text-center">
                <span className="text-4xl mb-2 block">⚙️</span>
                <h2 className="text-slate-300 text-base font-semibold">
                  Zone Viewport [{activeViewMode}]
                </h2>
                <p className="text-slate-500 text-xs mt-1">
                  Prêt pour le rendu Canvas 2D / Three.js 3D
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
