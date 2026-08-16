# Personal Combat Engine V0.1

Le moteur personnel compose la timeline déclarative, la file d'événements, le State Engine, le resolver d'effets et le Damage Engine. Il ne simule pas une équipe et n'importe jamais les effets d'un autre owner. Un événement externe peut uniquement déclencher une action dont le `damageOwnerId` est le Resonator sélectionné ou une entité possédée.

## Combat Context et statistiques

`finalStats` demeure le panneau final permanent et n'est jamais reconstruit. Une base vérifiée séparée (`RuntimeBaseStatBasis`) sert uniquement aux deltas temporaires : `effective = panel + basis × percent + flat`. Un pourcentage ATK/HP/DEF sans base exacte produit `missing-base-stat-basis`. L'audit conserve panneau, base, contributions et valeur effective sans mutation des entrées.

Les `ValueExpression` sont un AST fermé : constantes, stacks, table exacte par rank, stats, ressources, addition, soustraction, multiplication, min/max, clamp/cap et seuil de stacks. Les valeurs manquantes, non finies, ranks absents et cycles sont unsupported. Les stats effectives sont évaluées depuis un snapshot déterministe; les effets runtime ne peuvent donc pas créer une dépendance order-dependent implicite.

Les `CombatPredicate` couvrent identités/ownership, action, type, élément, mode, HP, stats, ressources, effets, états, statuses de l'acteur ou de la cible, shield, on-field et domaines. AND/OR/NOT sont composables. Faux signifie ignored; contexte absent signifie unsupported.

## Lifecycle, ressources et cibles

Le State Engine conserve acteurs, ressources, formes, named states, HP/shield minimal, effets actifs, targets séparées, statuses, marks, cooldowns, compteurs et registries. Les ressources supportent gain, consume, set, max, consume-all et consume-up-to avec clamp. Les lifecycle metadata séparent durée, refresh, extension, unicité/exclusivité et stacks de la politique d'agrégation numérique.

Les scopes ICD sont global, owner, source, action, target, action+target, source+target, element et custom contrôlé. Les clés sont déterministes. Les transitions et diagnostics sont auditables. Les requirements historiques textuels ne sont jamais exécutés et produisent `unstructured-requirement` lorsqu'ils sont nécessaires.

## Événements et ordre

La taxonomie inclut rotation/action/hit/damage/crit/dodge/switch/Intro/Outro/Echo, ressources, state/effect/stack, heal/shield/status, Tune, Fusion Burst et custom. À timestamp égal : timestamp, priorité système documentée, puis id lexical. La queue borne le nombre d'événements et la profondeur, et rejette les cycles dérivés identiques.

Une timeline sans `hitTimingsSeconds` émet start/end mais aucun hit inventé. Les dégâts directs complets peuvent rester attachés à l'action déclarée; une mécanique entre hits exige des hits explicites et reçoit `hit-timing-required`.

Les emitted actions repassent par le Damage Engine. Elles transportent actor, owner, target, origine, attribution et `SnapshotPolicy` (stats trigger/hit, stacks trigger/tick). Une policy inconnue est unsupported. Les statuses périodiques exigent intervalle et nombre de ticks explicites. Fusion Burst reste transportable mais `formula-not-supported`.

## Résultat, couverture et limites

`simulatePersonalCombat` retourne dommages/DPS sur la durée entière, attribution direct/Echo/follow-up/coordinated/summon/status/Tune, breakdowns action/source, event log, transitions, audits et couverture. `partial` ne devient vrai que pour une mécanique pertinente non résolue; une mécanique présente mais non émise n'invente aucun dommage.

Limites actuelles : pas de Team DPS, propagation Outro, quickswap, ciblage multi-cible avancé, cadence implicite, formule Fusion Burst, interpolation de rank/talent, ni parsing de texte. Les primitives owner/actor/scaling owner/target et les targets indexées permettent une extension future sans confondre Personal et Team.
