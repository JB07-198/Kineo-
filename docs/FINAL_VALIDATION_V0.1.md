# Kineo v0.1.0 — Final Validation

## 1. Audit summary

The audit reviewed the existing v0.1.0 model, Zod validation, JSON conversion,
Zustand CRUD/history actions, the 2D viewport, inspector, header import/export,
original JSON v3.0 specification, project documentation, tests, package metadata,
and Git state. The original slider-crank and public store/UI structure were
preserved.

The JSON model round-trips the original specification fixture with its metadata,
units, definitions, classes, liaisons, anchors, orientation, driven DOFs, geometry,
and additional nested extension fields. Runtime validation rejects malformed
documents and invalid references before replacing the active document. Store and
browser tests exercised the relevant editing, cascade, and history paths.

The audit found a production Zod advisory and several editor/integrity issues. Zod
was upgraded to its patched release; regressions were fixed and tested. The integrated
browser harness did not expose a browser download event, but the save Blob was
captured, imported through the application, and structurally compared after re-export.
The user additionally reports manually verifying the real download and reopen workflow
in Google Chrome.

## 2. Checks executed

Environment: Node.js `v22.22.2`, npm `10.9.7`, Vite `8.3.5`.

| Command | Result |
|---|---|
| `npm run typecheck` | PASS — `tsc -b`, no errors |
| `npm run lint` | PASS — no warnings or errors |
| `npm test` | PASS — 1 file, 14 tests passed |
| `npm run build` | PASS — production build, 123 modules transformed |
| `npm audit` | PASS — 0 vulnerabilities |
| `npm audit --omit=dev` | PASS — 0 production vulnerabilities |
| `git diff --check` | PASS — no whitespace errors |

The test fixture is read relative to the test module, not via a machine-specific
absolute path. `package.json` remains version `0.1.0`.

## 3. JSON v3.0 compatibility and integrity

### Automated structural round trip

The test extracts the embedded canonical document from
`documentation_etape1_etape2.txt`, then adds non-default metadata/units, a non-identity
quaternion, a driven DOF, and extension fields on metadata, definitions, anchors,
DOFs, classes, geometry style, and kinematics. It validates the document, converts
through the internal model, serializes/reopens it as JSON, and validates again.
Structural equality matched the original fixture exactly; `detectConversionLosses`
returned no losses and reference validation passed.

The original specification includes four rigid bodies, four liaisons, a fixed ground,
local anchors, several joint definitions/DOF types, and geometry. Additional tests
reject incomplete data, non-finite/out-of-range DOFs, duplicate identifiers and
unknown class, cyclic parent, joint type, geometry, and driven-DOF references.

### Import behavior

The store validates schema and references before replacing the active document.
Automated tests confirm failed reference and incomplete-document imports leave the
currently active document unchanged. In the browser, malformed JSON displayed an
explicit parse error and left the current five-body/five-joint document unchanged.

Unknown extension fields are preserved by passthrough schemas and verified at multiple
nested levels. Joint definitions remain a catalogue distinct from liaison instances.
The original fixture and browser export both pass the same application import path.

## 4. Zustand CRUD, ground, references, and history

Automated tests cover body creation/rename/edit; joint creation/edit/deletion; local
attachment edits in a rotated body frame; driven-DOF cleanup; dependent joint and
geometry deletion; ground deletion/movement/rotation protection; unknown-geometry
no-op behavior; and multiple undo/redo operations. Reference integrity was rechecked
after cascades and each tested history transition.

Fixes made during the audit:

- Cascading body deletion now clears selection if the selected body, a dependent joint,
  or dependent geometry was removed.
- Undo/redo clear a selection that no longer exists in the restored document.
- Deleting a nonexistent geometry ID no longer creates a history entry.
- Joint-type lookups require own catalogue properties, preventing inherited JavaScript
  members such as `toString` from being accepted as definitions.
- The inspector now edits local anchor points through the store; moving an anchor in
  its body frame updates the liaison position and corresponding point on the other
  body.

## 5. 2D editor and browser workflow

The browser workflow verified:

1. Adding and renaming a rigid body, selecting it, and adding a pivot.
2. Editing the pivot's local attachment coordinate in the inspector.
3. Undoing and redoing the anchor edit.
4. Dragging a body with snap enabled; `(250, 0)` became `(260, 10)`.
5. Zooming from `170%` to `190%` and Shift-drag panning without changing model
   coordinates.
6. Canvas resizing at `1024x768` and `1280x800`; measured canvas bounds were
   `479x676` and `735x708`.
7. Cascading body deletion, undo, redo, and export-based post-redo reference checks.

A passive wheel listener emitted a browser console error despite zooming successfully.
It was replaced with a non-passive native wheel listener. The browser workflow was
rerun; zoom still worked and no console errors were observed.

The canvas displays schematic relationships only. Moving a single body does not solve
the linkage or ensure that both connected local anchors coincide in world space. This
is intentionally not represented as a solved mechanical constraint. The ground in
the provided mechanism is fixed and protected, but the editor has no control to
designate a different ground body. ISO/AFNOR glyphs are schematic and have not been
formally certified.

## 6. Save, download, and reimport verification

The browser triggered the actual **Enregistrer JSON** handler. The resulting anchor
filename was `Bielle-manivelle-piston.json`; the generated Blob contained 11,374
characters and parsed as JSON schema version `3.0`, with five bodies, five joints,
the snapped body position, and the edited anchor.

The integrated browser did not emit a Playwright `download` event within 10 seconds,
even after the save anchor was attached to the document. Therefore no
browser-managed downloaded path/file could be read directly. As the requested
alternative integration verification, the test fetched the Blob URL generated by
the real save action, fed the content to the application's file-input handler as a
file, waited for the successful import status, triggered a second save, and compared
both JSON values recursively. They were structurally equal. A separate invalid-file
browser import produced an explicit error without changing the open document.

The user reports a separate manual verification in Google Chrome: the actual JSON
download was reopened successfully, and the mechanism was preserved after reimport.
This confirms the physical-download workflow by user report; it was not independently
captured in the integrated browser harness.

**Status:** save payload generation, runtime-validated import, and structural browser
round trip are independently verified; physical downloaded-file reopen is additionally
verified by user report.

## 7. Security advisory

Before remediation, `npm audit` and `npm audit --omit=dev` both reported a direct,
production dependency advisory:

- Package: `zod`, resolved version `3.23.8` (production dependency).
- Advisory: [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Severity: HIGH, CVSS 7.5; memory exhaustion while validating oversized constrained
  collections.
- Affected range: `<4.6.6`; the suggested fix was Zod `4.6.7`, a semver-major update.

Zod was upgraded to `^4.6.7` without `--force`. TypeScript, lint, all 14 tests, the
production build, and the subsequent full and production-only audits passed.
Both audit commands now report zero vulnerabilities.

## 8. Corrections made

- Upgraded direct Zod dependency from v3 to patched v4.6.7 and updated the lockfile.
- Hardened joint-definition lookup against inherited object properties.
- Fixed cascading-selection cleanup, stale selection after undo/redo, and no-op
  deletion history behavior.
- Added local-anchor editing controls and tested coordinate conversion.
- Corrected rotated rectangle hit testing to use its actual polygon instead of its
  axis-aligned bounding box.
- Attached the export link to the document during activation and removed it afterward.
- Fixed passive wheel handling to eliminate a browser console error.
- Added regression tests and updated editor/test documentation to reflect verified
  behavior and remaining constraints.

## 9. Release acceptance checklist

- [x] TypeScript, ESLint, Vitest, production build, and `git diff --check` pass.
- [x] JSON v3.0 original example validates and round-trips without structural loss,
      including extension data.
- [x] Failed imports preserve the active document.
- [x] Store CRUD, deletion cascades, ground protection, attachment edits, and
      undo/redo preserve tested reference integrity.
- [x] Slider-crank editor workflows for creation, selection, editing, movement,
      snapping, zoom, pan, deletion, and history were exercised in the browser.
- [x] The generated JSON Blob was parsed, imported through the UI, and structurally
      compared after re-export.
- [x] User-reported manual Chrome test confirms downloaded JSON reopens and preserves
      the mechanism. The integrated harness itself could not capture a download path;
      the save Blob fallback round trip passed independently.
- [x] Security advisory investigated and remediated; production audit is clear.
- [x] No commit, tag, push, publish, or file deletion was performed.

## 10. Git status and release recommendation

At audit start, branch `main` was clean at `ec155a4`, the same commit as `origin/main`.
At completion, the worktree contains the intended uncommitted source, dependency, test,
and documentation changes. No commit or push was made. Package metadata remains
`0.1.0`.

**Recommendation:** A local v0.1.0 validation/fix commit is reasonable after review of
these changes. Do not tag or publish until the physical browser download limitation
has been checked in a regular browser and the user has reviewed the remaining editor
scope.

## 11. Verdict

# PASS WITH KNOWN LIMITATIONS

Core JSON v3.0 integrity, tested CRUD/history behavior, browser editor interactions,
and production dependency security are verified. The remaining limitations are
explicit: no physical download artifact was captured by the integrated browser
harness; the editor does not solve mechanical constraints or let the user change the
ground body; small-screen layout and formal ISO/AFNOR conformance are not validated.
