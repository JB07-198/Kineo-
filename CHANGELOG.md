# Changelog

## 0.3.1 — 2026-10-31

- Suppression du message central sur le canvas vide.
- Ajout d’un outil d’encastrement au bâti avec hachures de support, sélection, déplacement graphique, propriétés et suppression ; les coordonnées du solide sont contraintes par le drapeau mécanique `isFixed` existant.
- Ajout des représentations segment, rectangle, rectangle arrondi, cercle, ellipse, polygone et contour libre, avec dimensions et styles séparés du modèle cinématique.
- Partage de la géométrie vectorielle entre canvas, hit-testing et export SVG/PNG ; affichage configurable des repères et des ancrages.
- Ajout de repères de nomenclature dérivés S0… et L1… et d’un panneau de nomenclature synchronisé avec la sélection.
- Placement persistant des liaisons par clic, aperçu sous le curseur, accrochage visuel aux ancrages, orientation réglable, Échap et action Terminer.
- Version applicative portée à 0.3.1 ; le schéma JSON v3.0 et les identifiants techniques restent inchangés.
- Documentation des représentations, des repères et des interactions. Les symboles sont schématiques et ne revendiquent aucune certification normative.

## 0.3.0 — 2026-10-31

- Noyau cinématique plan indépendant : coordonnées des solides, ancrages, contraintes, jacobienne centrée et SVD Jacobi.
- Newton amorti avec recherche linéaire, régularisation, résidus, limites d’itération et diagnostics distincts.
- Analyse de mobilité locale, dépendances de contraintes et suspicion de perte de rang.
- Benchmark bielle-manivelle paramétré, deux branches, origine et guide orientables ; comparaison analytique sur trois tours de référence.
- Panneau d’analyse, pilotage angulaire ou translation, Play/Pause/Stop/Reset, temps, vitesse et points suivis.
- Prévisualisation mécanique séparée du document et trajectoires des points calculés.
- Bâti créable et désignable, correction de la première couleur sur document vierge.
- Autosauvegarde validée, secours, restauration, conservation des sauvegardes corrompues et protection à la fermeture.
- Diagnostic visuel des glissières corrigé : le déplacement autorisé suivant l’axe n’est plus un désalignement.
- Ajustement initial du canvas corrigé sous React StrictMode.
- Compatibilité JSON v3.0 conservée, exports SVG/PNG de la pose affichée et JSON du document éditable.
- TypeScript strict, tests mécaniques et d’intégration, scénarios Chromium reproductibles et documentation technique.
- Audit npm corrigé par substitution ciblée de minimatch ≥11.0.3 ; aucune nouvelle dépendance d’exécution.

## 0.2.0 — état initial de cette mission

Éditeur 2D, graphe topologique, Split, import/export JSON v3.0 et exports SVG/PNG. Sans résolution cinématique ni autosauvegarde.

## 0.1.0

Fondations du modèle JSON et éditeur 2D. Voir les rapports historiques dans docs/.
