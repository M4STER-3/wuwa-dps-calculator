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

## Persistance

La clé `wuwa-character-box:v1` contient un `CharacterBox` versionné. Les données sont validées à la lecture ; une charge absente, corrompue, incompatible ou contenant des doublons revient à une Box vide sûre. La persistance est locale au navigateur et à l'appareil.

## Ajouter des données vérifiées

Une entrée réelle doit utiliser un niveau de confiance explicite (`verified-game-data`, `multi-source-verified`, `community-recommendation`, `community-calculation`, `disputed` ou `unknown`) et renseigner, lorsque disponibles, la source, l'URL, la version du jeu et la date de vérification. Un preset ne doit jamais être présenté comme recommandé tant que ses valeurs n'ont pas été sourcées et relues.

## Données de combat déclaratives

Les actions, ressources, états, effets et rotations de référence décrivent les faits nécessaires à un futur moteur, mais ne les exécutent pas. Les multiplicateurs conservent leurs hits et leur catégorie réelle de dégâts; les effets distinguent notamment `damage-bonus` de `damage-amplification`, ainsi que durée, fin anticipée, reset et portée d'ICD.

Une rotation déclarative reste la source de vérité éditoriale. Le Temporal Engine peut désormais en construire une projection temporelle déterministe séparée, sans dégâts ni DPS. Les recoveries, timings de hits et fenêtres de cancel restent explicitement inconnus tant qu'ils ne sont pas mesurés. La convention de référence est `no-quickswap`.

Voir [`docs/temporal-engine.md`](./temporal-engine.md) pour les profils fallback V0.1, la calibration et les limites du système.

Voir [`docs/damage-engine.md`](./damage-engine.md) pour la formule d'une action individuelle, les groupes multiplicatifs et les limites du Damage Engine V0.1.
