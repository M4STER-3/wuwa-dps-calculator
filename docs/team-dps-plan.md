# Team DPS — plan universel no-quickswap

## Objectif actuel

Le premier modèle Team DPS de WUWA LAB est volontairement simple et déterministe :

1. le personnage choisi en position 1 exécute toute sa rotation on-field ;
2. il passe au personnage choisi en position 2 ;
3. le personnage 2 exécute toute sa rotation ;
4. il passe au personnage choisi en position 3 ;
5. le personnage 3 exécute toute sa rotation ;
6. il repasse au personnage 1 pour fermer le cycle ;
7. les effets encore actifs au moment du retour restent dans le `TeamState`, sauf règle explicite d'expiration ou `endOnSwitchOut`.

La politique est **no-quickswap**. Une rotation locale n'a donc pas le droit de contenir elle-même un switch. Les seuls switches sont les frontières entre blocs P1, P2 et P3.

Le système doit être indépendant de l'identité des personnages : la position est portée par `actorId`, jamais par une branche `if (resonatorId === ...)` dans le moteur.

## Ce qui est posé dans l'étape 26

- `buildSequentialTeamCycle` compile des blocs locaux en un cycle fermé `P1 -> P2 -> P3 -> P1`.
- Le type des blocs locaux interdit structurellement les switches internes, ce qui verrouille le no-quickswap pour ce mode.
- L'ordre est celui des `actorId` fournis : le même build peut être placé en position 1, 2 ou 3 sans changer le moteur.
- Le dernier switch vers P1 laisse le `TeamState` vivre : buffs, debuffs, statuses, cooldowns, ressources et effets temporaires ne sont pas réinitialisés artificiellement.
- `buildTeamActorInputs` transmet maintenant les effets Sonata dérivés du vrai loadout 5 Echoes, y compris les builds mixtes 3+2, au lieu de dépendre d'un unique `sonataId` legacy.
- `buildTeamActorInputs` transmet aussi la base ATK/HP/DEF exacte quand elle est disponible, nécessaire aux buffs runtime en pourcentage sans reconstruire `finalStats`.

## Invariants à ne jamais casser

1. `UserBuild.finalStats` reste l'unique panneau permanent. Le Team Engine ne reconstruit jamais les stats depuis l'arme, les Echoes, Sonata ou les Minor Fortes.
2. Les bonus temporaires/conditionnels vivent dans le runtime et expirent selon leurs règles structurées.
3. Aucun personnage n'a de traitement spécial dans le moteur général. Une mécanique propre à un personnage reste une donnée/effect definition consommée par les primitives universelles.
4. Une action on-field ne peut être exécutée que par l'acteur actuellement actif.
5. En mode séquentiel, toutes les actions de P1 sont contiguës, puis toutes celles de P2, puis toutes celles de P3.
6. Le cycle fermé se termine avec P1 actif afin que le cycle suivant puisse repartir du même état partagé.
7. Un buff de P3 destiné au prochain personnage doit pouvoir affecter P1 immédiatement après le switch P3 -> P1 et rester actif tant que sa durée le permet.
8. Les données manquantes ne sont jamais inventées : timing, ressource, condition ou ownership non prouvé restent diagnostics/partiels.
9. Le calcul doit fonctionner avec n'importe quel trio supporté et n'importe quel ordre des trois builds.

## Plan d'implémentation

### A — Compiler les rotations personnelles vers des blocs Team

Créer un adaptateur universel qui prend, pour chaque `UserBuild`, la rotation personnelle sélectionnée et produit un bloc local compatible avec `buildSequentialTeamCycle`.

Règles :

- conserver l'ordre exact des actions personnelles ;
- ne pas copier aveuglément les transitions Intro/Outro personnelles : en Team, Intro/Outro appartiennent au switch entre deux acteurs ;
- conserver les variantes de rotation et modes de résonance comme données sélectionnées, pas comme branches moteur ;
- garder les profils temporels/fallbacks explicites lorsque les timings exacts ne sont pas connus ;
- exposer un diagnostic clair si une rotation personnelle ne peut pas être convertie sans hypothèse.

### B — Unifier complètement le binding Character Box -> Team actor

Faire de la Character Box la seule entrée utilisateur :

- Resonator ;
- Sequence ;
- niveaux de talents ;
- arme et rank ;
- cinq Echoes ;
- Main Echo ;
- Sonata actives réellement résolues ;
- `finalStats` permanent ;
- base ATK/HP/DEF séparée pour les stats runtime en pourcentage.

L'ordre des builds dans l'équipe doit uniquement déterminer les `actorId`/slots, jamais les règles de calcul.

### C — Lifecycle de switch universel

Auditer puis compléter la chaîne événementielle :

`rotation finie -> switch-out -> Outro éventuel -> switch-in -> Intro éventuel -> nouvelle rotation`.

À verrouiller :

- Concerto / autres règles explicites de readiness ;
- consommation de la readiness au bon moment ;
- portée `incoming-resonator`, `team`, `other-team-members`, `active-resonator` ;
- refresh/stacking/durée ;
- `endOnSwitchOut` ;
- effets qui doivent survivre deux switches et être encore actifs au retour sur P1 ;
- déclencheurs Intro/Outro data-driven sans double activation.

### D — Ressources et répétabilité du cycle

Le vrai Team DPS doit être calculé sur un cycle répétable, pas seulement sur un premier burst favorable.

Étapes :

- conserver ressources, états, buffs, cooldowns et statuses de cycle 1 vers cycle 2 ;
- propager correctement Concerto et Resonance Energy selon les règles vérifiées ;
- comparer la signature d'exécution cycle 1 / cycle 2 ;
- classer `repeatable`, `not-repeatable` ou `partial-unknown` ;
- ne publier un DPS stable que lorsque la durée et les dépendances bloquantes sont résolues.

`simulateTeamContinuation` et `validateTeamCycle` existent déjà et doivent rester les primitives de cette validation.

### E — Effets Team réellement cross-character

Promouvoir progressivement les mécaniques déjà décrites mais encore Team-owned :

- Outro buffs vers le prochain personnage ;
- buffs d'équipe ;
- debuffs/statuses ennemis persistants ;
- coordinated attacks et dégâts off-field ;
- effets d'armes/Sonata/Main Echo dépendant d'Intro, Outro, Echo Skill ou d'un autre membre ;
- ownership séparé `triggeringActorId`, `damageOwnerId`, `scalingOwnerId`.

La promotion se fait primitive par primitive. Aucun patch ne doit être écrit « pour Qiuyuan », « pour Galbrena », etc. si la règle est en réalité une mécanique générale du jeu.

### F — Team DPS et attribution

Quand le cycle est suffisamment supporté :

- dégâts attendus totaux du cycle ;
- durée résolue ;
- Team DPS = dégâts totaux / durée ;
- contribution de chaque acteur par `damageOwnerId` ;
- dégâts off-field attribués au bon owner ;
- audit des buffs/debuffs ayant contribué à chaque événement ;
- diagnostics visibles pour toute partie encore partielle.

### G — Interface de composition

Une fois le domaine stable :

- choisir jusqu'à trois builds de la Character Box ;
- réordonner P1/P2/P3 librement ;
- choisir la rotation/variante de chaque build ;
- afficher le cycle généré P1 -> P2 -> P3 -> P1 ;
- afficher une timeline des buffs encore actifs au changement de personnage ;
- afficher Team DPS, contribution par personnage et état de répétabilité ;
- conserver une option de test/sandbox sans modifier les builds persistés.

## Tests d'acceptation finaux

Le Team DPS universel sera considéré comme prêt quand les tests pourront démontrer au minimum :

- le même trio fonctionne dans plusieurs permutations de slots sans changement de code moteur ;
- P1 ne joue jamais pendant le bloc P2/P3 en mode no-quickswap ;
- le switch final P3 -> P1 ferme réellement le cycle ;
- un buff P3 -> incoming est visible sur P1 au retour ;
- un buff expiré avant le retour n'est plus appliqué ;
- un effet `endOnSwitchOut` disparaît au bon switch ;
- les Sonata 3+2 et Main Echo viennent du vrai build ;
- les stats permanentes ne sont pas double comptées ;
- cycle 2 repart du `finalState` de cycle 1 ;
- toute donnée inconnue empêche silencieusement zéro calcul : elle produit un diagnostic explicite.
