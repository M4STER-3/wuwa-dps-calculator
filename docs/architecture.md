# Architecture de la Character Box

## Séparation des données

- `src/data/catalog.ts` assemble les **Game Data** statiques et les presets éditoriaux. Les données vérifiées d’un personnage peuvent vivre dans un module dédié, comme `src/data/aemeath.ts`; les entrées de démonstration restantes restent marquées `technical-fixture`.
- `RecommendedBuildPreset` est une recommandation immutable. `createBuildFromPreset` en copie chaque objet imbriqué modifiable.
- `UserBuild` contient uniquement les choix du joueur et les références vers les entités statiques. La Box persistée ne duplique pas les armes, Sonata ou Main Echo complets.
- `src/storage/` isole `localStorage` du domaine. Un stockage cloud pourra plus tard implémenter le même contrat sans modifier les opérations de Box.

## Règle anti-double-comptage

`UserBuild.finalStats` est l'unique source des statistiques finales permanentes saisies par l'utilisateur. Ces chiffres peuvent déjà inclure le Resonator, son arme, ses Echoes, leurs main stats et substats, ainsi que d'autres bonus permanents.

**Il est interdit de recalculer ces statistiques depuis l'arme, le Main Echo ou le Sonata, ou de leur ajouter automatiquement une deuxième fois les mêmes valeurs.**

### Temporal Engine

Les effets temporaires ou conditionnels ne font pas partie de `finalStats`. Le Temporal Engine ne lit ni ne modifie ces statistiques : il positionne uniquement des actions et des fenêtres dans le temps. Un futur moteur de combat pourra consommer ces informations sans recalculer les statistiques permanentes.

### Damage Engine V0.1

Le Damage Engine suit la même frontière : pour un scaling ATK, HP ou DEF, il lit directement la valeur correspondante dans `UserBuild.finalStats`. Il ne reconstruit jamais le panneau depuis le personnage, l'arme, les Echoes, le Sonata ou les Minor Fortes. Les modificateurs temporaires lui sont fournis explicitement par un contexte séparé et ne sont pas activés automatiquement depuis l'équipement ou la timeline.

### Universal Effect & Modifier Engine V0.1

`src/domain/effect-models.ts` sépare les définitions structurées et auditées des occurrences déjà actives. `src/domain/effect-engine.ts` filtre ces occurrences par portée, élément, Damage Type, mode, action, owner/source/cible, puis agrège uniquement les familles compatibles avec `DamageModifiers`, `TuneDamageModifiers` et les overrides Crit explicites.

Cette couche ne parse jamais les descriptions historiques, ne reconstruit aucune statistique de `finalStats` et ne contient aucune formule de dégâts. Les règles `already-in-final-stats` et `informational` sont auditées mais ne contribuent pas. Elle ne déclenche, n'expire et ne rafraîchit aucune instance : ces responsabilités appartiennent au futur Trigger/State Engine.

Voir [`docs/universal-effect-engine.md`](./universal-effect-engine.md) pour les selectors, modifiers, stacking V0.1, diagnostics, audit trail et exemples structurés Aemeath.

## Persistance

La clé `wuwa-character-box:v1` contient un `CharacterBox` versionné. Les données sont validées à la lecture ; une charge absente, corrompue, incompatible ou contenant des doublons revient à une Box vide sûre. La persistance est locale au navigateur et à l'appareil.

## Ajouter des données vérifiées

Une entrée réelle doit utiliser un niveau de confiance explicite (`verified-game-data`, `multi-source-verified`, `community-recommendation`, `community-calculation`, `disputed` ou `unknown`) et renseigner, lorsque disponibles, la source, l'URL, la version du jeu et la date de vérification. Un preset ne doit jamais être présenté comme recommandé tant que ses valeurs n'ont pas été sourcées et relues.

## Données de combat déclaratives

Les actions, ressources, états, effets et rotations de référence décrivent les faits nécessaires à un futur moteur, mais ne les exécutent pas. Les multiplicateurs conservent leurs hits et leur catégorie réelle de dégâts; les effets distinguent notamment `damage-bonus` de `damage-amplification`, ainsi que durée, fin anticipée, reset et portée d'ICD.

Une rotation déclarative reste la source de vérité éditoriale. Le Temporal Engine peut désormais en construire une projection temporelle déterministe séparée, sans dégâts ni DPS. Les recoveries, timings de hits et fenêtres de cancel restent explicitement inconnus tant qu'ils ne sont pas mesurés. La convention de référence est `no-quickswap`.

Voir [`docs/temporal-engine.md`](./temporal-engine.md) pour les profils fallback V0.1, la calibration et les limites du système.

Voir [`docs/damage-engine.md`](./damage-engine.md) pour la formule d'une action individuelle, les groupes multiplicatifs et les limites du Damage Engine V0.1.

### Combat Simulation V0.1

La couche `src/domain/combat-simulation.ts` relie désormais la projection du Temporal Engine aux `CombatAction` puis au Damage Engine. Elle ne reconstruit ni stats, ni timeline, ni formule : elle produit des résultats par occurrence, agrège uniquement les dégâts supportés et divise par la durée complète de rotation. Les exclusions restent structurées et rendent le résultat explicitement partiel.

Voir [`docs/combat-simulation.md`](./combat-simulation.md) pour les statuts, le contrat de `supportedDamage` / `supportedDps`, la référence Aemeath S0 et les mécaniques non émises.

Combat Simulation V0.1 n'appelle pas encore le Universal Effect Engine. Son DPS partiel de référence reste inchangé; le branchement via un Combat Context est une étape ultérieure.

### Universal Personal Combat Engine

La nouvelle API `simulatePersonalCombat` préserve Combat Simulation V0.1 et compose les moteurs via un Combat Context universel, un State/Trigger Engine et une Event Queue déterministe. Elle applique les stats runtime depuis une base exacte distincte du panneau, résout effets et Motion Values sans muter les Game Data, puis délègue toutes les formules au Damage Engine. Les dégâts externes ne sont jamais comptés; seules les actions émises dont l'owner est personnel le sont.

Voir [`docs/personal-combat-engine.md`](./personal-combat-engine.md) pour les expressions, predicates, lifecycle, ICD, ressources, statuses, ordering, ownership, snapshot policies, couverture et limites Personal/Team.
