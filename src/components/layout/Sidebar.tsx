import { useSimulationStore } from '../../store/useSimulationStore';
import React, { useState } from 'react';
import { useKineoStore } from '../../store/useKineoStore';
import { useEditorToolStore } from '../../store/useEditorToolStore';

const JOINTS = [
  { type: 'PIVOT', label: 'Pivot' },
  { type: 'GLISSIERE', label: 'Glissière' },
  { type: 'PIVOT_GLISSANT', label: 'Pivot glissant' },
  { type: 'ROTULE', label: 'Rotule' },
  { type: 'APPUI_PLAN', label: 'Appui plan' },
  { type: 'HELICOIDALE', label: 'Hélicoïdale' },
  { type: 'ENCASTREMENT', label: 'Encastrement' },
];

export const Sidebar: React.FC = () => {
  const { document, selectedEntityId, selectedEntityType, addClass, addGround, selectEntity } = useKineoStore();
  const [filter, setFilter] = useState('');
  const readOnly = useSimulationStore((state) => !!state.preview);
  const tool = useEditorToolStore();
  const bodies = document.classesEquivalence;
  const visibleBodies = bodies.filter((body) => body.name.toLowerCase().includes(filter.toLowerCase()));
  const visibleJoints = document.liaisons.filter((joint) => joint.name.toLowerCase().includes(filter.toLowerCase()));

  const createBody = () => {
    const offset = Math.max(0, bodies.length - 4);
    addClass(`Solide ${bodies.length}`, { x: 250 + offset * 25, y: offset * 25, z: 0 });
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300">
      <div className="border-b border-slate-800 p-3">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Symboles de liaison</h2>
        <div className="grid grid-cols-2 gap-1.5">
          {JOINTS.map((joint) => (
            <button
              key={joint.type}
              disabled={readOnly || bodies.length < 2}
              onClick={() => tool.begin(joint.type, document, selectedEntityType === 'Class' ? selectedEntityId : null)}
              title={`Activer le placement de liaisons ${joint.label}`}
              className={`min-h-11 rounded-md border px-1 py-1.5 text-[10px] font-medium transition-colors ${
                tool.tool === 'joint' && tool.jointType === joint.type
                  ? 'border-indigo-500 bg-indigo-600/30 text-white'
                  : 'border-slate-700/70 bg-slate-800/60 hover:border-indigo-500 hover:bg-indigo-600/20'
              }`}
            >
              {joint.label}
            </button>
          ))}
        </div>
        <button
          disabled={readOnly || !bodies.length}
          onClick={() => tool.begin('GROUND_FIXATION', document, selectedEntityType === 'Class' ? selectedEntityId : null)}
          className={`mt-2 w-full rounded-md border px-2 py-2 text-left text-[10px] font-medium ${
            tool.tool === 'fixation' ? 'border-indigo-500 bg-indigo-600/30 text-white' : 'border-slate-700 bg-slate-800/60 hover:border-indigo-500'
          }`}
        >
          Encastrement au bâti
        </button>
        {tool.tool !== 'select' && (
          <div className="mt-2 space-y-2 rounded-md border border-indigo-500/40 bg-indigo-500/5 p-2">
            {tool.tool === 'joint' ? (
              <>
                <label className="block text-[10px] text-slate-400">
                  Solide A
                  <select value={tool.bodyA} onChange={(event) => tool.configure({ bodyA: event.target.value })} className="inspector-input">
                    {bodies.map((body) => <option key={body.id} value={body.id}>{body.name}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] text-slate-400">
                  Solide B
                  <select value={tool.bodyB} onChange={(event) => tool.configure({ bodyB: event.target.value })} className="inspector-input">
                    {bodies.map((body) => <option key={body.id} value={body.id}>{body.name}</option>)}
                  </select>
                </label>
                <label className="block text-[10px] text-slate-400">
                  Orientation du symbole (°)
                  <input type="number" value={tool.angle * 180 / Math.PI}
                    onChange={(event) => tool.configure({ angle: Number(event.target.value) * Math.PI / 180 })}
                    className="inspector-input" />
                </label>
              </>
            ) : (
              <>
                <label className="block text-[10px] text-slate-400">
                  Solide à fixer
                  <select value={tool.bodyA} onChange={(event) => tool.configure({ bodyA: event.target.value })} className="inspector-input">
                    {bodies.map((body) => <option key={body.id} value={body.id}>{body.name}</option>)}
                  </select>
                </label>
                <label className="flex items-center justify-between text-[10px] text-slate-400">
                  Orientation automatique (tangente)
                  <input type="checkbox" checked={tool.autoOrientation}
                    onChange={(event) => tool.setAutoOrientation(event.target.checked)} />
                </label>
                <label className="block text-[10px] text-slate-400">
                  Orientation de la surface (°)
                  <input type="number" disabled={tool.autoOrientation} value={tool.angle * 180 / Math.PI}
                    onChange={(event) => tool.configure({ angle: Number(event.target.value) * Math.PI / 180 })} className="inspector-input" />
                </label>
              </>
            )}
            {tool.message && <p role="status" className="text-[10px] text-rose-300">{tool.message}</p>}
            <button onClick={tool.finish} className="toolbar-button w-full">Terminer (Échap)</button>
          </div>
        )}
      </div>

      {!bodies.some((body) => body.isFixed) && <button className="toolbar-button m-3" disabled={readOnly} onClick={addGround}>+ Bâti fixe</button>}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pièces et liaisons</h2>
        <button disabled={readOnly} onClick={createBody} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
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
                  L{document.liaisons.indexOf(joint) + 1}
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
