import React from 'react';
import { useKineoStore } from '../../store/useKineoStore';
import type { Vector3 } from '../../model/jsonV3';
import { localBounds, SHAPE_LABELS, type ShapeKind } from '../../model/graphics';

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
  const { document, selectedEntityId, selectedEntityType, updateClass, setGround, updateJoint, updateJointAnchor, updateFixation, setBodyShape, resizeShape, updateGeometry, setDisplay, removeEntity } = useKineoStore();
  const selectedClass = selectedEntityType === 'Class'
    ? document.classesEquivalence.find((body) => body.id === selectedEntityId)
    : undefined;
  const selectedJoint = selectedEntityType === 'Joint'
    ? document.liaisons.find((joint) => joint.id === selectedEntityId)
    : undefined;
  const selectedGeometry = selectedEntityType === 'Geometry'
    ? document.geometry.entities.find((entity) => entity.id === selectedEntityId)
    : undefined;
  const bodyGeometry = selectedClass
    ? document.geometry.entities.find((entity) => entity.classId === selectedClass.id)
    : undefined;
  const selectedFixationBody = selectedEntityType === 'Fixation'
    ? document.classesEquivalence.find((body) => body.groundFixation?.id === selectedEntityId)
    : undefined;
  const selectedFixation = selectedFixationBody?.groundFixation;

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
          <section className="space-y-3 border-t border-slate-800 pt-3">
            <h3 className="text-[11px] font-semibold text-slate-300">Représentation graphique</h3>
            <label className="block text-[11px] text-slate-400">
              Forme
              <select
                value={bodyGeometry && bodyGeometry.kind in SHAPE_LABELS ? bodyGeometry.kind : 'segment'}
                onChange={(event) => setBodyShape(selectedClass.id, event.target.value as ShapeKind, bodyGeometry?.id)}
                className="inspector-input"
              >
                {Object.entries(SHAPE_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
              </select>
            </label>
            {bodyGeometry ? (
              <>
                {(() => {
                const bounds = localBounds(bodyGeometry);
                if (bodyGeometry.kind === 'segment') {
                  return numberInput('Longueur', bounds.width, (value) => resizeShape(bodyGeometry.id, value, 0), document.meta.lengthUnit, false, { min: 1, max: 10000 });
                }
                if (bodyGeometry.kind === 'circle') {
                  return numberInput('Diamètre', bounds.width, (value) => resizeShape(bodyGeometry.id, value, value), document.meta.lengthUnit, false, { min: 1, max: 10000 });
                }
                return (
                  <div className="grid grid-cols-2 gap-2">
                    {numberInput('Largeur', bounds.width, (value) => resizeShape(bodyGeometry.id, value, bounds.height), document.meta.lengthUnit, false, { min: 1, max: 10000 })}
                    {numberInput('Hauteur', bounds.height, (value) => resizeShape(bodyGeometry.id, bounds.width, value), document.meta.lengthUnit, false, { min: 1, max: 10000 })}
                  </div>
                );
              })()}
              {['polygon', 'freeform'].includes(bodyGeometry.kind) && (
                <div className="space-y-2 border-t border-slate-800 pt-2">
                  <h4 className="text-[10px] font-semibold text-slate-400">Sommets locaux du contour</h4>
                  {bodyGeometry.localPoints.map((point, index) => (
                    <div key={`${bodyGeometry.id}-${index}`} className="rounded border border-slate-800 bg-slate-950/60 p-2">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Sommet {index + 1}</span>
                        {bodyGeometry.localPoints.length > 3 && (
                          <button
                            aria-label={`Supprimer le sommet ${index + 1}`}
                            onClick={() => updateGeometry(bodyGeometry.id, {
                              localPoints: bodyGeometry.localPoints.filter((_, pointIndex) => pointIndex !== index),
                            })}
                            className="text-rose-300 hover:text-rose-200"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {numberInput('X local', point.x, (x) => updateGeometry(bodyGeometry.id, {
                          localPoints: bodyGeometry.localPoints.map((item, pointIndex) => pointIndex === index ? { ...item, x } : item),
                        }), document.meta.lengthUnit)}
                        {numberInput('Y local', point.y, (y) => updateGeometry(bodyGeometry.id, {
                          localPoints: bodyGeometry.localPoints.map((item, pointIndex) => pointIndex === index ? { ...item, y } : item),
                        }), document.meta.lengthUnit)}
                      </div>
                    </div>
                  ))}
                  <button
                    disabled={bodyGeometry.localPoints.length < 3}
                    onClick={() => {
                      const points = bodyGeometry.localPoints;
                      const first = points[0], last = points[points.length - 1];
                      updateGeometry(bodyGeometry.id, { localPoints: [...points, {
                        x: (first.x + last.x) / 2, y: (first.y + last.y) / 2, z: (first.z + last.z) / 2,
                      }] });
                    }}
                    className="toolbar-button w-full"
                  >
                    Ajouter un sommet
                  </button>
                </div>
              )}
              <label className="flex items-center justify-between text-[11px] text-slate-400">
                  Couleur du contour
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(bodyGeometry.style.color) ? bodyGeometry.style.color : '#64748b'}
                    onChange={(event) => updateGeometry(bodyGeometry.id, { style: { ...bodyGeometry.style, color: event.target.value } })}
                    className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" />
                </label>
                <label className="flex items-center justify-between text-[11px] text-slate-400">
                  Remplissage
                  <input type="color" value={/^#[0-9a-f]{6}$/i.test(bodyGeometry.style.fill ?? bodyGeometry.style.color) ? bodyGeometry.style.fill ?? bodyGeometry.style.color : '#64748b'}
                    onChange={(event) => updateGeometry(bodyGeometry.id, { style: { ...bodyGeometry.style, fill: event.target.value } })}
                    className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" />
                </label>
                {numberInput('Opacité du remplissage', bodyGeometry.style.fillOpacity ?? 0.18, (value) =>
                  updateGeometry(bodyGeometry.id, { style: { ...bodyGeometry.style, fillOpacity: value } }), '', false, { min: 0, max: 1 })}
                {numberInput('Épaisseur du trait', bodyGeometry.style.width, (value) =>
                  updateGeometry(bodyGeometry.id, { style: { ...bodyGeometry.style, width: value } }), 'px', false, { min: 0.2, max: 20 })}
                <label className="block text-[11px] text-slate-400">
                  Style du contour
                  <select value={bodyGeometry.style.stroke} onChange={(event) =>
                    updateGeometry(bodyGeometry.id, { style: { ...bodyGeometry.style, stroke: event.target.value } })}
                    className="inspector-input">
                    <option value="solid">Continu</option>
                    <option value="dashed">Tireté</option>
                  </select>
                </label>
                <p className="text-[10px] text-slate-500">La forme est graphique ; les ancrages et le calcul mécanique restent inchangés.</p>
              </>
            ) : <p className="text-[10px] text-slate-500">Choisissez une forme pour ajouter une représentation graphique.</p>}
          </section>
          <p className="text-[10px] text-slate-500">
            {selectedClass.isFixed ? 'Bâti — repère de référence fixe.' : 'Déplacez le solide dans la scène ou modifiez son repère ici.'}
          </p>
          {!selectedClass.isFixed && <button className="toolbar-button" onClick={() => setGround(selectedClass.id)}>Définir comme bâti unique</button>}
          {!selectedClass.isFixed && (
            <button onClick={() => removeEntity(selectedClass.id, 'Class')} className="danger-button">
              Supprimer le solide
            </button>
          )}
        </div>
      )}

      {selectedFixation && selectedFixationBody && (
        <div className="space-y-4">
          <div className="font-mono text-[10px] text-slate-500">{selectedFixation.id} · Encastrement au bâti</div>
          <p className="text-[10px] text-slate-400">Solide : {selectedFixationBody.name}. Le repère mécanique de ce solide reste fixe.</p>
          <div>
            <p className="mb-2 text-[11px] font-medium text-slate-400">Point du symbole dans le repère local</p>
            {positionFields(selectedFixation.localPoint, (localPoint) => updateFixation(selectedFixation.id, { localPoint }), document.meta.lengthUnit)}
          </div>
          {numberInput('Orientation de la surface', (selectedFixation.angle + (selectedFixationBody.rotation ?? 0)) * 180 / Math.PI, (degrees) =>
            updateFixation(selectedFixation.id, { angle: degrees * Math.PI / 180 - (selectedFixationBody.rotation ?? 0), orientationMode: 'manual' }), 'deg')}
          <p className="text-[10px] text-slate-500">Déplacer le symbole ne modifie pas les coordonnées mécaniques contraintes.</p>
          <button onClick={() => removeEntity(selectedFixation.id, 'Fixation')} className="danger-button">Supprimer la fixation</button>
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
          <div className="space-y-3 border-t border-slate-800 pt-3">
            <h3 className="text-[11px] font-semibold text-slate-300">Points d'attache locaux</h3>
            {([
              ['onClassA', 'Solide A'],
              ['onClassB', 'Solide B'],
            ] as const).map(([frame, label]) => (
              <div key={frame}>
                <p className="mb-2 text-[10px] text-slate-400">{label}</p>
                {positionFields(
                  selectedJoint.anchors[frame],
                  (anchor) => updateJointAnchor(selectedJoint.id, frame, anchor),
                  document.meta.lengthUnit,
                )}
              </div>
            ))}
            <p className="text-[10px] text-slate-500">
              Modifier un point déplace la liaison dans le repère du solide choisi et recalcule le point correspondant sur l'autre solide.
            </p>
          </div>
          {['GLISSIERE', 'PIVOT_GLISSANT'].includes(selectedJoint.type) && (() => {
            const axis = selectedJoint.dof.find((dof) => dof.type === 'translation')?.axisLocal;
            return axis ? numberInput('Direction de translation dans le repère A', Math.atan2(axis.y, axis.x) * 180 / Math.PI, (degrees) => {
              const angle = degrees * Math.PI / 180;
              const bodyA = document.classesEquivalence.find((body) => body.id === selectedJoint.classA);
              const worldAngle = angle + (bodyA?.rotation ?? 0);
              updateJoint(selectedJoint.id, {
                dof: selectedJoint.dof.map((dof) => dof.type === 'translation' || selectedJoint.type === 'PIVOT_GLISSANT'
                  ? { ...dof, axisLocal: { ...dof.axisLocal, x: Math.cos(angle), y: Math.sin(angle), z: 0 } } : dof),
                orientation: { x: 0, y: 0, z: Math.sin(worldAngle / 2), w: Math.cos(worldAngle / 2) },
              });
            }, 'deg') : null;
          })()}
          {['GLISSIERE', 'PIVOT_GLISSANT', 'ENCASTREMENT'].includes(selectedJoint.type) && numberInput('Angle relatif de référence B − A', (typeof selectedJoint.referenceAngle === 'number' ? selectedJoint.referenceAngle :
            (document.classesEquivalence.find((b) => b.id === selectedJoint.classB)?.rotation ?? 0) - (document.classesEquivalence.find((b) => b.id === selectedJoint.classA)?.rotation ?? 0)) * 180 / Math.PI,
            (degrees) => updateJoint(selectedJoint.id, { referenceAngle: degrees * Math.PI / 180 }), 'deg')}
          <p className="text-[10px] text-slate-500">Les valeurs DOF ci-dessous sont les métadonnées du document. Le mouvement se pilote dans Analyse / Simulation.</p>
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

      <section className="mt-6 space-y-2 border-t border-slate-800 pt-3">
        <h3 className="text-[11px] font-semibold text-slate-300">Affichage du schéma</h3>
        {([
          ['bodyIds', 'Repères des solides'],
          ['jointIds', 'Repères des liaisons'],
          ['anchors', 'Ancrages'],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between text-[10px] text-slate-400">
            {label}
            <input type="checkbox" checked={document.geometry.display?.[key] ?? (key !== 'anchors')}
              onChange={(event) => setDisplay({ [key]: event.target.checked })} />
          </label>
        ))}
      </section>
    </aside>
  );
};
