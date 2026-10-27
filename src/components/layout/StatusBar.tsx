import React from 'react';
import { useKineoStore } from '../../store/useKineoStore';

export const StatusBar: React.FC = () => {
    const { document, activeAppMode, toggleSimulationPlay, resetSimulation } = useKineoStore();
    const { mobility, hyperstatism } = document.dofTemplate;
    const { isPlaying, currentTime, duration } = document.kinematics;

    return (
        <footer className="h-10 bg-slate-950 border-t border-slate-800 text-slate-400 text-xs px-4 flex items-center justify-between select-none">
            {/* Contrôles de simulation si mode Simulation actif */}
            {activeAppMode === 'Simulation' ? (
                <div className="flex items-center space-x-3">
                    <button
                        onClick={toggleSimulationPlay}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
                    >
                        {isPlaying ? '⏸ Pause' : '▶ Lancer'}
                    </button>
                    <button
                        onClick={resetSimulation}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                    >
                        ⏹ Réinitialiser
                    </button>
                    <span className="font-mono text-slate-300">
                        Temps: {currentTime.toFixed(2)}s / {duration}s
                    </span>
                </div>
            ) : (
                <div className="text-slate-500">Mode Édition — Placez vos ancres et liaisons</div>
            )}

            {/* Indicateurs cinématiques (Mobilité & Hyperstatisme) */}
            <div className="flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                    <span>Mobilité m =</span>
                    <strong className="text-indigo-400 font-mono">{mobility}</strong>
                </span>
                <span className="flex items-center space-x-1">
                    <span>Hyperstatisme h =</span>
                    <strong className="text-emerald-400 font-mono">{hyperstatism}</strong>
                </span>
            </div>
        </footer>
    );
};