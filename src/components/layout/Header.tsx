import React from 'react';
import { useKineoStore } from '../../store/useKineoStore';

export const Header: React.FC = () => {
    const { document, activeAppMode, activeViewMode, setAppMode, setViewMode } = useKineoStore();

    return (
        <header className="h-14 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between px-4 select-none">
            {/* Branding & Nom du projet */}
            <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg">
                    K
                </div>
                <div>
                    <h1 className="font-semibold text-sm leading-none">{document.metadata?.title ?? 'Untitled'}</h1>
                    <span className="text-xs text-slate-400">Kineo Mechanics Studio v3.0</span>
                </div>
            </div>

            {/* Selecteur de Mode d'affichage */}
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
                {(['2D', '3D', 'Graph', 'Split'] as const).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={`px-3 py-1 rounded-md font-medium transition-colors ${activeViewMode === mode
                                ? 'bg-indigo-600 text-white shadow'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        {mode}
                    </button>
                ))}
            </div>

            {/* Switch Mode Édition / Simulation */}
            <div className="flex items-center space-x-2">
                <button
                    onClick={() => setAppMode('Edit')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeAppMode === 'Edit'
                            ? 'bg-emerald-600 text-white shadow-lg'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                >
                    Édition
                </button>
                <button
                    onClick={() => setAppMode('Simulation')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeAppMode === 'Simulation'
                            ? 'bg-amber-600 text-white shadow-lg'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                >
                    Simulation
                </button>
            </div>
        </header>
    );
};