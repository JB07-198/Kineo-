# Kineo — Code Wiki

Developer guide for the current Kineo v0.1 codebase. The initial project audit is kept
in [`audit/18_PROJECT_STATUS_AND_ROADMAP.md`](./audit/18_PROJECT_STATUS_AND_ROADMAP.md)
as historical context; the current implementation and test status are recorded in
[`docs/`](./docs/).

## Purpose and scope

Kineo is a browser-based editor for planar mechanical diagrams. Its persistence
contract is the JSON v3.0 example in [`documentation_etape1_etape2.txt`](./documentation_etape1_etape2.txt).
The app opens with a slider-crank example and supports editing rigid bodies, joints,
local attachment points and planar geometry.

The current release is an editor, not a kinematic solver: it does not calculate
mobility or hyperstatism, animate motion, or provide 3D/graph rendering.

## Stack and commands

- React 19, TypeScript 6, Vite 8
- Zustand 5 for document and interface state
- Zod 3 for runtime JSON validation
- Vitest 5 and ESLint 10

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

`npm run build` also type-checks with `tsc -b`.

## Source map

```text
src/
├── App.tsx                         Main shell and document keyboard shortcuts
├── components/
│   ├── canvas/Viewport2D.tsx       HiDPI canvas, drawing, hit-testing, pan/zoom/drag
│   └── layout/
│       ├── Header.tsx              JSON open/save, document title, undo/redo, view modes
│       ├── Sidebar.tsx             Joint library and rigid-body/joint entity list
│       ├── PropertyInspector.tsx   Class and liaison editors
│       └── StatusBar.tsx           Counts, grid/snap state, v0.1 solver notice
├── model/
│   ├── jsonV3.ts                   Canonical JSON v3.0 types
│   ├── validation.ts               Zod shape and numeric validation
│   ├── conversion.ts               Clone-based boundaries and reference integrity
│   ├── defaultDocument.ts          Joint catalogue and slider-crank example
│   └── __tests__/kineo.test.ts     Schema, conversion, store and integrity tests
├── store/useKineoStore.ts          Document CRUD, selection, history and UI settings
└── types/kineo.ts                  Application aliases for the canonical document
```

## Document model and integrity

`KineoDocument` aliases the canonical `KineoV3` model; there is no second legacy
document shape. `jointDefinitions` is a record of templates and `liaisons` is the
separate array of joint instances. Instances refer to equivalence-class IDs and store
local anchors and quaternion orientation.

The editor uses two optional, passthrough class fields: `position` (3D vector) and
`rotation` (planar angle in radians). They describe a body-local frame for the 2D
viewport and are preserved through JSON import/export. Existing v3.0 documents without
these fields remain valid and render with the origin/default orientation.

Zod object schemas are passthrough so unfamiliar user properties are not stripped.
The reference validator checks duplicate IDs, parent/class references, joint types,
geometry ownership and driven-DOF references. `replaceDocument` validates the shape
and references before replacing application state. Import failures are shown in the
header and do not replace the active document.

The import/export conversion functions deep-clone data rather than casting between
different representations. The tests extract and validate the JSON example directly
from the project specification, and include nested unknown properties in round-trip
checks.

## Store and editing flows

The Zustand store owns the active v3 document, current selection, 2D view mode, grid
and snap flags, and bounded undo/redo snapshots. Store actions validate document
references before committing. Deleting a body cascades to its liaisons and geometry,
removes driven-DOF references, and clears child `parentId` values. The ground body
cannot be deleted or moved. Deleting a joint also removes driven references to its
DOFs.

Body placement creates a local segment; the default example additionally has a
ground rail and a slider block. New joints connect the selected body to ground by
default; the inspector can change either endpoint. Dragging a body updates attached
joint world positions using local anchors. Dragging a joint updates its anchor
coordinates in both connected body frames.

The canvas maps document coordinates into CSS pixels, accounts for device pixel ratio,
and observes viewport resizing. Wheel/toolbar controls zoom around the cursor or
viewport; Shift-drag pans; body and joint dragging supports grid snapping. Clicking
canvas geometry or a joint selects the corresponding document entity.

## UI and persistence

- **Ouvrir** reads a selected JSON file, parses it, validates v3.0 shape and references,
  then replaces the active document.
- **Enregistrer JSON** downloads a formatted JSON v3.0 document.
- **Ctrl/Cmd+Z**, **Ctrl/Cmd+Y**, and **Ctrl/Cmd+Shift+Z** provide undo/redo.
- The joint library includes pivot, slider, cylindrical, spherical, planar, helical
  and fixed symbols.
- The 3D, graph and split view selectors remain visible, but are placeholders.
- The solve/simulation control is disabled; the status bar explicitly says no solver is
  available in v0.1.

## Known limitations

- No kinematic solve, computed mobility/hyperstatism, motion playback or DOF driver UI.
- No 3D/graph scene, geometry drawing tools, SVG/PNG export or autosave.
- The standard joint symbols are schematic 2D representations; formal ISO/AFNOR
  conformance has not been independently certified.
- The editor positions bodies in a planar view; imported 3D coordinates are retained
  by JSON but only XY and planar rotation are rendered.

See [`docs/V0.0_FOUNDATION.md`](./docs/V0.0_FOUNDATION.md),
[`docs/V0.1_2D_EDITOR.md`](./docs/V0.1_2D_EDITOR.md), and
[`docs/TEST_RESULTS.md`](./docs/TEST_RESULTS.md) for verified details.
