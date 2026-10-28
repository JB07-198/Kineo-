# Kineo — Code Wiki

Developer guide for the current Kineo v0.2 codebase. The initial project audit is kept
in [`audit/18_PROJECT_STATUS_AND_ROADMAP.md`](./audit/18_PROJECT_STATUS_AND_ROADMAP.md)
as historical context; the current implementation and test status are recorded in
[`docs/`](./docs/).

## Purpose and scope

Kineo is a browser-based editor for planar mechanical diagrams. Its persistence
contract is the JSON v3.0 example in [`documentation_etape1_etape2.txt`](./documentation_etape1_etape2.txt).
The app opens with a slider-crank example and supports editing rigid bodies, joints,
local attachment points and planar geometry.

The current application includes a mechanical connectivity graph, but is not a
kinematic solver: it does not calculate mobility or hyperstatism, animate motion, or
provide 3D modeling.

## Stack and commands

- React 19, TypeScript 6, Vite 8
- Zustand 5 for document and interface state
- Zod 4.6 for runtime JSON validation
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
│   ├── graph/MechanicalGraphView.tsx Interactive mechanical multigraph
│   └── layout/
│       ├── Header.tsx              JSON/SVG/PNG export, guarded open/new, dirty state
│       ├── Sidebar.tsx             Joint library and rigid-body/joint entity list
│       ├── PropertyInspector.tsx   Class and liaison editors
│       └── StatusBar.tsx           Counts, grid/snap state, solver-scope notice
├── model/
│   ├── jsonV3.ts                   Canonical JSON v3.0 types
│   ├── validation.ts               Zod shape and numeric validation
│   ├── conversion.ts               Clone-based boundaries and reference integrity
│   ├── mechanicalGraph.ts          Derived topology, components, parallel edges, cycles
│   ├── graphLayout.ts              Deterministic transient component layout
│   ├── planarCoordinates.ts        Shared planar transforms and quaternion yaw
│   ├── planarScene.ts              Shared geometry, anchors, labels and scene bounds
│   ├── jointSymbols.ts             Reusable schematic 2D joint glyphs
│   ├── export2d.ts                 White SVG and report-size browser PNG rendering
│   ├── defaultDocument.ts          Empty document and slider-crank factories
│   └── __tests__/                   Schema, graph, export, store and integrity tests
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

Body placement creates a local segment. The default slider-crank example additionally
has two fixed horizontal guide rails, support hatching, and a distinct slider-body
rectangle. Its static reference pose preserves the 70-unit crank and 120-unit rod;
the slider position is chosen to place B on the horizontal axis with all attachment
anchors coincident. This pose setup does not solve or animate the mechanism. New
joints connect the selected body to ground by default; the inspector can change
either endpoint. Dragging a body updates attached joint world positions using local
anchors. Dragging a joint updates its anchor coordinates in both connected body
frames.

The canvas maps document coordinates into CSS pixels, accounts for device pixel ratio,
and observes viewport resizing. Wheel/toolbar controls zoom around the cursor or
viewport; Shift-drag pans; body and joint dragging supports grid snapping. Clicking
canvas geometry or a joint selects the corresponding document entity.

`buildPlanarScene` is shared by the canvas and SVG/PNG export path. It transforms
geometry and both local joint anchors using their respective body poses, measures
anchor disagreement without altering the assembly, lays out labels against geometry
and other label bounds, and supplies scene bounds for fit/export. Canvas label text
scales with viewport zoom. Joint glyph geometry is shared by both renderers; symbols
are schematic and have not received formal ISO/AFNOR certification.
The canvas/export keep body geometry, joint glyphs, anchor diagnostics, ground
markers, guide/support geometry, and labels as separate drawing layers. The
prismatic glyph shows an oriented slider and guide with hatching, while revolute
glyphs retain circular articulations; at a shared slider/pivot location, the pivot
is drawn above the guide. Unfamiliar extension types use a neutral diamond/cross
instead of being mislabeled as a known constraint.

## UI and persistence

- **Ouvrir** reads a selected JSON file, parses it, validates v3.0 shape and references,
  then replaces the active document. If unsaved changes exist, replacement requires
  explicit confirmation.
- **Nouveau** starts from a valid empty JSON v3.0 document and confirms before
  discarding unsaved changes. **Exemple** explicitly loads the slider-crank. Dirty
  state compares the canonical document with the last open/new/save baseline and
  respects undo/redo.
- **Enregistrer JSON** downloads a formatted JSON v3.0 document and marks the active
  document saved.
- **Exporter SVG/PNG** exports a standalone white-background rendering, separate from
  editable JSON. PNG actions target 1600 px and 2400 px widths.
- Local anchor disagreement is visible through connectors and a distance warning.
  Circular attachment markers are used for pivots, not prismatic joints. The
  renderer does not disguise disagreement by changing body or joint data.
- **Ctrl/Cmd+Z**, **Ctrl/Cmd+Y**, and **Ctrl/Cmd+Shift+Z** provide undo/redo.
- The joint library includes pivot, prismatic, pivot-sliding, spherical, planar,
  helical, and fixed schematic symbols.
- Graph View derives nodes from rigid bodies and edges only from liaison instances.
  Split View displays the 2D editor and graph side-by-side; both share the same store
  selection and canonical document.
- Graph analysis reports connected components, isolated bodies, parallel connections,
  fixed bodies, and graph cycles. The graph layout is transient UI presentation data.
- The solve/simulation control is disabled; the status bar explicitly says no solver is
  available in the current v0.2 scope.

## Known limitations

- No kinematic solve, computed mobility/hyperstatism, motion playback or DOF driver UI.
- No 3D modeling, geometry drawing tools or autosave.
- Dense diagrams with long labels and multiple warnings can look crowded even though
  representative fixture label bounds are collision-checked.
- A graph cycle indicates connectivity topology only; it is not proof of geometrical
  assembly or solvability.
- The standard joint symbols are schematic 2D representations; formal ISO/AFNOR
  conformance has not been independently certified.
- The editor positions bodies in a planar view; imported 3D coordinates are retained
  by JSON but only XY and planar rotation are rendered.

See [`docs/V0.0_FOUNDATION.md`](./docs/V0.0_FOUNDATION.md),
[`docs/V0.1_2D_EDITOR.md`](./docs/V0.1_2D_EDITOR.md),
[`docs/V0.2_GRAPH_PERSISTENCE.md`](./docs/V0.2_GRAPH_PERSISTENCE.md), and
[`docs/TEST_RESULTS.md`](./docs/TEST_RESULTS.md) for verified details.
