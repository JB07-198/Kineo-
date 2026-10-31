import { beforeEach, describe, expect, it } from 'vitest';
import { useKineoStore } from '../../store/useKineoStore';
import { useSimulationStore } from '../../store/useSimulationStore';
import { createDefaultDocument, createEmptyKineoDocument } from '../../model/defaultDocument';
import { AUTOSAVE_KEY, BACKUP_KEY, parseDocument, restoreDocument, saveDocument } from '../persistence';
import { analyzeMechanism, compileMechanism } from '../../core/kinematics/model';
import { buildPlanarScene } from '../../model/planarScene';
import { createSvgExport } from '../../model/export2d';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}
beforeEach(() => { useKineoStore.getState().replaceDocument(createDefaultDocument()); useSimulationStore.getState().reset(); });
describe('Persistance locale robuste', () => {
  it('sauvegarde et restaure le document et ses extensions sans perte', () => {
    const storage = new MemoryStorage(), d = createDefaultDocument(); d.custom = { a: [1, 2] };
    saveDocument(storage, d); expect(restoreDocument(storage)).toEqual({ document: d, blocked: false });
  });
  it('conserve le dernier document valide comme secours', () => {
    const storage = new MemoryStorage(), d = createDefaultDocument();
    saveDocument(storage, d); const next = structuredClone(d); next.meta.title = 'Suite'; saveDocument(storage, next);
    expect(parseDocument(storage.getItem(BACKUP_KEY)!)).toEqual(d);
    storage.setItem(AUTOSAVE_KEY, 'broken');
    expect(restoreDocument(storage)).toMatchObject({ document: d, blocked: true });
  });
  it('n’écrase aucun emplacement avec un document invalide', () => {
    const storage = new MemoryStorage(), d = createDefaultDocument(); saveDocument(storage, d);
    const snapshot = new Map(storage.data); d.liaisons[0].classA = 'absent';
    expect(() => saveDocument(storage, d)).toThrow(); expect(storage.data).toEqual(snapshot);
  });
  it('ne remplace pas silencieusement un contenu corrompu ou incompatible', () => {
    const storage = new MemoryStorage(); storage.setItem(AUTOSAVE_KEY, '{"schemaVersion": 4}');
    expect(restoreDocument(storage).blocked).toBe(true);
    expect(() => saveDocument(storage, createDefaultDocument())).toThrow();
    expect(storage.getItem(AUTOSAVE_KEY)).toBe('{"schemaVersion": 4}');
  });
  it('gère un stockage absent, refusé ou saturé', () => {
    expect(restoreDocument(new MemoryStorage())).toEqual({ blocked: false });
    const refused = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(restoreDocument(refused)).toMatchObject({ blocked: true }); expect(() => saveDocument(refused, createDefaultDocument())).toThrow();
  });
  it('préserve le document principal si la rotation du secours échoue', () => {
    const storage = new MemoryStorage(), d = createDefaultDocument(); saveDocument(storage, d);
    const limited = { getItem: (key: string) => storage.getItem(key), setItem: () => { throw new Error('quota'); } };
    expect(() => saveDocument(limited, createEmptyKineoDocument())).toThrow('quota'); expect(restoreDocument(storage).document).toEqual(d);
  });
});
describe('Construction, solveur, aperçu et historique', () => {
  it('crée un premier solide avec une couleur valide depuis un document vide', () => {
    const store = useKineoStore.getState(); store.replaceDocument(createEmptyKineoDocument()); store.addClass('Premier', { x: 0, y: 0, z: 0 });
    expect(useKineoStore.getState().document.classesEquivalence[0].color).toMatch(/^#[a-f0-9]{6}$/i);
  });
  it('crée un bâti idempotent et permet de le remplacer sans déplacer les solides', () => {
    const store = useKineoStore.getState(); store.replaceDocument(createEmptyKineoDocument());
    const ground = store.addGround(); expect(store.addGround()).toBe(ground);
    const body = store.addClass('Mobile', { x: 20, y: 30, z: 0 }); store.setGround(body);
    expect(useKineoStore.getState().document.classesEquivalence.filter((b) => b.isFixed).map((b) => b.id)).toEqual([body]);
    expect(useKineoStore.getState().document.classesEquivalence.find((b) => b.id === body)?.position).toEqual({ x: 20, y: 30, z: 0 });
    store.undo(); expect(useKineoStore.getState().document.classesEquivalence.find((b) => b.id === ground)?.isFixed).toBe(true);
  });
  it('construit un pendule depuis zéro et transmet les ancrages au moteur', () => {
    const store = useKineoStore.getState(); store.replaceDocument(createEmptyKineoDocument());
    const ground = store.addGround(), body = store.addClass('Pendule', { x: 0, y: 0, z: 0 });
    store.addJoint('PIVOT', ground, body, { x: 0, y: 0, z: 0 });
    const model = compileMechanism(useKineoStore.getState().document); expect(model.errors).toEqual([]);
    expect(analyzeMechanism(model)).toMatchObject({ coordinates: 3, constraints: 2, mobility: 1 });
    useSimulationStore.getState().play(); useSimulationStore.getState().seek(1);
    expect(useSimulationStore.getState().session?.result.converged).toBe(true);
  });
  it('anime la bielle-manivelle sans modifier le document, la sauvegarde ou l’historique', () => {
    const original = useKineoStore.getState().document, saved = useKineoStore.getState().savedDocumentJson;
    const s = useSimulationStore.getState(); s.configure('link_1', 30); s.analyze(); s.track('eq_3', { x: 0, y: 0 }); s.play(); s.seek(1);
    const state = useSimulationStore.getState(); expect(state.session!.time).toBe(1); expect(state.trace.length).toBe(1);
    expect(state.preview!.classesEquivalence[3].position!.x).not.toBe(original.classesEquivalence[3].position!.x);
    expect(useKineoStore.getState().document).toBe(original); expect(useKineoStore.getState().savedDocumentJson).toBe(saved); expect(useKineoStore.getState().undoStack).toHaveLength(0);
    const scene = buildPlanarScene(state.preview!); expect(scene.joints.every((j) => j.mismatch < 1e-6)).toBe(true);
    expect(createSvgExport(state.preview!).markup).toContain('data-joint-id="link_1"');
    s.pause(); expect(useSimulationStore.getState().playing).toBe(false);
    s.reset(); expect(useSimulationStore.getState().preview).toBeNull();
  });
  it('préserve l’état actif quand un import invalide est refusé', () => {
    const store = useKineoStore.getState(), original = store.document;
    expect(() => store.replaceDocument({ meta: { schemaVersion: '4.0' } })).toThrow(); expect(useKineoStore.getState().document).toBe(original);
  });
  it('refuse une entrée angulaire bloquée dans un mécanisme à mobilité multiple', () => {
    const d = createDefaultDocument(); d.liaisons = d.liaisons.slice(0, 1); useKineoStore.getState().replaceDocument(d);
    useSimulationStore.getState().play(); expect(useSimulationStore.getState().playing).toBe(false);
    expect(useSimulationStore.getState().message).toContain('mobilité');
  });
});

describe('Secours et limitations de pilotage', () => {
  it('restaure le secours même si la clé principale a disparu', () => {
    const storage = new MemoryStorage(), document = createDefaultDocument();
    storage.setItem(BACKUP_KEY, JSON.stringify(document));
    expect(restoreDocument(storage)).toMatchObject({ document, blocked: false });
  });
  it('refuse une vitesse non finie sans lancer une animation', () => {
    const s = useSimulationStore.getState(); s.configure('link_1', NaN);
    expect(useSimulationStore.getState().playing).toBe(false); expect(useSimulationStore.getState().message).toContain('Vitesse');
  });
});
