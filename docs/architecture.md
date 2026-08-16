# Architecture de la Character Box

## Séparation des données

- `src/data/catalog.ts` assemble les **Game Data** statiques et les presets éditoriaux. Les données vérifiées d’un personnage peuvent vivre dans un module dédié, comme `src/data/aemeath.ts`; les entrées de démonstration restantes restent marquées `technical-fixture`.
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

Une entrée réelle doit utiliser un niveau de confiance explicite (`verified-game-data`, `multi-source-verified`, `community-recommendation`, `community-calculation`, `disputed` ou `unknown`) et renseigner, lorsque disponibles, la source, l'URL, la version du jeu et la date de vérification. Un preset ne doit jamais être présenté comme recommandé tant que ses valeurs n'ont pas été sourcées et relues.

### Portraits locaux

Les portraits fournis au projet sont placés dans `public/resonators/`, puis référencés par `Resonator.portrait` avec un chemin local et un texte alternatif. En l'absence de fichier — ou si le fichier ne peut pas être chargé — le composant partagé affiche volontairement « Image indisponible » au lieu d'une image cassée ou générée.

### Options exposées dans l'éditeur

Les presets d'un Resonator constituent la liste d'autorisation de ses armes, Sonata et Main Echo configurés. Les fixtures techniques restent disponibles pour les tests internes, mais ne peuvent pas devenir des alternatives d'un Resonator réel. Zéro option produit un état « Aucune option configurée », une option est affichée en lecture seule, et plusieurs options produisent un sélecteur.

## Données de combat déclaratives

Les actions, ressources, états, effets et rotations de référence décrivent les faits nécessaires à un futur moteur, mais ne les exécutent pas. Les multiplicateurs conservent leurs hits et leur catégorie réelle de dégâts; les effets distinguent notamment `damage-bonus` de `damage-amplification`, ainsi que durée, fin anticipée, reset et portée d'ICD.

Une rotation n'est pas une timeline simulée. Sa durée totale peut provenir d'un calcul communautaire tandis que les durées d'action, recoveries, timings de hits et fenêtres de cancel restent explicitement `unknown`. La convention de référence est `no-quickswap`.
