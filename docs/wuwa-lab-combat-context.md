# WUWA LAB · Contexte durable de calcul et d’architecture

> **But de ce document**
>
> Ce fichier décrit les **règles durables de fonctionnement** de WUWA LAB : comment les builds sont représentés, comment les statistiques sont comptées, comment les Echoes / Sonata / Main Echo / armes interagissent avec le calcul, comment les rotations personnelles sont simulées, et comment le Team DPS doit composer plusieurs personnages sans double comptage.
>
> Il est volontairement **indépendant de l’état d’avancement du projet**. Il ne doit pas servir de liste de tâches, de journal de PR ou de photographie d’un checkpoint. Une future conversation doit lire ce document pour comprendre les contrats techniques et les décisions de conception, puis inspecter séparément le repo pour connaître l’état réel du moment.

---

## 1. Objectif général de WUWA LAB

WUWA LAB est un calculateur / simulateur de theorycraft Wuthering Waves centré sur trois niveaux complémentaires :

1. **Character Box** : représentation persistée des builds réellement utilisés par l’utilisateur ;
2. **Personal DPS** : simulation déterministe d’un personnage et d’un scénario personnel donné ;
3. **Team DPS** : simulation d’une rotation commune à plusieurs Resonators, avec buffs, handoffs, statuts, dégâts off-field, ressources et ownership exacts.

Le projet ne cherche pas à produire un chiffre de DPS en faisant des moyennes silencieuses ou des suppositions invisibles. Une donnée absente doit rester absente, explicitement estimée, ou être classée comme dépendance externe selon sa nature.

La priorité absolue est la **traçabilité du calcul** : chaque chiffre important doit pouvoir être relié à une statistique de build, une motion value, une règle d’effet, une ressource, un événement, un état ou une source vérifiée.

---

## 2. Principe fondamental : une seule comptabilité pour chaque bonus

La règle la plus importante du projet est l’anti-double-comptage.

### 2.1 `UserBuild.finalStats` est l’autorité du panneau permanent

`UserBuild.finalStats` est la source de vérité des statistiques permanentes déjà résolues dans le build et consommées par les moteurs de combat.

Il peut contenir notamment :

- HP ;
- ATK ;
- DEF ;
- Crit Rate ;
- Crit DMG ;
- Energy Regen ;
- Healing Bonus ;
- Tune Break Boost ;
- bonus élémentaires ;
- bonus permanents de catégories de dégâts lorsque ceux-ci sont volontairement représentés dans le panneau.

Les moteurs de dégâts ne doivent **jamais reconstruire** ces statistiques en relisant le personnage, l’arme, les Echoes, les Minor Fortes ou d’autres équipements.

### 2.2 Un bonus n’a qu’un seul propriétaire comptable

Pour chaque effet, il faut décider explicitement s’il appartient :

- au **panneau permanent** (`finalStats`) ;
- à un **effet runtime toujours actif** ;
- à une **fenêtre runtime conditionnelle** ;
- à une **mécanique Team** ;
- ou uniquement à de l’**information / documentation**.

Un effet marqué `already-in-final-stats` reste auditable mais ne doit jamais contribuer une seconde fois au runtime.

Un bonus de gameplay permanent qui n’est volontairement pas intégré au panneau peut être modélisé comme un effet `initially-active`, mais il ne doit alors pas être aussi ajouté à `finalStats`.

La bonne question n’est donc pas « ce bonus est-il permanent ? », mais :

> **Où ce bonus est-il compté exactement une fois ?**

---

## 3. Séparation des responsabilités entre les couches

WUWA LAB sépare volontairement les différentes familles de calcul.

### Character Box / Build Resolver

Responsable de :

- l’équipement choisi ;
- les niveaux ;
- la Resonance Sequence ;
- les niveaux de talents ;
- les cinq Echoes et leurs rolls ;
- les statistiques permanentes résolues ;
- les références stables vers l’arme, Sonata et Main Echo.

Il ne simule pas une rotation.

### Temporal Engine

Responsable uniquement du temps :

- ordre des actions ;
- début / fin des actions ;
- durée théorique ;
- calibration vers une durée totale sourcée ;
- fenêtres temporelles lorsque leur activation est connue.

Il ne calcule pas de dégâts et ne modifie jamais `finalStats`.

### State / Trigger / Event Engine

Responsable de l’évolution du combat :

- formes ;
- ressources ;
- stacks ;
- buffs ;
- debuffs ;
- statuts ;
- cooldowns / ICD ;
- événements émis ;
- actions dérivées ;
- changements d’état ;
- expirations.

### Effect Engine

Responsable de résoudre les modificateurs actifs dans un contexte précis :

- bonus de dégâts ;
- amplification ;
- statistiques runtime ;
- Crit ;
- DEF ignore / RES ignore ;
- motion-value modifiers ;
- remplacement de catégorie de dégâts ;
- selectors et predicates.

Il ne doit pas parser du texte de skill au runtime pour deviner une règle.

### Damage Engine

Responsable des formules finales d’une instance de dégâts.

Il reçoit déjà :

- les stats résolues ;
- la motion value effective ;
- le type de dégâts ;
- l’élément ;
- les modificateurs actifs ;
- les données de cible.

Il ne possède ni la rotation, ni les ressources du personnage, ni l’équipement.

### Personal Combat Engine

Compose les couches précédentes pour **un propriétaire personnel**.

### Team Engine

Compose les mêmes principes sur une **timeline commune multi-acteurs**.

---

## 4. Données de personnage

Un Resonator est une entité de données stable contenant notamment :

- identité ;
- élément ;
- type d’arme ;
- rareté ;
- statistiques de base ;
- Minor Fortes ;
- noms de talents ;
- Resonance Sequences ;
- données de combat structurées.

Les données de combat peuvent contenir :

- formes ;
- mode initial ;
- modes de combat ;
- ressources ;
- actions ;
- effets ;
- réponses coordonnées ;
- rotations de référence ;
- inconnues explicitement documentées.

### 4.1 Les actions ont une identité stable

Une action ne doit pas être reconnue par une branche ad hoc du moteur du type :

```ts
if (resonator.id === "...")
```

lorsqu’une règle générique ou un `actionId` stable suffit.

Une action possède notamment :

- un talent d’origine ;
- une catégorie de dégâts réelle ;
- une scaling attribute ;
- une motion value ;
- un niveau de talent ;
- éventuellement des opérations de ressources ;
- éventuellement des résultats de soin / shield ;
- sa provenance.

Les classifications spéciales d’un kit doivent être corrigées dans les données du personnage, pas dans la formule générale de dégâts.

### 4.2 Motion Value et catégorie de dégâts sont distinctes

Une Forte peut être « considérée comme Resonance Liberation DMG » sans devenir un talent Resonance Liberation.

De même, le profil temporel utilisé pour une action n’a aucun droit de modifier sa catégorie de dégâts.

---

## 5. Minor Fortes et statistiques permanentes de personnage

Les Minor Fortes qui augmentent directement des statistiques permanentes doivent être résolues **en amont** dans le panneau lorsque le preset déclare ces nodes débloqués.

Exemples de familles possibles :

- ATK % ;
- HP % ;
- DEF % ;
- Crit Rate ;
- Crit DMG ;
- Energy Regen ;
- bonus élémentaire permanent.

Ces contributions ne doivent jamais être réémises plus tard comme buffs runtime si elles sont déjà absorbées dans `finalStats`.

Les Inherent Skills qui dépendent d’une action, d’un état, d’une ressource ou d’une fenêtre restent au contraire des effets runtime.

---

## 6. Armes : séparation base / secondaire / passif

Une arme possède plusieurs couches distinctes.

### 6.1 Base ATK

La Base ATK de l’arme participe à la base de calcul du build et doit être prise en compte par le Build Resolver.

### 6.2 Statistique secondaire

La statistique secondaire Lv90 est une contribution permanente du build : Crit Rate, Crit DMG, Energy Regen, etc.

Elle appartient au panneau résolu.

### 6.3 Passif permanent

Un bonus de passif permanent comme ATK %, HP %, DEF %, ou autre statistique intégrée au panneau doit être appliqué exactement une fois et marqué `already-in-final-stats` dans sa représentation structurée.

Un bonus de dégâts toujours actif qui est volontairement modélisé comme modificateur de combat peut rester `initially-active`, à condition de ne pas être également inclus dans le panneau.

### 6.4 Passif conditionnel

Les fenêtres déclenchées par :

- Intro ;
- soin ;
- Shield ;
- Basic Attack ;
- Heavy Attack ;
- Echo Skill ;
- Resonance Liberation ;
- Tune Rupture / Tune Strain / Fusion Burst ;
- application d’un statut ;
- autre événement structuré ;

doivent être des effets runtime avec leurs vraies règles de durée, refresh, stacks et cible.

### 6.5 Rank R1–R5

Les valeurs de Rank sont **sparse et exactes**.

Ne jamais interpoler entre R1 et R5. Une table de Rank doit contenir les valeurs exactes connues.

---

## 7. Echo Loadout : les cinq Echoes sont des données de build

Le loadout Echo persisté représente les cinq pièces réellement équipées.

Chaque Echo contient au minimum :

- `echoId` ;
- `sonataSetId` ;
- rareté ;
- niveau ;
- main stat principal ;
- substats ;
- éventuellement son statut de Main Echo via `mainEchoId` au niveau du loadout.

### 7.1 Règles de validation

Pour un preset endgame standard :

- cinq Echoes maximum ;
- identités uniques dans le loadout ;
- rareté et niveau explicitement attendus ;
- main stat légal pour le Cost ;
- fixed secondary main stat exact ;
- rolls de substats appartenant aux tables légales ;
- pas de double substat identique sur une même pièce ;
- pas de valeur arbitraire inventée.

### 7.2 Ce que le resolver Echo applique

Le resolver Echo applique uniquement les **statistiques permanentes de pièces** :

- main stat principal ;
- fixed secondary main stat ;
- substats.

Il produit également un audit détaillé des contributions.

Il ne doit pas appliquer silencieusement :

- passif Sonata ;
- passif du Main Echo ;
- dégâts de l’Echo ;
- buffs conditionnels.

Ces éléments appartiennent à la couche combat / effets.

### 7.3 Remplacer un loadout sans dérive

Lorsqu’un utilisateur modifie ses Echoes, l’ancien apport doit être retiré exactement une fois avant d’appliquer le nouveau loadout.

La modification répétée de rolls ne doit jamais accumuler des statistiques fantômes.

---

## 8. Sonata : les bonus doivent découler des pièces réellement équipées

Le Sonata ne doit pas être considéré comme une simple étiquette de preset.

La source de vérité est le `sonataSetId` de **chaque Echo** du loadout.

### 8.1 Comptage de pièces

Le resolver doit pouvoir déterminer les paliers actifs en comptant les pièces du même set.

Cela doit naturellement supporter :

- 5 pièces d’un même set ;
- 3 + 2 ;
- 2 + 2 + 1 ;
- toute autre combinaison légale pertinente.

Il ne faut pas créer de faux « Sonata composites » pour représenter un build 3+2.

### 8.2 Paliers indépendants

Chaque palier est une règle propre :

- 2 pièces ;
- 3 pièces ;
- 5 pièces ;
- ou toute structure spécifique au set.

Un bonus permanent toujours actif peut être un effet `initially-active` lorsque la politique du projet le classe comme modificateur de combat.

Un bonus conditionnel doit être lié au vrai événement qui le déclenche.

### 8.3 Portée du bonus

Un set peut cibler :

- `self` ;
- `team` ;
- `other-team-members` ;
- `active-resonator` ;
- `incoming-resonator` ;
- `enemy`.

Le scope est une règle de gameplay et ne doit pas être simplifié pour faire monter artificiellement le DPS personnel.

---

## 9. Main Echo : trois responsabilités différentes

Un Main Echo peut contenir trois familles de données indépendantes.

### 9.1 Bonus de slot principal

Certains Main Echoes accordent un bonus parce qu’ils occupent le slot principal.

Ce bonus peut être :

- toujours actif ;
- ou conditionné à un événement.

### 9.2 Action de cast

Le cast du Main Echo est une vraie action lorsque le build / scénario l’utilise.

Il peut :

- infliger des dégâts ;
- appliquer un buff ;
- générer une ressource ;
- déclencher un effet de personnage ;
- poser un summon ;
- provoquer une transformation ;
- déclencher un événement utilisé par une autre mécanique.

### 9.3 Dégâts du Main Echo

Les dégâts du Main Echo appartiennent au propriétaire du build lorsque le jeu les attribue à ce personnage.

Ils doivent avoir :

- motion value ;
- élément ;
- catégorie Echo Skill ;
- scaling owner ;
- timing / événements nécessaires ;
- source.

Le moteur ne doit jamais représenter le « moment logique du cast » par un faux dégât si l’action réelle n’est pas équipée.

---

## 10. Presets recommandés

Un `RecommendedBuildPreset` est une **recette éditoriale immuable** qui sert à créer un `UserBuild`.

Un preset peut spécifier :

- niveau personnage ;
- Sequence ;
- niveaux de talents ;
- progression ;
- arme + niveau + Rank ;
- `finalStats` ;
- cinq Echoes ;
- Sonata / Main Echo ;
- rôle ;
- objectifs de statistiques ;
- notes ;
- provenance.

### 10.1 Plusieurs presets par personnage sont normaux

Un personnage peut avoir plusieurs scénarios ou rôles réellement différents :

- Main DPS ;
- Hybrid ;
- Support ;
- opener ;
- loop ;
- single target ;
- AoE ;
- différents systèmes Tune ;
- différents sets Echo.

Le projet ne doit pas forcer un unique preset lorsqu’une variante modifie réellement le calcul ou la rotation.

### 10.2 Preset ≠ vérité universelle

Le preset décrit un build de référence. Le moteur doit rester capable de calculer un `UserBuild` modifié sans réinjecter les valeurs du preset original.

---

## 11. Timings : les temps théoriques sont une décision de conception

Le système temporel de WUWA LAB utilise volontairement des **durées théoriques par action** lorsque des frame data fiables ne sont pas nécessaires ou disponibles.

Ce comportement n’est pas considéré comme un défaut temporaire à supprimer.

### 11.1 Durée individuelle

Une action peut utiliser :

- une durée mesurée ;
- une durée théorique standard ;
- une durée théorique calibrée.

Les profils temporels sont indépendants de la catégorie de dégâts.

### 11.2 Durée totale de rotation

Lorsqu’une durée totale fiable / sourcée de rotation existe, **elle est prioritaire**.

Le Temporal Engine peut calibrer les durées théoriques des actions afin que la somme rejoigne ce total.

Il est interdit de modifier le total de rotation uniquement pour améliorer ou réduire artificiellement un résultat DPS.

### 11.3 Pas de fausse frame data

Le moteur ne doit jamais inventer :

- hit timings exacts ;
- recovery exact ;
- cancel timing exact ;
- frame count exact.

Une information inconnue reste inconnue.

### 11.4 Quand les hit timings deviennent réellement nécessaires

La simple absence de frame data ne rend pas un personnage incomplet.

Un hit timing précis devient matériel uniquement lorsque le calcul dépend réellement de l’ordre des hits, par exemple :

- expiration d’un buff au milieu d’une action ;
- ICD très court ;
- stack par hit ;
- `damage-dealt` nécessaire à une chaîne de triggers ;
- mécanique qui distingue un hit précis.

Sans dépendance de ce type, une action peut être calculée comme occurrence agrégée dans la timeline théorique.

---

## 12. Intro Skills : elles appartiennent au scénario, pas automatiquement au personnage

Une Intro Skill est une vraie action de combat et peut simultanément :

- infliger ses propres dégâts ;
- générer une ressource ;
- changer une forme ;
- activer un Inherent Skill ;
- déclencher une arme ;
- déclencher un Sonata ;
- créer un buff personnel ;
- consommer le handoff provenant du personnage précédent.

Mais une Intro ne doit **jamais être ajoutée automatiquement à toutes les rotations**.

Le scénario décide si le personnage entre réellement via Intro.

Ainsi :

- un opener peut commencer déjà sur le personnage et ne pas contenir d’Intro ;
- un loop peut commencer après un vrai switch et contenir l’Intro ;
- deux scénarios du même personnage peuvent donc avoir des états initiaux différents.

Le Team DPS doit produire l’Intro par le vrai enchaînement `Outro / switch / incoming actor`, et non en accordant gratuitement les buffs associés.

---

## 13. Outro Skills : dégâts personnels et handoff sont deux choses séparées

L’Outro peut posséder :

1. des dégâts propres au personnage sortant ;
2. un effet destiné au personnage entrant.

### 13.1 Dégâts d’Outro

Lorsque l’Outro inflige des dégâts, ces dégâts appartiennent au personnage qui lance l’Outro et comptent dans son Personal DPS si le scénario contient cette action.

Les dégâts d’Outro ordinaires peuvent utiliser une catégorie neutre `outroSkill` :

- formule de dégâts standard ;
- élément standard ;
- Crit / DEF / RES / All-DMG / Amplification ;
- mais pas de faux bonus Basic / Heavy / Skill / Liberation si le jeu ne les classe pas ainsi.

### 13.2 Buff du personnage entrant

Un effet explicitement destiné à `incoming-resonator` ne doit jamais s’appliquer au lanceur uniquement pour gonfler son Personal DPS.

Dans le Team Engine, le vrai switch fournit l’identité du destinataire.

---

## 14. Scopes d’effets et règle anti-fuite

Les scopes structurés doivent être interprétés littéralement.

### `self`

Uniquement le propriétaire de l’effet.

### `team`

Tous les membres, **y compris le propriétaire**, sauf si le texte du jeu exclut explicitement le lanceur.

Cette règle est importante : un buff « nearby Resonators » ou « all Resonators » peut légitimement contribuer au Personal DPS du lanceur s’il en est lui-même bénéficiaire.

### `other-team-members`

Tous les alliés sauf le propriétaire.

### `active-resonator`

Le personnage actuellement actif dans la timeline Team.

### `incoming-resonator`

Le personnage qui reçoit effectivement le handoff lors du switch.

### `enemy`

La ou les cibles concernées.

Aucun moteur ne doit convertir automatiquement `other-team-members` ou `incoming-resonator` en `self`.

---

## 15. Buffs : DMG Bonus et Amplification restent séparés

WUWA LAB doit préserver les familles multiplicatives du jeu.

En particulier :

- DMG Bonus ;
- Damage Amplification ;
- Crit ;
- DEF / DEF ignore ;
- RES / RES ignore ;
- Motion Value ;
- statistiques de scaling ;

ne sont pas interchangeables.

Un effet « +20% DMG Bonus » ne doit pas être converti en « +20% Amplification » pour simplifier le moteur.

De même, une augmentation de Motion Value modifie l’action avant la formule de dégâts ; elle n’est pas un simple All-DMG Bonus.

---

## 16. Ressources, formes, states et stacks

Les mécaniques de personnage doivent être exprimées par des primitives génériques lorsque possible.

### Ressources

Une ressource possède :

- id ;
- cap ;
- valeur courante ;
- éventuellement un cap dépendant de la Sequence ;
- une sémantique : ressource personnage, Resonance Energy, Concerto, système, etc.

Les opérations peuvent notamment :

- gain ;
- consume ;
- consume-up-to ;
- consume-all ;
- set ;
- set-max.

### Formes

Une forme est un état de gameplay explicite : baseline, mode alternatif, transformation, etc.

Le moteur doit suivre la **forme courante**, pas simplement la liste des formes disponibles.

### States

Les states servent à représenter des conditions binaires ou tokens qui ne sont pas naturellement des ressources numériques.

### Stacks

Les stacks peuvent être :

- shared ;
- indépendants avec expiration propre ;
- bornés par un maximum ;
- consommés ;
- clear ;
- rafraîchis selon une politique explicite.

---

## 17. Event Queue : les mécaniques se déclenchent par événements réels

Les effets ne doivent pas être appliqués parce qu’une description « ressemble » à une condition.

Ils réagissent à des événements structurés, par exemple :

- rotation-step-start ;
- action-start ;
- action-hit ;
- damage-dealt ;
- action-end ;
- critical-hit explicite ;
- heal-applied ;
- shield-gained ;
- echo-skill ;
- intro ;
- outro ;
- Tune Break ;
- Tune Rupture ;
- Fusion Burst ;
- événement custom data-owned.

Les emitted actions passent par la même queue déterministe que les actions normales.

La queue doit être protégée contre :

- récursions infinies ;
- boucles à délai zéro ;
- nombre d’événements non borné.

---

## 18. Ownership : source, trigger, damage owner et scaling owner

Le futur Team DPS dépend fortement de cette séparation.

Pour une action ou un dégât dérivé, il faut distinguer :

- **actor / source entity** : l’entité qui exécute l’action ;
- **triggering actor** : qui a provoqué l’événement ;
- **damage owner** : à quel personnage le dégât est attribué ;
- **scaling owner** : quelles statistiques servent à la formule ;
- **target** : qui reçoit l’effet ou le dégât.

Exemple conceptuel : une attaque coordonnée ou un summon peut être déclenché par le personnage actif, visuellement exécuté par une entité secondaire, mais appartenir en dégâts et en scaling à un autre Resonator.

Le moteur ne doit pas confondre ces identités.

---

## 19. Personal DPS : définition exacte

Le Personal DPS mesure les dégâts attribuables au personnage calculé dans le scénario personnel revendiqué.

Il peut inclure :

- dégâts directs ;
- Echo Skill du build ;
- follow-ups ;
- summons appartenant au personnage ;
- coordinated damage appartenant au personnage ;
- Negative Status appartenant au personnage ;
- Tune damage appartenant au personnage ;
- dégâts d’Outro du personnage ;
- buffs `team` dont le personnage est réellement bénéficiaire ;
- effets de son arme / Sonata / Main Echo qui s’appliquent à lui.

Il ne doit pas inclure :

- dégâts d’un allié ;
- buff réservé aux autres membres ;
- buff `incoming-resonator` accordé sans vrai destinataire ;
- événement externe uniquement utilisé comme déclencheur ;
- dégâts off-field d’un autre propriétaire.

### 19.1 Événements externes en Personal DPS

Un événement externe peut être fourni à un scénario pour représenter une condition réelle nécessaire à une mécanique personnelle.

Cet événement peut déclencher un effet du personnage, mais ses propres dégâts ne sont jamais ajoutés au Personal DPS.

### 19.2 Plusieurs scénarios personnels

Un personnage peut publier plusieurs scénarios si le calcul change réellement selon :

- opener / loop ;
- boss / AoE ;
- mode de résonance ;
- rôle ;
- condition de ressource ;
- Sequence ;
- route de rotation.

Le statut de complétude doit toujours être compris **par scénario revendiqué**, pas comme une affirmation absolue couvrant toutes les façons possibles de jouer le personnage.

---

## 20. Définition durable d’un personnage « complete »

Le mot `complete` doit être utilisé avec une portée claire.

### Personal mechanics complete

Un scénario personnel peut être considéré comme complet lorsque :

- toutes les actions matérielles du scénario sont connues ;
- les motion values nécessaires sont structurées ;
- les classifications de dégâts sont correctes ;
- les ressources / formes / states utilisés sont structurés ;
- les passifs personnels matériels sont exécutés ;
- les Sequence mechanics qui affectent ce scénario sont structurées ;
- les effets d’équipement du build revendiqué qui affectent personnellement le scénario sont pris en compte ;
- aucune mécanique personnelle importante n’est remplacée par une moyenne silencieuse.

Une dépendance qui appartient réellement au **Team Cycle** peut rester documentée comme telle sans empêcher le Personal DPS d’être complet.

### Equipment complete

Le build de référence est complet lorsque :

- personnage ;
- arme ;
- Minor Fortes ;
- cinq Echoes ;
- main stats / substats ;
- Sonata ;
- Main Echo ;
- passifs permanents ;
- fenêtres conditionnelles pertinentes ;

sont comptabilisés exactement une fois selon leur couche correcte.

### Team complete

Une composition / rotation Team est complète lorsque les dépendances multi-personnages qu’elle revendique sont réellement exécutées dans une timeline commune : handoffs, buffs, statuts, coordinated attacks, ressources et cooldowns inclus.

### Le timing théorique ne bloque pas `complete`

L’absence de frame data exacte ne rend pas un scénario incomplet tant qu’aucune mécanique matérielle ne dépend de ces frames.

Le temps théorique calibré est une politique voulue de WUWA LAB.

---

## 21. Team DPS : modèle conceptuel

Le Team DPS ne doit pas être calculé comme :

```text
Personal DPS A + Personal DPS B + Personal DPS C
```

Cette addition serait incorrecte car les personnages partagent :

- une seule timeline ;
- les fenêtres de buffs ;
- les switches ;
- les Intro / Outro ;
- les statuts ennemis ;
- les ressources d’équipe ;
- les cooldowns ;
- les durées off-field ;
- les summons / coordinated attacks ;
- les effets qui ciblent le personnage actif ou entrant.

Le Team DPS est donc une **simulation séquentielle commune**.

---

## 22. État d’une simulation Team

Une simulation Team contient entre un et trois acteurs.

Chaque acteur conserve :

- `actorId` d’instance ;
- Resonator ;
- `UserBuild` ;
- `finalStats` ;
- Sequence ;
- talents ;
- ressources ;
- forme courante ;
- states ;
- actions ;
- effets ;
- réponses coordonnées ;
- base-stat basis ;
- disponibilité de switch.

L’état partagé contient :

- acteur actif ;
- temps courant ;
- targets ;
- statuts ennemis ;
- effets actifs ;
- cooldowns ;
- event queue ;
- diagnostics ;
- couverture.

---

## 23. Timeline Team et switches

Une rotation Team est une suite ordonnée :

- action d’un acteur ;
- switch vers un autre acteur ;
- wait explicite lorsque nécessaire.

Une action ne peut pas être exécutée par un acteur qui n’est pas actif, sauf si elle a été **explicitement émise comme action off-field / coordinated / summon** par une mécanique qui l’autorise.

Le switch est un événement de gameplay important : il peut :

- terminer certains effets ;
- sélectionner `incoming-resonator` ;
- déclencher une Intro ;
- déplacer `active-resonator` ;
- démarrer un cooldown de retour ;
- rendre certaines mécaniques d’Outro applicables.

Le Team Engine ne doit pas simuler un handoff en changeant simplement une statistique sans passer par ce contexte.

---

## 24. Handoff Outro → Switch → Intro

Le handoff standard doit être compris comme une chaîne causale :

1. le personnage sortant exécute son Outro ;
2. son effet sortant est créé avec la bonne portée ;
3. le switch détermine le personnage entrant ;
4. les effets `incoming-resonator` sont attachés à ce destinataire ;
5. le personnage entrant exécute son Intro si les conditions de gameplay sont remplies ;
6. cette Intro peut déclencher à son tour ses propres ressources, arme, Sonata, états et effets.

Cette chaîne évite deux erreurs majeures :

- appliquer un Outro au mauvais personnage ;
- donner une Intro / un buff d’entrée alors que le scénario n’a jamais réellement switché.

---

## 25. Buffs d’équipe dans le Team Engine

Un effet Team doit conserver :

- son propriétaire ;
- ses destinataires ;
- son instant d’activation ;
- sa durée ;
- ses stacks ;
- ses règles de refresh ;
- ses conditions de fin.

Les effets ne doivent pas être « copiés » dans `finalStats` des autres acteurs pendant la simulation.

Ils restent des **runtime modifiers** appliqués seulement aux snapshots où ils sont actifs.

Cette règle est essentielle pour éviter qu’un buff temporaire survive après son expiration ou soit sauvegardé dans la Character Box.

---

## 26. Healing et Shield en Team DPS

Un soin ou un Shield peut être une condition de gameplay, pas seulement une statistique défensive.

Le moteur doit donc conserver les événements :

- `heal-applied` ;
- `shield-gained` ;
- bénéficiaires exacts ;
- scaling owner ;
- source entity.

Ces événements peuvent déclencher :

- arme ;
- Sonata ;
- buff Team ;
- stack ;
- domaine ;
- autre réponse structurée.

Un effet qui dit « après avoir soigné un allié » ou « lorsqu’un Shield est obtenu » ne doit pas être préactivé simplement parce que le build possède une capacité de soin / Shield.

---

## 27. Statuts ennemis et Negative Status

Les statuts sont stockés **par cible**, avec :

- définition ;
- source owner ;
- stacks ;
- durée ;
- cadence lorsqu’elle existe ;
- transformations éventuelles.

Le Team Engine doit permettre qu’un personnage applique un statut et qu’un autre personnage en profite, sans transférer l’ownership du statut.

Les Negative Status doivent rester génériques : le moteur reconnaît le type de statut / événement, pas l’id d’un personnage précis.

Les overrides exacts de motion value restent data-owned.

---

## 28. Tune, Shifting et événements de réaction

Les systèmes de Tune doivent être traités comme des événements / statuts structurés.

Une mécanique peut :

- appliquer un état Shifting ;
- écouter Tune Rupture ;
- écouter Tune Break ;
- répondre à Tune Strain ;
- convertir une condition de cible ;
- émettre une action dérivée ;
- appliquer un buff / debuff.

En Personal DPS, un événement externe peut représenter la condition sans ajouter les dégâts de l’allié.

En Team DPS, ces événements doivent idéalement être produits naturellement par les vraies actions de la composition.

---

## 29. Coordinated attacks, summons et dégâts off-field

Le Team Engine doit permettre à un acteur non actif de posséder des dégâts tant qu’une mécanique structurée les émet.

Il faut toujours conserver :

- le propriétaire du dégât ;
- le personnage dont les stats servent au scaling ;
- l’acteur qui a déclenché la réponse ;
- l’entité source ;
- le target ;
- le délai ;
- le snapshot policy.

Le fait qu’un autre personnage soit actif à l’écran ne change pas automatiquement l’ownership du dégât.

---

## 30. Snapshot policy

Une action dérivée peut avoir besoin de capturer :

- les stats au moment du trigger ;
- les stats au moment du hit ;
- les stacks au moment du trigger ;
- les stacks au tick.

Ces choix doivent être déclarés explicitement.

Le moteur ne doit pas utiliser une politique unique implicite pour tous les summons / DoT / coordinated attacks.

---

## 31. Energy, Concerto et répétabilité d’une rotation Team

Un chiffre de Team DPS n’est réellement représentatif que si la rotation peut se répéter selon les conditions revendiquées.

Le Team Engine doit donc suivre les ressources structurées et pouvoir contrôler au minimum :

- consommation ;
- génération ;
- ressources initiales ;
- état final ;
- cooldowns ;
- conditions de switch / Intro / Outro ;
- dépendances de cycle précédent.

### Validation multi-cycle

Une bonne validation ne s’arrête pas au premier cycle.

Le résultat d’un cycle doit pouvoir devenir l’état initial du suivant afin de vérifier :

- si les ressources sont encore disponibles ;
- si les cooldowns sont cohérents ;
- si les états carried-over sont corrects ;
- si la rotation est réellement répétable.

Une rotation « opener » et une rotation « loop » peuvent naturellement être différentes.

---

## 32. Calcul du Team DPS

Le Team DPS est basé sur la timeline commune :

```text
Team DPS = somme des dégâts attendus attribués aux acteurs / durée résolue du cycle
```

Le moteur doit également pouvoir exposer :

- dégâts par acteur ;
- DPS par acteur dans le cycle commun ;
- contribution % ;
- dégâts par source ;
- event log ;
- buffs actifs ;
- statuts ;
- ressources finales ;
- diagnostics ;
- répétabilité.

Le DPS individuel affiché dans le Team DPS n’est pas nécessairement égal au Personal DPS du même personnage : la timeline, les buffs entrants, le temps de field et les dépendances sont différents.

---

## 33. Personal DPS et Team DPS partagent les mêmes règles de dégâts

Il ne doit pas exister une formule « Personal » et une formule « Team » divergentes.

Les deux couches doivent partager autant que possible :

- Damage Engine ;
- Effect Engine ;
- Motion Value resolver ;
- action replacement ;
- damage-type replacement ;
- ressources ;
- statuts ;
- Event Queue ;
- expressions / predicates ;
- données de personnage ;
- données d’équipement.

La différence principale est **le contexte d’ownership et la timeline**, pas la formule de dégâts.

Toute nouvelle primitive nécessaire à plusieurs personnages doit être ajoutée au domaine générique plutôt que dupliquée dans leurs modules.

---

## 34. Damage attribution et reporting

Les résultats doivent rester auditables.

Une instance de dégâts devrait permettre de retrouver :

- timestamp ;
- action de base ;
- action effective ;
- damage type base ;
- damage type effectif ;
- damage owner ;
- scaling owner ;
- triggering actor ;
- source entity ;
- cible ;
- panel stats ;
- effective stats ;
- motion value originale ;
- modifications de motion value ;
- effets actifs ;
- audit des effets ;
- non-crit ;
- crit ;
- expected damage.

Un chiffre global sans cette traçabilité est insuffisant pour un outil de theorycraft.

---

## 35. Données et hiérarchie des sources

### GameDatabase / données de jeu structurées

À privilégier pour :

- ids stables ;
- identité des personnages ;
- identité des armes ;
- base stats ;
- action ids ;
- motion values ;
- talents ;
- assets ;
- tables numériques directement disponibles.

### Sources communautaires reconnues

Peuvent compléter les données de jeu pour :

- rotations ;
- classifications ambiguës ;
- build recommendations ;
- timings totaux de référence ;
- interprétations de mécaniques ;
- cross-checks.

Une donnée communautaire ne doit pas être présentée comme donnée brute du jeu.

### Métadonnées de confiance

Les données doivent utiliser des niveaux explicites tels que :

- `verified-game-data` ;
- `multi-source-verified` ;
- `community-recommendation` ;
- `community-calculation` ;
- `disputed` ;
- `unknown` ;
- `technical-fixture`.

Quand une donnée est absente, le projet préfère **fail closed** plutôt qu’inventer une moyenne silencieuse.

---

## 36. Données exactes : pas d’interpolation silencieuse

Les niveaux de talent et Rank peuvent utiliser des tables sparse exactes.

Si une valeur n’existe pas pour un niveau donné, elle reste unsupported plutôt que d’être interpolée arbitrairement.

Cette règle s’applique aussi à :

- motion values ;
- coûts de ressource ;
- caps ;
- cooldowns ;
- valeurs de Sequence ;
- rolls Echo.

---

## 37. Ne pas parser les descriptions au runtime

Les descriptions humaines servent de source de revue, pas de langage d’exécution.

Interdit au runtime :

- rechercher des mots comme « ATK » ou « Crit » dans une description pour décider d’un buff ;
- exécuter une formule textuelle distante ;
- déduire un cooldown à partir d’une phrase ;
- déduire un scope `team` à partir d’un substring.

La mécanique validée doit être transformée en données structurées avant d’atteindre le moteur.

---

## 38. Import réseau et sécurité des données

Une source distante n’est jamais implicitement fiable.

Les imports doivent notamment :

- valider le schéma ;
- limiter la taille ;
- rejeter les clés dangereuses ;
- échouer proprement ;
- séparer import brut et promotion revue ;
- ne jamais exécuter de code distant ;
- empêcher les doublons par identité stable.

Une donnée importée peut être archivée sans être automatiquement promue comme recommandation runtime.

---

## 39. Règles de conception pour de nouvelles mécaniques

Lorsqu’un nouveau personnage exige une mécanique :

1. vérifier si une primitive générique existe déjà ;
2. si plusieurs personnages peuvent l’utiliser, améliorer la primitive générique ;
3. conserver le module personnage comme données / orchestration spécifique ;
4. ne pas mettre une formule de personnage dans le Damage Engine ;
5. ne pas mettre un `if characterId` dans un moteur universel lorsqu’un selector, predicate, trigger ou operation suffit ;
6. écrire des tests qui valident le résultat mécanique réel.

Exemples de primitives génériques :

- resource transaction ;
- form change ;
- stack threshold ;
- action replacement ;
- damage-type replacement ;
- status application ;
- emitted action ;
- incoming-resonator targeting ;
- shield/heal event ;
- custom shared cooldown ;
- snapshot policy.

---

## 40. Règles de test

Les tests importants ne doivent pas seulement vérifier « l’objet existe ».

Ils doivent vérifier selon le besoin :

- valeur finale du panneau ;
- absence de double comptage ;
- bonne activation / expiration ;
- nombre de stacks ;
- consommation de ressources ;
- changement de forme ;
- différence S0 / S1 / … / S6 ;
- bonne cible du buff ;
- bonne catégorie de dégâts ;
- bonne ownership ;
- dégâts émis ;
- durée totale de scénario ;
- état final ;
- répétabilité Team ;
- diagnostics attendus.

Les calculs devraient rester déterministes et reproductibles.

---

## 41. Règles de complétude et de communication

Ne jamais utiliser « complet » sans préciser implicitement ou explicitement la portée revendiquée.

Un personnage peut être :

- complet pour son scénario Personal ;
- complet pour son équipement de référence ;
- documenté pour ses dépendances Team ;
- complet dans une composition Team donnée.

Ces notions ne sont pas contradictoires.

Une mécanique exclusivement Team ne doit pas empêcher artificiellement un scénario Personal d’être considéré complet.

À l’inverse, une mécanique personnelle importante ne doit pas être repoussée vers « Team » uniquement pour obtenir un statut `complete`.

---

## 42. Ce document n’est pas un tracker d’avancement

Ne pas ajouter ici :

- pourcentages de progression ;
- SHA courant ;
- numéro de PR actif ;
- branche active ;
- liste de fichiers temporairement manquants ;
- liste de personnages encore incomplets ;
- lien de preview du moment ;
- problèmes de CI ponctuels ;
- prochaines tâches à faire.

Ces informations vieillissent trop vite.

Ce document doit rester une **référence de conception durable**.

Lorsqu’une future conversation reprend le projet, elle doit :

1. lire ce document pour comprendre les règles ;
2. inspecter le repo / les PR / la CI pour connaître l’état réel ;
3. respecter les frontières d’architecture ;
4. ne pas réinterpréter une absence de frame data comme une obligation de remplacer les timings théoriques ;
5. ne pas refaire des décisions déjà codifiées ici sans raison technique ou demande explicite.

---

## 43. Résumé des invariants à ne jamais casser

- `UserBuild.finalStats` est l’autorité des stats permanentes déjà résolues.
- Un bonus ne doit être compté qu’une seule fois.
- Echo main stats / fixed secondary / substats sont résolus en amont ; les passifs Sonata / Main Echo sont des effets séparés.
- Les Sonata doivent découler du compte réel des pièces et supporter naturellement les builds hybrides.
- Le Main Echo peut avoir bonus de slot, action et dégâts distincts.
- Intro et Outro appartiennent à la vraie rotation ; elles ne sont pas accordées gratuitement.
- `team` inclut le propriétaire lorsqu’il est réellement bénéficiaire ; `other-team-members` et `incoming-resonator` ne doivent pas fuiter vers `self`.
- DMG Bonus et Amplification restent deux familles distinctes.
- Les motion values restent data-owned.
- Les temps d’actions théoriques sont voulus ; une durée totale sourcée peut calibrer la timeline.
- Aucune fausse frame data n’est inventée.
- Personal DPS ne compte que les dégâts du propriétaire personnel, même lorsqu’un événement externe déclenche sa mécanique.
- Team DPS utilise une timeline commune, pas une somme de trois Personal DPS.
- Damage owner, scaling owner, source entity et triggering actor restent distincts.
- Les buffs Team restent runtime et ne sont pas persistés dans `finalStats`.
- Les statuts sont isolés par target et conservent leur source owner.
- Les rotations Team doivent pouvoir être validées sur leur répétabilité lorsque le DPS soutenu est revendiqué.
- Les moteurs universels ne doivent pas contenir de logique ad hoc par `characterId` lorsqu’une primitive déclarative suffit.
- Les données inconnues restent explicitement inconnues ou unsupported ; aucune moyenne silencieuse.
- Les descriptions humaines ne sont jamais exécutées comme logique runtime.
- Les tests doivent valider la mécanique et le résultat, pas seulement la présence d’un objet.

Ce contrat doit rester la base de toute extension future de WUWA LAB, y compris l’enrichissement du Personal DPS, les nouveaux systèmes de combat, les nouveaux sets Echo et le Team DPS complet.
