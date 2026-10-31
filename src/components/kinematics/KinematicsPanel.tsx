import { useState } from 'react';
import { useKineoStore } from '../../store/useKineoStore';
import { currentInputValue, useSimulationStore } from '../../store/useSimulationStore';
import { posesFor } from '../../core/kinematics/model';
import { createSliderCrank } from '../../core/kinematics/sliderCrank';
import { APP_VERSION } from '../../model/defaultDocument';

export function KinematicsPanel() {
  const { document, replaceDocument, savedDocumentJson } = useKineoStore();
  const s = useSimulationStore();
  const [radius, setRadius] = useState(70), [length, setLength] = useState(120), [angle, setAngle] = useState(45);
  const [originX, setOriginX] = useState(0), [originY, setOriginY] = useState(0), [axisAngle, setAxisAngle] = useState(0);
  const [localError, setLocalError] = useState('');
  const motor = document.liaisons.find((j) => j.id === s.jointId) ?? document.liaisons.find((j) => ['PIVOT', 'GLISSIERE'].includes(j.type));
  const rotational = motor?.type !== 'GLISSIERE';
  const input = currentInputValue();
  const field = (label: string, value: number, update: (n: number) => void, step = 'any') => <label className="block text-[11px] text-slate-400">{label}<input className="inspector-input" type="number" step={step} value={value} onChange={(e) => { if (e.target.value && Number.isFinite(Number(e.target.value))) update(Number(e.target.value)); }} /></label>;
  const analysis = s.analysis;
  return <aside className="h-full w-80 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-900 p-4 text-xs text-slate-300" aria-label="Analyse cinématique">
    <h2 className="mb-3 font-semibold text-white">Cinématique plane · v{APP_VERSION}</h2>
    <button className="toolbar-button w-full" onClick={s.analyze}>Analyser et assembler</button>
    <p className="mt-2 text-[10px] text-slate-500">{document.classesEquivalence.length} solides · {document.liaisons.length} liaisons · XY, rotations en radians dans le moteur</p>
    {analysis && <dl className="my-3 grid grid-cols-2 gap-2 rounded border border-slate-700 bg-slate-950 p-3" aria-label="Résultats numériques">
      {Object.entries({ 'Solides mobiles': analysis.mobileBodies, 'Coordonnées': analysis.coordinates, 'Contraintes': analysis.constraints, 'Rang J': analysis.rank, 'Mobilité locale': analysis.mobility, 'Lignes dépendantes': analysis.redundant,
        'Résidu normalisé': analysis.residual.toExponential(2), [`Résidu ${document.meta.lengthUnit}`]: analysis.lengthResidual.toExponential(2), 'Résidu rad': analysis.angularResidual.toExponential(2),
        'État solveur': s.result?.status ?? '—', 'Itérations': s.result?.iterations ?? 0, 'Singularité suspectée': analysis.singular ? 'Oui' : 'Non',
      }).map(([label, value]) => <div key={label}><dt className="text-[10px] text-slate-500">{label}</dt><dd className="font-mono text-indigo-200">{value}</dd></div>)}
    </dl>}
    <p role="status" className="my-3 whitespace-pre-wrap text-[11px] leading-relaxed text-amber-200">{s.message}</p>
    {analysis?.warnings.map((warning, i) => <p key={i} className="mb-2 text-[10px] text-amber-300">{warning}</p>)}
    <p className="mb-4 text-[10px] text-slate-500">Mobilité locale = n − rang(J), hors pilotage. Une dépendance ne démontre pas un hyperstatisme. Le rang perturbé sert d’indicateur, pas de preuve de mobilité globale.</p>
    <section className="space-y-3 border-t border-slate-700 pt-3" aria-label="Paramètres de simulation">
      <h3 className="font-semibold">Simulation sous contraintes</h3>
      <label className="block text-[11px]">Liaison motrice<select className="inspector-input" value={s.jointId} onChange={(e) => s.configure(e.target.value, s.speed)}><option value="">Sélection automatique</option>{document.liaisons.filter((j) => ['PIVOT', 'GLISSIERE'].includes(j.type)).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}</select></label>
      {field(`Vitesse (${rotational ? 'deg/s' : document.meta.lengthUnit + '/s'})`, s.speed, (n) => s.configure(s.jointId, n))}
      <div className="flex flex-wrap gap-1">
        <button className="toolbar-button" onClick={s.play} disabled={s.playing}>Play</button>
        <button className="toolbar-button" onClick={s.pause} disabled={!s.playing}>Pause</button>
        <button className="toolbar-button" onClick={s.reset}>Stop</button>
        <button className="toolbar-button" onClick={s.reset}>Réinitialiser</button>
      </div>
      {field('Temps demandé (s, 0–3600)', Number((s.session?.time ?? 0).toFixed(3)), (time) => { s.pause(); s.seek(time); }, '.1')}
      <p className="font-mono text-[11px]" data-testid="simulation-time">t = {(s.session?.time ?? 0).toFixed(3)} s</p>
      {input !== null && <p className="font-mono text-[11px]">Entrée calculée : {(rotational ? input * 180 / Math.PI : input).toFixed(3)} {rotational ? 'deg' : document.meta.lengthUnit}</p>}
      <p className="text-[10px] text-slate-500">Conditions initiales : positions et rotations de l’éditeur au lancement. Prévisualisation séparée ; Stop restaure le document. Une entrée pour une mobilité locale de 1.</p>
      <label className="block text-[11px]">Point suivi · solide<select className="inspector-input" value={s.trackedBodyId} onChange={(e) => s.track(e.target.value, s.trackedLocal)}><option value="">Solide sélectionné</option>{document.classesEquivalence.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2">{field('Point local X', s.trackedLocal.x, (x) => s.track(s.trackedBodyId, { ...s.trackedLocal, x }))}{field('Point local Y', s.trackedLocal.y, (y) => s.track(s.trackedBodyId, { ...s.trackedLocal, y }))}</div>
      <p className="text-[10px] text-cyan-300">Trajectoire cyan : {s.trace.length} points, limite 2000.</p>
      {s.session && <div className="space-y-1 rounded bg-slate-950 p-2 text-[10px] font-mono">{Object.entries(posesFor(s.session.model, s.session.q)).map(([id, pose]) => <div key={id}>{document.classesEquivalence.find((b) => b.id === id)?.name} : ({pose.x.toFixed(2)}, {pose.y.toFixed(2)}), {(pose.theta * 180 / Math.PI).toFixed(2)}°</div>)}</div>}
    </section>
    <details className="mt-4 border-t border-slate-700 pt-3"><summary className="cursor-pointer">Générer une bielle-manivelle paramétrée</summary>
      <div className="mt-3 grid grid-cols-2 gap-2">{field('Rayon r', radius, setRadius)}{field('Longueur L', length, setLength)}{field('Angle entrée (deg)', angle, setAngle)}{field('Axe guide (deg)', axisAngle, setAxisAngle)}{field('Origine X', originX, setOriginX)}{field('Origine Y', originY, setOriginY)}</div>
      <button className="toolbar-button mt-3" onClick={() => {
        try {
          const generated = createSliderCrank({ radius, rodLength: length, angle: angle * Math.PI / 180, axisAngle: axisAngle * Math.PI / 180, origin: { x: originX, y: originY } });
          if (JSON.stringify(document) !== savedDocumentJson && !window.confirm('Remplacer les modifications non exportées par le mécanisme paramétré ?')) return;
          replaceDocument(generated); setLocalError('');
        } catch (error) { setLocalError(error instanceof Error ? error.message : String(error)); }
      }}>Créer le mécanisme</button>
      {localError && <p role="alert" className="mt-2 text-red-300">{localError}</p>}
    </details>
  </aside>;
}
