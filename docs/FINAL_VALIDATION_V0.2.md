# Kineo v0.2 — Final Validation

## Summary

The final schematic corrections preserve the v0.2 editor and JSON v3.0 data model.
The supplied illustration was used as a mechanical reference, not as a source of
copied proportions, colors, or labels. The findings and changes are:

1. **The original slider-crank example was collinear.** The crank, rod and slider
   linkage endpoints all lay on one horizontal line, obscuring the expected
   mechanism shape. It now has O=(0,0), a 70-unit crank at 45 degrees, a 120-unit
   rod, and B on the horizontal slider axis. The slider position is derived once
   from those two lengths for this reference pose; this is not a motion solver.
2. **The guide was only a dashed ground line, and the prismatic symbol looked like a
   pivot.** The ground geometry now has two horizontal guide rails and hatch marks;
   the slider is a separate rectangle. The oriented prismatic symbol has rails,
   slider and support hatching. It has no circular pivot endpoints. The three
   revolute glyphs are drawn above the slider glyph where pivot B shares the same
   location.
3. **Previous canvas and export rendering obscured the mechanical intent.** Both
   outputs use the shared scene and joint glyphs. Actual local anchors coincide at
   O, A, B and the prismatic connection in the example; tests verify the world
   coordinates, body-segment endpoints and original 70/120 lengths. Ordinary
   annotation leaders were removed to reduce crossing lines; mismatch warnings can
   retain leaders.
4. **Report exports were poorly suited to technical documents.** The SVG uses a
   white background and high-contrast monochrome outlines. Browser PNG exports are
   sized to 1600 px or 2400 px wide.

The canvas label font now scales with zoom so it stays within the label bounds used
for collision placement. A representative dense fixture and the corrected four-bar
fixture were visually inspected; automated tests cover label collisions. Dense
scenes with many long labels and warnings can nevertheless look busy.

## Scope and compatibility

- Package metadata is `0.2.0`; document schema remains JSON v3.0.
- Imported v3.0 documents retain their metadata and extension fields through the
  existing passthrough/clone conversion path.
- `jointDefinitions` remains the template catalogue; actual mechanical connections
  remain `liaisons`.
- Anchor warnings are diagnostics only. The renderer does not move bodies, repair
  anchors, solve constraints, or claim a valid assembled mechanism.
- Graph/Split views, topology display, selection, and inspector state continue to use
  the same Zustand document and selection.

## Automated verification

All commands below were run after the mechanical pose, symbol layering and label
leader updates:

| Command | Result |
|---|---|
| `npm run typecheck` | PASS — `tsc -b` exited successfully. |
| `npm run lint` | PASS — ESLint exited successfully. |
| `npm test` | PASS — 5 test files, 49 tests passed. |
| `npm run build` | PASS — TypeScript build succeeded; Vite transformed 130 modules. |
| `npm audit` | PASS — 0 vulnerabilities. |
| `npm audit --omit=dev` | PASS — 0 production vulnerabilities. |
| `git diff --check` | PASS — no whitespace errors. |

Regression coverage includes empty-document creation and roundtrip, store replacement
and history behavior, JSON v3.0 validation, planar transforms, both joint-local
anchors, mismatch warnings, default slider-crank topology and pose, 70/120 rigid
segment lengths, exact reference-point coincidence, horizontal guide orientation,
prismatic-versus-pivot glyph distinction/layering, dense and standard label bounds,
SVG output and PNG dimension validation.

## JSON v3.0 and document lifecycle

- Browser **Nouveau** produced a document with `meta.schemaVersion` equal to `3.0`
  and zero bodies, liaisons, and geometry entities.
- Browser **Exemple** restored the four-body, four-liaison slider-crank.
- The default reference pose has a 70-unit O–A crank and 120-unit A–B rod. O is the
  ground origin; A is above the horizontal slider axis; B lies on that axis. Both
  world-space endpoint anchors of every liaison coincide with the stored liaison
  position within floating-point tolerance.
- The fourth existing liaison remains the horizontal prismatic connection between
  the slider body and ground. No extra body or joint was added. Guide rails and hatch
  marks are geometry owned by the fixed ground body.
- Automated round-trip tests use the project specification fixture and check
  metadata, units, definitions, equivalence classes, liaisons, anchors, orientations,
  driven DOFs, geometry, and nested extension properties.
- Import validation checks document shape and references before replacing store
  state. Failed imports are reported by the header; the existing active document is
  not replaced.
- The latest browser run captured the actual JSON save Blob, validated it, reopened
  it through the application's file-input handler, then saved and parsed it again.
  The documents were structurally identical and retained schema v3.0, app version
  0.2.0, four bodies, four liaisons, 14 geometry entities, zero driven DOFs, and
  the fixed ground.
- Store tests cover CRUD, dependent-reference cleanup, ground protection, and
  undo/redo. Earlier browser checks additionally confirmed that deleting the Piston
  removed its graph node and undo restored it.

These are not solver-validity claims. The graph is topological, and the editor does
not calculate mobility or simulate motion.

## Browser and report-export evidence

The local Vite application was exercised through its UI, file input, and toolbar.
Evidence includes:

- The four-bar fixture rendered with four bodies and four joints.
- The dense annotation fixture fitted in the viewport. Automated assertions found
  no overlap between its label bounds or between those labels and body geometry.
  At fit zoom it remains visually busy, so the fixture is not evidence that every
  arbitrary mechanism will have uncluttered labels.
- The deliberately inconsistent pivot fixture visibly reported
  `Ancrages séparés: 20.0 mm`.
- The four-bar fixture still rendered as four bodies and four pivot connections after
  the generic symbol and layer-order changes.
- The slider-crank 2D canvas was visually inspected: the crank O–A and rod A–B are
  separate sloping links; the three pivots mark O/A/B; the rectangular slider is
  between horizontal rails with hatching below; and the ground is fixed. No body or
  joint positions are animated.
- The actual slider-crank SVG toolbar output was captured and opened in the browser.
  It has a white background, 14 geometry records, 4 liaison records and dimensions
  of 361.56 x 228.80 SVG user units (7,965 bytes). The prismatic symbol has rails
  and hatching but no circular glyph; pivot B is layered above it.
- The actual PNG toolbar outputs had valid PNG signature
  `89504e470d0a1a0a` and measured:
  - Standard: 1600 x 1013 pixels, 108,505 bytes.
  - HD: 2400 x 1519 pixels, 179,911 bytes.
  Both images were opened and visually inspected.
- Graph/Split rendered the four bodies and four joints. Selecting the Piston
  synchronized its inspector fields and showed the corresponding graph node.
  Earlier checks found that deleting and undoing the Piston changed and restored its
  graph node.
- After reload, the slider-crank rendered with four bodies and four liaisons, and no
  browser console or page errors were observed during that reload.

Toolbar output was inspected from the Blobs emitted by the actual save/export
handlers. The harness did not verify the OS-managed destination file on disk. A
deployed GitHub Pages build was not tested in this validation.

The user reported that all 16 earlier v0.2 functional checks passed. This is retained
as user-reported context; it is not represented as a fresh independent execution of
all 16 checks.

## Security audit

`npm audit` and `npm audit --omit=dev` both returned zero vulnerabilities. There is
no affected dependency, advisory path, or known security fix outstanding.

## Remaining limitations and known risks

- The app does not solve kinematics, compute mobility/hyperstaticity, or animate
  motion; the demonstration is a diagram, not a simulation.
- Joint glyphs are schematic. Formal ISO/AFNOR compliance has not been independently
  certified.
- Dense diagrams with long labels and multiple warnings can appear crowded.
  Collision checks cover representative test fixtures, not all possible documents.
- Imported 3D coordinates are retained in JSON, while the editor renders the planar
  XY view.
- OS-level download-file capture, deployed-site behavior, and mobile-specific layout
  were not independently verified.

## Release acceptance checklist

- [x] New creates an empty document; Example loads the slider-crank explicitly.
- [x] Shared 2D and export rendering transforms geometry and each local joint anchor.
- [x] Slider-crank O–A and A–B geometry preserves the 70/120 example lengths and
      terminates at the corresponding world-space pivot anchors.
- [x] O, A, and B are revolute pivots; the existing ground connection at the slider
      is prismatic and horizontally oriented.
- [x] The slider is distinct from fixed guide rails and support hatching.
- [x] Four-bar rendering remains valid after generic symbol changes.
- [x] Anchor disagreement is visible and is not silently repaired or treated as a
      solved constraint.
- [x] Joint types have distinct schematic glyphs in canvas and SVG.
- [x] White-background SVG and 1600/2400 px PNG actions were exercised in browser.
- [x] JSON v3.0 validation, roundtrip preservation, and document lifecycle are covered
      by automated and browser evidence.
- [x] Graph/Split selection and deletion/undo behavior were checked.
- [x] TypeScript, lint, tests, production build, development and production npm audit,
      and diff whitespace checks passed.
- [ ] OS-managed download destination and deployed GitHub Pages behavior independently
      verified.
- [ ] Formal ISO/AFNOR symbol conformity and universally uncluttered layouts certified.

## Git and verdict

- Branch: `feature/v0.2`.
- HEAD before this validation work: `edf6744`.
- Package version: `0.2.0`.
- Changes remain local and uncommitted. No tag, push, merge, or publication was made.

**Verdict: READY FOR REVIEW**, with the unverified deployment/download and visual
limitations explicitly listed above. This verdict confirms the implemented v0.2
scope and recorded checks; it does not claim solver functionality or formal standards
certification.
