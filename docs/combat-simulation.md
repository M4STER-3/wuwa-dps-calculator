# Combat Simulation V0.1

## Rôle et frontières

Combat Simulation est une couche d'orchestration déterministe et auditable. Elle parcourt une `TemporalTimeline`, résout chaque `actionId` dans les Game Data du Resonator, puis délègue chaque action standard non ambiguë à `calculateActionDamage`. Elle ne contient aucune seconde formule de dégâts et ne crée aucune seconde timeline Aemeath.

Les responsabilités restent séparées :

1. le **Temporal Engine** fournit l'ordre, les fenêtres d'action, la durée complète, la calibration et la confiance temporelle ;
2. le **Damage Engine** calcule une action à partir de ses Motion Values, du panneau final et de la cible ;
3. **Combat Simulation** classe les étapes, agrège seulement les résultats supportés et documente tout ce qui manque.

`UserBuild.finalStats` reste l'autorité exclusive du panneau. Le simulateur ne réadditionne jamais personnage, arme, Minor Fortes, Echo, Sonata ou substats. Aemeath déclare ici un scaling `attack`; l'élément `fusion` est lu depuis ses Game Data. Aucun modificateur runtime n'est injecté automatiquement.

## Résultat partiel et statuts

Chaque occurrence temporelle possède son propre résultat avec index, `stepId`, éventuel `actionId`, nom d'action, début, fin, durée effective, confiance, notes et `hitTimingsSeconds`. Les statuts V0.1 sont :

- `calculated` : action standard non ambiguë calculée par le Damage Engine ;
- `no-damage` : action à Motion Value nul, ou étape volontairement sans action associée ;
- `unsupported-damage` : l'action inflige des dégâts, mais son contexte ou sa formule ne permet pas un résultat exact ;
- `unmapped-action` : incohérence structurée lorsqu'un `actionId` est introuvable.

Un événement automatique absent n'est **pas** une action à zéro dégât. `unmodeledMechanics` le marque `not-emitted`, avec une information distincte sur la disponibilité de sa formule. Ainsi Starburst et le bonus Seraphic sont `not-emitted` avec formule disponible en mode Tune Rupture, tandis que Fusion Burst reste `not-emitted` sans formule supportée. Les modes ne sont jamais mélangés.

## `supportedDamage` et `supportedDps`

`supportedDamage.nonCrit`, `.crit` et `.expected` sont les sommes sans arrondi intermédiaire des seules étapes `calculated`. Ce total est explicitement un sous-ensemble des dégâts réels possibles, jamais un « final damage ».

Le dénominateur de chaque `supportedDps` est toujours `timeline.finalDurationSeconds` :

```text
supportedDps.expected = supportedDamage.expected / fullRotationDuration
```

La durée des seules actions calculées ne serait pas représentative : les transitions, l'Outro et l'action conditionnelle occupent bien une partie de la rotation complète, même si V0.1 ne leur attribue pas de dégâts supportés.

## Référence Aemeath S0

Avec le preset niveau 90 S0, le mode `tune-rupture`, une cible niveau 90 à 10 % RES Fusion/Physique et sans modificateur runtime, la timeline calibrée contient 18 étapes sur environ 11,69 s :

- 13 occurrences calculées, pour 4 564,68 % de Motion Value ;
- 4 étapes `no-damage` (trois Form Switch et l'Outro sans `CombatAction`) ;
- 1 étape `unsupported-damage`, `mech-heavy-2`.

La référence actuelle donne environ 57 666,72253298153 non-Crit, 121 100,1173192612 Crit et 98 898,42914406332 expected, soit 8 460,088036275734 supported expected DPS sur la durée complète. Ces nombres sont des cross-checks de test, jamais des constantes du simulateur.

`mech-heavy-2` est exclue parce que son `conditionalDamageType`, Instant Response et Before All Sounds ne sont pas résolus. À l'inverse, Finale et Seraphic Duet restent calculables parce que la présence déclarative dans la rotation suffit en V0.1 ; leurs ressources et états ne sont pas validés.

## Limites explicites et roadmap

V0.1 n'invente aucun timing individuel de hit : les fenêtres début/fin sont conservées, mais les hit timings restent `null`. Les fenêtres du Temporal Engine peuvent être exposées à titre informatif ; elles ne deviennent ni buffs, ni preuves d'une condition, ni validation de ressources. Un trigger externe sans début connu n'est jamais activé.

Ne sont notamment pas simulés : ressources et légalité gameplay, Instant Response, Before All Sounds, Between the Stars, Starburst automatique, bonus Tune Rupture de Seraphic, Rupturous Trail, ICD cible, Fusion Burst, effets conditionnels d'arme/Sonata, Sigillum/Echo et effets complets de Sequence. `partial: true` décrit donc un résultat valide mais incomplet.

Une version ultérieure pourra introduire un **Combat Context** explicite et un state engine pour les ressources, triggers, ICD, contributeurs et buffs conditionnels. Une application hit-by-hit devra attendre des timings réellement mesurés ; aucune approximation V0.1 ne doit devenir implicitement frame-perfect.
