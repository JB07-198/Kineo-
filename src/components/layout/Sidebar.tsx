import React from 'react';
import { useKineoStore } from '../../store/useKineoStore';
import type { JointType } from '../../types/kineo'; // <-- Ajouter 'type' ici

const JOINTS: { type: JointType; label: string; icon: string }[] = [
    { type: 'Pivoting', label: 'Pivot', icon: '🔄' },
    { type: 'Prismatic', label: 'Glissière', icon: '↔️' },
    { type: 'Cylindrical', label: 'Pivot Glissant', icon: '🌀' },
    { type: 'Spherical', label: 'Rotule', icon: '⚽' },
    { type: 'Planar', label: 'Appui Plan', icon: '📐' },
    { type: 'Helicoidal', label: 'Hélicoïdale', icon: '🔩' },
    { type: 'Fixed', label: 'Encastrement', icon: '🔒' },
];

export const Sidebar: React.FC = () => {
    const { document, addClass, selectEntity } = useKineoStore();

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-full select-none">
            {/* Bibliothèques de liaisons ISO */}
            <div className="p-4 border-b border-slate-800">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Liaisons ISO / AFNOR
                </h2>
                <div className="grid grid-cols-2 gap-2">
                    {JOINTS.map((j) => (
                        <button
                            key={j.type}
                            className="flex flex-col items-center justify-center p-2.5 bg-slate-800/60 hover:bg-indigo-600/20 hover:border-indigo-500/50 border border-slate-700/50 rounded-lg transition-all text-center group"
                        >
                            <span className="text-xl mb-1 group-hover:scale-110 transition-transform">{j.icon}</span>
                            <span className="text-[11px] font-medium text-slate-300 group-hover:text-white">{j.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Arborescence des Classes d'Équivalence */}
            <div className="p-4 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Classes (Solides)
                    </h2>
                    <button
                        onClick={() =>
                            addClass({
                                name: `Solide ${document.classesEquivalence.length}`,
                                color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
                                isGround: false,
                            })
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                    >
                        + Ajouter
                    </button>
                </div>

                <ul className="space-y-1.5">
                    {document.classesEquivalence.map((cls) => (
                        <li
                            key={cls.id}
                            onClick={() => selectEntity(cls.id, 'Class')}
                            className="flex items-center justify-between p-2 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 cursor-pointer text-xs"
                        >
                            <div className="flex items-center space-x-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cls.color }} />
                                <span className="font-medium text-slate-200">{cls.name}</span>
                            </div>
                            {cls.isGround && (
                                <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 font-semibold">
                                    Bâti
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </aside>
    );
};