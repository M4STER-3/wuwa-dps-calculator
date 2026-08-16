# Temporal Engine V0.1

## Périmètre et séparation métier

Le Temporal Engine transforme une rotation déclarative ordonnée en timeline. Il ne calcule ni dégâts, ni Crit, ni DEF/RES ennemie, ni DPS, et ne modifie jamais `UserBuild.finalStats`. Le type de dégâts ou le talent d'une `CombatAction` reste distinct de son **profil temporel** : une Forte peut par exemple utiliser le fallback temporel d'une Skill moyenne sans devenir une Resonance Skill.

La politique de rotation de référence est `no-quickswap` : les cancels par une autre action du même Resonator sont acceptés, mais la rotation standard ne repose pas sur des swaps permanents toutes les quelques secondes.

## Profils temporels fallback V0.1

Les profils sont centralisés dans `src/domain/temporal-engine.ts`. Ils ont été définis le **2026-08-16** et portent tous la confiance initiale `estimated-default`.

| Profil | Durée théorique |
| --- | ---: |
| Basic Attack courte | 0,30 s |
| Basic Attack moyenne | 0,60 s |
| Basic Attack longue | 0,90 s |
| Heavy Attack | 1,00 s |
| Resonance Skill courte | 1,00 s |
| Resonance Skill moyenne | 1,30 s |
| Resonance Liberation courte | 0,70 s |
| Resonance Liberation longue | 1,20 s |
| Intro | 0,50 s |
| Outro | 0,60 s |
| Echo Skill | 0,80 s |
| Form Switch / transformation courte | 0,50 s |
| Action très courte | 0,25 s |

Ces valeurs ne sont **pas** des frame data officielles. La recherche publique précise reste limitée. Le point de comparaison communautaire disponible est une mesure d'environ 20 frames à 30 FPS pour trois Basic Attacks rapides de Shorekeeper, soit environ 0,67 s au total. Les autres valeurs sont des estimations raisonnées destinées uniquement à fournir un fallback cohérent avant leur remplacement progressif par de vraies mesures.

## Confiance et provenance

Chaque entrée temporelle conserve sa durée de base, sa durée effective, sa source et l'un des trois états suivants :

- `measured` : vraie mesure documentée. Sa durée effective reste strictement identique et n'est jamais calibrée ;
- `estimated-default` : durée théorique du profil, utilisée telle quelle lorsqu'aucune cible externe n'est connue ;
- `estimated-calibrated` : durée théorique multipliée par le facteur d'une rotation possédant une cible externe documentée.

Les champs `recoverySeconds`, `cancelTimingSeconds` et `hitTimingsSeconds` sont indépendants de la durée globale. Ils restent à `null` lorsqu'ils sont inconnus. Le moteur **n'invente aucun hit timing**, recovery ou cancel timing générique.

## Calibration

Pour une cible externe documentée :

```text
measuredTotal = somme des durées measured
estimatedTotal = somme des durées estimated-default
remainingTime = targetRotationDuration - measuredTotal
calibrationFactor = remainingTime / estimatedTotal
effectiveEstimatedDuration = baseEstimatedDuration × calibrationFactor
```

Les entrées mesurées ne changent jamais. Sans cible, le facteur reste absent et les fallbacks restent `estimated-default`. Si la cible est inférieure au total mesuré, si une durée est non positive/non finie, ou si la cible exige un ajustement sans aucune estimation disponible, le moteur lève une erreur structurée au lieu de produire une timeline absurde. Un facteur hors de la plage prudente 0,5–2,0 produit aussi un diagnostic, sans falsifier les mesures.

La calibration sert exclusivement à rejoindre une **durée externe connue et sourcée**. Elle ne doit jamais raccourcir ou rallonger une rotation parce qu'un résultat de DPS serait jugé plus favorable.

## Classification Aemeath V0.1

`src/data/aemeath-temporal.ts` mappe la rotation déclarative existante sans remplacer sa liste de référence. L'étape « Cancel de fin via Finale » reste une annotation de cancel et n'est pas comptée comme une seconde animation de Finale.

| Étape de rotation | Profil retenu | Justification provisoire |
| --- | --- | --- |
| Intro en Mech form | Intro | Entrée de personnage |
| Basic Mech 3 | Basic longue | Séquence multi-hit importante |
| Basic Mech 4 | Basic moyenne | Fin de chaîne plus compacte, cancel documenté |
| Overdrive | Liberation longue | Animation de Liberation multi-hit |
| Basic Mech 2 | Basic moyenne | Étape intermédiaire à deux groupes de hits |
| Basic Mech 3 | Basic longue | Séquence multi-hit importante |
| Basic Mech 4 | Basic moyenne | Fin de chaîne avec cancel |
| Skill / Shared Voyage | Form Switch courte | Transition de forme courte |
| Seraphic Duet: Encore | Skill moyenne | Forte multi-hit importante, sans changer son talent réel |
| Basic Aemeath 2 | Basic moyenne | Étape intermédiaire multi-hit |
| Basic Aemeath 3 | Basic longue | Étape multi-hit plus importante |
| Basic Aemeath 4 | Basic longue | Fin de chaîne à nombreux hits |
| Skill / Shared Voyage | Form Switch courte | Transition de forme courte |
| Seraphic Duet: Overture | Skill moyenne | Forte multi-hit importante, sans changer son talent réel |
| Heavy Mech Charged II | Heavy Attack | Attaque chargée |
| Finale | Liberation longue | Finisher de Liberation |
| Form Switch de boucle | Form Switch courte | Transition de forme |
| Outro | Outro | Sortie de personnage ; pas encore de `CombatAction` dédiée |

Avec ces choix :

- durée brute : **14,60 s** ;
- cible communautaire : **11,69 s** (`community-calculation`, Prydwen) ;
- facteur : **11,69 / 14,60 = 0,8006849315** ;
- durée finale : **11,69 s** à la tolérance numérique près ;
- confiance finale : `estimated-calibrated` car aucune animation individuelle n'est encore mesurée.

Les timestamps ne sont pas saisis à la main : ils sont cumulés par le moteur à partir des durées effectives.

### Timeline Aemeath générée

Les valeurs suivantes sont arrondies à 6 décimales pour la lecture ; le moteur conserve les nombres non arrondis.

| Début | Fin | Action |
| ---: | ---: | --- |
| 0,000000 | 0,400342 | Intro en Mech form |
| 0,400342 | 1,120959 | Basic Mech 3 (premier) |
| 1,120959 | 1,601370 | Basic Mech 4 (premier) |
| 1,601370 | 2,562192 | Heavenfall Edict: Overdrive |
| 2,562192 | 3,042603 | Basic Mech 2 |
| 3,042603 | 3,763219 | Basic Mech 3 (second) |
| 3,763219 | 4,243630 | Basic Mech 4 (second) |
| 4,243630 | 4,643973 | Skill / Form Switch (premier) |
| 4,643973 | 5,684863 | Seraphic Duet: Encore |
| 5,684863 | 6,165274 | Basic Aemeath 2 |
| 6,165274 | 6,885890 | Basic Aemeath 3 |
| 6,885890 | 7,606507 | Basic Aemeath 4 |
| 7,606507 | 8,006849 | Skill / Form Switch (second) |
| 8,006849 | 9,047740 | Seraphic Duet: Overture |
| 9,047740 | 9,848425 | Heavy Mech Charged II |
| 9,848425 | 10,809247 | Heavenfall Edict: Finale |
| 10,809247 | 11,209589 | Form Switch de boucle |
| 11,209589 | 11,690000 | Outro |

## Fenêtres d'effets V0.1

Une fenêtre conserve `startTimeSeconds`, `endTimeSeconds`, `sourceId`, `effectId`, son activation et toutes ses règles de fin. Le moteur sait déjà résoudre :

- une activation au début ou à la fin d'une action ;
- une expiration maximale ;
- une fin au début ou à la fin d'une action ;
- une fin après un nombre d'utilisations lorsque ces utilisations sont présentes dans la rotation.

Pour Aemeath, cela permet notamment de positionner Starlume jusqu'à Overdrive, Stardust Resonance jusqu'au deuxième Seraphic Duet, Unbound jusqu'à Finale, Seraphic Duo jusqu'à Finale ou son expiration, et Silent Protection à partir de l'Outro.

Les déclenchements dont l'instant exact dépend encore d'un événement de combat — Everbright Polestar, Trailblazing Star et l'ICD Starburst par cible — restent explicitement non résolus. Les règles de refresh, reset, remplacement, fin anticipée alternative et portée par cible restent déclaratives dans la fenêtre. Cette V0.1 n'est donc pas encore une machine d'état complète.

## Limites avant le futur moteur de dégâts

- Toutes les animations Aemeath sont encore des estimations calibrées.
- Les cancels documentés ne raccourcissent pas encore automatiquement les actions : leurs timings précis restent inconnus.
- Recovery/endlag et hit timings restent inconnus.
- Les triggers conditionnels nécessitant la résolution des ressources, modes, cibles ou applications de Tune Rupture/Fusion Burst ne sont pas exécutés.
- Les stacks et ICD sont représentables mais pas encore simulés par cible au fil des hits.
- Aucun effet temporel n'est appliqué à des statistiques et aucun calcul de dégâts/DPS n'existe dans ce moteur.
