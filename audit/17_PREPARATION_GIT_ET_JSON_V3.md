# Préparation Git & Analyse du Schéma JSON v3.0

> Analyse de référence antérieure à l’implémentation v0.0/v0.1. Les écarts décrits
> ici sont historiques; voir `../docs/V0.0_FOUNDATION.md` et
> `../docs/V0.1_2D_EDITOR.md` pour l’état actuel.

## 1️⃣ État Git exact (au **2026‑10‑27 05:18 UTC+1**) 

| Catégorie | Fichiers | Commentaire |
|---|---|---|
| **Suivis** | `.gitignore`, `LICENSE`, `README.md` | Tracked – déjà versionnés.
| **Modifiés (non‑staged)** | `.gitignore`, `README.md` | Les deux contiennent des modifications locales (CRLF warnings, README update).
| **Non suivis** | `documentation_etape1_etape2.txt`, `eslint.config.js`, `index.html`, `package-lock.json`, `package.json`, `postcss.config.js`, `public/`, `src/`, `tailwind.config.js`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts` | Tous les fichiers sources du projet sont **untracked**. Aucun n’est ignoré par `.gitignore` (vérifié avec `git check-ignore -v src/store/useKineoStore.ts` – aucune sortie, donc non ignoré).
| **Ignorés** | – | `.gitignore` ne mentionne que les répertoires générés (`node_modules/`, `dist/`, etc.). Aucun des fichiers source n’est listé, d’où le grand nombre de *untracked*.

**Commandes utilisées** : `git status --short`, `git ls-files`, `git check-ignore -v src/store/useKineoStore.ts`.

---

## 2️⃣ Spécifications JSON v3.0 (`documentation_etape1_etape2.txt`)
- **Existence** : fichier présent, **359 lignes**, encodage **UTF‑8** (détecté par PowerShell). 
- **Contenu** : décrit le modèle de données complet d’un mécanisme Bielle‑Manivelle‑Piston.

### Structure canonique (extraits pertinents)
```json
{
  "meta": {
    "schemaVersion": "3.0",
    "appVersion": "0.1.0",
    "title": "Système Bielle-Manivelle-Piston Complexe",
    "author": "Équipe Conception",
    "lengthUnit": "mm",
    "angleUnit": "deg"
  },
  "jointDefinitions": { ... },
  "classesEquivalence": [ ... ],
  "liaisons": [ ... ],
  "kinematics": { ... },
  "geometry": { "entities": [ ... ] }
}
```
- **`meta`** : version du schéma, unité, métadonnées.
- **`jointDefinitions`** : catalogue des types de jointures ISO (Pivot, Glissière, Pivot‑Glissant, Rotule) avec leurs DOF templates.
- **`classesEquivalence`** : liste des solides (id, nom, couleur, `isFixed`, `parentId`).
- **`liaisons`** : instances concrètes de jointures — identifiant, nom, type, références de classes, position, orientation quaternion, ancrages locaux, collection de DOF avec valeurs.
- **`kinematics`** : configuration du solveur (type, boucle fermée, DOF pilotés).
- **`geometry.entities`** : représentation visuelle (segment, rectangle) avec points locaux et style.

---

## 3️⃣ Modèle TypeScript actuel (`src/types/kineo.ts` & `src/store/useKineoStore.ts`)
| Aspect | Implémentation | Observations |
|---|---|---|
| **Version** | `KineoDocument.version: '3.0'` | OK (nom différent de `meta.schemaVersion`). |
| **Métadonnées** | `metadata` contient `title`, `description`, `author`, `created`, `lastModified` | Manque `schemaVersion`, `appVersion`, `lengthUnit`, `angleUnit`. |
| **Classes** | `EquivalenceClass` → `id`, `name`, `color`, `isGround` | Absence de `parentId` et de flag `isFixed` (différent de `isGround`). |
| **Ancrages** | `Anchor` → `id`, `classId`, `position`, `orientation?` (Euler) | Orientation exprimée en Euler, pas de quaternion; pas de champ `_comment`. |
| **JointDefinitions** | `JointDefinition` (id, name, type, primary/secondary anchor, `axis?`, `limits?`) | Types de joint (`JointType`) utilisent des libellés anglais (`Pivoting`, `Prismatic`, …) différents de ceux du spec (`PIVOT`, `GLISSIERE`, `PIVOT_GLISSANT`, `ROTULE`). Aucun champ `orientation`, `anchors`, `dof` (valeur + limites). |
| **Liaisons (instances)** | **Absentes** – le store ne possède pas de tableau dédié aux liaisons; les jointes sont décrites uniquement via `jointDefinitions` (catalogue). |
| **Kinematics** | `KinematicsSolverBlock` (timeStep, duration, currentTime, isPlaying) | Manque `solverType`, `closedLoopMode`, `drivenDofs` (avec `controlType`, `targetValue`, `unit`). |
| **Geometry** | Aucun champ `geometry` dans le document. |
| **DOF template** | `DOFTemplate` (mobility, hyperstatism, inputJointIds) | Aucun détail sur chaque DOF (id, type, axis, min/max, value, unit). |

---

## 4️⃣ Matrice de correspondance **JSON v3.0 ↔ TypeScript**
```markdown
| JSON v3.0            | TypeScript (kineo.ts)                           | Compatibilité |
|----------------------|-------------------------------------------------|---------------|
| meta.schemaVersion   | KineoDocument.version ('3.0')                  | ✅ (nom différent) |
| meta.appVersion      | – (absent)                                      | ❌ Missing |
| meta.title           | metadata.title                                  | ✅ |
| meta.author          | metadata.author                                 | ✅ |
| meta.lengthUnit      | – (absent)                                      | ❌ Missing |
| meta.angleUnit       | – (absent)                                      | ❌ Missing |
| jointDefinitions.*   | JointDefinition (catalogue)                    | Partial – libellés type différents, pas de `orientation`, `anchors`, `dof` values |
| classesEquivalence[] | EquivalenceClass (id, name, color, isGround)    | Partial – `isGround` ↔ `isFixed`, missing `parentId` |
| liaisons[]           | – (no dedicated structure)                     | ❌ Missing entirely |
| kinematics.solverType| – (absent)                                     | ❌ Missing |
| kinematics.closedLoopMode | – (absent)                                 | ❌ Missing |
| kinematics.drivenDofs | – (absent)                                     | ❌ Missing |
| geometry.entities[]   | – (absent)                                     | ❌ Missing |
```

### Principales incompatibilités
1. **Typologie des jointures** – libellés anglais vs codes ISO.
2. **Absence de `liaisons`** : aucune instance de jointure avec position/orientation/quaternion.
3. **Métadonnées incomplètes** – unités, versions d’application manquantes.
4. **Orientation** – le spec utilise des quaternions (`x,y,z,w`), le modèle utilise des angles d’Euler (ou rien).
5. **`parentId` & `isFixed`** – le spec différencie les deux, le code ne garde que `isGround`.
6. **`geometry`** – non représentée dans le store.
7. **DOF détaillés** – le spec stocke chaque DOF avec valeur, limites, unité ; le code ne les décrit que globalement.

---

## 5️⃣ Risques de perte de données lors d’une future migration
- **Conversion d’orientation** : perte de précision si on passe de quaternion à Euler.
- **Suppression des champs `parentId`** : hiérarchie d’assemblage potentiellement perdue.
- **Unités non‑stockées** : les valeurs numériques pourraient être interprétées avec l’unité par défaut du code (mm/deg) – risque de confusion.
- **Jointes non‑persistées** : sans tableau `liaisons`, les paramètres de chaque jointure (valeurs, limites) seraient perdus.
- **Geometry** : si la visualisation dépend de `geometry.entities`, son absence bloquera l’affichage 3D.

---

## 6️⃣ Recommandations architecturales (sans coder pour l’instant)
1. **Renommer / étendre `JointType`** pour correspondre aux codes ISO (`PIVOT`, `GLISSIERE`, …) et conserver les libellés anciens pour rétro‑compatibilité.
2. **Ajouter une interface `Liaison`** reproduisant la structure du spec (id, name, type, classA/B, position, orientation quaternion, anchors, dof[]).
3. **Enrichir `EquivalenceClass`** avec `parentId?: string` et `isFixed?: boolean` (ou mapper `isGround` ⇔ `isFixed`).
4. **Étendre `metadata`** avec `schemaVersion`, `appVersion`, `lengthUnit`, `angleUnit`.
5. **Inclure un bloc `geometry`** contenant les entités graphiques (segment, rectangle) et leurs styles.
6. **Définir un type `DOF`** détaillé (id, type, axisLocal, min, max, value, unit) et l’intégrer dans `Liaison` ainsi que dans un éventuel `dofTemplate` global.
7. **Documenter la convention d’orientation** : stocker les quaternions dans le modèle, offrir une fonction de conversion vers Euler uniquement pour l’UI.
8. **Mettre à jour le store** pour accepter ces nouvelles propriétés tout en conservant le document initial existant (migration progressive).

---

## 7️⃣ Procédure de sauvegarde Git proposée (à exécuter **après validation**)
```bash
# 1️⃣ Vérifier l’état actuel (déjà fait)
git status --short

# 2️⃣ Ajouter **tous** les fichiers pertinents du projet (y compris la spécification)
git add .gitignore README.md package.json package-lock.json tsconfig*.json vite.config.ts eslint.config.js tailwind.config.js postcss.config.js public/ src/ documentation_etape1_etape2.txt

# 3️⃣ Créer un premier commit de référence
git commit -m "Initial project snapshot – audit 03C – include JSON v3.0 spec"

# 4️⃣ (Optionnel) Taguer pour référence future
# git tag -a v0.1-initial -m "Snapshot after audit 03C"
```
> **Important** : ne pas pousser tant que vous n’avez pas validé le contenu du commit avec l’équipe.

---

## 8️⃣ Critères d’acceptation pour la **Mission 04**
- [ ] Le modèle TypeScript possède **toutes** les structures du JSON v3.0 (meta, classes, liaisons, geometry, kinematics, DOF détaillés).
- [ ] Un mécanisme de migration (fonctions de conversion) entre le document existant et le nouveau modèle est implémenté et testé.
- [ ] Les unités (`mm`, `deg`) sont correctement gérées et exposées dans l’UI.\n- [ ] La représentation visuelle (`geometry.entities`) fonctionne dans la vue 3D.
- [ ] Les tests unitaires couvrent : lecture du JSON, validation du schéma, conversion bidirectionnelle, et persistance via le store.
- [ ] Le premier commit décrité ci‑dessus a été créé et **vérifié** (git log montre le SHA, aucun fichier manquant).

---

*Rapport généré le **2026‑10‑27 05:18 UTC+1** et stocké à*:
`C:/Users/Toshiba/Kineo-/audit/17_PREPARATION_GIT_ET_JSON_V3.md`
