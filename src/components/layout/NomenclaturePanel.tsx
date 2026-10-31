import React from 'react';
import { buildNomenclature } from '../../model/nomenclature';
import { useKineoStore } from '../../store/useKineoStore';

export const NomenclaturePanel: React.FC = () => {
  const { document, selectedEntityId, selectedEntityType, selectEntity } = useKineoStore();
  const nomenclature = buildNomenclature(document);
  const unit = document.meta.lengthUnit;

  return (
    <aside className="h-full w-80 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900 p-3 text-slate-300">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-300">Nomenclature</h2>
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Solides</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[10px]">
          <thead className="text-slate-500">
            <tr>
              <th className="border-b border-slate-700 px-1 py-1">Repère</th>
              <th className="border-b border-slate-700 px-1 py-1">Désignation</th>
              <th className="border-b border-slate-700 px-1 py-1">Forme</th>
              <th className="border-b border-slate-700 px-1 py-1">Position</th>
              <th className="border-b border-slate-700 px-1 py-1">Fixation</th>
            </tr>
          </thead>
          <tbody>
            {nomenclature.bodies.map((body) => (
              <tr
                key={body.id}
                className={`cursor-pointer ${selectedEntityType === 'Class' && selectedEntityId === body.id ? 'bg-indigo-500/20 text-white' : 'hover:bg-slate-800'}`}
                onClick={() => selectEntity(body.id, 'Class')}
              >
                <td className="border-b border-slate-800 px-1 py-1 font-mono font-semibold">{body.reference}</td>
                <td className="max-w-24 truncate border-b border-slate-800 px-1 py-1" title={body.name}>{body.name}</td>
                <td className="border-b border-slate-800 px-1 py-1">{body.shape}</td>
                <td className="whitespace-nowrap border-b border-slate-800 px-1 py-1">
                  {body.position.x.toFixed(1)}, {body.position.y.toFixed(1)} {unit}
                </td>
                <td className="border-b border-slate-800 px-1 py-1">{body.fixed}</td>
              </tr>
            ))}
            {!nomenclature.bodies.length && <tr><td colSpan={5} className="px-1 py-3 text-center text-slate-500">Aucun solide</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 className="mb-1 mt-5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Liaisons</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[10px]">
          <thead className="text-slate-500">
            <tr>
              <th className="border-b border-slate-700 px-1 py-1">Repère</th>
              <th className="border-b border-slate-700 px-1 py-1">Type</th>
              <th className="border-b border-slate-700 px-1 py-1">Solides</th>
              <th className="border-b border-slate-700 px-1 py-1">Position</th>
            </tr>
          </thead>
          <tbody>
            {nomenclature.joints.map((joint) => (
              <tr
                key={joint.id}
                className={`cursor-pointer ${selectedEntityType === 'Joint' && selectedEntityId === joint.id ? 'bg-indigo-500/20 text-white' : 'hover:bg-slate-800'}`}
                onClick={() => selectEntity(joint.id, 'Joint')}
              >
                <td className="border-b border-slate-800 px-1 py-1 font-mono font-semibold">{joint.reference}</td>
                <td className="border-b border-slate-800 px-1 py-1">{joint.type}</td>
                <td className="whitespace-nowrap border-b border-slate-800 px-1 py-1">{joint.source}–{joint.target}</td>
                <td className="whitespace-nowrap border-b border-slate-800 px-1 py-1">
                  {joint.position.x.toFixed(1)}, {joint.position.y.toFixed(1)} {unit}
                </td>
              </tr>
            ))}
            {!nomenclature.joints.length && <tr><td colSpan={4} className="px-1 py-3 text-center text-slate-500">Aucune liaison</td></tr>}
          </tbody>
        </table>
      </div>
    </aside>
  );
};
