# Architecture de la Character Box

## Séparation des données

- `src/data/catalog.ts` contient les **Game Data** statiques et les presets éditoriaux. Les entrées actuelles sont toutes marquées `technical-fixture` : elles prouvent le fonctionnement sans prétendre être des données Wuthering Waves vérifiées.
- `RecommendedBuildPreset` est une recommandation immutable. `createBuildFromPreset` en copie chaque objet imbriqué modifiable.
- `UserBuild` contient uniquement les choix du joueur et les références vers les entités statiques. La Box persistée ne duplique pas les armes, Sonata ou Main Echo complets.
- `src/storage/` isole `localStorage` du domaine. Un stockage cloud pourra plus tard implémenter le même contrat sans modifier les opérations de Box.

## Règle anti-double-comptage

`UserBuild.finalStats` est l'unique source des statistiques finales permanentes saisies par l'utilisateur. Ces chiffres peuvent déjà inclure le Resonator, son arme, ses Echoes, leurs main stats et substats, ainsi que d'autres bonus permanents.

**Il est interdit de recalculer ces statistiques depuis l'arme, le Main Echo ou le Sonata, ou de leur ajouter automatiquement une deuxième fois les mêmes valeurs.**

Les effets temporaires ou conditionnels ne font pas partie de `finalStats`. Ils appartiendront au futur moteur de combat, qui est explicitement hors périmètre de la Character Box.

## Persistance

La clé `wuwa-character-box:v1` contient un `CharacterBox` versionné. Les données sont validées à la lecture ; une charge absente, corrompue, incompatible ou contenant des doublons revient à une Box vide sûre. La persistance est locale au navigateur et à l'appareil.

## Ajouter des données vérifiées

Une entrée réelle doit remplacer `technical-fixture` par `verified-game-data` ou `editorial-recommendation` et renseigner, lorsque disponibles, la source, l'URL, la version du jeu et la date de vérification. Un preset ne doit jamais être présenté comme recommandé tant que ses valeurs n'ont pas été sourcées et relues.
