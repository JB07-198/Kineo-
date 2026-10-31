# Kineo — carte du code v0.3.0

Le dépôt contient un éditeur React/TypeScript, un noyau cinématique pur, des services de fichiers et des tests. Le contrat JSON reste en version 3.0 ; la version applicative est 0.3.0.

| Zone | Points d’entrée |
|---|---|
| Interface | `src/App.tsx`, `src/main.tsx`, `src/index.css` |
| Éditeur | `src/components/canvas/Viewport2D.tsx`, `src/components/layout/` |
| Graphe | `src/components/graph/MechanicalGraphView.tsx`, `src/model/mechanicalGraph.ts`, `graphLayout.ts` |
| Document | `src/store/useKineoStore.ts`, `src/model/jsonV3.ts`, `validation.ts`, `conversion.ts` |
| Scène et exports | `src/model/planarScene.ts`, `planarCoordinates.ts`, `jointSymbols.ts`, `export2d.ts` |
| Cinématique pure | `src/core/kinematics/` |
| Simulation UI | `src/store/useSimulationStore.ts`, `src/components/kinematics/` |
| Persistance | `src/services/persistence.ts`, `documentLifecycle.ts` |
| Références | `src/model/defaultDocument.ts`, `src/core/kinematics/sliderCrank.ts`, `examples/` |
| Tests | `src/model/__tests__/`, `src/core/kinematics/__tests__/`, `src/services/__tests__/`, `e2e/` |
| Automatisation | `.github/workflows/`, `scripts/benchmark.mjs`, `playwright.config.ts`, `vitest.config.ts` |

Lire [l’architecture](docs/ARCHITECTURE_V0.3.md), [les équations](docs/SOLVER_V0.3.md), [le guide](docs/USER_GUIDE_V0.3.md), [les limites](docs/KNOWN_LIMITATIONS.md) et [la validation](docs/FINAL_VALIDATION_V0.3.md).

Aucune dépendance React/Zustand ne doit entrer dans `src/core/kinematics`. Les documents importés doivent passer par validation de forme et de références. Une frame de simulation ne doit jamais appeler les opérations d’édition du document.

Les documents v0.0/v0.1/v0.2 et les audits sont conservés comme archives, sans valeur de statut courant.
