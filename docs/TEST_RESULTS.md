# Kineo v0.1 — Test Results

## Environment

- Node.js `v22.22.2`
- npm `10.9.7`
- Vite `8.3.5`
- Integrated Playwright browser against the local Vite development server

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| `npm run typecheck` | PASS | `tsc -b` completed without errors. |
| `npm run lint` | PASS | ESLint completed without warnings or errors. |
| `npm test` | PASS | 1 test file, 14 tests passed. |
| `npm run build` | PASS | TypeScript build and Vite production build completed; 123 modules transformed. |
| `npm audit` | PASS | 0 vulnerabilities after upgrading Zod to `4.6.7`. |
| `npm audit --omit=dev` | PASS | 0 production vulnerabilities. |
| `git diff --check` | PASS | No whitespace errors in the audited changes. |

The regression tests load the original JSON v3.0 fixture directly from the repository's
specification file using a relative module URL. They test structural round-trip
preservation for non-default metadata and units, definitions, multiple rigid bodies
and liaisons, local anchors, quaternion orientation, driven DOFs, geometry and nested
extension fields. Store coverage includes reference failures, invalid import safety,
body/joint CRUD, local-anchor edits, dependent-reference cascades, ground protection,
and multi-step undo/redo.

## Browser and JSON save/reopen

Verified against the running application:

- Created and renamed a body, added a pivot, edited its local attachment point, and
  observed the edited inspector value. Undo and redo restored the anchor values.
- Dragged the body with snapping enabled: its coordinates changed from `(250, 0)` to
  `(260, 10)`.
- Zoom changed from `170%` to `190%`; Shift-drag panning left the model coordinates
  unchanged. No console errors were observed after correcting the wheel listener.
- At viewport sizes `1024x768` and `1280x800`, the canvas measured `479x676` and
  `735x708` pixels respectively. This verifies canvas resizing, not a mobile layout
  or automatic scene refit.
- Deleting the created body removed its dependent joint. Undo restored both; redo
  removed both again. Exported references after redo were checked against existing
  bodies and DOFs.
- A malformed JSON import displayed an explicit error and left the five-body,
  five-joint document unchanged.

The real **Enregistrer JSON** action was triggered in the browser. The browser
download event did not arrive within 10 seconds, so no OS/browser download path was
available to inspect. As an integration fallback, the test captured the filename and
Blob URL from the action's actual download anchor, fetched and parsed the generated
Blob (`Bielle-manivelle-piston.json`, 11,374 characters), imported that content through
the application's file-input handler, and triggered a second save. A recursive
structural comparison of the two JSON objects was equal. The import handler's success
status confirms the captured JSON passed runtime schema and reference validation.
The user additionally reports manually verifying in Google Chrome that a real
downloaded JSON file can be reopened and that the mechanism is preserved. That
manual verification is user-reported rather than independently captured in this
browser session.

## Scope and limitations

- No kinematic solver or motion simulation is present in v0.1. A drawn joint is not
  proof of a mechanically satisfied constraint; dragging one body does not solve or
  reposition the other connected body.
- The default mechanism has a fixed ground body, but the UI does not designate a
  different ground body.
- 3D, graph/split rendering, formal ISO/AFNOR symbol certification, mobility and
  hyperstatism calculations, image export, autosave, and mobile-specific layout are
  not verified v0.1 features.
- Browser-managed download-file capture remains limited by the integrated browser
  harness as described above.

See [`FINAL_VALIDATION_V0.1.md`](./FINAL_VALIDATION_V0.1.md) for the full audit,
security findings, release checklist, and verdict.
