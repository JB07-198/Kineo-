import React from 'react';
import { useKineoStore } from '../../store/useKineoStore';
import type { Vector3 } from '../../model/jsonV3';

const numberInput = (
  label: string,
  value: number,
  onChange: (value: number) => void,
  suffix?: string,
  disabled = false,
  limits?: { min: number; max: number },
) => (
  <label className="block text-[11px] text-slate-400">
    {label}
    <span className="mt-1 flex items-center rounded border border-slate-700 bg-slate-950 focus-within:border-indigo-500">
      <input
        type="number"
        step="any"
        min={limits?.min}
        max={limits?.max}
        disabled={disabled}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(limits?.max ?? next, Math.max(limits?.min ?? next, next)));
        }}
        className="w-full min-w-0 bg-transparent px-2 py-1.5 font-mono text-xs text-white outline-none"
      />
      {suffix && <span className="px-2 text-[10px] text-slate-500">{suffix}</span>}
    </span>
  </label>
);

const positionFields = (
  position: Vector3,
  update: (position: Vector3) => void,
  unit: string,
  disabled = false,
) => (
  <div className="grid grid-cols-3 gap-2">
    {(['x', 'y', 'z'] as const).map((axis) => (
      <div key={axis}>
        {numberInput(axis.toUpperCase(), position[axis], (value) => {
          update({ ...position, [axis]: value });
        }, unit, disabled)}
      </div>
    ))}
  </div>
);

export const PropertyInspector: React.FC = () => {
  const { document, selectedEntityId, selectedEntityType, updateClass, updateJoint, removeEntity } = useKineoStore();
  const selectedClass = selectedEntityType === 'Class'
    ? document.classesEquivalence.find((body) => body.id === selectedEntityId)
    : undefined;
  const selectedJoint = selectedEntityType === 'Joint'
    ? document.liaisons.find((joint) => joint.id === selectedEntityId)
    : undefined;
  const selectedGeometry = selectedEntityType === 'Geometry'
    ? document.geometry.entities.find((entity) => entity.id === selectedEntityId)
    : undefined;

  const updatePosition = (position: Vector3) => {
    if (selectedJoint) updateJoint(selectedJoint.id, { position });
  };

  return (
    <aside className="h-full w-72 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900 p-4 text-slate-300">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Inspecteur</h2>
      {!selectedEntityId && (
        <div className="py-8 text-center text-xs leading-relaxed text-slate-500">
          Sélectionnez un solide ou une liaison sur la scène ou dans la liste.
        </div>
      )}

      {selectedClass && (
        <div className="space-y-4">
          <div className="font-mono text-[10px] text-slate-500">{selectedClass.id}</div>
          <label className="block text-[11px] text-slate-400">
            Nom du solide
            <input
              value={selectedClass.name}
              onChange={(event) => updateClass(selectedClass.id, { name: event.target.value })}
              className="inspector-input"
            />
          </label>
          <label className="flex items-center justify-between text-[11px] text-slate-400">
            Couleur
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(selectedClass.color) ? selectedClass.color : '#64748b'}
              onChange={(event) => updateClass(selectedClass.id, { color: event.target.value })}
              className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
            />
          </label>
          <div>
            <p className="mb-2 text-[11px] font-medium text-slate-400">Position du repère local</p>
            {positionFields(selectedClass.position ?? { x: 0, y: 0, z: 0 }, (position) => {
              updateClass(selectedClass.id, { position });
            }, document.meta.lengthUnit, selectedClass.isFixed)}
          </div>
          {numberInput('Orientation autour de Z', (selectedClass.rotation ?? 0) * 180 / Math.PI, (value) => {
            updateClass(selectedClass.id, { rotation: value * Math.PI / 180 });
          }, 'deg', selectedClass.isFixed)}
          <p className="text-[10px] text-slate-500">
            {selectedClass.isFixed ? 'Bâti — repère de référence fixe.' : 'Déplacez le solide dans la scène ou modifiez son repère ici.'}
          </p>
          {!selectedClass.isFixed && (
            <button onClick={() => removeEntity(selectedClass.id, 'Class')} className="danger-button">
              Supprimer le solide
            </button>
          )}
        </div>
      )}

      {selectedJoint && (
        <div className="space-y-4">
          <div className="font-mono text-[10px] text-slate-500">{selectedJoint.id} · {selectedJoint.type}</div>
          <p className="text-[10px] text-slate-500">
            {document.jointDefinitions[selectedJoint.type]?.isoCode ?? 'Norme non spécifiée'}
          </p>
          <label className="block text-[11px] text-slate-400">
            Nom
            <input
              value={selectedJoint.name}
              onChange={(event) => updateJoint(selectedJoint.id, { name: event.target.value })}
              className="inspector-input"
            />
          </label>
          <label className="block text-[11px] text-slate-400">
            Solide A
            <select
              value={selectedJoint.classA}
              onChange={(event) => updateJoint(selectedJoint.id, { classA: event.target.value })}
              className="inspector-input"
            >
              {document.classesEquivalence.filter((body) => body.id !== selectedJoint.classB).map((body) => (
                <option key={body.id} value={body.id}>{body.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-slate-400">
            Solide B
            <select
              value={selectedJoint.classB}
              onChange={(event) => updateJoint(selectedJoint.id, { classB: event.target.value })}
              className="inspector-input"
            >
              {document.classesEquivalence.filter((body) => body.id !== selectedJoint.classA).map((body) => (
                <option key={body.id} value={body.id}>{body.name}</option>
              ))}
            </select>
          </label>
          <div>
            <p className="mb-2 text-[11px] font-medium text-slate-400">Position de la liaison</p>
            {positionFields(selectedJoint.position, updatePosition, document.meta.lengthUnit)}
          </div>
          {selectedJoint.dof.length > 0 && (
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <h3 className="text-[11px] font-semibold text-slate-300">Degrés de liberté ({selectedJoint.dof.length})</h3>
              {selectedJoint.dof.map((dof, index) => (
                <div key={dof.id} className="rounded border border-slate-800 bg-slate-950/60 p-2">
                  <div className="mb-2 text-[10px] text-slate-400">
                    {index + 1}. {dof.type === 'rotation' ? 'Rotation' : 'Translation'} · [{dof.min}, {dof.max}] {dof.unit}
                  </div>
                  {numberInput('Valeur', dof.value, (value) => {
                    updateJoint(selectedJoint.id, {
                      dof: selectedJoint.dof.map((item) => item.id === dof.id ? { ...item, value } : item),
                    });
                  }, dof.unit, false, { min: dof.min, max: dof.max })}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => removeEntity(selectedJoint.id, 'Joint')} className="danger-button">
            Supprimer la liaison
          </button>
        </div>
      )}

      {selectedGeometry && (
        <div className="space-y-3">
          <div className="font-mono text-[10px] text-slate-500">{selectedGeometry.id}</div>
          <p className="text-xs text-slate-300">{selectedGeometry.kind} · {selectedGeometry.classId}</p>
          <button onClick={() => removeEntity(selectedGeometry.id, 'Geometry')} className="danger-button">
            Supprimer la géométrie
          </button>
        </div>
      )}
    </aside>
  );
};
