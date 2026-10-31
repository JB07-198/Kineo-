import type { KineoV3 } from '../model/jsonV3';
import { validateKineoV3 } from '../model/validation';
import { validateReferences } from '../model/conversion';

export const AUTOSAVE_KEY = 'kineo.autosave.v3';
export const BACKUP_KEY = 'kineo.autosave.v3.backup';
export interface DocumentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function parseDocument(text: string): KineoV3 {
  const document = validateKineoV3(JSON.parse(text));
  validateReferences(document);
  return document;
}
export function restoreDocument(storage: DocumentStorage): { document?: KineoV3; warning?: string; blocked: boolean } {
  try {
    const text = storage.getItem(AUTOSAVE_KEY);
    if (!text) {
      const backup = storage.getItem(BACKUP_KEY);
      return backup ? { document: parseDocument(backup), warning: 'Sauvegarde principale absente : copie de secours restaurée.', blocked: false } : { blocked: false };
    }
    try { return { document: parseDocument(text), blocked: false }; }
    catch {
      const backup = storage.getItem(BACKUP_KEY);
      if (backup) return { document: parseDocument(backup), warning: 'Sauvegarde principale invalide : copie de secours restaurée. Exportez le JSON puis choisissez Nouveau ou Ouvrir pour réactiver la sauvegarde.', blocked: true };
      return { warning: 'Sauvegarde locale incompatible ou corrompue, conservée sans modification. Choisissez Nouveau ou Ouvrir après récupération.', blocked: true };
    }
  } catch (error) {
    return { warning: `Restauration impossible : ${error instanceof Error ? error.message : String(error)}`, blocked: true };
  }
}
export function saveDocument(storage: DocumentStorage, document: KineoV3): void {
  // Validate the new payload before touching either slot. Never replace a corrupt slot silently.
  const text = JSON.stringify(document);
  parseDocument(text);
  const previous = storage.getItem(AUTOSAVE_KEY);
  if (previous) {
    parseDocument(previous);
    storage.setItem(BACKUP_KEY, previous);
  }
  storage.setItem(AUTOSAVE_KEY, text);
}
