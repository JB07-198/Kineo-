# Changelog

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
