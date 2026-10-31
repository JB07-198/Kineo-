import React from 'react';
import { useKineoStore } from '../../store/useKineoStore';

export const StatusBar: React.FC = () => {
  const { document, gridVisible, snapEnabled } = useKineoStore();

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-slate-800 bg-slate-950 px-4 text-[11px] text-slate-400">
      <div className="flex items-center gap-3">
        <span className="text-emerald-400">Éditeur mécanique</span>
        <span>{document.classesEquivalence.length} solides</span>
        <span>{document.liaisons.length} liaisons</span>
        <span>Grille {gridVisible ? 'active' : 'masquée'}</span>
        <span>Aimantation {snapEnabled ? 'active' : 'inactive'}</span>
      </div>
      <span className="text-slate-500">Solveur plan · mobilité locale · hors dynamique</span>
    </footer>
  );
};
