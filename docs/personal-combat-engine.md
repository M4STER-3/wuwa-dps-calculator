# Personal Combat Engine V0.1

Le moteur personnel compose la timeline déclarative, le State/Trigger Engine, la file d'événements, le resolver d'effets et le Damage Engine. Il ne simule pas une équipe. Un événement externe peut servir de trigger, mais son propre dommage n'est jamais compté.

## Supported and executed

### Context, stats and deterministic data

- `finalStats` reste l'autorité du panneau permanent et n'est jamais reconstruit.
- Les deltas runtime suivent `effective = panel + exact base-stat basis × percent + flat`. Une base ATK/HP/DEF absente est unsupported.
- Les expressions fermées couvrent constantes, stacks, rank exact, panel stat, ressource, arithmétique, min/max, clamp/cap et seuil de stacks. NaN, Infinity, variable/rank absent et cycle sont diagnostiqués.
- Les predicates couvrent identities, ownership, action/type/élément/mode, HP, panel stat, ressources, effects, states, statuses, shield, on-field et domains, avec AND/OR/NOT.
- Les expressions runtime dépendant d'une `effective` stat modifiée dans le même snapshot sont explicitement unsupported afin d'éviter l'ordre arbitraire des arrays.

### State, lifecycle and isolation

- Les opérations sont isolées par owner; les statuses sont isolés par target.
- `activate-effect` résout la définition demandée par id, même lorsque le trigger appartient à une autre définition.
- Sont exécutés : fixed/indefinite duration, expiration, reset/no refresh, reset-only-below-max, no-reset-at-max, extension bornée et nombre maximal d'extensions, replace/reject duplicate/same-name, exclusive groups, shared stacks, independent stack expirations, caps, gain/consume/consume-all/clear.
- Les stacks indépendantes reçoivent chacune leur expiration; une consommation retire d'abord les expirations les plus anciennes.
- Les opérations de trigger sur ressources exécutent gain/consume/set/set-max/consume-all/consume-up-to avec validation stricte et clamp. Le resolver pur d'action supporte désormais les transactions explicitement déclarées `before-action`/`after-action`, de façon atomique et auditée. Les `CombatAction.costs/gains` historiques ne sont pas automatiquement traduits : leur timing n'est pas structuré.
- Les cooldowns supportent global, owner, source, action, target, action+target, source+target, element et custom. Une custom key représente explicitement un groupe partagé; les autres clés incluent le trigger source et évitent les collisions accidentelles.
- `maxTriggers` possède un scope déclaré global, owner, target, owner-target ou instance.

### Events, statuses and damage

- À timestamp égal, l'ordre est expiration, state, resource, rotation/action-start, action-hit, damage-dealt, action-end, activation, puis id lexical. Une expiration exactement au timestamp d'un hit est appliquée avant ce hit.
- La queue accepte des événements frères identiques lorsqu'ils ont des ids/occurrences distincts. Les limites de profondeur, récursion zéro délai et nombre total protègent des boucles.
- Les statuses sont stockés sur leur target, ont durée/stacks, planifient uniquement une cadence explicitement déclarée, émettent une action via la queue, consomment leurs stacks et peuvent se transformer au maximum.
- Une action dérivée transporte actor, triggering actor, source entity, damage owner et scaling owner. Personal V0.1 exige que le scaling owner soit le Resonator sélectionné.
- `action-replacement` est résolu avant requirements/talent/Motion Value. `damage-type-replacement` produit le type effectif utilisé par selectors, bonus de type et Damage Engine. L'audit conserve les ids/types base et effectifs.
- Les Motion Value modifiers V0.1 portent sur le total global de l'occurrence. L'addition conserve proportionnellement les groupes; aucun ciblage de hit group n'est modélisé ou accepté.
- Un vrai hit calculé émet `damage-dealt`, qui peut déclencher une chaîne bornée. Un calcul agrégé sans hit timings n'en émet pas. Aucun `critical-hit` probabiliste n'est dérivé de l'espérance de Crit; un trigger Crit sans événement explicite produit `critical-hit-context-required`.
- Tune Break/Rupture continuent d'utiliser les formules validées du Damage Engine. Fusion Burst reste `formula-not-supported`.

### Hit timing and snapshots

- Sans `hitTimingsSeconds`, le moteur peut calculer une occurrence agrégée à `action-start`; cela n'émet aucun faux `action-hit`.
- Si une définition pertinente écoute `action-hit`, `damage-dealt` dépendant des hits ou `critical-hit`, l'absence de timings rend le résultat partial avec `hit-timing-required`.
- Avec timings explicites, les vrais hit events sont émis et les groupes sont ventilés par hit; une incohérence entre hits et multipliers est unsupported.
- Les emitted actions exécutent `stats: trigger|hit` et `stacks: trigger|tick` en capturant les instances actives au trigger ou en lisant l'état au hit/tick. `unknown` est unsupported.

### Loader, attribution and result

- Le loader inspecte automatiquement les `structuredEffect` du Resonator. Les objets Weapon/Sonata/Main Echo doivent être résolus explicitement dans le loadout, puisque `UserBuild` ne stocke que leurs ids; aucune donnée n'est devinée.
- Les rules de Sequence utilisent `requiredSequence <= build.sequence`. Les rules `already-in-final-stats` restent auditables et ne contribuent jamais au runtime.
- Les dégâts externes et les effets d'un owner étranger ne sont pas comptés. Les owned entities doivent être déclarées.
- Le résultat expose durée complète, damage/DPS, breakdowns direct/Echo/follow-up/coordinated/summon/status/Tune, action/source, event log, transitions, audits, diagnostics et coverage.
- `partial` est vrai uniquement pour `relevant-unsupported` ou `not-emitted-due-to-missing-context`. Coverage distingue ces catégories de `modeled-unused`, mais l'inventaire automatique de toutes les mécaniques data non utilisées reste limité : `modeledUnused` ne constitue pas encore une mesure exhaustive du kit.

## Modeled for future / unsupported

- Team DPS, buffs d'équipiers, propagation Outro, quickswap et rotation à trois acteurs.
- Formule de dégâts Fusion Burst.
- Interpolation de rank ou talent; seules les tables exactes sont acceptées.
- Parsing de descriptions historiques ou cadence déduite du texte.
- Dépendances entre runtime stats effectives dans un même snapshot et résolution de graphes cycliques.
- Application automatique des `CombatAction.costs/gains`, marks génériques, registries déclaratifs et shield operations. Les conteneurs d'état existent, mais ces opérations sont modeled-only.
- `CooldownDefinition.maxTriggers`; le runtime utilise actuellement `TriggerDefinition.maxTriggers` et son scope.
- `ActiveEffectInstance.startTimeSeconds/endTimeSeconds`; le State Engine utilise `activatedAt/expiresAt` à la place.
- Motion Value ciblant un groupe/hit particulier.
- Scaling depuis un owner autre que le Resonator sélectionné.
- Génération probabiliste de `critical-hit` depuis l'expected Crit Rate; un tel événement doit être fourni explicitement par un scénario déterministe.
- Multi-target damage aggregation avancée. L'état des targets est déjà indexé et isolé, mais l'API principale reste mono-cible.
