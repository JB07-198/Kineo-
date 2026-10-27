# Kineo — Code Wiki

> Structured developer documentation for the **Kineo** repository
> (`c:\Users\Toshiba\Kineo-` → `https://github.com/JB07-198/Kineo-`).
>
> Generated from a full static reading of every source file. Where the code and the
> `audit/` reports disagree, the documentation describes the **current code** and flags
> the divergence explicitly (see [§9 Known Issues](#9-known-issues--current-state)).

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Technology stack & dependencies](#2-technology-stack--dependencies)
3. [Getting started / running the project](#3-getting-started--running-the-project)
4. [Architecture](#4-architecture)
5. [Module reference](#5-module-reference)
6. [Data model — canonical JSON v3.0 vs internal model](#6-data-model--canonical-json-v30-vs-internal-model)
7. [Dependency relationships](#7-dependency-relationships)
8. [Configuration files](#8-configuration-files)
9. [Known issues & current state](#9-known-issues--current-state)
10. [Glossary](#10-glossary)

---

## 1. Project overview

**Kineo** (referred to as *CinémaLab* in the original specification text) is a
**100 % client-side, browser-based kinematics studio** for drawing, validating and
animating mechanisms using normalised **ISO 3952-1 / AFNOR** joint symbols.

### 1.1 Purpose

Producing mechanical-link diagrams that respect ISO/AFNOR conventions is awkward: CAD
tools are not symbol-oriented and drawing tools know nothing about kinematics. Kineo
aims to be a single tool that:

1. **Draws** normalised joints (pivot, slider, ball joint, …).
2. **Checks consistency** automatically (mobility `m`, hyperstatism `h`, over-constraints).
3. **Animates** the resulting degrees of freedom (DOF) in real time.

### 1.2 Scope targets (specification MVP)

| # | Capability | Detail |
|---|---|---|
| 1 | 2D / 3D editing | ISO 3952-1 library, automatic colour per equivalence class, synchronised 2D / 3D / graph views |
| 2 | Intelligence & ergonomics | Magnetic snap on anchors, automatic detection of over-constraints and incoherences |
| 3 | Simulation | DOF animation, motor DOF + rotational-speed control, auto-generated liaison graph |
| 4 | Export | SVG / PNG for reports and lectures |
| 5 | Infrastructure | Free hosting (GitHub Pages), 100 % browser, later Electron/Tauri without rewriting the core |

The canonical persistence format is **JSON v3.0** (see
[documentation_etape1_etape2.txt](file:///c:/Users/Toshiba/Kineo-/documentation_etape1_etape2.txt)).

### 1.3 Current implementation status

The repository currently contains a **working UI shell** (layout, navigation state,
theming) plus a **detached model layer** implementing the JSON v3.0 contract. The two
halves are **not yet wired together** — the canonical model is only exercised by the
test suite. See [§9](#9-known-issues--current-state) for the full status matrix.

---

## 2. Technology stack & dependencies

### 2.1 Runtime dependencies

| Package | Version | Role |
|---|---|---|
| `react` | `^19.3.1` | UI library |
| `react-dom` | `^19.3.1` | DOM renderer |
| `zustand` | `^5.0.16` | Global state store (single flat store) |
| `zod` | `^3.23.8` | Runtime schema validation for the JSON v3.0 contract |

### 2.2 Development dependencies

| Package | Version | Role |
|---|---|---|
| `typescript` | `~6.0.3` | Type system / type-checker |
| `vite` | `^8.3.4` | Bundler & dev server (ESM, rolldown-based) |
| `@vitejs/plugin-react` | `^6.1.2` | React Fast Refresh + JSX transform |
| `tailwindcss` | `^4.3.3` | Utility-first CSS (v4 engine) |
| `@tailwindcss/postcss` | `^4.3.3` | Tailwind PostCSS integration |
| `@tailwindcss/cli` | `^4.3.3` | Tailwind CLI (present, not wired into scripts) |
| `postcss` | `^8.5.32` | CSS transform pipeline |
| `autoprefixer` | `^10.6.2` | Vendor prefixing (legacy with Tailwind v4) |
| `eslint` | `^10.13.0` | Linter |
| `@eslint/js` | `^10.0.1` | ESLint core JS config |
| `typescript-eslint` | `^8.71.2` | TS-aware lint rules |
| `eslint-plugin-react-hooks` | `^7.1.1` | React Hooks lint rules |
| `eslint-plugin-react-refresh` | `^0.5.7` | Fast-refresh lint rules |
| `globals` | `^17.13.0` | Browser/node global definitions for ESLint |
| `vitest` | `^5.0.5` | Unit-test runner (no `test` script declared) |
| `@types/react`, `@types/react-dom`, `@types/node` | — | Type declarations |

> **Not a dependency:** `three` (Three.js). It is mentioned in the GitHub description
> but has never been installed — the 3D view does not exist yet.

---

## 3. Getting started / running the project

### 3.1 Prerequisites

- **Node.js** ≥ 20 (audited machine used `v24.14.0`, `npm 11.9.0`).
- No backend, database or paid service is required.

### 3.2 Install

```powershell
npm.cmd install        # or: npm install
```

### 3.3 npm scripts

Defined in [package.json](file:///c:/Users/Toshiba/Kineo-/package.json#L6-L11):

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `vite` | Start the dev server with HMR |
| `npm run build` | `tsc -b && vite build` | Type-check, then produce the production bundle in `dist/` |
| `npm run preview` | `vite preview` | Serve the built `dist/` locally |
| `npm run lint` | `eslint .` | Lint the whole repository |

> There is **no `test` script**. Tests exist (`src/model/__tests__/kineo.test.ts`) but
> must be run via `npx vitest run` directly.

### 3.4 Windows / PowerShell note

On the audited machine the `npm`/`npx` **PowerShell shims were blocked by the execution
policy** (`npm.ps1 cannot be loaded`). Two workarounds:

- Use `npm.cmd …` / `npx.cmd …`, or
- Run once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

### 3.5 Typical workflow

```powershell
npm.cmd install
npm.cmd run dev            # open the printed http://localhost:5173 URL
npm.cmd run lint
npx.cmd vitest run         # run the model-layer tests
npm.cmd run build          # production build
```

---

## 4. Architecture

### 4.1 Layered view

```
┌──────────────────────────────────────────────────────────────────────┐
│  Presentation — src/components/**                                     │
│    Header · Sidebar · PropertyInspector · StatusBar · Viewport2D      │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  useKineoStore()  (read/subscribe)
                                │  actions         (write)
┌───────────────────────────────▼──────────────────────────────────────┐
│  State — src/store/useKineoStore.ts  (Zustand, single flat store)     │
│    document: KineoDocument   +   UI state (view/app mode, selection)  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  imports types only
┌───────────────────────────────▼──────────────────────────────────────┐
│  Domain model — src/types/kineo.ts   (internal document shape)        │
└──────────────────────────────────────────────────────────────────────┘

        ── disconnected from the UI today (only the test imports them) ──
┌──────────────────────────────────────────────────────────────────────┐
│  Canonical model — src/model/                                        │
│    jsonV3.ts      external JSON v3.0 contract types                  │
│    validation.ts  Zod schema + validateKineoV3()                     │
│    conversion.ts  to/fromInternal, validateReferences, loss detector │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Runtime data flow (as implemented)

```
index.html
   └─ src/main.tsx  → createRoot(...).render(<App/>)  (StrictMode)
         └─ src/App.tsx
               ├─ <Header/>            → activeViewMode / activeAppMode toggles
               ├─ <Sidebar/>           → addClass, selectEntity
               ├─ <Viewport2D/>  ──if── activeViewMode === '2D'
               │     └─ reads document.anchors, draws axes + anchors on <canvas>
               ├─ <PropertyInspector/> → selected Class details, removeEntity
               └─ <StatusBar/>         → toggleSimulationPlay, resetSimulation, m/h display
                         ▲
                         │  all read/write the single Zustand store
                         ▼
               src/store/useKineoStore.ts  (document + UI state)
```

### 4.3 Directory structure

```
Kineo-/
├─ documentation_etape1_etape2.txt  Product spec: vision, MVP, JSON v3.0 example, ASCII mock-up
├─ audit/
│  ├─ 17_PREPARATION_GIT_ET_JSON_V3.md   Gap analysis: JSON v3.0 ↔ TypeScript
│  └─ 18_PROJECT_STATUS_AND_ROADMAP.md   Full audit + roadmap (P0–P6)
├─ index.html                        Vite entry (title "kineo-", lang="en")
├─ package.json / package-lock.json
├─ tsconfig.json (+ .app / .node)    Project references
├─ vite.config.ts
├─ eslint.config.js
├─ tailwind.config.js / postcss.config.js
├─ public/                           favicon.svg, icons.svg (icons.svg unused)
└─ src/
   ├─ main.tsx                       React root
   ├─ App.tsx                        Application layout + view routing
   ├─ index.css                      `@import "tailwindcss";`
   ├─ App.css                        Legacy Vite-template styles (UNUSED)
   ├─ assets/                        hero.png, react.svg, vite.svg (UNUSED)
   ├─ components/
   │  ├─ canvas/Viewport2D.tsx       Canvas 2D renderer (axes, origin, anchors)
   │  └─ layout/
   │     ├─ Header.tsx               Branding + view mode + app mode switches
   │     ├─ Sidebar.tsx              ISO joint library + equivalence-class list
   │     ├─ PropertyInspector.tsx    Class property panel
   │     └─ StatusBar.tsx            Simulation controls + mobility/hyperstatism readout
   ├─ store/useKineoStore.ts         Zustand store (document + UI state + actions)
   ├─ types/kineo.ts                 Internal document model
   └─ model/
      ├─ jsonV3.ts                   Canonical JSON v3.0 types (external contract)
      ├─ validation.ts               Zod schema + validateKineoV3()
      ├─ conversion.ts               to/fromInternal + reference/loss checks
      └─ __tests__/kineo.test.ts     Three tests over the spec document
```

---

## 5. Module reference

### 5.1 Entry points

#### `src/main.tsx`
Boots React into the `#root` element declared in `index.html`.

- Imports `./index.css` (the Tailwind entry point).
- Renders `<App/>` inside `<StrictMode>` via `createRoot`.

#### [src/App.tsx](file:///c:/Users/Toshiba/Kineo-/src/App.tsx)
Root layout component (`App: React.FC`).

- Subscribes to `activeViewMode` from the store.
- Renders a vertical flex layout: `<Header/>`, a middle row (`<Sidebar/>` + viewport +
  `<PropertyInspector/>`), then `<StatusBar/>`.
- **Viewport routing:** when `activeViewMode === '2D'` it renders `<Viewport2D/>`;
  otherwise it shows a placeholder card ("Zone Viewport […], Prêt pour le rendu
  Canvas 2D / Three.js 3D"). Only the 2D view is implemented.

---

### 5.2 Store — [src/store/useKineoStore.ts](file:///c:/Users/Toshiba/Kineo-/src/store/useKineoStore.ts)

A single **Zustand** store created with `create<KineoState>((set) => ({ … }))`. It holds
both the *document* (model) and *UI state*, and exposes actions that update them
immutably.

#### `interface KineoState`

| Member | Type | Description |
|---|---|---|
| `document` | `KineoDocument` | Active document (the mechanism) |
| `activeViewMode` | `'2D' \| '3D' \| 'Graph' \| 'Split'` | Current viewport mode |
| `activeAppMode` | `'Edit' \| 'Simulation'` | Edit vs simulation mode |
| `selectedEntityId` | `string \| null` | Currently selected entity id |
| `selectedEntityType` | `'Class' \| 'Joint' \| 'Anchor' \| null` | Type of the selection |

#### Actions

| Action | Signature | Behaviour |
|---|---|---|
| `setViewMode` | `(mode) => void` | Sets `activeViewMode` |
| `setAppMode` | `(mode) => void` | Sets `activeAppMode` |
| `selectEntity` | `(id, type) => void` | Sets the selection pair |
| `addClass` | `(Omit<EquivalenceClass,'id'>) => void` | Appends a class with `id = class-<uuid>` |
| `addJoint` | `(Omit<JointDefinition,'id'>) => void` | Appends a joint with `id = joint-<uuid>` |
| `addAnchor` | `(Omit<Anchor,'id'>) => void` | Appends an anchor with `id = anchor-<uuid>` |
| `removeEntity` | `(id, type) => void` | Deletes a Class / Joint / Anchor by id and clears the selection |
| `setSimulationTime` | `(time) => void` | Sets `kinematics.currentTime` (currently never called) |
| `toggleSimulationPlay` | `() => void` | Flips `kinematics.isPlaying` |
| `resetSimulation` | `() => void` | Resets `currentTime = 0`, `isPlaying = false` |

#### `initialDocument`

A hard-coded `KineoDocument` seeded at boot:

- **2 equivalence classes:** `class-0` *Bâti (Solide 0)* (ground) and `class-1` *Manivelle (Solide 1)*.
- **2 anchors:** `anchor-0`, `anchor-1` at the origin.
- **1 joint definition:** `joint-1` — a `Pivoting` joint between `anchor-0` and `anchor-1`, axis `z`.
- **`dofTemplate`:** `mobility = 1`, `hyperstatism = 0`, `inputJointIds = ['joint-1']`.
- **`kinematics`:** `timeStep = 0.01`, `duration = 10`, `currentTime = 0`, `isPlaying = false`.

**Design notes / caveats**

- The store keeps `jointDefinitions` typed by the document as a `Record<string, …>`
  catalogue (JSON v3.0 semantics), **but initialises it as an array of joint instances
  and spreads an array in `addJoint`** — a shape mismatch between the internal model and
  the canonical contract (see [§9](#9-known-issues--current-state)).
- No undo/redo, no persistence, no `lastModified` refresh, and no cascade delete
  (deleting a class leaves dangling `anchor.classId` / joint references).
- `setSimulationTime` is exported but never invoked; there is no `requestAnimationFrame`
  or timer loop, so the simulation is currently inert.

---

### 5.3 Internal model — [src/types/kineo.ts](file:///c:/Users/Toshiba/Kineo-/src/types/kineo.ts)

The shape the UI actually runs on. Key types:

| Type | Description |
|---|---|
| `Vector2D`, `Vector3D` | Plain `{x,y}` / `{x,y,z}` coordinate objects |
| `Anchor` | `{ id, classId, position: Vector3D, orientation?: Vector3D }` — a local reference frame on a class |
| `JointType` | Union: `'Pivoting' \| 'Prismatic' \| 'Cylindrical' \| 'Spherical' \| 'Planar' \| 'Helicoidal' \| 'Fixed'` (English labels — **not** the ISO codes used by the canonical JSON) |
| `JointDefinition` | Instantiated joint: `{ id, name, type, primaryAnchorId, secondaryAnchorId, axis?, limits? }` |
| `JointDefinitionTemplate` | `{ isoCode, dofCount, dofTemplate: [...] }` — template used by the JSON v3.0 catalogue |
| `EquivalenceClass` | `{ id, name, color, isGround }` (uses `isGround`; the canonical model uses `isFixed` + `parentId`) |
| `KinematicsSolverBlock` | `{ timeStep, duration, currentTime, isPlaying }` |
| `DOFTemplate` | `{ mobility, hyperstatism, inputJointIds }` — global mobility/hyperstatism block |
| `Liaison` | Full instantiated liaison: `{ id, name, type, classA, classB, position, orientation(quaternion), anchors{onClassA,onClassB}, dof[] }` |
| `DrivenDOF` | `{ dofId, controlType, targetValue, unit }` |
| `GeometryEntity` | `{ id, kind, classId, localPoints, style, view }` |
| `KineoDocument` | The root document type (see below) |

#### `KineoDocument`

```
KineoDocument
├─ meta?              { schemaVersion, appVersion, title, author, lengthUnit, angleUnit }   // canonical
├─ metadata?          { title, description?, author?, created, lastModified }               // legacy
├─ classesEquivalence EquivalenceClass[]
├─ anchors            Anchor[]
├─ jointDefinitions   Record<string, JointDefinitionTemplate>    // catalogue keyed by ISO code
├─ liaisons?          Liaison[]                                  // instantiated joints
├─ kinematics         KinematicsSolverBlock & { solverType?, closedLoopMode?, drivenDofs? }
├─ geometry?          { entities: GeometryEntity[] }
├─ dofTemplate        DOFTemplate
└─ version            '3.0'
```

Both `meta` (canonical) and `metadata` (legacy) are optional — a transitional,
dual-shape document. The UI reads `document.metadata?.title` and `document.dofTemplate`,
while the canonical JSON supplies `meta` and `kinematics`.

---

### 5.4 Canonical model layer — `src/model/`

This layer faithfully mirrors the external **JSON v3.0** contract but is **not imported
by any application module** — only by the test file.

#### [src/model/jsonV3.ts](file:///c:/Users/Toshiba/Kineo-/src/model/jsonV3.ts)
Pure TypeScript interfaces mirroring the spec: `Meta`, `Vector3`, `Quaternion`,
`AnchorSpec`, `DOFSpec`, `Liaison`, `EquivalenceClass`, `JointDefinition` (a
`Record` catalogue), `Kinematics`, `GeometryEntity`, `Geometry`, and the root `KineoV3`.

#### [src/model/validation.ts](file:///c:/Users/Toshiba/Kineo-/src/model/validation.ts)
Zod schemas plus the exported validator.

| Export | Description |
|---|---|
| `KineoV3Schema` | `z.object({ meta, jointDefinitions, classesEquivalence, liaisons, kinematics, geometry })`; `meta.schemaVersion` is a `z.literal('3.0')` |
| `validateKineoV3(data: unknown): KineoV3` | Parses `data` against the schema; returns the typed document or throws a `ZodError` |

Private sub-schemas: `Vector3Schema`, `QuaternionSchema`, `AnchorSpecSchema`,
`DOFSpecSchema`, `LiaisonSchema`, `EquivalenceClassSchema`,
`JointDefinitionTemplateSchema`, `JointDefinitionsSchema`, `DrivenDOFSchema`,
`KinematicsSchema`, `GeometryEntitySchema`, `GeometrySchema`.

#### [src/model/conversion.ts](file:///c:/Users/Toshiba/Kineo-/src/model/conversion.ts)

| Function | Signature | Behaviour |
|---|---|---|
| `toInternalModel` | `(external: KineoV3) => KineoDocument` | `as unknown as` cast — **no real mapping** |
| `fromInternalModel` | `(internal: KineoDocument) => KineoV3` | `as unknown as` cast — **no real mapping** |
| `validateReferences` | `(doc: KineoDocument) => void` | Builds the set of class ids and verifies every `liaison.classA` / `classB` and each liaison `type` (against `jointDefinitions` keys) exists; throws `Error` on the first inconsistency |
| `detectConversionLosses` | `(original: KineoV3, converted: KineoV3) => string[]` | Deep-walks the **original** object and reports paths missing/changed in `converted` |

Note: the current `validateReferences` correctly uses `doc.classesEquivalence` and
`doc.liaisons` (the `doc.anchors` line is commented out), so unlike the earlier audit it
does **not** crash on a v3.0 document. `detectConversionLosses` is still one-directional.

---

### 5.5 UI components — `src/components/`

| Component | File | Responsibility | Store bindings |
|---|---|---|---|
| `Header` | [Header.tsx](file:///c:/Users/Toshiba/Kineo-/src/components/layout/Header.tsx) | Branding ("Kineo Mechanics Studio v3.0"), document title, `2D/3D/Graph/Split` segmented control, `Édition/Simulation` switch | `document`, `activeViewMode`, `activeAppMode`, `setViewMode`, `setAppMode` |
| `Sidebar` | [Sidebar.tsx](file:///c:/Users/Toshiba/Kineo-/src/components/layout/Sidebar.tsx) | Static library of 7 ISO joint buttons (Pivot, Glissière, Pivot Glissant, Rotule, Appui Plan, Hélicoïdale, Encastrement) + equivalence-class list with "+ Ajouter" and click-to-select | `document`, `addClass`, `selectEntity` |
| `PropertyInspector` | [PropertyInspector.tsx](file:///c:/Users/Toshiba/Kineo-/src/components/layout/PropertyInspector.tsx) | Read-only class inspector (ID, name, colour) + "Supprimer le solide" (hidden for the ground class) | `document`, `selectedEntityId`, `selectedEntityType`, `removeEntity` |
| `StatusBar` | [StatusBar.tsx](file:///c:/Users/Toshiba/Kineo-/src/components/layout/StatusBar.tsx) | Simulation strip (Play/Pause, Reset, time readout) shown in Simulation mode; always shows mobility `m` and hyperstatism `h` | `document`, `activeAppMode`, `toggleSimulationPlay`, `resetSimulation` |
| `Viewport2D` | [Viewport2D.tsx](file:///c:/Users/Toshiba/Kineo-/src/components/canvas/Viewport2D.tsx) | `<canvas>` renderer: resizes to parent, clears, draws X (red) / Y (green) axes, the origin dot, and one blue dot per `document.anchors` at 50 px/unit | `document` |

**`Sidebar` JOINT constant** (`JOINTS`) maps each `JointType` to a French label and emoji.
The joint buttons are **decorative** (no `onClick`). "Ajouter" generates a name
`Solide <n>` and a random colour.

**`Viewport2D` caveats:** the `resize` listener updates `canvas.width/height` but does
**not** redraw (resizing a canvas clears it → blank viewport until state changes); the
scale is hard-coded (50 px/unit); there is no `devicePixelRatio` handling (blurry on
HiDPI); and `geometry.entities` / `liaisons` are never rendered.

---

### 5.6 Tests — [src/model/__tests__/kineo.test.ts](file:///c:/Users/Toshiba/Kineo-/src/model/__tests__/kineo.test.ts)

Vitest suite (3 cases) that loads the **specification file itself** as the fixture:

1. Reads `C:/Users/Toshiba/Kineo-/documentation_etape1_etape2.txt` (absolute path),
   extracts the JSON between the first `{` and last `}`, and `JSON.parse`s it.
2. **Test 1** — `validateKineoV3(specJson)` succeeds and `meta.schemaVersion === '3.0'`.
3. **Test 2** — `toInternalModel` → `fromInternalModel` round-trip yields
   `detectConversionLosses(...) === []`.
4. **Test 3** — `validateReferences(toInternalModel(specJson))` does not throw.

**Portability defects:** the absolute fixture path breaks on any other machine/CI; the
JSON is scraped out of a prose file; and Node built-ins (`fs`, `path`) are imported while
`tsconfig.app.json` sets `"types": ["vite/client"]` (no Node types). There is no `test`
script in `package.json`.

---

## 6. Data model — canonical JSON v3.0 vs internal model

The project defines the mechanism document **twice**. Understanding the difference is
essential when working on the model layer.

| JSON v3.0 field | `model/jsonV3.ts` (canonical) | `types/kineo.ts` + store (internal) | Status |
|---|---|---|---|
| `meta` (schemaVersion/appVersion/title/author/units) | ✅ `Meta` | 🟡 legacy `metadata` instead (title/description/author/created/lastModified) | Divergent |
| `jointDefinitions` (catalogue keyed by ISO code: `PIVOT`, `GLISSIERE`, …) | ✅ `Record<string, template>` | 🟡 typed as `Record` but **stored as an array of instances** | Divergent |
| `classesEquivalence` (`isFixed`, `parentId`) | ✅ | 🟡 `isGround`, no `parentId` | Partial |
| `liaisons[]` (instances + `dof[]`, quaternion orientation, per-liaison anchors) | ✅ | ✅ declared (`Liaison`), **never populated or rendered** | Declared only |
| `kinematics` (`solverType`, `closedLoopMode`, `drivenDofs`) | ✅ | 🟡 only `timeStep/duration/currentTime/isPlaying` used | Partial |
| `geometry.entities` | ✅ | ✅ `GeometryEntity` declared, **never read** | Declared only |
| Top-level `dofTemplate` (`m`, `h`, `inputJointIds`) | — (not in v3.0) | ✅ required, initialised (1 / 0) | Internal-only |
| Top-level `anchors[]` | — (anchors live inside each liaison) | ✅ top-level array, used by `Viewport2D` | Internal-only |

### 6.1 Joint type vocabulary

| Internal `JointType` | Canonical ISO code (spec) | DOF count |
|---|---|---|
| `Pivoting` | `PIVOT` | 1 (rotation) |
| `Prismatic` | `GLISSIERE` | 1 (translation) |
| `Cylindrical` | `PIVOT_GLISSANT` | 2 (translation + rotation) |
| `Spherical` | `ROTULE` | 3 (rotations) |
| `Planar`, `Helicoidal`, `Fixed` | *not defined in the spec catalogue* | — |

The spec's `jointDefinitions` catalogue defines only `PIVOT`, `GLISSIERE`,
`PIVOT_GLISSANT` and `ROTULE`.

### 6.2 Reference example (from the spec)

The specification document embeds a complete **Bielle-Manivelle-Piston** mechanism:
4 equivalence classes (`eq_0` Bâti … `eq_3` Piston), 4 liaisons (`link_1`…`link_4`),
driven DOF `dof_rot_manivelle` at 60 deg/s, and 3 geometry entities. This JSON is the
fixture used by the test suite and is the canonical target the internal model must reach.

---

## 7. Dependency relationships

### 7.1 Internal module graph

```
main.tsx ──► App.tsx
               ├─► components/layout/Header.tsx ─────────────► store/useKineoStore.ts
               ├─► components/layout/Sidebar.tsx ────────────► store + types/kineo.ts (JointType)
               ├─► components/layout/PropertyInspector.tsx ──► store
               ├─► components/layout/StatusBar.tsx ──────────► store
               └─► components/canvas/Viewport2D.tsx ─────────► store

store/useKineoStore.ts ──► types/kineo.ts
       (types only)

── no imports between the two halves below ──

model/validation.ts ──► model/jsonV3.ts (+ zod)
model/conversion.ts ──► model/jsonV3.ts, types/kineo.ts
model/__tests__/kineo.test.ts ──► validation.ts, conversion.ts (+ node fs/path)
```

**Key fact:** no application module imports `jsonV3.ts`, `validation.ts` or
`conversion.ts`. The canonical model is currently **dead code** with respect to the
running app.

### 7.2 External package usage

| Package | Imported by |
|---|---|
| `react` | all components, `App.tsx`, `main.tsx` |
| `react-dom/client` | `main.tsx` |
| `zustand` | `store/useKineoStore.ts` |
| `zod` | `model/validation.ts` |
| `vitest` | `model/__tests__/kineo.test.ts` |
| `vite` / `@vitejs/plugin-react` | `vite.config.ts` |

---

## 8. Configuration files

| File | Purpose / notable content |
|---|---|
| [vite.config.ts](file:///c:/Users/Toshiba/Kineo-/vite.config.ts) | Minimal — `plugins: [react()]`. No `base` set (needed later for GitHub Pages). |
| [tsconfig.json](file:///c:/Users/Toshiba/Kineo-/tsconfig.json) | Solution file — references `tsconfig.app.json` + `tsconfig.node.json`. |
| [tsconfig.app.json](file:///c:/Users/Toshiba/Kineo-/tsconfig.app.json) | App project: `target es2023`, `lib [ES2023, DOM]`, `types ["vite/client"]`, bundler resolution, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`; `include: ["src"]`. **No test exclusion** and no Node types. |
| [tsconfig.node.json](file:///c:/Users/Toshiba/Kineo-/tsconfig.node.json) | Node project for `vite.config.ts`: `module nodenext`, `types ["node"]`. |
| [eslint.config.js](file:///c:/Users/Toshiba/Kineo-/eslint.config.js) | Flat config: `js.recommended` + `tseslint.recommended` + `react-hooks` + `react-refresh`, browser globals, ignores `dist`. |
| [tailwind.config.js](file:///c:/Users/Toshiba/Kineo-/tailwind.config.js) | Legacy v3-style config (content/theme/plugins). Tailwind v4 auto-detects content, so this is redundant. |
| [postcss.config.js](file:///c:/Users/Toshiba/Kineo-/postcss.config.js) | `@tailwindcss/postcss` + `autoprefixer`. |
| [index.html](file:///c:/Users/Toshiba/Kineo-/index.html) | Mount point `#root`; `lang="en"` and `<title>kineo-</title>` (UI is French). |
| [.gitignore](file:///c:/Users/Toshiba/Kineo-/.gitignore) | Standard Vite/Node ignores (`node_modules`, `dist`, logs, editor dirs). |
| [index.css](file:///c:/Users/Toshiba/Kineo-/src/index.css) | Single line: `@import "tailwindcss";` |

---

## 9. Known issues & current state

This section reconciles the current code with the `audit/` reports. Several audit
findings have since been **partially fixed in the working tree**, so treat the audit as
historical context.

### 9.1 Status matrix (current working tree)

| Dimension | Status |
|---|---|
| UI shell (layout, navigation state, theming) | 🟢 Coherent; renders correctly |
| Product definition (spec, data model, mock-up) | 🟢 Documented in `documentation_etape1_etape2.txt` |
| `src/types/kineo.ts` syntax | 🟢 **Repaired** — `DOFTemplate` is correctly defined; no stray block (contra audit F1) |
| JSON v3.0 model layer (`src/model/`) | 🟡 Written and validated, but **unused by the app** |
| `validateReferences` | 🟢 Uses `classesEquivalence`/`liaisons`; no longer crashes on `doc.anchors` (contra audit) |
| Single document model | 🔴 Two divergent shapes (`meta` vs `metadata`, catalogue vs array) |
| Store shape vs contract | 🔴 `jointDefinitions` typed as `Record` but stored/spread as an array |
| Import/export/persistence | 🔴 Absent; refresh loses the document |
| Simulation | 🔴 Inert — `setSimulationTime` unused, no clock/solver, `m`/`h` hard-coded |
| 3D / graph / export | 🔴 Absent (`three` not installed) |
| Test suite | 🟡 Logically sound but non-portable (absolute paths, Node types) and no `test` script |
| Lint | 🟡 Config present; historically red (`no-irregular-whitespace`, `no-explicit-any`) — reverify with `npm run lint` |
| Version control | ⚠️ Per audit: application sources were **untracked**. Verify with `git status`. |

### 9.2 Principal risks to know before editing

1. **Model split (trunk issue).** The internal model (`types/kineo.ts` + store) and the
   canonical model (`model/jsonV3.ts`) disagree on `meta`/`metadata`,
   `jointDefinitions` (catalogue vs array), `isGround`/`isFixed`, and anchors.
   Loading a real v3.0 document into the current UI would break `Header`
   (`metadata.title`), `StatusBar` (`dofTemplate`) and `Viewport2D` (`anchors`).
2. **`as unknown as` conversions** in `conversion.ts` perform no mapping — they hide
   structural drift rather than resolving it.
3. **`Viewport2D` blanks on resize** (no redraw in the resize handler) and ignores DPR.
4. **Dead/duplicated config & assets:** `src/App.css`, `src/assets/*`,
   `public/icons.svg`, `tailwind.config.js`, `autoprefixer`, `@tailwindcss/cli` are
   unused or redundant.
5. **Naming drift:** "CinémaLab" (spec title) vs "Kineo"; `package.json` version `0.0.0`
   vs spec `meta.appVersion 0.1.0`; English `JointType` labels vs ISO codes; French UI
   with `lang="en"`.

### 9.3 Recommended remediation order (from `audit/18_…`)

**P0** stop the bleeding (repair build/lint/tests, commit & push sources) →
**P1** one canonical model (Zod-inferred `KineoV3` as the single document type) →
**P2** persistence & file I/O → **P3** 2D editor → **P4** kinematics & validation →
**P5** 3D, graph, export → **P6** delivery & polish.

See [18_PROJECT_STATUS_AND_ROADMAP.md](file:///c:/Users/Toshiba/Kineo-/audit/18_PROJECT_STATUS_AND_ROADMAP.md)
for full detail.

---

## 10. Glossary

| Term | Meaning |
|---|---|
| **Liaison** | A mechanical joint *instance* connecting two equivalence classes, carrying position, orientation (quaternion), local anchors and DOF values |
| **Joint definition** | A *template* (catalogue entry, e.g. `PIVOT`) describing an ISO joint type and its default DOFs |
| **Équivalence class / Solide** | A rigid body (equivalence class of a real mechanism); the ground is `isGround`/`isFixed` |
| **Anchor / Ancrage** | A local reference frame attached to a class, used to position liaisons |
| **DOF** | Degree of freedom (rotation or translation) of a liaison, with `min`/`max`/`value`/`unit` |
| **Mobility (m)** | Number of independent DOFs of the mechanism (Grübler/Kutzbach) |
| **Hyperstatism (h)** | Degree of over-constraint (redundant constraints) |
| **Driven DOF** | A motorised DOF controlled during simulation (e.g. `SPEED`, 60 deg/s) |
| **JSON v3.0** | The canonical persistence contract (`meta`, `jointDefinitions`, `classesEquivalence`, `liaisons`, `kinematics`, `geometry`) |

---

*Documentation generated from a static analysis of the repository at working-tree HEAD.
Cross-referenced with `audit/17_PREPARATION_GIT_ET_JSON_V3.md`,
`audit/18_PROJECT_STATUS_AND_ROADMAP.md`, and `documentation_etape1_etape2.txt`.*
