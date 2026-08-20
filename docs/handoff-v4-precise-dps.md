# WUWA LAB · Passation V4 Precise DPS

Cette fiche est la référence de reprise pour un futur chat. Elle décrit les choix déjà validés et évite de recommencer l’architecture ou de réinventer des règles déjà décidées.

## État de travail

- Repo : `M4STER-3/wuwa-dps-calculator`
- Chaîne V4 : branches / PR empilées, volontairement non mergées tant que les étapes visuelles ne sont pas testées par l’utilisateur.
- Branche Precise DPS active : `v4-ui-step-13-precise-dps-modes`
- PR associée : `#83`
- Hiyuki : mécanique Precise DPS marquée `complete` dans `src/data/precise-dps-future-registry.json`.
- Checkpoint code Hiyuki avant cette fiche : `e8cfd2646159eba3c8cd89b24b986720fe388095`.
- Ne jamais déclarer une étape verte sans vérifier le run GitHub Actions du SHA exact.

## Méthode de travail impérative

1. Travailler directement sur GitHub, sur une branche dédiée / la branche empilée actuelle.
2. Utiliser les PR ; ne pas merger une étape visuelle avant test utilisateur sauf accord explicite.
3. Vérifier systématiquement : preflight, lint, typecheck, tests, Next build, sécurité, Cloudflare Worker et Wrangler.
4. À chaque grosse étape testable, fournir le lien Cloudflare de preview réel ; ne jamais l’inventer.
5. Corriger toute CI rouge avant de poursuivre.
6. Pour une longue tâche, donner régulièrement le pourcentage global et le pourcentage du personnage courant.
7. Quand un personnage est fini, indiquer ce qui reste puis continuer immédiatement si la tâche globale l’exige.

## Contrat de timing — règle fondamentale

Le temps d’une action individuelle est **théorique par défaut**.

- Ne pas inventer de frame data, hit timing, recovery ou cancel timing exact par attaque.
- Une durée exacte par attaque n’est ajoutée que lorsqu’une mécanique a réellement besoin de ce timestamp et qu’une source fiable existe.
- Le **temps total d’une rotation**, lui, doit être précis et sourcé lorsqu’un total de référence est disponible.
- Le moteur temporel peut calibrer les durées théoriques des actions afin que leur somme corresponde au total exact de rotation.
- L’absence de frame-perfect timing ne doit pas rendre un personnage `partial` si aucune mécanique utilisée par le scénario ne dépend réellement de ces timestamps.
- `buildTheoreticalRotationTimeline` reste la frontière de calibration ; le Damage Engine ne doit pas inventer le temps.

## Source de vérité des statistiques — anti-double-comptage

`UserBuild.finalStats` est l’unique source des statistiques permanentes consommées par le combat.

Interdit :

- reconstruire les stats permanentes depuis l’arme, les Echoes, Sonata ou autres équipements pendant le calcul ;
- réajouter un bonus permanent déjà inclus dans `finalStats` ;
- mélanger des bonus de panneau et des bonus runtime sans comptabilité explicite.

Les effets permanents déjà absorbés dans le panneau doivent être `already-in-final-stats`. Les effets temporaires sont appliqués explicitement au runtime.

`resolveExactBuildStatSheetV1` reste la frontière de résolution du panneau permanent.

## Personal DPS vs Team DPS

Le Personal DPS mesure tout ce qui appartient réellement au personnage calculé, mais pas les dégâts ou buffs appartenant exclusivement aux alliés.

Règle de buff importante :

- si un effet dit « team », « nearby Resonators » ou équivalent **et que le personnage lui-même en est bénéficiaire**, la part qui s’applique à lui doit compter dans son Personal DPS ;
- ne pas exclure automatiquement un buff sous prétexte que son texte mentionne l’équipe ;
- en revanche, un effet destiné explicitement à `other-team-members` / `incoming-resonator` ne doit pas se self-appliquer ;
- les buffs sortants d’Outro qui ne profitent qu’au prochain personnage restent Team Cycle-owned ;
- les Intro Skills du personnage et leurs effets personnels comptent lorsqu’ils font réellement partie du scénario personnel ;
- les transitions / Intro des alliés nécessaires à un état d’équipe restent Team Cycle-owned, sauf si le moteur Team les exécute explicitement.

Ne jamais faire fuiter un buff d’Outro entrant/sortant sur le mauvais personnage uniquement pour augmenter le chiffre DPS.

## Moteurs et frontières

### Temporal Engine

- place les actions, fenêtres et événements ;
- calibre les timings théoriques vers un total de rotation sourcé ;
- ne lit ni ne modifie `finalStats`.

### Personal Combat Engine

`simulatePersonalCombat` compose :

- contexte combat ;
- State/Trigger Engine ;
- Event Queue ;
- effets et motion values ;
- Damage Engine ;
- attribution personnelle.

Il ne doit pas contenir des branches ad hoc du type `if (resonator.id === "hiyuki")` lorsque le besoin peut être exprimé par une primitive de données générique.

### Damage Engine

- lit les stats depuis le contexte résolu ;
- garde DMG Bonus et Amplification séparés ;
- respecte DEF / RES / Crit ;
- ne possède pas la rotation ;
- ne reconstruit pas l’équipement.

### State / Effect Engine

Les mécaniques doivent être déclaratives : ressources, états, effets, stacks, statuts, triggers et opérations.

Lorsque plusieurs personnages ont besoin de la même famille de mécanique, ajouter une primitive universelle plutôt qu’une branche personnage.

## Negative Status

Le dispatch Negative Status est générique.

Les événements peuvent déclarer le type de Negative Status via payload ; le moteur ne doit pas reconnaître Hiyuki par ID.

Glacio Chafe utilise la table générique vérifiée de `negative-status-damage.ts`. Les overrides explicites de motion value restent data-owned, comme Fine Snow à 102%.

## Données et sources

### GameDatabase / Encore

La projection GameDatabase fournit en priorité :

- identité stable des personnages / armes / actions ;
- IDs source ;
- stats de base exactes ;
- motion values Lv1–10 ;
- association robuste des assets.

Le pipeline Encore est une frontière réseau non fiable : validation fail-closed, JSON borné, clés dangereuses rejetées, promotion revue avant runtime.

Ne jamais exécuter directement une formule ou un texte distant comme code.

### Sources communautaires

Pour les mécaniques / rotations qui ne sont pas suffisamment structurées dans GameDatabase :

- Prydwen peut servir de référence de rotation / calcul communautaire revue ;
- WutheringTools peut servir de cross-check de formules / classifications / chaînes ;
- les divergences doivent rester explicites ;
- ne jamais transformer une absence de source en valeur moyenne inventée.

Les métadonnées de confiance doivent rester explicites : `verified-game-data`, `multi-source-verified`, `community-recommendation`, `community-calculation`, `disputed`, `unknown`.

## Pattern d’ajout d’un futur personnage

Ordre recommandé :

1. Ajouter / vérifier la projection GameDatabase et les IDs stables.
2. Créer un petit module personnage dans `src/data/precise-dps-<personnage>.ts` uniquement pour les règles réellement spécifiques : classifications, ressources, états, effets, séquences, arme.
3. Créer `src/data/precise-dps-<personnage>-scenarios.ts` pour les scénarios personnels ; le total précis de rotation est scenario-owned lorsqu’il est sourcé.
4. Raccorder les scénarios dans `precise-dps-scenario-overrides.ts` quand une recette dédiée est nécessaire.
5. Raccorder personnage et arme dans `precise-dps-loadouts.ts`.
6. Si une nouvelle mécanique peut servir à plusieurs personnages, implémenter d’abord une primitive universelle dans le domaine au lieu de coder un cas particulier.
7. Écrire des tests stricts qui valident le résultat mécanique, pas seulement la présence de données.
8. Supprimer tout probe temporaire / `console.log` d’inventaire après validation.
9. Ne passer `mechanicsStatus` à `complete` qu’après tests + CI verte du scénario réellement revendiqué.
10. Vérifier Cloudflare/Wrangler avant de considérer le checkpoint final.

## Hiyuki — checkpoint validé

Fichiers principaux :

- `src/data/precise-dps-hiyuki.ts`
- `src/data/precise-dps-hiyuki-scenarios.ts`
- `src/data/precise-dps-hiyuki.test.ts`
- primitives Negative Status dans `src/domain/negative-status-damage.ts` et leur dispatch dans `src/domain/personal-combat-simulation.ts`.

Contrats Hiyuki :

- scénarios `hiyuki-opener` et `hiyuki-loop` ;
- durée totale sourcée / calibrée : **11.67 s** pour les scénarios de référence ;
- aucun frame timing individuel prétendu exact ;
- ressources : Dedication 300, Frostheart 300, Frostharden Iai 3, Whiteout Bitterfrost 3, Snowforged Blade 3 ;
- les gains Frostheart par action non publiés de manière suffisamment fiable ne sont pas inventés : un checkpoint scénario exact est utilisé pour la route revue ;
- Inward Vision bascule vers Foreclaimed Self et initialise les ressources structurées ;
- Iai / Bitterfrost / Blade Liberation utilisent des transactions de ressources explicites ;
- Blade Liberation consomme la banque Snowforged Blade et retourne à Present Self ;
- Glacio Bite / Glacio Chafe utilisent le moteur Negative Status générique ;
- Fine Snow peut produire l’instance additionnelle de Glacio Bite à MV fixe 102% ;
- Frostburn R1–R5 est structuré sans réinjecter ses stats permanentes déjà présentes dans `finalStats` ;
- le S4 destiné aux nearby/team Resonators bénéficie aussi à Hiyuki et compte donc dans son Personal DPS ;
- l’Outro destiné aux autres membres reste `other-team-members`, `teamContextRequired`, et ne booste pas artificiellement Hiyuki ;
- les Resonance Sequences S1–S6 sont data-owned et testées par le runtime lorsque pertinentes au scénario.

Le probe temporaire `precise-dps-hiyuki-inventory.test.ts` a été supprimé après validation.

## Tests Hiyuki importants

`precise-dps-hiyuki.test.ts` vérifie notamment :

- publication des deux scénarios ;
- recette d’actions stable ;
- total 11.67 s ;
- classifications Resonance Liberation ;
- ressources exactes et données Frostburn ;
- route opener et état final ;
- différence opener / loop de Snowforged Blade ;
- S4 appliqué aussi à Hiyuki ;
- Outro exclu du self buff ;
- S3 Fine Snow / Negative Status ;
- S6 personnel ;
- table générique Glacio Chafe et override 102%.

## Ce qu’un futur chat ne doit pas refaire

- ne pas repartir de `main` en ignorant la chaîne de PR V4 ;
- ne pas remplacer la V4 par un autre design sans demande utilisateur ;
- ne pas réintroduire un grand background global ;
- ne pas reconstruire les stats permanentes depuis l’équipement au moment du combat ;
- ne pas inventer de timings par attaque pour satisfaire un moteur ;
- ne pas confondre « team buff qui inclut le lanceur » avec « buff réservé aux alliés » ;
- ne pas parser du texte de skill au runtime pour décider du calcul ;
- ne pas ajouter de `if characterId` au moteur lorsqu’une primitive déclarative suffit ;
- ne pas laisser de probes / logs temporaires après validation ;
- ne pas merger une étape visuelle avant test utilisateur.

## Reprise conseillée

Au démarrage d’un nouveau chat :

1. lire cette fiche ;
2. vérifier le HEAD réel de `v4-ui-step-13-precise-dps-modes` et la PR #83 ;
3. vérifier la CI du HEAD ;
4. vérifier le lien Cloudflare de preview réel ;
5. comparer le registre `mechanicsStatus` à la tâche demandée avant d’annoncer quels personnages restent ;
6. continuer depuis le dernier checkpoint vert sans refaire les décisions documentées ici.
