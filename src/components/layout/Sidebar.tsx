import React, { useState } from 'react';
import { useKineoStore } from '../../store/useKineoStore';

const JOINTS = [
  { type: 'PIVOT', label: 'Pivot', symbol: '○' },
  { type: 'GLISSIERE', label: 'Glissière', symbol: '▤' },
  { type: 'PIVOT_GLISSANT', label: 'Pivot glissant', symbol: '⊙↔' },
  { type: 'ROTULE', label: 'Rotule', symbol: '◎' },
  { type: 'APPUI_PLAN', label: 'Appui plan', symbol: '△' },
  { type: 'HELICOIDALE', label: 'Hélicoïdale', symbol: '⟳' },
  { type: 'ENCASTREMENT', label: 'Encastrement', symbol: '⊣' },
];

export const Sidebar: React.FC = () => {
  const { document, selectedEntityId, selectedEntityType, addClass, addJoint, selectEntity } = useKineoStore();
  const [filter, setFilter] = useState('');
  const bodies = document.classesEquivalence;
  const visibleBodies = bodies.filter((body) => body.name.toLowerCase().includes(filter.toLowerCase()));
  const visibleJoints = document.liaisons.filter((joint) => joint.name.toLowerCase().includes(filter.toLowerCase()));

  const createBody = () => {
    const offset = Math.max(0, bodies.length - 4);
    addClass(`Solide ${bodies.length}`, { x: 250 + offset * 25, y: offset * 25, z: 0 });
  };

  const createJoint = (type: string) => {
    const selectedBody = selectedEntityType === 'Class'
      ? bodies.find((body) => body.id === selectedEntityId)
      : undefined;
    const secondBody = selectedBody?.isFixed
      ? bodies.find((body) => !body.isFixed)
      : selectedBody ?? bodies.find((body) => !body.isFixed);
    const ground = bodies.find((body) => body.isFixed);
    if (!ground || !secondBody || ground.id === secondBody.id) return;
    const first = ground.position ?? { x: 0, y: 0, z: 0 };
    const second = secondBody.position ?? { x: 0, y: 0, z: 0 };
    addJoint(type, ground.id, secondBody.id, {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
      z: (first.z + second.z) / 2,
    });
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300">
      <div className="border-b border-slate-800 p-3">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Liaisons ISO / AFNOR</h2>
        <div className="grid grid-cols-2 gap-1.5">
          {JOINTS.map((joint) => (
            <button
              key={joint.type}
              onClick={() => createJoint(joint.type)}
              title={`Ajouter une liaison ${joint.label} entre le bâti et le solide sélectionné`}
              className="flex min-h-14 flex-col items-center justify-center rounded-md border border-slate-700/70 bg-slate-800/60 px-1 py-1.5 transition-colors hover:border-indigo-500 hover:bg-indigo-600/20"
            >
              <span className="text-xl leading-6 text-indigo-300">{joint.symbol}</span>
              <span className="text-[10px] font-medium">{joint.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pièces et liaisons</h2>
        <button onClick={createBody} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
          + Solide
        </button>
      </div>
      <div className="border-b border-slate-800 px-3 py-2">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          aria-label="Rechercher une pièce ou une liaison"
          placeholder="Rechercher…"
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <h3 className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Solides</h3>
        <ul className="space-y-1">
          {visibleBodies.map((body) => (
            <li key={body.id}>
              <button
                onClick={() => selectEntity(body.id, 'Class')}
                className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-xs ${
                  selectedEntityId === body.id && selectedEntityType === 'Class'
                    ? 'border-indigo-500/60 bg-indigo-500/15'
                    : 'border-transparent bg-slate-800/40 hover:bg-slate-800'
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: body.color }} />
                <span className="min-w-0 flex-1 truncate">{body.name}</span>
                {body.isFixed && <span className="rounded bg-slate-700 px-1 text-[9px] text-slate-300">Bâti</span>}
              </button>
            </li>
          ))}
          {visibleBodies.length === 0 && <li className="px-2 py-2 text-xs text-slate-500">Aucun solide trouvé.</li>}
        </ul>

        <h3 className="mt-4 px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Liaisons ({document.liaisons.length})
        </h3>
        <ul className="space-y-1">
          {visibleJoints.map((joint) => (
            <li key={joint.id}>
              <button
                onClick={() => selectEntity(joint.id, 'Joint')}
                className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-xs ${
                  selectedEntityId === joint.id && selectedEntityType === 'Joint'
                    ? 'border-indigo-500/60 bg-indigo-500/15'
                    : 'border-transparent bg-slate-800/40 hover:bg-slate-800'
                }`}
              >
                <span className="w-5 shrink-0 text-center text-indigo-300">
                  {JOINTS.find((item) => item.type === joint.type)?.symbol ?? '○'}
                </span>
                <span className="min-w-0 flex-1 truncate">{joint.name}</span>
              </button>
            </li>
          ))}
          {visibleJoints.length === 0 && <li className="px-2 py-2 text-xs text-slate-500">Aucune liaison trouvée.</li>}
        </ul>
      </div>
    </aside>
  );
};
