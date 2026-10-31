# Kineo v0.3.0

Kineo est un éditeur web de mécanismes plans avec un **véritable solveur de contraintes géométriques 2D**. Il permet de construire un mécanisme, désigner son bâti, calculer sa mobilité locale et animer un système à un degré de liberté depuis une entrée pivot ou glissière.

L’éditeur conserve les vues 2D, Graph et Split, les propriétés, la grille, le zoom, l’annulation/rétablissement et les exports JSON, SVG et PNG. Les documents utilisent toujours le **schéma JSON v3.0** ; la version de l’application est distincte de celle du schéma. Les champs d’extension existants sont préservés à l’import/export.

## Démarrer

Node.js 20.19+ ou 22.12+, npm et un navigateur moderne :

```sh
npm ci
npm run dev
```

Ouvrir l’adresse indiquée par Vite. L’exemple initial est une bielle-manivelle r = 70 mm, L = 120 mm. Un document local valide est restauré automatiquement s’il existe.

1. Ouvrir **Analyse / Simulation**, puis **Analyser et assembler**.
2. Vérifier la convergence, les résidus et la mobilité locale de 1.
3. Choisir **Pivot O**, une vitesse en deg/s, puis **Play**.
4. Choisir **Piston** comme solide du point suivi pour afficher sa trajectoire cyan.
5. **Pause** conserve la pose ; **Stop** ou **Réinitialiser** restaure le document initial.

Pour créer son propre mécanisme : **Nouveau → + Bâti fixe → + Solide → liaison**, puis régler les extrémités, les ancrages et les repères dans l’inspecteur. Un solide existant peut aussi devenir le bâti. Le générateur paramétré dans le panneau cinématique permet de choisir r, L, l’origine, l’orientation du guide et l’angle d’entrée.

## Calcul mécanique

Le moteur indépendant de React utilise qᵢ = [xᵢ, yᵢ, θᵢ], les équations Φ(q) = 0, une jacobienne centrée et une résolution de Newton amortie par SVD. La mobilité affichée est **n − rang(J)** sans l’entrée motrice. Les redondances numériques ne sont pas présentées comme une preuve d’hyperstatisme.

Pivot, glissière et encastrement ont des contraintes planes explicites. Rotule, pivot glissant et appui plan utilisent des réductions planes documentées et signalées. La liaison hélicoïdale est refusée par le solveur : le contrat existant ne définit pas son pas. Les documents correspondants restent éditables et exportables.

Les prévisualisations animées ne modifient ni le document, ni son historique, ni l’autosauvegarde. JSON enregistre le document initial éditable ; SVG/PNG représentent la pose actuellement affichée. Les trajectoires sont des annotations transitoires du canvas.

## Sauvegarde

Sauvegarde locale après 400 ms d’inactivité, avec un emplacement principal et une copie de secours validée. Une sauvegarde corrompue est conservée et bloque l’écrasement automatique jusqu’à un choix explicite Nouveau/Ouvrir/Exemple. Une alerte protège les modifications non exportées à la fermeture. **Enregistrer JSON** fournit une copie portable ; localStorage reste propre au navigateur et à l’origine du site.

## Vérifier

```sh
npm run typecheck
npm run lint
npm test
npm run benchmark
npm run build
npm audit
npm audit --omit=dev
```

Tests navigateur reproductibles :

```sh
npx playwright install chromium
npm run test:e2e
# Ou utiliser Chromium déjà installé :
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium-browser npm run test:e2e
```

Le benchmark numérique indépendant de l’interface vérifie trois géométries et 361 configurations par tour. Il écrit ses mesures dans [docs/evidence/benchmark-v0.3.json](docs/evidence/benchmark-v0.3.json). Exemple réouvrable : [examples/slider-crank-v3.json](examples/slider-crank-v3.json).

## Documentation

- [Changelog](CHANGELOG.md)
- [Audit de départ](docs/V0.3_AUDIT.md)
- [Architecture et modèle mécanique](docs/ARCHITECTURE_V0.3.md)
- [Mathématiques et équations des sept liaisons](docs/SOLVER_V0.3.md)
- [Construction et simulation](docs/USER_GUIDE_V0.3.md)
- [Limites connues](docs/KNOWN_LIMITATIONS.md)
- [Validation et rapport de livraison](docs/FINAL_VALIDATION_V0.3.md)

Les documents v0.0 à v0.2 et les anciens audits sont des archives de ces versions. Leurs limitations ne décrivent pas nécessairement v0.3.

## Hébergement

Application entièrement exécutée dans le navigateur, sans backend. Les workflows GitHub Actions vérifient le code et préparent le déploiement Pages avec `/Kineo-/` comme base. Dans Settings → Pages, sélectionner **GitHub Actions**. La mission v0.3 prépare les sources et vérifie le build local ; elle ne publie pas automatiquement le site.
