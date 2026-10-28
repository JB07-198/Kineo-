# Kineo

Kineo is a browser-based editor for planar mechanical diagrams. It uses the canonical
JSON v3.0 format described in [`documentation_etape1_etape2.txt`](./documentation_etape1_etape2.txt)
and starts with a slider-crank (bielle-manivelle-piston) example.

## Requirements

- Node.js `20.19+` or `22.12+` (required by the installed Vite version)
- npm

## Development

```sh
npm ci
npm run dev
```

## Checks and production build

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## GitHub Pages deployment

The project-site URL is `https://jb07-198.github.io/Kineo-/`. The GitHub Actions
deployment workflow builds the app with that project path and publishes the generated
`dist/` directory. In the repository, open **Settings → Pages → Build and deployment
→ Source** and select **GitHub Actions** (do not publish the repository root as a
branch). Push to `main` or run **Deploy GitHub Pages** manually from the Actions tab.

Local development continues to use the root path; the `/Kineo-/` base is selected
automatically inside GitHub Actions.

## Editor

- Add rigid bodies from **+ Solide**; the ground is fixed and protected from deletion.
- Choose a joint symbol to connect the selected body to the ground. Edit either endpoint,
  position, name, local attachment points, or joint DOF values in the inspector.
- Drag a body or joint to move it. **Maj + glisser** pans the view; the wheel and toolbar
  buttons zoom. Grid visibility and 10-unit snapping are toggled in the canvas toolbar.
- Use **Ctrl/Cmd + Z** and **Ctrl/Cmd + Y** (or the toolbar) to undo and redo document edits.
- **Ouvrir** validates JSON v3.0, including referential integrity; **Enregistrer JSON**
  downloads the current document.

The connectivity graph describes topology only; it does not solve constraints or
calculate mobility. Split View synchronizes the 2D editor and graph. The graph,
SVG/PNG export, and document unsaved-change protection are documented in
[`docs/V0.2_GRAPH_PERSISTENCE.md`](./docs/V0.2_GRAPH_PERSISTENCE.md).

Use **Graph** to inspect body/joint connectivity or **Split** for synchronized 2D and
graph views. **Exporter SVG** and **Exporter PNG** create visual outputs; JSON remains
the editable document. Creating a new document or opening another prompts before
discarding unsaved changes.

See [`docs/V0.0_FOUNDATION.md`](./docs/V0.0_FOUNDATION.md),
[`docs/V0.1_2D_EDITOR.md`](./docs/V0.1_2D_EDITOR.md),
[`docs/V0.2_GRAPH_PERSISTENCE.md`](./docs/V0.2_GRAPH_PERSISTENCE.md), and
[`docs/TEST_RESULTS.md`](./docs/TEST_RESULTS.md) for implementation and verification details.
