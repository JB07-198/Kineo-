import { useKineoStore } from '../store/useKineoStore';
import { AUTOSAVE_KEY, BACKUP_KEY, parseDocument, restoreDocument, saveDocument } from './persistence';

/** Installs one debounced persistence subscriber; simulation previews never modify the document. */
export function startDocumentLifecycle(report: (message: string) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let blocked = false;
  let dirty = false;
  let revision = useKineoStore.getState().documentRevision;
  const reportError = (error: unknown) => report(`Sauvegarde locale impossible : ${error instanceof Error ? error.message : String(error)}`);
  try {
    const restored = restoreDocument(window.localStorage);
    blocked = restored.blocked;
    if (restored.document) useKineoStore.getState().replaceDocument(restored.document);
    revision = useKineoStore.getState().documentRevision;
    if (restored.warning) report(restored.warning);
    else if (restored.document) report('Dernier document restauré depuis cet appareil.');
  } catch (error) { blocked = true; reportError(error); }
  const flush = () => {
    if (blocked || !dirty) return;
    try {
      saveDocument(window.localStorage, useKineoStore.getState().document);
      dirty = false;
      report('Sauvegarde locale à jour · exportez le JSON pour une copie portable.');
    } catch (error) { reportError(error); }
  };
  const unsubscribe = useKineoStore.subscribe((state, previous) => {
    if (state.document === previous.document) return;
    if (blocked && state.documentRevision !== revision) {
      // Explicit New/Open/Example is the recovery boundary; preserve the corrupt payload separately.
      try {
        const damaged = window.localStorage.getItem(AUTOSAVE_KEY);
        if (damaged) window.localStorage.setItem(`${AUTOSAVE_KEY}.recovery.${Date.now()}`, damaged);
        const backup = window.localStorage.getItem(BACKUP_KEY);
        if (backup) {
          try { parseDocument(backup); window.localStorage.setItem(AUTOSAVE_KEY, backup); }
          catch {
            window.localStorage.setItem(`${BACKUP_KEY}.recovery.${Date.now()}`, backup);
            window.localStorage.removeItem(AUTOSAVE_KEY); window.localStorage.removeItem(BACKUP_KEY);
          }
        } else window.localStorage.removeItem(AUTOSAVE_KEY);
        blocked = false;
      } catch (error) { reportError(error); }
    }
    revision = state.documentRevision;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
  });
  const beforeUnload = (event: BeforeUnloadEvent) => {
    flush();
    const state = useKineoStore.getState();
    if (JSON.stringify(state.document) !== state.savedDocumentJson) {
      event.preventDefault(); event.returnValue = '';
    }
  };
  const onVisibility = () => { if (window.document.visibilityState === 'hidden') flush(); };
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('pagehide', flush);
  window.document.addEventListener('visibilitychange', onVisibility);
  return () => {
    clearTimeout(timer); flush(); unsubscribe();
    window.removeEventListener('beforeunload', beforeUnload);
    window.removeEventListener('pagehide', flush);
    window.document.removeEventListener('visibilitychange', onVisibility);
  };
}
