# Résultats des tests — version courante v0.3.0

Voir [FINAL_VALIDATION_V0.3.md](FINAL_VALIDATION_V0.3.md) pour les vérifications actuelles et [evidence/benchmark-v0.3.json](evidence/benchmark-v0.3.json) pour les mesures numériques reproductibles.

---

> Archive ci-dessous : les résultats et limitations suivants décrivent v0.2, pas la version actuelle.

# Kineo v0.2 — Test Results

## Environment and scope

- Node.js `v22.22.2`; npm `10.9.7`.
- Vite development server at `http://127.0.0.1:5174/` for the final schematic review.
- Validation covers the in-progress v0.2 implementation on `feature/v0.2`.
- Package version: `0.2.0`. No commit, tag, push, or publication was performed.

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| `npm run typecheck` | PASS | `tsc -b` exited successfully. |
| `npm run lint` | PASS | ESLint exited successfully. |
| `npm test` | PASS | 5 test files; 49 tests passed. |
| `npm run build` | PASS | `tsc -b` succeeded; Vite production output completed. |
| `npm audit` | PASS | 0 vulnerabilities. |
| `npm audit --omit=dev` | PASS | 0 production vulnerabilities. |
| `git diff --check` | PASS | No whitespace errors. |

Tests cover JSON v3.0 validation and preservation, store lifecycle and undo/redo,
graph topology/layout, scene transforms, local-anchor mismatch reporting, label
collision bounds, joint glyph differentiation/layering, SVG output, and PNG size
guards. Slider-crank tests assert O–A and A–B segment lengths, joint centers and
local-anchor coincidence, horizontal prismatic orientation, ground support geometry,
and valid JSON roundtrip.

## Browser and editor checks

The local application was exercised through its UI, file input, and toolbar. The
browser harness intercepted object URLs to inspect the Blobs emitted by the actual
toolbar actions. This does not verify the OS-managed destination file.

Final schematic run:

- The default reference pose rendered O at the ground origin, A above the horizontal
  guide, and B on the guide. The crank and rod are separate connected segments.
- The slider is a rectangular body between horizontal fixed-ground guide rails.
  Hatching is part of the ground body's geometry; no extra moving body or joint was
  introduced.
- Pivot symbols were visible at O, A, and B. The prismatic symbol had rails and
  support hatching but no circular pivot endpoints. Its symbol is layered behind
  pivot B when both share the slider reference position.
- A corrected four-bar fixture still rendered with four bodies and four pivot
  connections.
- The deliberately inconsistent-anchor fixture displayed a red warning reading
  `Ancrages séparés: 20.0 mm`; the renderer did not silently move the endpoints.
- The actual slider-crank SVG toolbar output had a white background, 14 geometry
  records, 4 liaison records and dimensions of 361.56 x 228.80 SVG user units
  (7,965 bytes). The captured SVG was opened and visually inspected.
- Actual PNG toolbar outputs had valid signature `89504e470d0a1a0a` and measured:
  - 1600 x 1013 pixels (108,505 bytes).
  - 2400 x 1519 pixels (179,911 bytes).
  Both images were opened and visually inspected.
- The standard and HD PNG dimensions preserve the SVG aspect ratio. The exporter
  applies its existing 8192-pixel edge and 32-million-pixel area limits.
- The actual JSON save toolbar action emitted a Blob that validated as schema v3.0.
  It was opened through the application's file-input handler and saved again; the
  two parsed documents were structurally identical. The round-trip retained the
  four bodies, four liaisons, 14 geometry entities, zero driven DOFs, and fixed
  ground.
- Graph and Split views rendered the corrected four-body/four-joint mechanism.
  Selecting the Piston synchronized its inspector fields; the graph exposed its
  corresponding body node.

Earlier browser checks also exercised empty New Document, Example loading,
dirty-document cancellation, Piston deletion and undo. The final model pose changed
only the generated slider-crank reference data, not the document lifecycle.
Automated tests validate and round-trip the corrected default document and verify
the canonical specification fixture with extension fields.

The user separately reported that all 16 earlier v0.2 functional checks passed.
This remains user-reported context, not a claim that those 16 checks were freshly
rerun as part of this schematic correction.

## Security audit

`npm audit` and `npm audit --omit=dev` both reported zero vulnerabilities. There is
no outstanding affected package, dependency path, or advisory requiring remediation.

## Limitations and unverified checks

- The corrected slider-crank is a single static reference pose, not a computed
  motion solution. The 70-unit crank and 120-unit rod preserve the example geometry;
  the slider coordinate is derived only to form a closed initial illustration.
- The graph remains a connectivity/topology view; Kineo does not calculate mobility,
  solve constraints, or simulate mechanism motion.
- Joint glyphs are engineering-inspired schematic marks. Formal ISO/AFNOR compliance
  has not been independently certified.
- Dense labels avoid overlap in representative fixtures, but arbitrary mechanisms
  with many long labels and warnings can still look crowded.
- Browser verification used the development server. The OS-managed download path,
  deployed GitHub Pages behavior, and mobile-specific layout were not independently
  verified here.
- SVG/PNG are visual artifacts. JSON v3.0 remains the editable and reopenable
  document format.

See [`V0.2_GRAPH_PERSISTENCE.md`](./V0.2_GRAPH_PERSISTENCE.md) and
[`FINAL_VALIDATION_V0.2.md`](./FINAL_VALIDATION_V0.2.md) for implementation and
release-readiness detail.
