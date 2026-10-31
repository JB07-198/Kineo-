# Limites connues — v0.3.0

## Mécanique

- Cinématique géométrique **plane** uniquement : aucun effort, inertie, couple, calcul de résistance ou dynamique.
- Hélicoïdale refusée : le modèle historique ne définit pas le pas ni une sémantique spatiale suffisante.
- Rotule, pivot glissant et appui plan utilisent les intersections planes décrites dans SOLVER_V0.3 ; les rotations/translations hors plan ne sont pas simulées.
- L’appui plan est interprété comme un contact coplanaire de normale Z ; pas de décollage, frottement ou contact unilatéral.
- Les hiérarchies parentId non nulles et les données hors XY restent importables/exportables, mais le solveur les refuse. Elles ne sont pas silencieusement aplaties.
- Les bornes et valeurs DOF historiques restent des métadonnées ; les butées ne sont pas des contraintes d’inégalité du solveur. L’entrée est une coordonnée relative géométrique définie par les ancrages et repères, pas une réécriture arbitraire de ces valeurs.
- Aucun test de collision entre solides. La géométrie du dessin n’impose pas de contrainte mécanique supplémentaire.
- L’orientation relative bloquée est celle capturée à la compilation, sauf extension `referenceAngle` explicite. Les ancrages seuls ne définissent pas une orientation d’encastrement.

## Calcul numérique

- Solveur local : pas de garantie de convergence globale, d’exhaustivité des configurations ou de conservation de la branche pour un mécanisme arbitraire.
- Le rang dépend des tolérances et de l’échelle. La comparaison avec trois poses perturbées signale une singularité suspectée ; elle ne démontre pas un rang générique sur toutes les configurations admissibles.
- Une incompatibilité locale linéarisée n’est pas une preuve d’impossibilité globale.
- La mobilité tangentielle et les dépendances numériques ne constituent pas une analyse complète de mobilité finie ni d’hyperstatisme physique.
- Un seul pilote est actuellement disponible. Les systèmes à plusieurs mobilités sont analysables mais leur animation déterminée est refusée.
- Le benchmark analytique distingue points morts de transmission et singularités géométriques. Le panneau général signale le rang et les échecs de pilotage ; il ne reconnaît pas automatiquement tous les points morts de transmission de tout mécanisme.
- Les méthodes sont denses et exécutées dans le thread principal. Les tests de performance concernent les petits mécanismes de référence ; pas de promesse de temps réel sur de grands assemblages.
- Incréments plafonnés, 5000 sous-pas par saut temporel et durée de 3600 s. L’horloge ralentit plutôt que de rattraper un retard du navigateur.

## Fichiers et interface

- Autosauvegarde locale par origine/navigateur, sans synchronisation multi-appareils, verrouillage inter-onglets ou transaction atomique entre deux clés localStorage. Exporter régulièrement le JSON portable.
- Les sauvegardes récupérées établissent une nouvelle base locale ; l’état « exporté depuis cette session » n’est pas persisté dans une enveloppe supplémentaire.
- Le navigateur décide de l’affichage effectif d’une confirmation de fermeture ; Kineo enregistre l’événement standard et tente la sauvegarde.
- L’aperçu de simulation, le temps, la vitesse sélectionnée, les trajectoires et la caméra ne sont pas enregistrés dans le JSON. Les DOF pilotés existants sont préservés mais ne démarrent pas automatiquement une animation.
- Stop et Réinitialiser reviennent tous deux au document initial. Aucune commande ne remplace implicitement le document par une pose simulée.
- SVG/PNG illustrent la pose affichée ; ils ne contiennent pas le tracé cyan. JSON conserve le document éditable initial.
- Vue 3D non implémentée ; symboles schématiques sans certification ISO/AFNOR. Les scènes très denses peuvent produire des annotations chargées.
- Parcours vérifiés dans Chromium à 1440×900 et 1024×768. Pas de validation Safari/Firefox, tactile mobile ou déploiement distant dans cette mission.
