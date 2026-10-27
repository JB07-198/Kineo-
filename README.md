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

## Editor

- Add rigid bodies from **+ Solide**; the ground is fixed and protected from deletion.
- Choose a joint symbol to connect the selected body to the ground. Edit either endpoint,
  position, name, or joint DOF values in the inspector.
- Drag a body or joint to move it. **Maj + glisser** pans the view; the wheel and toolbar
  buttons zoom. Grid visibility and 10-unit snapping are toggled in the canvas toolbar.
- Use **Ctrl/Cmd + Z** and **Ctrl/Cmd + Y** (or the toolbar) to undo and redo document edits.
- **Ouvrir** validates JSON v3.0, including referential integrity; **Enregistrer JSON**
  downloads the current document.

The 2D editor does not run a kinematic solver. 3D, graph rendering, motion simulation,
mobility calculation, and image/vector export are not part of v0.1.

See [`docs/V0.0_FOUNDATION.md`](./docs/V0.0_FOUNDATION.md),
[`docs/V0.1_2D_EDITOR.md`](./docs/V0.1_2D_EDITOR.md), and
[`docs/TEST_RESULTS.md`](./docs/TEST_RESULTS.md) for implementation and verification details.
