# Damage Engine V0.1

## Périmètre

Le Damage Engine V0.1 calcule uniquement les dégâts déterministes d'une **action individuelle standard**. Il ne somme pas une rotation, ne lit pas les timestamps, n'active pas automatiquement les buffs et ne calcule ni DPS ni Team DPS.

`UserBuild.finalStats` reste la seule source des statistiques permanentes du panneau. Le moteur ne réadditionne jamais les statistiques de base, l'arme, les Echoes, le Sonata ou les Minor Fortes. Les bonus conditionnels sont des paramètres explicites du calcul ; ils ne sont pas injectés automatiquement depuis Everbright Polestar, Trailblazing Star, Sigillum ou le Temporal Engine.

## Provenance et statut

La formule V0.1 est une formule communautaire et technique recoupée au **2026-08-16**, et non une API ou une spécification officielle de Kuro Games. Les références de recherche indiquées pour ce recoupement sont :

- Wuthering Waves Wiki — Damage, DEF, RES et Crit DMG ;
- WutheringTools — explication du calculateur ;
- wiki communautaire japonais de Wuthering Waves — recoupement des groupes multiplicatifs.

Si une future validation en jeu contredit cette implémentation, la mesure in-game prévaut et le moteur doit être corrigé.

## Entrées et scaling

Une requête reçoit explicitement :

- la `CombatAction` et ses groupes de Motion Values ;
- `finalStats` ;
- le niveau de l'attaquant ;
- l'attribut de scaling `attack`, `hp` ou `defense` ;
- l'élément ;
- la cible et ses résistances élémentaires ;
- un éventuel `effectiveDamageType` ;
- les modificateurs conditionnels explicites.

Pour un scaling standard :

```text
ScalingAttribute = finalStats[scalingAttribute]
MotionValue = percent / 100
BaseAbilityDamage = ScalingAttribute × MotionValue
```

Le `baseDamageType` reste celui de l'action. Le `effectiveDamageType`, lorsqu'il est fourni par un futur contexte d'état, choisit le Damage Type Bonus réellement applicable sans prétendre résoudre la condition lui-même.

## Groupes de hits

Chaque entrée `{ percent, hits }` est conservée. Pour chaque groupe :

```text
motionValuePerHit = percent / 100
baseAbilityDamagePerHit = ScalingAttribute × motionValuePerHit
subtotal = damagePerHit × hits
```

Le total de l'action est la somme des sous-totaux. Le moteur expose nombre de hits, Motion Value par hit, Motion Value total, dégâts unitaires et sous-total non-crit/crit/expected. Aucun groupe multi-hit n'est aplati définitivement.

## DMG Bonus et Amplification

Les pourcentages du panneau et des modificateurs explicites sont exprimés en points : `40` signifie `40 %`, puis est converti en `0,40`.

```text
totalDamageBonus =
  elementalDamageBonus[element]
  + damageTypeBonus[effectiveDamageType]
  + allDamageBonus
  + additionalElementalDamageBonus
  + additionalDamageTypeBonus

DamageBonusMultiplier = 1 + totalDamageBonus / 100

DamageAmplificationMultiplier = 1 + damageAmplification / 100
```

DMG Bonus et DMG Amplification restent deux groupes séparés et multiplicatifs.

## DEF

```text
EnemyBaseDEF = 8 × EnemyLevel + 792
AttackerLevelTerm = 800 + 8 × AttackerLevel

DefenseMultiplier =
  AttackerLevelTerm
  /
  (
    AttackerLevelTerm
    + EnemyBaseDEF
      × (1 - DEFReduction)
      × (1 - DEFIgnore)
  )
```

`DEFReduction` et `DEFIgnore` sont des ratios distincts entre 0 et 1. Au niveau 90 contre niveau 90, sans modificateur, le multiplicateur vaut `1520 / 3032 = 0,5013192612…`.

## RES

Les résistances et leurs réductions/ignores sont des ratios : `0,10` signifie `10 %`.

```text
EffectiveRES = ElementalRES[element] - RESReduction - RESIgnore
```

Puis :

```text
si EffectiveRES < 0     : RESMultiplier = 1 - EffectiveRES / 2
si 0 <= EffectiveRES < 0,8 : RESMultiplier = 1 - EffectiveRES
si EffectiveRES >= 0,8  : RESMultiplier = 1 / (5 × EffectiveRES + 1)
```

## Formule standard et Crit

Pour chaque hit :

```text
DamageBeforeCrit =
  BaseAbilityDamage
  × DamageBonusMultiplier
  × DamageAmplificationMultiplier
  × DefenseMultiplier
  × ResistanceMultiplier

nonCrit = DamageBeforeCrit
crit = DamageBeforeCrit × CritDamageMultiplier

rawCritRatePercent = finalStats.critRate + bonus explicite
effectiveCritRate = clamp(rawCritRatePercent / 100, 0, 1)
CritDamageMultiplier = (finalStats.critDamage + bonus explicite) / 100
expectedCritMultiplier = 1 + effectiveCritRate × (CritDamageMultiplier - 1)
expected = DamageBeforeCrit × expectedCritMultiplier
```

Le Crit DMG du panneau est déjà le multiplicateur total : `210 %` devient `×2,10`, et non `×3,10`. Le Crit Rate brut est conservé dans le résultat, mais sa valeur utilisée pour l'espérance est bornée entre 0 et 1. Aucun RNG n'est utilisé et aucun arrondi intermédiaire n'est effectué.

## Validation Aemeath — Basic Attack Stage 1

Entrées du preset Aemeath et de la cible contrôlée :

- ATK finale : `2000` ;
- Motion Value : `46,35 % × 1` ;
- Fusion DMG Bonus : `40 %` ;
- Basic Attack DMG Bonus : `0 %` ;
- amplification : `0 %` ;
- Crit Rate : `65 %` ;
- Crit DMG : `210 %` ;
- attaquant niveau 90, ennemi niveau 90 ;
- Fusion RES, DEF Reduction et DEF Ignore : `0`.

Ventilation calculée sans arrondi interne :

| Valeur | Résultat |
| --- | ---: |
| Scaling stat | 2000 ATK |
| Motion Value | 0,4635 |
| Base Ability Damage | 927 |
| Elemental Bonus | 40 % |
| Damage Type Bonus | 0 % |
| Total DMG Bonus | 40 % |
| DMG Bonus multiplier | 1,4 |
| Amplification multiplier | 1 |
| DEF multiplier | 0,5013192612… |
| RES multiplier | 1 |
| Non-crit | 650,6121372032… |
| Crit multiplier | 2,1 |
| Crit | 1366,2854881266… |
| Expected Crit multiplier | 1,715 |
| Expected | 1115,7998153034… |

## Validation Aemeath — Basic Attack Stage 3

Les groupes vérifiés restent séparés :

| Motion Value par hit | Hits | Non-crit par hit | Sous-total non-crit |
| ---: | ---: | ---: | ---: |
| 9,32 % | 3 | 130,8242744063… | 392,4728232190… |
| 18,63 % | 1 | 261,5081794195… | 261,5081794195… |
| 46,56 % | 1 | 653,5598944591… | 653,5598944591… |

Le Motion Value total est `0,9315` sur 5 hits. Le total non-crit est `1307,5408970976…`, le total crit `2745,8358839050…` et l'espérance `2242,4326385224…`.

## Formules non supportées et limites

Une action marquée `scaling: "tuneAmp"` retourne un résultat structuré `unsupported` avec la raison `tune-amp-not-implemented`. Elle n'est jamais transformée silencieusement en attaque ATK standard.

Restent hors périmètre :

- formule Tune Amp/Tune Rupture ;
- activation automatique des effets d'arme, Sonata, Echo ou Resonator ;
- application des fenêtres du Temporal Engine ;
- overrides spéciaux de Crit propres à certaines mécaniques ;
- dégâts de rotation et DPS ;
- buffs d'équipe et Team DPS ;
- arrondis d'affichage ou règles d'arrondi internes éventuelles du jeu.
