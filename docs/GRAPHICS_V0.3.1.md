# Représentation graphique et nomenclature — v0.3.1

## Séparation des données

Les classes d’équivalence et liaisons restent la source de vérité mécanique. Un solide conserve son repère, sa position, son orientation, ses ancrages et ses relations. Chaque entité de `geometry.entities` porte séparément sa forme, ses points locaux et son style (`color`, `fill`, `fillOpacity`, largeur et type de trait). Changer la forme ou ses dimensions ne réécrit pas les ancrages ni les équations du solveur.

Les nouvelles propriétés sont des champs optionnels du document JSON v3.0. Les anciens documents sans style de remplissage ni options d’affichage restent valides ; des valeurs par défaut sont appliquées au rendu. Les identifiants techniques des classes, liaisons et entités ne sont jamais remplacés par les repères d’affichage.

Formes disponibles : segment, rectangle, rectangle arrondi, cercle, ellipse, polygone et contour libre fermé. Les sommets de polygones et contours libres sont éditables dans l’inspecteur, avec ajout et suppression de sommets (au moins trois conservés). Les points sont locaux au solide. Le canvas, le test de sélection et les exports SVG/PNG partagent les mêmes chemins vectoriels et les transformations du repère mécanique.

## Encastrement au bâti

Une fixation explicite est stockée sur le solide comme `groundFixation` : identifiant propre, point local, orientation relative, mode d’orientation et état de fixation antérieur. Elle est distincte d’une liaison `ENCASTREMENT` entre deux solides. Le solide est contraint par son état mécanique `isFixed`, que le solveur plan utilise déjà pour retirer ses coordonnées généralisées `[x, y, θ]` des inconnues. Le point et l’orientation de `groundFixation` pilotent le dessin, pas les équations.

Le symbole d’ancrage utilise une ligne de contact et cinq hachures inclinées du côté support. Par défaut, la ligne suit la tangente de la forme au point de placement ; l’orientation peut être fixée manuellement. Il s’agit d’une convention graphique indicative, sans revendication de conformité certifiée ISO ou AFNOR. La suppression de la fixation restaure l’état `isFixed` antérieur. Déplacer le marqueur le contraint au contour et ne change que ses données graphiques.

## Repères et nomenclature

`buildNomenclature` dérive les identifiants des tableaux : S0 désigne le solide de référence lorsqu’il existe ; les autres solides sont S1, S2… Les liaisons sont L1, L2… L’ordre suit les éléments du document. Après suppression, les repères restants sont renumérotés ; les références techniques restent stables. Les désignations sont conservées dans le tableau et l’inspecteur mais pas dessinées sur le schéma.

Le panneau Nomenclature est dérivé à chaque rendu depuis le document central. Sa sélection utilise le même état que le canvas et l’inspecteur. Les réglages `geometry.display.bodyIds`, `jointIds` et `anchors` contrôlent l’affichage du schéma et sont persistés avec le document. Le tableau n’est pas inclus dans les exports du schéma.

## Placement des liaisons

Choisir un type active le mode de placement sans créer d’objet. Après sélection des solides A/B et de l’orientation, le curseur affiche un aperçu. Un clic crée une seule liaison à la position choisie et conserve le mode actif ; les ancrages locaux initiaux sont calculés depuis cette position. Un accrochage proche d’un ancrage existant est indiqué. Échap ou Terminer ferme le mode. Toute erreur de sélection des solides est signalée dans la palette, et aucun objet incomplet n’est ajouté.

## Export et limites

SVG et PNG exportent les chemins, styles, repères configurés, symboles et ancrages lorsqu’ils sont activés. Les options d’affichage des repères ont les valeurs par défaut activées ; les ancrages sont masqués par défaut. La nomenclature n’est pas ajoutée automatiquement à l’illustration.

Le dessin d’encastrement est une représentation schématique et non un plan normatif. La forme graphique ne modélise ni le volume ni les propriétés physiques du solide. Le solveur et son analyse de mobilité restent plans et reposent sur les contraintes existantes.
