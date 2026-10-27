# Kineo — Project Status Audit & Roadmap

> Historical baseline audit before the v0.0/v0.1 implementation. Its defect and
> roadmap tables describe that baseline, not the current working tree. See
> [`../docs/V0.0_FOUNDATION.md`](../docs/V0.0_FOUNDATION.md),
> [`../docs/V0.1_2D_EDITOR.md`](../docs/V0.1_2D_EDITOR.md), and
> [`../docs/TEST_RESULTS.md`](../docs/TEST_RESULTS.md) for current status.

**Repository:** `C:\Users\Toshiba\Kineo-` → `https://github.com/JB07-198/Kineo-`
**Audit date:** 2026-10-27 · **Audited revision:** working tree at HEAD `b34cef1`
**Method:** static reading of every source file, `tsc -b`, `eslint .`, isolated-build experiment (syntax repaired in a throw-away copy), runtime harness over the model layer, `git` inspection of local + remote state.

---

## 1. Executive summary

**What it is.** Kineo is a browser-based kinematics studio for drawing, validating and animating planar/spatial mechanisms using normalised ISO 3952-1 / AFNOR joint symbols. Concept, data contract (JSON v3.0) and UI mock-up are specified in `documentation_etape1_etape2.txt`; the product target is a 100 % client-side app hosted free on GitHub Pages, later wrappable as a desktop binary (Electron/Tauri).

**What exists.** A working application shell: header (view/mode switches), ISO joint library sidebar, class list with add/delete, property inspector for equivalence classes, status bar with a simulation strip, and a Canvas 2D viewport that draws only axes + anchors. Alongside it, a second, *detached* model layer (`src/model/`) implementing the canonical JSON v3.0 contract with Zod validation, plus one test file.

**Verdict.** The *concept and interface skeleton* are solid and the design documentation is above average for a project at this stage. The *delivery* is not: **the build is red, the source code is not in version control at all, and roughly none of the MVP features beyond the layout are implemented.** The project is best described as "UI shell + specification + a half-finished model migration", not as a working MVP.

| Dimension | Status |
|---|---|
| Product definition (spec, data model, mock-up) | 🟢 Good and usable |
| UI shell (layout, navigation state, theming) | 🟢 Coherent, renders correctly |
| Type-check / build | 🔴 Fails — 3 syntax errors → `npm run build` impossible |
| Lint | 🔴 Fails — 8 errors |
| Tests | 🔴 Cannot run (toolchain blocked here); logically fails on 1 of 3 cases |
| Version control | 🔴 **Critical** — entire app is untracked; GitHub holds only README/LICENSE |
| JSON v3.0 model layer | 🟡 Written, validated, but **unused by the app** |
| MVP features (edit, simulate, export, deploy) | 🔴 Mostly absent (see §5) |

**The single most urgent action is not a feature: it is committing and pushing the sources.** Today, one `git clean -fdx` or a disk failure destroys the whole application, because `git ls-tree` of the repository contains three files (`README.md`, `LICENSE`, `.gitignore`) and nothing else.

---

## 2. Product purpose

### 2.1 Problem statement (spec §1)

Mechanical link diagrams that respect ISO/AFNOR conventions are painful to produce: heavyweight CAD tools are not symbol-oriented, drawing tools know nothing about kinematics. Kineo's promise is a single tool that (a) draws normalised joints, (b) checks consistency automatically, and (c) animates the resulting degrees of freedom in real time.

### 2.2 Functional scope of the MVP (spec §2)

| # | Capability | Detail |
|---|---|---|
| 1 | 2D/3D editing | ISO 3952-1 library, automatic colour per equivalence class, synchronised 2D / 3D / graph views |
| 2 | Intelligence & ergonomics | Magnetic snap on anchors, automatic detection of over-constraints and incoherences |
| 3 | Simulation | DOF animation, motor DOF + rotational speed control, auto-generated liaison graph |
| 4 | Export | SVG / PNG for reports and lectures |
| 5 | Infrastructure | Free hosting (GitHub Pages), 100 % browser, later Electron/Tauri without rewriting the core |

### 2.3 Technical constraints

- Front-end only, no backend, no paid service (0 €).
- Canonical persistence format: **JSON v3.0** (`meta`, `jointDefinitions`, `classesEquivalence`, `liaisons`, `kinematics`, `geometry`).
- Deployable as a static site; the core must stay portable to a desktop wrapper.

### 2.4 Naming inconsistency to settle

The specification document is titled **"CinémaLab"**; the repository, the UI (`Kineo Mechanics Studio v3.0`) and the GitHub description all say **Kineo**. This is harmless but should be normalised everywhere, including `README.md` and the spec title.

---

## 3. Technical baseline

| Item | Value |
|---|---|
| Language / bundler | TypeScript `~6.0.3`, Vite `^8.3.4` (rolldown), ESM |
| UI | React `^19.3.1` + Tailwind CSS `^4.3.3` (`@tailwindcss/postcss`) |
| State | Zustand `^5.0.16` (single flat store) |
| Validation | Zod `^3.23.8` |
| Tests | Vitest `^5.0.5` (no `test` script declared) |
| Node on the audited machine | v24.14.0 / npm 11.9.0 |
| Lines of TS/TSX in `src/` | ~990 (13 files) |
| Dependencies promised but missing | **Three.js** (announced in the GitHub description, never installed) |

### 3.1 File map

```
Kineo-/
├─ documentation_etape1_etape2.txt   Spec: vision, MVP, JSON v3.0 example, ASCII mock-up
├─ audit/17_PREPARATION_GIT_ET_JSON_V3.md   Prior gap analysis (JSON v3.0 ↔ TypeScript)
├─ index.html                        Title "kineo-", lang="en", no meta description
├─ src/
│  ├─ main.tsx                       React root, imports ./index.css (Tailwind entry)
│  ├─ App.tsx                        Layout: Header / Sidebar / viewport / Inspector / StatusBar
│  ├─ components/
│  │  ├─ layout/Header.tsx           Brand + 2D/3D/Graph/Split switch + Edit/Simulation switch
│  │  ├─ layout/Sidebar.tsx          7 static ISO joint buttons + class list (+ Add/Delete)
│  │  ├─ layout/PropertyInspector.tsx Class inspector (read-only fields, delete)
│  │  ├─ layout/StatusBar.tsx        Play/Reset + static m & h + time display
│  │  └─ canvas/Viewport2D.tsx       Canvas: axes, origin, anchors
│  ├─ store/useKineoStore.ts         Zustand: document + UI state + CRUD + sim flags
│  ├─ types/kineo.ts                 Internal document model (legacy shape) — BROKEN
│  └─ model/
│     ├─ jsonV3.ts                   Canonical JSON v3.0 types (external contract)
│     ├─ validation.ts               Zod schema + validateKineoV3()
│     ├─ conversion.ts               toInternal/fromInternal + reference checks
│     └─ __tests__/kineo.test.ts     3 tests over the spec document
├─ public/                           favicon.svg, icons.svg (icons.svg unused)
├─ dist/                             Stale build output (03:58, before model layer)
└─ configs: vite, tsconfig.{json,app,node}, eslint, tailwind, postcss
```

### 3.2 Data flow as implemented

```
documentation_etape1_etape2.txt
        │ (manual copy in spec §1)
        ▼
src/model/jsonV3.ts ──► validation.ts (Zod) ──► conversion.ts ──► test only
                                                        ✗  (never imported by UI)

src/types/kineo.ts ──► useKineoStore.ts ──► 5 UI components  ← the app actually runs on this
        (legacy shape, broken syntax)          (no liaisons, no geometry rendering)
```

The two halves never meet: **no application module imports `validation.ts`, `jsonV3.ts` or `conversion.ts`** (verified by a project-wide import search — only the test file does). Consequently the app cannot read or write the format it is specified around.

---

## 4. Architecture: what is actually there

### 4.1 State (`src/store/useKineoStore.ts`)

One Zustand store holding the document plus view mode (`2D | 3D | Graph | Split`), app mode (`Edit | Simulation`), selection (`id` + type), CRUD for classes, "joints", anchors, and simulation flags (`isPlaying`, `currentTime`).

Strengths: small, readable, immutable updates, sensible separation of *document* and *UI state*.
Weaknesses: no `lastModified` refresh, no undo/redo, no persistence, no cascade delete, and — most importantly — it stores **"jointDefinitions" as an array of joint instances** while the JSON v3.0 contract defines `jointDefinitions` as a **catalogue keyed by ISO code** and keeps instances in `liaisons`. The same word means two different things on each side of the boundary.

### 4.2 Rendering (`Viewport2D.tsx`)

Resizes a canvas to its parent, clears it, draws the X/Y axes, the origin dot, and one blue dot per `document.anchors` at a hard-coded 50 px per unit. No geometry, no liaisons, no grid, no pan/zoom, no selection, no ISO symbols. A `resize` listener adjusts `canvas.width/height` but **never redraws** — resizing a canvas clears it, so the viewport goes blank until some document state changes. No `devicePixelRatio` handling (blurry on HiDPI screens).

### 4.3 Simulation

`toggleSimulationPlay` flips a boolean; `setSimulationTime` is exported but **never called anywhere**, and no `requestAnimationFrame` / timer loop exists. The "Simulation" mode therefore changes a button colour and a footer, nothing else. Mobilité (`m`) and hyperstatisme (`h`) shown in the status bar are constants copied from the initial document (1 / 0), not computed from the mechanism.

### 4.4 Model layer (`src/model/`)

Well-written for what it is: `jsonV3.ts` mirrors the spec types, `validation.ts` is a faithful Zod transcription, `conversion.ts` documents intent. But:

- `toInternalModel` / `fromInternalModel` are **`as unknown as` casts**, i.e. no conversion at all;
- `validateReferences` assumes a top-level `anchors` array, which the canonical format does not have (anchors live inside each liaison) → it throws `Cannot read properties of undefined (reading 'map')` on a valid v3.0 document (reproduced, §6.4);
- `detectConversionLosses` only walks the *original* object, so it can never detect fields the internal model adds or requires (it reports "no loss" for a document that would crash the UI).

---

## 5. Feature status against the mock-up

Legend: ✅ implemented · 🟡 partial/static · 🔴 absent

| Area (spec / mock-up) | Implemented today | Status | Notes |
|---|---|---|---|
| App frame, branding, dark theme | Header/Sidebar/Inspector/StatusBar | ✅ | Renders and looks like the mock-up |
| View switch 2D / 3D / Graph / Split | State + segmented control | 🟡 | Only 2D exists; 3 others show a placeholder card |
| Edit / Simulation switch | State + styled buttons | 🟡 | Only alters the status bar |
| ISO 3952-1 joint library | 7 buttons | 🟡 | **No `onClick`**, purely decorative; 3 of 7 types (Planar, Helicoidal, Fixed) have no definition in the schema |
| Equivalence classes (list, colour, add, delete) | Yes | 🟡 | Colour is random and sometimes invalid hex; name/colour fields are read-only; no `parentId` hierarchy |
| Click-to-place a liaison | — | 🔴 | No canvas interaction at all |
| Property inspector for a liaison/DOF (mock-up's main panel) | — | 🔴 | Only the Class branch exists |
| Magnetic snap on anchors | — | 🔴 | — |
| Over-constraint detection + warning banner | — | 🔴 | `m`/`h` are hard-coded |
| 2D rendering of geometry (`geometry.entities`) | — | 🔴 | Entities never read |
| 3D view | — | 🔴 | Three.js not even a dependency |
| Liaison graph view | — | 🔴 | — |
| DOF animation / motor / speed | Boolean flag only | 🔴 | No clock, no solver |
| Timeline / scrubber | Time display only | 🔴 | `currentTime` never advances |
| SVG / PNG export | — | 🔴 | — |
| JSON open / save / autosave | — | 🔴 | Model layer not wired; refresh loses everything |
| Undo / redo | — | 🔴 | Buttons in mock-up, absent in header |
| GitHub Pages deployment | — | 🔴 | No workflow, no `base` in `vite.config.ts` |
| Desktop packaging (Electron/Tauri) | — | 🔴 | Explicitly a later step |

**Rough completion estimate against the MVP defined in Étape 1: ~15 %**, of which almost all is layout and state plumbing.

---

## 6. Verification results (reproducible)

### 6.1 Type-check / build — 🔴 fails

```
$ node node_modules/typescript/bin/tsc -b --pretty false
src/types/kineo.ts(63,27): error TS1011: An element access expression should take an argument.
src/types/kineo.ts(64,1):  error TS1128: Declaration or statement expected.
src/types/kineo.ts(120,1): error TS1128: Declaration or statement expected.
```

`src/types/kineo.ts` contains two truncated blocks: the `DOFTemplate` members (`mobility`, `hyperstatism`, `inputJointIds`) are orphaned after `KinematicsSolverBlock`, and a second stray copy of the `KinematicsSolverBlock` fields sits between `GeometryEntity` and `KineoDocument`. Because `npm run build` is `tsc -b && vite build`, **the production build cannot be produced**, and `dist/` is a leftover from 03:58 (it predates the model layer written at 05:51, so it does not reflect the current source).

### 6.2 What remains after repairing only the syntax

Repaired in an isolated copy (syntax only, nothing else changed), `tsc` still reports 6 errors:

| File | Error |
|---|---|
| `Header.tsx:15` | `'document.metadata' is possibly 'undefined'` |
| `__tests__/kineo.test.ts:3,4` | `Cannot find name 'fs' / 'path'` (tsconfig `types: ["vite/client"]` excludes Node types) |
| `conversion.ts:37` | `'anchorIds' is declared but its value is never read` (`noUnusedLocals`) |
| `useKineoStore.ts:108` | `Type 'Record<string, any>' must have a '[Symbol.iterator]()'` — array spread into a record field |
| `useKineoStore.ts:143` | `Parameter 'j' implicitly has an 'any' type` |

These are not typos: they are the visible edge of the model mismatch (F3). Fixing the syntax alone leaves the build red unless those five sites are addressed.

### 6.3 Lint — 🔴 fails

```
$ node node_modules/eslint/bin/eslint.js .
✖ 8 problems (8 errors, 0 warnings)
  conversion.ts: 2:60, 37:9, 65:26, 65:37
  jsonV3.ts:     2:59
  validation.ts: 2:36, 119:47
  types/kineo.ts: 120:34
```

Causes: invisible non-breaking spaces in comments (5 × `no-irregular-whitespace`), one unused variable, two `no-explicit-any`. No CI gate exists to catch this.

### 6.4 Tests — 🔴 cannot start here, and would fail

`vitest` cannot boot in this sandboxed shell (`spawn EPERM` while Vite bundles its config); to obtain a real signal the model layer was compiled to CommonJS and exercised with an equivalent harness:

```
PASS  1. spec validates against Zod schema
PASS  2. round-trip conversion without loss
FAIL  3. reference integrity  ->  Cannot read properties of undefined (reading 'map')
```

So the Zod schema genuinely accepts the specification document — the validation work is sound — but `validateReferences` is built on a wrong assumption (`doc.anchors`). Additional portability defects in `kineo.test.ts`: it reads `C:/Users/Toshiba/Kineo-/documentation_etape1_etape2.txt` by **absolute path** (breaks on any other machine/CI), extracts JSON via `indexOf('{')`/`lastIndexOf('}')` from a prose file, and imports Node built-ins from a browser tsconfig. There is also no `test` script in `package.json`, so `npm test` does not exist.

### 6.5 Git — 🔴 the source is not versioned

```
$ git log --oneline
b34cef1 Initial commit
$ git show --stat HEAD
 .gitignore | 149 ++++  LICENSE | 21 ++  README.md | 2 +
$ git status --short
 M .gitignore
 M README.md
?? audit/ ?? documentation_etape1_etape2.txt ?? eslint.config.js ?? index.html
?? package-lock.json ?? package.json ?? postcss.config.js ?? public/ ?? src/
?? tailwind.config.js ?? tsconfig.app.json ?? tsconfig.json ?? tsconfig.node.json ?? vite.config.ts
$ git rev-parse HEAD origin/main
b34cef1fd4ac2cae831a9dcb5ec8910e9225ad82  (both)
```

Every application file is **untracked**, and `origin/main` is the same commit, so **GitHub contains no code**. Two regressions came with the local rewrite:

- `README.md` (committed) described the actual product; the working copy was overwritten with the **Vite template boilerplate** (`+75 / −2`).
- `.gitignore` (committed, standard Node) was replaced by a minimal Vite version that no longer ignores `.env*`, `coverage/`, `*.tsbuildinfo`, `.vite/`, editor caches, etc.

`git check-ignore` confirms none of `src/` is ignored — nothing is being silently excluded; it was simply never added. Note also the CRLF/LF warnings: there is no `.gitattributes`.

### 6.6 Environment note (not a project defect)

On this machine `npm`/`npx` PowerShell shims are blocked by the execution policy (`npm.ps1 cannot be loaded`), so `npm run dev`, `npm run build`, `npm test` fail from PowerShell even when the project is healthy. `npm.cmd` works (`npm.cmd --version` → 11.9.0). Either use `npm.cmd …` or run once:
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

---

## 7. Findings

| ID | Severity | Finding | Evidence | Impact | Fix |
|---|---|---|---|---|---|
| **F1** | 🔴 Blocker | `src/types/kineo.ts` is syntactically broken (two truncated interface blocks) | `tsc -b` → 3 × TS1011/TS1128 | `npm run build` impossible; stale `dist/` | Restore `DOFTemplate`, delete stray blocks (§9.1) |
| **F2** | 🔴 Critical | Application source untracked; GitHub holds 3 files | `git status`, `git ls-tree HEAD` | Total data-loss exposure; no history, no review, no CI | Snapshot branch + commit + push (§9.2) |
| **F3** | 🟠 High | Two incompatible document models; the v3.0 layer is dead code and the UI assumes the legacy shape | import search; `store:108`; `Header:15`; `StatusBar:6`; `Viewport2D:54` | Contract defined but unusable; loading a v3.0 file would crash 3 of 5 components (`metadata.title`, `dofTemplate`, `anchors`) | Single source of truth = Zod-inferred `KineoV3` (§8 P1) |
| **F4** | 🟠 High | Test suite red and non-portable | harness §6.4; absolute path; Node types missing | No safety net while refactoring | Exported fixture JSON, anchor-aware checks, separate test tsconfig |
| **F5** | 🟠 High | No import/export/persistence; refresh loses the document | no `File` menu, no `localStorage`, model layer unimported | Product cannot be used for real work | File menu + Zod-validated open + autosave (§8 P2) |
| **F6** | 🟡 Medium | Lint red, no CI | 8 ESLint errors | Style rot; regressions merge silently | `npm run lint` + GitHub Actions |
| **F7** | 🟡 Medium | `Viewport2D` visually breaks after resize; fixed scale; no DPR; ignores geometry | effect has no redraw in `updateSize` | Blank canvas; unusable on laptop dock/undock, HiDPI | Redraw in resize handler, DPR scaling, transform state (§8 P3) |
| **F8** | 🟡 Medium | Simulation inert; `m`/`h` hard-coded | `setSimulationTime` unused; constants 1/0 | "Simulation" button is decorative; the core promise is unmet | Clock + FK/IK solver + Grübler computation (§8 P4) |
| **F9** | 🟡 Medium | MVP gaps (snap, over-constraint, graph, export, 3D, Pages) | §5 | 85 % of the value is still missing | Roadmap P3–P6 |
| **F10** | 🟢 Low | Template leftovers & config debt | `App.css` unused, `assets/*` unused, `public/icons.svg` unused, Tailwind v4 + legacy `tailwind.config.js` + `autoprefixer` + `@tailwindcss/cli` | Confusing repository, dead bundles | Delete/move, simplify config (§9.4) |
| **F11** | 🟢 Low | Store integrity gaps | delete class → dangling `anchor.classId`/`joint` refs; `Math.random()*0xFFFFFF).toString(16)` can yield `#abc` (invalid CSS) | Silent corruption once import/export exists | Cascade delete, `padStart(6,'0')` |
| **F12** | 🟢 Low | Naming/version drift | "CinémaLab" vs "Kineo"; `package.json` 0.0.0 vs `meta.appVersion` 0.1.0; English `JointType` vs ISO codes `PIVOT`…; French UI with `lang="en"` and title `kineo-` | Polish, SEO, and a real mapping cost in the model | Normalise (§9.4) |

### 7.1 Root cause

File timestamps reconstruct the story: UI shell 03:06–03:54 → store 04:51 → prior audit 05:18 → **model layer, types and tests 05:51–05:53**. The project is mid-migration from the legacy ad-hoc model to the canonical JSON v3.0 model, interrupted before the UI was connected and before the type file was finished. F3 is the trunk from which F1, F4 and F5 grow; fixing it removes all three.

---

## 8. Roadmap

Effort assumes one developer. Ordering respects dependencies: nothing can be tested or deployed before P0/P1.

### P0 — Stop the bleeding (½ day) 🔴 *do this first*

1. `git switch -c wip/import-sources` and commit **everything as-is**, even red — the current state must become recoverable before it is edited. Push.
2. `git switch -c fix/build`; repair `src/types/kineo.ts` (§9.1).
3. Add `typecheck` and `test` scripts; add `tsconfig.test.json` for Node-typed tests and exclude `**/*.test.ts` from `tsconfig.app.json`.
4. Fix the 5 remaining type sites (F3-lite): type `jointDefinitions` as a record catalogue, guard `metadata`, and make the store build instances into `liaisons`.
5. Restore the product `README.md` (keep the Vite text in a `docs/` note if wanted), restore the standard `.gitignore` entries, add `.gitattributes` with `* text=auto eol=lf`.
6. Delete the non-ASCII whitespace flagged by ESLint; remove the unused `anchorIds`; replace `any` with `unknown` + narrowing.
7. Make `lint`, `typecheck` and `test` green, then push and open a PR.

**Exit criteria:** on a clean clone, `npm.cmd ci && npm.cmd run build && npm.cmd run lint && npm.cmd test` all succeed.

### P1 — One model, one truth (1–2 days)

1. Declare the canonical contract **`KineoV3` (Zod) as the only document type**; derive `type KineoDocument = z.infer<typeof KineoV3Schema>` so the two can never drift again.
2. Move UI-only state (`viewMode`, `appMode`, selection, camera, hover) out of the document; keep `document` strictly serialisable.
3. Implement `instantiateLiaison(jointType, classA, classB, position)` that copies the joint template's DOFs (`dofTemplate` → `dof[]` with `value = defaultMin`, `unit`), and `computeMobility(doc)` via Grübler/Kutzbach (`m = 6·(n−1) − Σ(6−dof_i)` planar/spatial variants, `h` from redundant constraints).
4. Replace `toInternalModel`/`fromInternalModel` casts with a real mapper; make `validateReferences` anchor-aware (check `classA/B`, each liaison's `anchors`, DOF id uniqueness) and add graph-level checks (isolated class, closed-loop consistency, duplicate liaison between the same pair).
5. Make `detectConversionLosses` symmetric, or replace it with a Zod re-parse + deep-equal (stricter and simpler).
6. Update the 5 components to read `meta.title`, computed `m`/`h`, and `liaisons`; keep `isFixed`→"Bâti" badge mapping.

**Exit criteria:** importing the specification's own JSON produces the mechanism, with `m`/`h` computed, no crash, and zero casts.

### P2 — Persistence & file I/O (1–2 days)

1. `File` menu: New / Open (`.kineo.json`) / Save / Save As, plus drag-and-drop.
2. Validate on open with `KineoV3Schema`; show a readable error list; offer `safeparse` + migration hook keyed by `meta.schemaVersion`.
3. Autosave the working document to `localStorage` (debounced), restore on boot, "unsaved changes" indicator.
4. Tests: round-trip the fixture, reject malformed documents, verify migration from a v2.9-shaped sample.

**Exit criteria:** open → close tab → reopen restores the work; export produces a byte-comparable document.

### P3 — 2D editor (≈1 week)

1. Viewport engine: pan/zoom/fit, grid toggle, DPR-aware canvas, redraw on resize, `requestAnimationFrame` invalidation.
2. Render `geometry.entities` per class (transform from class → world), ISO 3952-1 glyphs for PIVOT / GLISSIERE / PIVOT_GLISSANT / ROTULE (+ Planar, Helicoidal, Fixed once added to the schema), class colour coding, selection highlight, hover.
3. Interactions: place a liaison by clicking the sidebar then the canvas (snap to anchor within N px, grid fallback), drag a liaison, inline rename, delete, undo/redo (Zustand temporal or command stack).
4. Status hints (coordinates, snapped target) mirroring the mock-up's bottom line.

**Exit criteria:** the bielle-manivelle-piston can be assembled from scratch by mouse, undoably, and the drawing survives a window resize.

### P4 — Kinematics & validation (1–2 weeks)

1. Transform model: per-class 4×4 matrices; quaternion ↔ Euler helpers for the UI only (store quaternions).
2. Open chain: forward kinematics from DOF values. Closed loop (the fixture): Newton–Raphson on the loop-closure equation, driven DOF from `kinematics.drivenDofs` (`controlType: SPEED`, `targetValue` in deg/s).
3. Over-constraint detection: compare `h` with 0, flag redundant liaisons (e.g. PIVOT_GLISSANT + GLISSIERE on the same pair, exactly the mock-up's example), surface the actionable banner with "Corriger / Ignorer".
4. Simulation bar: play/pause/reset, speed multiplier, driven-DOF selector, timeline scrub connected to the solver.

**Exit criteria:** the slider-crank animates continuously; piston position matches the analytic solution within 1 %; the redundant-liaison banner appears when a duplicated liaison is added.

### P5 — 3D, graph, export (≈1 week)

1. Add `three` (+ `@react-three/fiber` or plain three), orthographic + perspective camera, shared selection with the 2D view, solids extruded from `geometry.entities`.
2. Graph view: classes as nodes, liaisons as labelled edges, synced selection/highlight, simple force layout (or precomputed layout to avoid a dependency).
3. Export: SVG serialisation of the 2D scene and PNG at 2×/4× (`canvas.toDataURL`), with a title/legend block.

**Exit criteria:** selecting a class highlights it in all three views; exported PNG is print-usable.

### P6 — Delivery & polish (2–3 days)

1. `vite.config.ts`: `base: '/Kineo-/'`; GitHub Actions workflow building and publishing `dist/` to Pages on `main`.
2. `index.html`: real title/description, `lang="fr"`; Open Graph tags; favicon check.
3. Light i18n (fr default, en secondary) — the code already separates labels from logic.
4. Accessibility pass (button `type`, `aria-pressed` on segmented controls, keyboard focus, contrast).
5. Optional: Tauri shell reusing the same `dist/`; only after P4.

---

## 9. Immediate patches and commands

### 9.1 Blocker patch — `src/types/kineo.ts`

Replace the orphaned block after `KinematicsSolverBlock`:

```ts
export interface KinematicsSolverBlock {
    timeStep: number;
    duration: number;
    currentTime: number;
    isPlaying: boolean;
}

// Restored: was truncated in the working copy
export interface DOFTemplate {
    mobility: number;        // Degré de mobilité m
    hyperstatism: number;    // Degré d'hyperstatisme h
    inputJointIds: string[]; // Liaisons motorisées/pilotes
}
```

and delete the stray block between `GeometryEntity` and `KineoDocument`:

```ts
    timeStep: number;
    duration: number;
    currentTime: number;
    isPlaying: boolean;
}
```

### 9.2 Git snapshot (run before any edit)

```powershell
git switch -c wip/import-sources
git add -A
git commit -m "chore: snapshot Kineo app sources (UI shell + JSON v3.0 model layer)"
git push -u origin wip/import-sources
```

Then restore the two regressions before merging to `main`:

```powershell
git checkout HEAD -- .gitignore          # back to the standard Node ignore list
git show HEAD:README.md                   # the Kineo description, to re-merge into the new README
```

### 9.3 Scripts and tsconfig

```jsonc
// package.json (scripts)
"dev": "vite",
"build": "tsc -b && vite build",
"typecheck": "tsc -b --pretty",
"lint": "eslint .",
"test": "vitest run",
"test:watch": "vitest",
"preview": "vite preview"
```

```jsonc
// tsconfig.test.json (new)
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": { "types": ["vite/client", "node"], "noEmit": true },
  "include": ["src"]
}
```

…and in `tsconfig.app.json` add `"exclude": ["src/**/*.test.ts"]`; reference the test project from `tsconfig.json`.

### 9.4 Quick wins (< 15 min each)

- `index.html`: `<html lang="fr">`, `<title>Kineo — Studio de cinématique</title>`, meta description.
- Delete `src/App.css`, `src/assets/{hero.png,react.svg,vite.svg}` (unused — verified by search), and `public/icons.svg` if unreferenced.
- Drop `tailwind.config.js`, `autoprefixer` and `@tailwindcss/cli` (Tailwind v4 auto-detects content and prefixes itself); keep `postcss.config.js` with `@tailwindcss/postcss` only.
- `package.json`: `"name": "kineo"`, `"version": "0.1.0"` and align `meta.appVersion`.
- `Sidebar.tsx`: `Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0')`.
- `Viewport2D.tsx`: redraw inside `updateSize`, scale by `devicePixelRatio`.
- Rename `CinémaLab` → `Kineo` in `documentation_etape1_etape2.txt`.

### 9.5 Definition of Done — v0.1

- [ ] `npm.cmd run build`, `lint`, `test` green on a clean clone; CI enforces them.
- [ ] Sources on GitHub with a meaningful history; `main` deployable.
- [ ] One canonical model (`KineoV3`), no `as unknown as`; the spec's own JSON opens without error.
- [ ] Save/open/autosave; no data loss on refresh.
- [ ] 2D editor: place, snap, drag, delete, undo, ISO symbols, class colours.
- [ ] Slider-crank animates with motor speed control; `m`/`h` computed; over-constraint banner works.
- [ ] SVG + PNG export.
- [ ] Published on GitHub Pages.
- [ ] 3D and graph views may land in v0.2 without blocking the above.

---

## Appendix A — JSON v3.0 ↔ code mapping (current state)

| JSON v3.0 | `jsonV3.ts` | `types/kineo.ts` (used by UI) | Store |
|---|---|---|---|
| `meta.schemaVersion` | ✅ | 🟡 via `version: '3.0'` | partial |
| `meta.appVersion/title/author/lengthUnit/angleUnit` | ✅ | 🔴 absent (legacy `metadata` instead) | `metadata.title` only |
| `jointDefinitions` (catalogue keyed by ISO code) | ✅ | 🟡 `Record<string, any>` | 🔴 used as an **array of instances** |
| `classesEquivalence` (`isFixed`, `parentId`) | ✅ | 🟡 `isGround`, no `parentId` | ✅ but no hierarchy |
| `liaisons[]` (instances + DOFs) | ✅ | ✅ declared, **never used** | 🔴 no field/action |
| `anchors.onClassA/B` | ✅ | 🟡 per liaison only | 🔴 top-level `anchors[]` invented |
| `kinematics.solverType/closedLoopMode/drivenDofs` | ✅ | 🔴 absent | 🔴 absent |
| `geometry.entities` | ✅ | ✅ declared, never read | 🔴 absent |
| Top-level `dofTemplate` (m/h) | — | ✅ required | ✅ initialised — undefined for a loaded v3.0 doc |

## Appendix B — Environment & commands used

```powershell
node node_modules/typescript/bin/tsc -b --pretty false          # 3 syntax errors
node node_modules/eslint/bin/eslint.js .                        # 8 errors
node node_modules/vitest/vitest.mjs run                         # cannot start (sandbox: spawn EPERM)
# model layer compiled to CJS in a throw-away copy, then exercised:
#   PASS/PASS/FAIL (validateReferences crashes on undefined anchors)
git status --short; git log --oneline; git show --stat HEAD
```

*Report produced 2026-10-27. No project file was modified during the audit; the temporary diagnostic copy was deleted.*
