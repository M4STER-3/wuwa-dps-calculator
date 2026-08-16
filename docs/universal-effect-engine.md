# Universal Effect & Modifier Engine V0.1

## Responsabilité et frontières

Cette couche transforme des **instances d'effets que l'appelant déclare déjà actives** en modificateurs structurés. Elle ne lit jamais une description naturelle, ne découvre aucun trigger et n'exécute ni durée, expiration, refresh, ICD, ressource ou évolution de stacks.

```text
Game Data → EffectDefinition → ActiveEffectInstance
          → resolveActiveEffects(context)
          → DamageModifiers / TuneDamageModifiers / overrides + audit
          → Damage Engine (formules existantes)
```

Le resolver répond uniquement à « quelles contributions correspondent à cette action, cet attaquant et cette cible ? ». Le Damage Engine reste seul responsable des mathématiques de dégâts. Le futur Trigger/State Engine créera, actualisera et supprimera les instances actives à partir de la timeline.

## Définition et instance active

Une `EffectDefinition` est la donnée statique : identifiant et label, provenance (`source.id`, type et metadata), portée, règles, selectors et modifiers. Le champ documentaire `activation` peut conserver la condition et la durée connues, mais le resolver ne l'interprète pas.

Une `ActiveEffectInstance` est l'occurrence runtime fournie par l'appelant. Elle référence directement sa définition en V0.1 et porte un identifiant d'occurrence, l'owner, les entités affectées optionnelles, les stacks déjà résolus, le rang et des timestamps optionnels. Les timestamps sont de simples données de provenance : le resolver ne compare jamais l'heure courante.

## Portées et selectors

Les portées disponibles sont `self`, `enemy`, `team` et `other-team-members`. Le contexte conserve des identifiants d'acteur, cible et membres d'équipe afin de ne pas dépendre d'un ennemi ou d'un personnage global unique. `affectedEntityIds` peut restreindre une instance à des entités précises.

Toutes les conditions d'une règle sont combinées par **ET**. Chaque selector accepte plusieurs valeurs par **OU** :

- élément ;
- Damage Type ;
- Resonance Mode ;
- action précise ;
- catégorie d'action ;
- owner, source ou cible par identifiant.

Un contexte requis absent produit un diagnostic `missing-context`. Un selector inconnu est `unsupported`; il n'est jamais interprété par heuristique.

## Familles de modifiers et unités

La sortie réutilise directement les contrats du Damage Engine :

- Damage Bonus : All DMG, élément et Damage Type, en points de pourcentage ;
- Damage Amplification, en points de pourcentage et dans son groupe séparé ;
- DEF Reduction et DEF Ignore, ratios distincts (`0.32` signifie 32 %) ;
- RES Reduction et RES Ignore, ratios distincts, avec selector élémentaire pour une RES élémentaire ;
- Crit Rate et Crit DMG bonus, en points de pourcentage ;
- fixed Crit override explicite (`critRatePercent` + `critDamagePercent`), jamais converti en bonus ;
- temporary Tune Break Boost, transporté vers `TuneDamageModifiers` sans nouvelle formule Tune.

Une valeur peut être constante ou linéaire `valuePerStack × stacks`, avec un cap explicite optionnel. Les stacks sont fournis par l'instance. Une valeur non finie, un cap invalide ou des stacks absents/négatifs/non entiers rendent la règle diagnostiquée au lieu de produire `NaN` ou `Infinity`.

## Stacking V0.1

Chaque modifier déclare une politique :

- `additive` : somme des contributions ;
- `highest` : plus grande contribution du canal, ajoutée au groupe additif ;
- `override` : remplace explicitement le canal agrégé ; si plusieurs overrides existent, le dernier dans l'ordre d'entrée gagne et un diagnostic `conflicting-overrides` est émis.

La politique temporelle (`refresh`, remplacement d'instance, expiration, ICD) n'est pas une politique de combinaison du resolver et reste hors périmètre. Toute politique inconnue est `unsupported-stacking-policy`.

## Anti-double-comptage

Chaque règle possède un statut comptable :

- `runtime` : peut contribuer ;
- `already-in-final-stats` : ignorée avec une entrée d'audit ;
- `informational` : conservée mais non calculée.

Le resolver ne reçoit pas et ne reconstruit pas ATK, HP, DEF, statistiques d'arme/Echo, Main Stats, substats ou nodes. `UserBuild.finalStats` reste donc l'autorité permanente. Le marquage obligatoire empêche une règle déjà incluse dans le panneau de produire une seconde contribution.

## Audit et diagnostics

Chaque règle produit une `EffectAuditEntry` avec instance, effect id, rule id, source id/type/label, statut (`matched`, `ignored`, `unsupported`), raison et contributions structurées. Les mismatches (par exemple `damage-type-mismatch`) restent visibles.

Les diagnostics couvrent modifier et selector inconnus, stacking non supporté, valeur/stacks invalides, contexte manquant et overrides concurrents. Une extension inconnue est explicitement non résolue : le moteur ne parse jamais `trigger`, `effect`, `passiveDescription` ou une autre prose existante.

## Exemples génériques validés

Les fixtures testent +20 % Fusion DMG (Fusion seulement), +25 % Liberation DMG (Liberation seulement), +200 % Heavy Amplification (hors Damage Bonus), DEF Ignore distinct de DEF Reduction, Fusion RES Ignore, +20 % Crit Rate, 4 % × 30 stacks = 120 %, fixed Crit, Tune boost et anti-double-comptage.

## Données Aemeath utilisées comme validation générique

- **Everbright Polestar R1** : une définition équipée donne +12 % All DMG. Une seconde définition active, documentée avec condition externe et durée de 8 s, possède une règle Liberation DEF Ignore `0.32` et une règle Fusion RES Ignore `0.10`.
- **Trailblazing Star 5pc** : lorsque l'instance est fournie active, deux règles donnent +20 % Crit Rate et +20 % Fusion DMG. La condition et les 8 s ne sont que documentaires.
- **Sigillum** : une règle Damage Type donne +25 % Resonance Liberation DMG ; elle matche Finale et ignore une Basic Attack.
- **Before All Sounds** : la définition provenant du Resonator sélectionne Heavy Attack et donne +200 % Damage Amplification. L'appelant affirme qu'Instant Response est actif ; le resolver ne le vérifie pas.

Ces objets n'ont aucun branchement par id dans le resolver. `CombatEffect` conserve tous ses champs textuels historiques et accepte maintenant une `structuredEffect` optionnelle, ce qui permet une migration progressive du catalogue.

## Limites explicites de V0.1

Il n'existe encore aucune activation automatique depuis l'équipement, aucune connexion à Combat Simulation, aucun événement de hit, aucune insertion d'Echo, aucune horloge et aucun lifecycle de cible/Trail. En particulier, les triggers Tune Rupture, Fusion Burst, Instant Response et Starburst ne sont pas exécutés. Une future couche Combat Context + Trigger/State Engine fournira les instances actives à ce resolver sans déplacer les formules du Damage Engine.
