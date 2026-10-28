import React, { useRef, useState } from 'react';
import { fromInternalModel, validateReferences } from '../../model/conversion';
import { createDefaultDocument } from '../../model/defaultDocument';
import { createSvgExport, renderSvgAsPng } from '../../model/export2d';
import { validateKineoV3 } from '../../model/validation';
import { useKineoStore } from '../../store/useKineoStore';

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  try {
    window.document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export const Header: React.FC = () => {
  const {
    document,
    activeViewMode,
    setViewMode,
    replaceDocument,
    markDocumentSaved,
    setTitle,
    undo,
    redo,
    undoStack,
    redoStack,
    savedDocumentJson,
  } = useKineoStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const openDocument = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const validated = validateKineoV3(parsed);
      validateReferences(validated);
      if (JSON.stringify(document) !== savedDocumentJson &&
          !window.confirm('Les modifications non enregistrées seront perdues. Remplacer le document actuel ?')) {
        setMessage('Ouverture annulée — les modifications sont conservées.');
      } else {
        replaceDocument(parsed);
        setMessage(`Ouvert : ${file.name}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? `Import impossible : ${error.message}` : 'Import impossible.');
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const createNewDocument = () => {
    if (JSON.stringify(document) !== savedDocumentJson &&
        !window.confirm('Les modifications non enregistrées seront perdues. Créer un nouveau mécanisme ?')) {
      setMessage('Nouveau document annulé — les modifications sont conservées.');
      return;
    }
    replaceDocument(createDefaultDocument());
    setMessage('Nouveau mécanisme créé.');
  };

  const saveDocument = () => {
    try {
      const content = JSON.stringify(fromInternalModel(document), null, 2);
      downloadBlob(`${document.meta.title.trim().replace(/[^a-z0-9_-]+/gi, '-') || 'kineo-mechanism'}.json`, new Blob([content], { type: 'application/json' }));
      markDocumentSaved();
      setMessage('Document JSON v3.0 exporté.');
    } catch (error) {
      setMessage(error instanceof Error ? `Export impossible : ${error.message}` : 'Export impossible.');
    }
  };

  const exportSvg = () => {
    try {
      const { markup } = createSvgExport(document);
      downloadBlob(`${document.meta.title.trim().replace(/[^a-z0-9_-]+/gi, '-') || 'kineo-mechanism'}.svg`, new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
      setMessage('Export SVG terminé.');
    } catch (error) {
      setMessage(error instanceof Error ? `Export SVG impossible : ${error.message}` : 'Export SVG impossible.');
    }
  };

  const exportPng = async () => {
    try {
      const { markup } = createSvgExport(document);
      const blob = await renderSvgAsPng(markup);
      downloadBlob(`${document.meta.title.trim().replace(/[^a-z0-9_-]+/gi, '-') || 'kineo-mechanism'}.png`, blob);
      setMessage('Export PNG terminé.');
    } catch (error) {
      setMessage(error instanceof Error ? `Export PNG impossible : ${error.message}` : 'Export PNG impossible.');
    }
  };

  return (
    <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold">K</div>
        <div className="min-w-0">
          <input
            aria-label="Titre du mécanisme"
            value={document.meta.title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-56 bg-transparent text-sm font-semibold leading-none text-white outline-none"
          />
          <span className="text-xs text-slate-400">Kineo · JSON v3.0</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button className="toolbar-button" onClick={createNewDocument} title="Nouveau mécanisme (exemple bielle-manivelle)">
          Nouveau
        </button>
        <button className="toolbar-button" onClick={() => fileInput.current?.click()}>Ouvrir</button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => void openDocument(event.target.files?.[0])}
        />
        <button className="toolbar-button" onClick={saveDocument}>Enregistrer JSON</button>
        <button className="toolbar-button" onClick={exportSvg}>Exporter SVG</button>
        <button className="toolbar-button" onClick={() => void exportPng()}>Exporter PNG</button>
        <span className="mx-1 h-6 border-l border-slate-700" />
        <button className="toolbar-button" disabled={!undoStack.length} onClick={undo} title="Annuler (Ctrl+Z)">↶</button>
        <button className="toolbar-button" disabled={!redoStack.length} onClick={redo} title="Rétablir (Ctrl+Y)">↷</button>
      </div>

      <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-1 text-xs">
        {(['2D', '3D', 'Graph', 'Split'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              activeViewMode === mode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <span role="status" aria-label="État d'enregistrement" className={`max-w-40 truncate text-[10px] ${JSON.stringify(document) !== savedDocumentJson ? 'text-amber-300' : 'text-slate-400'}`}>
        {JSON.stringify(document) !== savedDocumentJson ? 'Modifications non enregistrées' : 'Enregistré'}
      </span>
      {message && <span role="status" className="max-w-40 truncate text-[10px] text-slate-400" title={message}>{message}</span>}
    </header>
  );
};
