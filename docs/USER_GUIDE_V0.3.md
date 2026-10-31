# Guide de construction et de simulation

## Construire depuis un document vierge

1. Cliquer **Nouveau**. Le canvas vide conserve la grille et les axes, sans message central.
2. Cliquer **+ Bâti fixe** ou créer un solide, régler sa pose, puis choisir **Définir comme bâti unique** dans ses propriétés.
3. Ajouter les solides mobiles avec **+ Solide**. Leur segment graphique initial mesure 60 unités ; la géométrie visuelle et les ancrages mécaniques sont distincts. La forme et ses styles se changent dans **Représentation graphique**.
4. Choisir un type dans **Symboles de liaison**, vérifier les solides A/B, régler l’orientation du symbole et cliquer dans le canvas. L’aperçu suit le curseur et l’accrochage aux ancrages proches est signalé.
5. Le mode de placement reste actif pour créer plusieurs liaisons du même type. Appuyer sur **Échap** ou **Terminer** pour revenir à la sélection. Une liaison est créée seulement si deux solides distincts sont choisis.
6. Choisir **Encastrement au bâti**, choisir le solide et cliquer au point voulu. Ce solide devient fixe ; le symbole peut être déplacé sans changer son repère mécanique.
7. Régler la position de liaison ou ses ancrages locaux. Pour une glissière, régler la direction **dans le repère A** et l’angle relatif B − A si nécessaire.
8. Placer les solides près d’une configuration réalisable. Le solveur assemble localement ; une topologie correcte ne garantit pas une fermeture géométrique.

Le panneau **Nomenclature** affiche les désignations, formes, positions, fixations et connexions. Les repères S0… et L1… sont calculés depuis le modèle, ne remplacent pas les identifiants techniques et un clic sur une ligne sélectionne son élément.

Le bâti est protégé contre le déplacement et la suppression. Pour le remplacer, désigner un autre solide comme bâti ; l’ancien devient mobile. L’import conserve d’éventuels multiples solides fixes, que le solveur traite comme références imposées.

## Exemple minimal : pendule plan

Créer le bâti, un solide à (0,0), puis un pivot à l’origine entre eux. Le solide mobile a trois coordonnées et le pivot apporte deux contraintes indépendantes. **Analyser et assembler** doit afficher une mobilité locale de 1. Le pivot peut ensuite être piloté en angle à vitesse constante.

## Bielle-manivelle de référence

**Exemple** charge r = 70 mm, L = 120 mm et un angle initial de 45°. Pour personnaliser, ouvrir **Analyse / Simulation → Générer une bielle-manivelle paramétrée** et régler les dimensions, l’angle, l’origine et la direction du guide. Une géométrie inadmissible est refusée avant remplacement du document.

Le fichier [slider-crank-v3.json](../examples/slider-crank-v3.json) peut être ouvert directement. Pour construire un mécanisme équivalent à la main : quatre solides dont un bâti, trois pivots et une glissière. Définir les points matériels de chaque segment par ses ancrages locaux et aligner le guide sur son axe autorisé.

## Analyser

Ouvrir **Analyse / Simulation**, puis **Analyser et assembler**. Le panneau donne le nombre de solides mobiles, coordonnées, contraintes, le rang, la mobilité, les lignes dépendantes, les résidus et l’état du solveur. La pose assemblée est un aperçu, sans modifier le document.

Si l’analyse échoue, lire le message : bâti absent, modèle hors plan, liaison non supportée, références invalides, assemblage bloqué ou contraintes incompatibles. Revenir à l’édition pour régler les poses et ancrages, puis analyser à nouveau.

Une analyse convergée n’est pas une certification de conception mécanique. Une mobilité locale de 1 ne garantit pas un tour complet admissible.

## Piloter

- Choisir un **pivot** comme entrée angulaire ou une **glissière** comme entrée de translation.
- Vitesse : deg/s pour un pivot, unité du document/s pour une glissière ; signe négatif accepté.
- **Play** initialise depuis le document puis fait progresser le temps par continuation numérique.
- **Pause** fige la pose. Changer l’entrée ou la vitesse réinitialise la session, afin de ne pas introduire une rupture artificielle de cible.
- Le champ **Temps demandé** permet d’avancer ou reculer dans la même session. Il peut refuser un saut trop grand ; préférer des incréments plus petits.
- **Stop**, **Réinitialiser** et **Revenir à l’édition** suppriment l’aperçu et restaurent exactement le document source. Stop et Réinitialiser ont volontairement le même effet de retour initial.
- Un système à plusieurs mobilités ou une entrée dépendante est refusé : aucun mouvement arbitraire ne comble les coordonnées manquantes.
- Une impossibilité de résolution arrête le mouvement à la dernière pose valide. Les diagnostics décrivent l’échec ; les coordonnées affichées restent celles de la dernière solution acceptée.

L’horloge suit le temps simulé, avec un pas plafonné ; un onglet caché ne produit pas un rattrapage brutal de temps réel. Durée maximale : 3600 s.

## Trajectoires et vues

Choisir un solide et les coordonnées locales X/Y du point à suivre. Sans choix explicite, le solide sélectionné dans la scène est utilisé. Le tracé cyan contient les positions issues du solveur, au plus 2000 points ; il est réinitialisé en changeant le point suivi, en revenant en arrière ou en réinitialisant la simulation.

La vue **Split** conserve le graphe topologique à côté du mouvement 2D. La sélection reste partagée ; le graphe ne représente pas les distances ou la mobilité numérique. Maj + glisser déplace la vue ; la molette zoome. Pendant l’aperçu, le déplacement des solides et leurs propriétés sont verrouillés. Le bouton de retour à l’édition les réactive.

## Sauvegarder et récupérer

L’autosauvegarde conserve localement le document **éditable**, sans les frames d’animation. Un échec de stockage reste visible dans la barre de message. À la prochaine ouverture, Kineo restaure la principale ou propose son secours en signalant la corruption. Aucun contenu corrompu n’est silencieusement remplacé par l’exemple.

Après récupération d’une corruption, exporter d’abord le JSON pour conserver son travail. Choisir ensuite explicitement Nouveau/Ouvrir/Exemple pour autoriser une nouvelle sauvegarde locale. Les anciens contenus corrompus sont archivés dans localStorage sous des clés `.recovery.<timestamp>`.

**Enregistrer JSON** : données initiales de l’éditeur, réouvrables, avec les champs d’extension. **Exporter SVG / PNG** : illustration de la pose affichée, y compris un aperçu calculé. Les trajectoires ne sont pas intégrées à ces exports. Le PNG est proposé en 1600 ou 2400 px de large.
