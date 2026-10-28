# Kineo v0.2 — Test Results

## Environment and scope

- Node.js `v22.22.2`; npm `10.9.7`.
- Vite development server on `http://127.0.0.1:5173/` for the browser checks.
- Validation covers the in-progress v0.2 Graph & Persistence implementation on
  `feature/v0.2`. The package version remains `0.1.0`; this work is not a release.

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| `npm run typecheck` | PASS | `tsc -b` completed without errors. |
| `npm run lint` | PASS | ESLint completed without warnings or errors. |
| `npm test` | PASS | 4 test files, 40 tests passed. |
| `npm run build` | PASS | TypeScript project build passed; Vite transformed 128 modules and emitted the production bundle. |
| `npm audit` | PASS | 0 vulnerabilities. |
| `npm audit --omit=dev` | PASS | 0 production vulnerabilities. |
| `git diff --check` | PASS | No whitespace errors in the reviewed changes. |

The test suite includes JSON v3.0 validation and round trips, document and
reference-integrity operations, undo/redo, multigraph topology and cycle rank,
deterministic graph layout, SVG generation, and PNG-input validation/size limits.
The JSON round-trip test reads the original specification example from the
repository and checks nested extension properties as well as metadata, units,
definitions, bodies, liaisons, anchors, orientations, driven DOFs, and geometry.

## Browser and editor checks

Browser verification used the running Vite development server:

- Graph View rendered the slider-crank as 4 body nodes and 4 liaison edges, with
  one connected component, no isolated nodes, no parallel connections, and one
  independent graph cycle.
- A selected body remained selected when switching to Split View. Selecting the
  Piston from the 2D entity list highlighted the corresponding graph node and
  synchronized the inspector.
- Deleting the graph-selected Piston removed its graph node; undo restored it.
- New-document cancellation preserved a dirty title and displayed the cancellation
  status. Accepting the replacement created a clean default document. Opening a
  valid file after editing was also exercised with confirmation enabled.
- Changing view modes did not alter the exported JSON structure.
- The **Exporter SVG** action produced a captured SVG Blob with 4 body groups,
  4 geometry entities, 4 liaison symbols, and one ground marker.
- The **Exporter PNG** action produced an `image/png` Blob (25,061 bytes) with a
  valid PNG signature and dimensions of `797 x 240` pixels.
- The **Enregistrer JSON** action produced a JSON Blob. The captured content was
  parsed, supplied back to the application's file-input handler as a JSON `File`,
  reopened, and saved again. Structural comparison of the parsed documents was
  equal; both contained JSON schema version `3.0`, 4 bodies, 4 liaisons, and
  4 geometry entities. The imported title and clean saved state were verified.
- No browser console errors were observed during the cross-view selection and
  delete/undo check.

The integrated browser harness captured the Blob produced by the real save/export
toolbar actions, rather than capturing the browser's OS-level download destination.
The saved JSON Blob itself was parsed and re-imported through the real application
file-input handler. A separate OS-managed download file was not independently
inspected in this v0.2 browser run. The user's earlier report of a manual Chrome
download/reopen check pertains to the v0.1 validation.

## Security audit

Both `npm audit` and `npm audit --omit=dev` reported zero vulnerabilities. There
were no dependency-manifest changes in this v0.2 work.

## Limitations

- The graph is derived from rigid bodies and actual liaison instances. Its cycle
  rank is a graph-topology measure only; it does not establish geometric assembly,
  constraint validity, mobility, or solver convergence.
- No kinematic solver, motion simulation, mobility/hyperstaticity calculation, or
  3D editor is implemented.
- SVG and PNG are visual exports, not editable mechanism documents. JSON v3.0
  remains the persistence format.
- Browser verification used the Vite development server, not a deployed GitHub Pages
  site or production preview. Mobile-specific layout and formal ISO/AFNOR
  certification of symbols were not tested.
- The package version remains `0.1.0` to keep the tagged baseline metadata
  unchanged. No commit, tag, push, or publication was performed.

See [`V0.2_GRAPH_PERSISTENCE.md`](./V0.2_GRAPH_PERSISTENCE.md) for the architecture,
behavior, and remaining work.
