# Kineo v0.0 / v0.1 — Test Results

## Environment

- Node.js `v22.22.2`
- npm `10.9.7`
- Browser smoke test against the local Vite development server

## Automated checks

| Check | Result | Notes |
|---|---|---|
| `npm ci` | PASS | Installed from the lockfile. npm reported one high-severity audit advisory; it was not assessed or remediated in this task. |
| `npm run typecheck` | PASS | `tsc -b` completed without errors. |
| `npm run lint` | PASS | ESLint completed without warnings or errors. |
| `npm test` | PASS | 1 test file, 10 tests passed. |
| `npm run build` | PASS | TypeScript project build and Vite production bundle completed (29 modules transformed). |
| `git diff --check` | PASS | No whitespace errors. |

For the Pages fix, the GitHub Actions build is additionally verified with
`GITHUB_ACTIONS=true npm run build`; the emitted HTML points to
`/Kineo-/assets/...` and `/Kineo-/favicon.svg` rather than the unprefixed site root.

Coverage includes validation of the original JSON v3.0 example, lossless conversion
and serialization/reopening including unfamiliar nested properties, valid store import,
missing/invalid references, numeric limits, joint-library completion, body/joint
editing, local attachment transforms, cascading deletion, and undo/redo.

## Browser smoke test

Verified in the rendered local application:

- The slider-crank example displays in the 2D viewport with all four bodies and four
  joints visible.
- Selecting a body opens its inspector properties.
- Creating a body and a pivot adds them to the entity list and updates counts.
- Undo and redo return the liaison list to the expected counts.
- Dragging the crank updates the inspector position with snapping enabled.
- The JSON save control runs and reports its export status.
- A valid JSON v3 file was imported through the browser file picker; an invalid text
  file displayed an explicit parse error and left the imported document unchanged.
- No browser console errors were observed in the final interaction pass.

The browser harness did not capture and inspect the downloaded JSON artifact. The
model-level tests verify serialization/reopening and valid import through the same
validation/store actions; checking the saved file in a normal browser download flow
remains advisable.

## Not verified / remaining

- GitHub Actions has been configured but no remote workflow run was triggered.
- The npm audit advisory noted during dependency installation was not investigated.
- 3D, graph rendering, kinematic solving, motion simulation, mobility/hyperstatism,
  SVG/PNG export, and autosave remain out of scope for v0.1.
