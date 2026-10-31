# Formulation mathématique du solveur plan

## Géométrie et coordonnées

Pour chaque solide mobile i : qᵢ = [xᵢ, yᵢ, θᵢ]. Les solides fixes sont retirés des inconnues. Pour un ancrage local aᵢ :

```text
pᵢ = [xᵢ, yᵢ]ᵀ + R(θᵢ) aᵢ
R(θ) = [[cos θ, −sin θ], [sin θ, cos θ]]
Δp = pB − pA
Δθ = wrap(θB − θA − α₀)
```

`wrap` est atan2(sin, cos). Les radians ne sont pas convertis selon l’unité textuelle des DOF. α₀ est `referenceAngle` ou l’angle relatif de référence capturé dans le document compilé.

## Les sept liaisons

| Type | Équations planes | Hypothèses et limites |
|---|---|---|
| PIVOT | Δpₓ = 0 ; Δpᵧ = 0 | Axe normal Z. Deux contraintes ; rotation relative libre. |
| GLISSIERE | nA · Δp = 0 ; Δθ = 0 | uA = R(θA) uLocal ; nA = [−uAy, uAx]. Translation le long de l’axe local A. |
| ENCASTREMENT | Δpₓ = 0 ; Δpᵧ = 0 ; Δθ = 0 | Ancrages définissant le même point matériel, orientation relative bloquée. |
| ROTULE | Δpₓ = 0 ; Δpᵧ = 0 | Intersection avec le mouvement plan : seule rotation Z restante. Avertissement systématique ; pas une résolution spatiale. |
| PIVOT_GLISSANT | nA · Δp = 0 ; Δθ = 0 | Cylindre d’axe dans XY : sa rotation axiale sort du plan et est supprimée. Réduction à une glissière signalée. |
| APPUI_PLAN | Aucune ligne supplémentaire dans XY | Surfaces coplanaires de normale Z ; les trois mouvements plans sont libres. Avertissement systématique. |
| HELICOIDALE | Refus explicite | Pas absent du contrat, couplage rotation/translation spatial non défini. Aucune équation inventée. |

Les points/axes hors du plan, références absentes, auto-liaisons, identifiants dupliqués, quaternions nuls/non unitaires et hiérarchies ambiguës entraînent un statut géométriquement invalide. Un axe de translation doit être non nul et contenu dans XY. Une orientation spatiale inclinée est refusée, même si le document reste importable/exportable.

Les types d’extension inconnus restent conservés en JSON mais le solveur les refuse. Les symboles ne constituent pas une certification ISO/AFNOR.

## Normalisation et jacobienne

Un facteur ℓ est le maximum de 1 et des normes d’ancrages locaux. Les lignes de longueur sont divisées par ℓ ; les lignes angulaires restent en radians. Les coordonnées de translation sont également normalisées par ℓ dans le système linéaire. Cela limite la dépendance du rang aux unités utilisées.

La jacobienne centrée J̄ = ∂Φ̄/∂z est calculée avec h = 10⁻⁶ sur les coordonnées normalisées z. Pour les angles, la différence de résidus est circulaire afin de traverser correctement la coupure ±π. Les tests comparent J̄v à une dérivée directionnelle indépendante, au pas 10⁻⁵.

L’analyse affiche le résidu normalisé maximal, les erreurs de longueur dans l’unité du document et les erreurs angulaires en radians. Les tolérances ne constituent pas une garantie métrologique.

## Rang et mobilité

Une SVD de Jacobi unilatérale est appliquée directement à J̄, sans former JᵀJ pour calculer le rang. Le seuil par défaut est :

```text
τ = 10⁻⁸ × max(1, σmax)
r = nombre de σ > τ
Mlocale = nombre de coordonnées mobiles − r
lignes dépendantes = nombre de contraintes − r
```

L’analyse affichée exclut le pilote ; la résolution pilotée vérifie aussi que sa mobilité résiduelle est nulle. Les corps déconnectés gardent leurs mobilités libres. Aucun calcul de Grübler n’est substitué au rang.

Une suspicion de singularité correspond à un rang inférieur au maximum observé dans la pose initiale et trois perturbations déterministes voisines. Ce maximum est un indicateur numérique, non une preuve de rang générique sur la variété des contraintes. Une redondance n’est **pas** une démonstration d’hyperstatisme. Le rang tangent local ne garantit ni mobilité finie globale ni accessibilité d’une branche.

## Newton amorti

À chaque itération, résoudre J̄ δz = −Φ̄ par pseudo-inverse SVD. La correction utilise les valeurs singulières conservées et, si nécessaire, les facteurs σ/(σ² + λ) avec λ dans {0, 10⁻⁸, 10⁻⁵, 10⁻²}. La correction maximale normalisée est plafonnée à 0,5. Une recherche linéaire divise ensuite le facteur par deux jusqu’à 1/1024 du facteur initial et exige une diminution de la norme des résidus.

Critères configurables par API : tolérance résiduelle (défaut 10⁻⁹), maximum d’itérations (60), seuil de rang (10⁻⁸). Les résidus non finis, l’échec de SVD ou une recherche bloquée restent visibles.

| Statut | Sens |
|---|---|
| `converged` | Résidu sous tolérance, sans singularité détectée |
| `singular` | Perte de rang suspectée ou entrée ne déterminant pas la configuration |
| `incompatible` | Résidu non annulable dans la linéarisation au point d’arrêt |
| `nonconvergent` | Limite d’itérations, divergence ou recherche bloquée |
| `invalid` | Document, géométrie, pilote ou paramètres invalides |

Un résultat peut être géométriquement convergé (`converged: true`) et porter le statut `singular` : on distingue respect des équations et capacité à déterminer un mouvement. Une incompatibilité locale ne prouve pas l’absence de toute configuration distante ; essayer une pose initiale plus proche peut résoudre le problème.

## Pilotage et continuation

L’équation motrice angulaire est wrap(θB − θA − cible) = 0. L’équation de translation est uA · Δp − cible = 0. La cible vaut valeurInitiale + vitesse × temps. Une seule entrée est acceptée si la mobilité mécanique locale vaut exactement 1 et si la jacobienne augmentée est de rang colonne plein.

Le chemin est subdivisé à 0,04 rad au maximum par incrément angulaire ou 0,02ℓ en translation. Chaque solution initialise la suivante. Un saut dépassant 5000 sous-pas est refusé. Lors d’un échec, le temps et q restent ceux du dernier pas valide ; le résultat d’échec est conservé comme diagnostic. Aucun mouvement CSS ou résultat analytique préprogrammé n’anime le solveur.

## Benchmark bielle-manivelle

Dans le repère du guide, pour rayon r, bielle L et angle φ :

```text
D = L² − r² sin² φ
s = r cos φ + ε sqrt(D), ε ∈ {−1,+1}
β = atan2(−r sin φ, ε sqrt(D))
ds/dφ = −r sin φ − ε r² sin φ cos φ / sqrt(D)
```

D négatif : configuration inadmissible. D proche de zéro : les branches se rejoignent, singularité analytique signalée. ds/dφ proche de zéro : point mort de transmission du coulisseau ; pour L > r, φ = 0 ou π n’est pas nécessairement une perte de rang du système piloté par la **manivelle**. Piloter le coulisseau à ce point produit en revanche une singularité de pilotage.

L’origine et l’orientation du guide sont appliquées par transformation rigide. Les deux branches sont validées. Les tests vérifient s, β et Φ ; le script benchmark génère les mesures reproductibles. Tolérances d’acceptation : position 10⁻⁶ unité de longueur, angle 10⁻⁷ rad et résidu normalisé 10⁻⁹.

## Références de méthode

- [Modern Robotics, §5.3, singularités et rang de la jacobienne](https://modernrobotics.northwestern.edu/nu-gm-book-resource/5-3-singularities/).
- [SciPy, least_squares : systèmes non linéaires, jacobiennes et régularisation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.least_squares.html).

Ces références motivent les choix numériques ; Kineo implémente son propre solveur TypeScript et n’embarque pas SciPy.
