# Damage Engine V0.2 — Tune Break et Tune Rupture

## Frontières métier

Damage Engine V0.2 conserve trois familles distinctes :

1. **Standard Damage V0.1**, fondé sur ATK/HP/DEF, les DMG Bonus standards, l'Amplification et le Crit du panneau ;
2. **Tune Break**, fondé sur une base Tune liée au coût ennemi, un multiplicateur de niveau, la DEF, la résistance physique et Tune Break Boost ;
3. **Tune Rupture / Tune AMP**, fondé sur la base Tune, le Tune AMP propre à la compétence, la DEF, la résistance élémentaire et Tune Break Boost.

Les familles Tune n'utilisent ni ATK, ni HP, ni DEF du Resonator comme scaling. Elles n'utilisent pas non plus automatiquement les DMG Bonus élémentaires, les Damage Type Bonus, All-DMG Bonus ou l'Amplification standard.

Le moteur répond seulement à la question : « si cette instance existe, combien de dégâts produit-elle ? ». Il ne déclenche pas Tune Break, ne gère pas l'accumulation Off-Tune, les Trails, l'ICD Starburst, les fenêtres temporelles ou une rotation/DPS.

## Provenance

Ces formules sont des formules communautaires empiriques fortement recoupées au **2026-08-16**, et non une spécification officielle de Kuro Games. Les sources déclarées sont les tests 库街区/17173, l'analyse Bilibili de 叫我棉被 avec 金铃子攻略组, les vérifications Bahamut, Prydwen, Wuthering Waves Wiki/Fandom et WutheringLab. WutheringTools sert uniquement de cross-check indépendant.

Une mesure future en jeu prévaut toujours sur les calculateurs externes et doit conduire à corriger le moteur si nécessaire.

## Tune Break Boost et migration

`FinalStats.tuneBreakBoost` est la valeur permanente/finale affichée par le panneau. Aemeath initialise cette statistique à `10`; une fixture sans valeur vérifiée utilise `0`. Un ancien build localStorage sans le champ est normalisé à la lecture avec ces mêmes valeurs, tout en conservant la version de schéma et le reste du build.

Un bonus temporaire est fourni séparément :

```text
EffectiveTuneBreakBoost =
  finalStats.tuneBreakBoost
  + temporaryTuneBreakBoostPercent

TuneBreakBoostMultiplier =
  1 + EffectiveTuneBreakBoost / 100
```

## Base Tune et coût ennemi

Le modèle mathématique utilise `TuneEnemyCost = 1 | 3 | 4` :

| Coût Tune | Base empirique |
| ---: | ---: |
| 1C | 716 |
| 3C | 2149 |
| 4C | 10027 |

Une base explicite peut être fournie pour un futur cas vérifié ne correspondant pas à cette table. Ces bases ne sont ni les HP, ni l'ATK, ni la DEF de l'ennemi.

## Tune Break V0.2

```text
TuneBreakBase =
  TuneEnemyBase × TuneBreakLevelMultiplier

TuneBreakDamage =
  TuneBreakBase
  × DefenseMultiplier
  × PhysicalResistanceMultiplier
  × TuneBreakBoostMultiplier
```

Le helper DEF standard est réutilisé, avec DEF Reduction et DEF Ignore séparés. Tune Break utilise `target.physicalResistance`, jamais la résistance Fusion d'Aemeath.

La seule valeur de niveau intégrée automatiquement est `Lv90 = 16`. Aucun profil Lv1–89 n'est interpolé. Un autre niveau doit fournir `verifiedLevelMultiplier`; sinon le résultat est `unsupported` avec `tune-break-level-multiplier-unverified`.

Tune Break ne crit pas dans cette V0.2. `nonCrit`, `crit` et `expected` sont identiques et le résultat expose `canCrit: false` et `critMode: "disabled"`. Ces champs identiques servent seulement un contrat de résultat déterministe commun, sans prétendre simuler un Crit.

## Tune Rupture / Tune AMP V0.2

Pour une instance :

```text
EffectiveTuneAmpPercent =
  BaseTuneAmpPercent + AdditionalTuneAmpPercent

TuneAmpMultiplier =
  EffectiveTuneAmpPercent / 100

TuneRuptureDamage =
  TuneEnemyBase
  × TuneAmpMultiplier
  × DefenseMultiplier
  × ElementalResistanceMultiplier
  × TuneBreakBoostMultiplier
```

Tune Rupture ne reçoit jamais le multiplicateur de niveau Tune Break `16`. Son Tune AMP propre à l'action prend cette place. Elle utilise la résistance de son élément réel et accepte RES Reduction/Ignore, mais ignore le bonus élémentaire standard du panneau.

Le contexte possède un **owner** explicite (`resonatorId`, niveau, `finalStats`, Resonance Mode). Starburst utilise donc le niveau, Tune Break Boost et l'élément d'Aemeath, pas ceux du personnage qui a déclenché le Tune Break.

Par défaut, Tune Rupture ne crit pas et ne lit pas le Crit du build. Un override fixe explicite est supporté. Pour Aemeath S6 en mode Tune Rupture :

```text
CritRate = 0.80
CritDamageMultiplier = 2.75
ExpectedCritMultiplier = 1 + 0.80 × (2.75 - 1) = 2.40
```

L'override n'est pas activé automatiquement à S0.

## Resonance Modes Aemeath

Le contexte distingue explicitement `tune-rupture` et `fusion-burst`. Starburst, Rupturous Trail et les instances Tune Rupture de Seraphic Duet exigent le mode `tune-rupture`. Une requête Tune Rupture en mode `fusion-burst` reste `unsupported` avec `wrong-resonance-mode`.

Fusion Burst, Fusion Trail et leurs interactions restent déclaratifs. Aucune formule Fusion Burst n'est inventée. Un futur simulateur devra choisir son mode, traiter un changement de mode comme un événement d'état et appliquer les resets associés.

## Augmentation additive du Tune AMP

Le helper générique calcule :

```text
additionalTuneAmpPercent = increasePerStack × stacks
effectiveTuneAmpPercent = baseTuneAmpPercent + additionalTuneAmpPercent
```

Ainsi, pour une instance Seraphic Duet Bonus à `109,35 %` et 30 Rupturous Trails retirés à `4 %` chacun :

```text
109.35 + 30 × 4 = 229.35 %
```

Ce n'est ni un Fusion DMG Bonus, ni une croissance exponentielle. Le moteur accepte aussi un nombre d'instances explicite, mais ne décide pas combien d'instances existent, quelles cibles elles touchent, ni leur ordre. La mécanique progressive S2 reste hors périmètre.

## Cross-checks non arrondis

Contexte Aemeath : propriétaire Lv90, TBB `10`, ennemi 4C Lv90, DEF neutre.

| Cas | Résistances | Résultat mathématique |
| --- | --- | ---: |
| Starburst `596,43 %` | Fusion RES `10 %` | `29681,1060433…` |
| Seraphic Bonus `109,35 %` | Fusion RES `10 %` | `5441,76004868…` |
| Tune Break Lv90 `×16` | Physical RES `10 %` | `79623,3752…` |

Le cross-check communautaire indépendant Lv90 contre ennemi 4C Lv100, Physical RES `20 %`, TBB `0`, donne `62688,08…`, proche de la mesure rapportée `62689`.

Les petites différences avec les entiers externes sont compatibles avec leurs arrondis ou précisions internes. Le moteur ne force jamais son résultat vers un entier externe.

## Limites restantes

- formule Fusion Burst non validée ;
- multiplicateurs de niveau Tune Break autres que Lv90 non intégrés ;
- bonus/multiplicateurs Tune spécifiques dont le stacking n'est pas encore isolé ;
- lifecycle Rupturous/Fusion Trail ;
- progression Aemeath S2 entre plusieurs instances ;
- Stardust Resonance, répartition multi-cible et ordre des instances ;
- ICD Starburst et déclenchement des réponses ;
- intégration Temporal Engine, dégâts de rotation et DPS.
