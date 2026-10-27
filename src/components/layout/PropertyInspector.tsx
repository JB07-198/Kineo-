import React from 'react';
import { useKineoStore } from '../../store/useKineoStore';

export const PropertyInspector: React.FC = () => {
    const { document, selectedEntityId, selectedEntityType, removeEntity } = useKineoStore();

    const selectedClass =
        selectedEntityType === 'Class'
            ? document.classesEquivalence.find((c) => c.id === selectedEntityId)
            : null;

    return (
        <aside className="w-72 bg-slate-900 border-l border-slate-800 text-slate-300 p-4 h-full select-none">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Inspecteur de Propriétés
            </h2>

            {!selectedEntityId && (
                <div className="text-xs text-slate-500 italic text-center py-8">
                    Sélectionnez un composant sur la zone de travail ou dans la liste pour voir ses propriétés.
                </div>
            )}

            {selectedClass && (
                <div className="space-y-4 text-xs">
                    <div>
                        <label className="block text-slate-400 mb-1">ID</label>
                        <input
                            disabled
                            value={selectedClass.id}
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-400"
                        />
                    </div>

                    <div>
                        <label className="block text-slate-400 mb-1">Nom du Solide</label>
                        <input
                            type="text"
                            value={selectedClass.name}
                            readOnly
                            className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-slate-400 mb-1">Couleur d'Affichage</label>
                        <div className="flex items-center space-x-2">
                            <input
                                type="color"
                                value={selectedClass.color}
                                disabled
                                className="w-8 h-8 rounded bg-transparent cursor-pointer border-0"
                            />
                            <span className="font-mono text-slate-300">{selectedClass.color}</span>
                        </div>
                    </div>

                    {!selectedClass.isGround && (
                        <button
                            onClick={() => removeEntity(selectedClass.id, 'Class')}
                            className="w-full mt-4 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded py-1.5 transition-colors font-medium"
                        >
                            Supprimer le solide
                        </button>
                    )}
                </div>
            )}
        </aside>
    );
};