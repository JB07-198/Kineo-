# Rapport de livraison — Kineo v0.3.0

Date : **31 octobre 2026**. Validation locale sous Node.js 22.22.2, npm 10.9.7, Chromium 156.0.8078.47, Linux. Rapport établi sur les résultats effectivement exécutés ; pas de publication distante.

## 1. Version initiale et finale

Départ : application 0.2.0, HEAD `5da26be`, arbre propre, branche `feature/v0.2`. Fin : application **0.3.0**, branche de travail **feature/v0.3**, contrat documentaire **JSON v3.0 conservé**. Les documents anciens ne sont pas réécrits pour changer arbitrairement leurs métadonnées.

## 2. Architecture développée

Noyau `src/core/kinematics` sans React/Zustand/DOM : modèle, géométrie, contraintes, jacobienne, SVD, analyse de rang, Newton amorti, continuation, benchmark analytique. Store de simulation séparé du document éditable ; prévisualisation partagée avec le canvas et les exports. Services purs de persistance et adaptateur de cycle de vie navigateur.

Voir [ARCHITECTURE_V0.3.md](ARCHITECTURE_V0.3.md) et [SOLVER_V0.3.md](SOLVER_V0.3.md).

## 3. Fichiers créés

- `CHANGELOG.md`
- `docs/ARCHITECTURE_V0.3.md`
- `docs/FINAL_VALIDATION_V0.3.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/SOLVER_V0.3.md`
- `docs/USER_GUIDE_V0.3.md`
- `docs/V0.3_AUDIT.md`
- `docs/evidence/benchmark-v0.3.json`
- `docs/evidence/v0.3-1024.png`
- `docs/evidence/v0.3-simulation.png`
- `e2e/kineo.spec.ts`
- `examples/slider-crank-v3.json`
- `playwright.config.ts`
- `scripts/benchmark.mjs`
- `src/components/kinematics/KinematicsPanel.tsx`
- `src/components/kinematics/useSimulationClock.ts`
- `src/core/kinematics/__tests__/kinematics.test.ts`
- `src/core/kinematics/geometry.ts`
- `src/core/kinematics/linearAlgebra.ts`
- `src/core/kinematics/model.ts`
- `src/core/kinematics/simulation.ts`
- `src/core/kinematics/sliderCrank.ts`
- `src/core/kinematics/solver.ts`
- `src/core/kinematics/types.ts`
- `src/services/__tests__/lifecycle.test.ts`
- `src/services/documentLifecycle.ts`
- `src/services/persistence.ts`
- `src/store/useSimulationStore.ts`
- `vitest.config.ts`

## 4. Fichiers modifiés

- `.github/workflows/ci.yml`
- `.gitignore`
- `CODE_WIKI.md`
- `README.md`
- `docs/TEST_RESULTS.md`
- `documentation_etape1_etape2.txt`
- `package-lock.json`
- `package.json`
- `src/App.tsx`
- `src/components/canvas/Viewport2D.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/PropertyInspector.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/StatusBar.tsx`
- `src/model/defaultDocument.ts`
- `src/model/export2d.ts`
- `src/model/planarScene.ts`
- `src/store/useKineoStore.ts`
- `tsconfig.app.json`
- `tsconfig.node.json`

## 5. Fonctionnalités effectivement opérationnelles

- Document vierge utilisable, premier solide correctement coloré, bâti créable et désignable, historique préservé.
- Validation JSON/références, import/export v3.0 et extensions, erreurs d’import sans remplacement du document actif.
- Contraintes des corps plans, analyse de mobilité locale et résidus de longueur/angle.
- Assemblage et simulation générale à une mobilité avec entrée pivot ou glissière, positions calculées par le solveur.
- Play/Pause, Stop/Reset, vitesse, temps demandé, conditions initiales issues des poses de l’éditeur.
- Trajectoires d’un point local sélectionné, maximum 2000 points, sans animation indépendante des équations.
- Générateur de bielle-manivelle paramétré, axe et origine orientables.
- Canvas, sélection, Graph/Split, zoom, grille, propriétés, undo/redo et téléchargements maintenus. Pendant l’aperçu, les mutations géométriques sont verrouillées ; la sélection reste disponible.
- Sauvegarde locale après 400 ms, secours, restauration, conservation des corruptions et confirmation de fermeture standard.

## 6. Méthodes mathématiques

qᵢ=[xᵢ,yᵢ,θᵢ], transformations rigides locales/globales, Φ(q)=0, jacobienne centrée normalisée. SVD de Jacobi unilatérale directe, pseudo-inverse et régularisation, Newton avec recherche linéaire. Mobilité locale n−rang(J), dépendances numériques distinguées de l’hyperstatisme.

Paramètres par défaut : tolérance normalisée 10⁻⁹, 60 itérations, seuil de rang relatif 10⁻⁸. Convergence, singularité, incompatibilité locale, non-convergence et géométrie invalide sont des états distincts. Une convergence résiduelle peut coexister avec une singularité de pilotage ; ce cas n’est pas animé comme une solution déterminée.

Les équations et hypothèses des sept types sont publiées dans SOLVER_V0.3. Six types ont une interprétation plane explicite ; l’hélicoïdale est refusée faute de pas et de convention spatiale suffisante.

## 7. Validation numérique bielle-manivelle

Trois cas, **361 configurations chacun**, un tour complet à vitesse angulaire 1 rad/s, continuation depuis la solution précédente. Comparaison indépendante avec s=r cosφ±√(L²−r² sin²φ) et β=atan2(−r sinφ, ±√D).

| Cas | Erreur position maximale (unité du document) | Erreur angle maximale (rad) | Résidu normalisé maximal | Durée mesurée (ms) |
|---|---:|---:|---:|---:|
| r=70, L=120, branche 1 | 1.90633592e-07 | 6.55323795e-10 | 9.96115731e-10 | 224.46 |
| r=30, L=80, branche 1 | 1.25292853e-07 | 5.40346656e-10 | 9.93065183e-10 | 180.91 |
| r=20, L=65, branche -1 | 7.03364833e-08 | 3.11977111e-10 | 9.92161977e-10 | 171.48 |

Le deuxième cas inclut une origine (123,−67) et un guide à 0,8 rad. Le troisième vérifie la seconde branche. Pour le cas de référence r=70 mm et L=120 mm : **3 solides mobiles, 9 coordonnées, 8 contraintes, rang 8, mobilité locale 1** ; au plus 3 itérations sur les frames mesurées.

Seuils d’acceptation : 10⁻⁶ unité de longueur, 10⁻⁷ rad, résidu normalisé 10⁻⁹. Aucun de ces seuils n’est dépassé. Les timings sont des observations locales sur les petits systèmes testés, pas une garantie générale de temps réel.

Tests supplémentaires : configurations à 0, π/2, π et 2π, pose perturbée, guide incliné, deux branches, géométrie inadmissible, point mort de transmission, singularité L=r à 90°, pilotage du coulisseau au point mort refusé, redondances et contraintes fixes incompatibles.

Mesures détaillées : [benchmark-v0.3.json](evidence/benchmark-v0.3.json). Reproduction : `npm run benchmark`.

## 8. Tests exécutés

| Suite | Réussis | Échoués |
|---|---:|---:|
| Référence initiale Vitest, 5 fichiers | 49 | 0 |
| Suite finale Vitest, 7 fichiers | **101** | **0** |
| Playwright Chromium, serveur développement | **5** | **0** |
| Mêmes 5 scénarios Chromium, build production avec Vite preview | **5** | **0** |

Il s’agit de 106 cas distincts finaux, dont les 5 tests navigateur ont été exécutés sur deux modes de service. Aucun test existant supprimé, ignoré ou désactivé. La configuration Vitest cible les tests src ; Playwright exécute séparément les scénarios e2e.

Parcours navigateur réellement effectués : document vierge → bâti → solide → pivot → analyse → simulation ; autosauvegarde et rechargement ; bielle-manivelle et trajectoire ; vrais téléchargements SVG/PNG/JSON ; réouverture du JSON téléchargé ; Graph et Split ; corruption locale conservée puis récupération explicite ; import incompatible ; confirmation de remplacement ; ajout/undo/redo ; génération paramétrée et largeur 1024 px.

Captures produites par le navigateur sur le build de production et inspectées visuellement : [simulation 1440×900](evidence/v0.3-simulation.png), [interface 1024×768](evidence/v0.3-1024.png). Le panneau est défilant et le contrôle de débordement horizontal à 1024 px passe. Les deux premiers parcours contrôlent aussi l’absence d’erreur JavaScript non capturée.

## 9. Vérifications finales

| Commande | Résultat |
|---|---|
| `npm ci` | PASS, installation reproductible depuis le lockfile |
| `npm run typecheck` | PASS, TypeScript strict application et configurations/e2e |
| `npm run lint` | PASS |
| `npm test` | PASS, 101 tests |
| `npm run build` | PASS, 141 modules, JS 405,15 kB / gzip 122,69 kB |
| `npm run benchmark` | PASS, 3 × 361 configurations |
| `npm run test:e2e` avec Chromium système | PASS, 5 tests en développement |
| `KINEO_TEST_PRODUCTION=1 ... npm run test:e2e` | PASS, 5 tests sur production |
| `npm audit` | PASS, 0 vulnérabilité |
| `npm audit --omit=dev` | PASS, 0 vulnérabilité de production |
| `npm ls --depth=0` | PASS, arbre des dépendances résolu |
| `git diff --check` | PASS |

Le contrôle npm a révélé 12 entrées modérées provenant d’une même dépendance transitive de développement `minimatch` (<11.0.1). Une substitution ciblée vers ^11.0.3 corrige la cause ; lint, typecheck, tests et build ont été revérifiés après réinstallation. La seule nouvelle dépendance directe est **@playwright/test**, en développement. Aucune bibliothèque numérique n’a été ajoutée au runtime.

Le workflow CI est étendu au benchmark et aux tests Chromium. Son exécution distante et le déploiement Pages ne sont pas affirmés : seules les vérifications locales ont été effectuées.

## 10. Défauts corrigés

Première couleur invalide, absence de création/désignation du bâti, perte du travail au rechargement, absence de secours/confirmation de fermeture, faux désalignement d’une glissière sur son déplacement autorisé et ajustement initial du canvas annulé sous StrictMode. Les champs d’extension des ancrages sont aussi conservés dans la mise à jour de leur position.

Les 49 tests historiques continuent de passer, notamment la référence JSON originale de la spécification. L’application n’utilise aucun résultat analytique préprogrammé pour animer le mécanisme.

## 11. Limites restantes

Pas de dynamique ni de 3D. Hélicoïdale non calculée, réductions planes explicites des types spatiaux. Pas de composition parentId, butées DOF comme contraintes d’inégalité, collisions, analyse globale certifiée ou preuve d’hyperstatisme. La mobilité et la singularité affichées sont locales et numériques. Un unique pilote déterminé ; au-delà d’une mobilité, l’animation est refusée.

La sauvegarde reste locale, sans verrouillage multi-onglets ; les traces et paramètres transitoires de simulation ne sont pas enregistrés dans le JSON. Stop et Reset reviennent au même document initial. Le panneau général ne reconnaît pas automatiquement tous les points morts de transmission, contrairement au benchmark analytique spécifique qui les identifie.

Voir [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) pour les détails et bornes numériques. Aucun blocage de permission, de navigateur ou de dépendance externe n’a empêché les vérifications locales. Les fonctions hors sémantique mécanique définie sont refusées explicitement, sans solution fictive.

## 12. Lancer et utiliser

```sh
npm ci
npm run dev
```

Ouvrir l’URL Vite, puis **Analyse / Simulation → Analyser et assembler → Pivot O → Play**. Choisir Piston comme point suivi. Pour construire : Nouveau → Bâti → Solides → Liaisons, puis régler les ancrages et analyser.

```sh
npm run typecheck
npm run lint
npm test
npm run benchmark
npm run build
npx playwright install chromium
npm run test:e2e
# Chromium déjà installé, Linux :
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium-browser npm run test:e2e
# Même suite sur le build de production :
KINEO_TEST_PRODUCTION=1 PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium-browser npm run test:e2e
```

Le guide [USER_GUIDE_V0.3.md](USER_GUIDE_V0.3.md) couvre les ancrages, le pilote, la récupération et les exports.

### État Git à la livraison

Sources, tests, documentation, captures et exemple disponibles dans l’arbre de travail de **feature/v0.3**. Aucun commit, tag, push ou déploiement réalisé. Les fichiers générés dist/node_modules et les résultats temporaires Playwright sont ignorés ; les preuves choisies dans docs/evidence sont conservées.
