# Personal Combat consolidation audit matrix

Cette matrice applique la règle : une primitive n'est « supported » que si modèle, runtime, intégration Personal et test d'intégration existent.

| Requirement | Model | Runtime | Personal integration | Integration proof | Unsupported when missing |
| --- | --- | --- | --- | --- | --- |
| Runtime ATK/HP/DEF + exact basis | yes | yes | yes | combat-context + personal tests | yes |
| Value expressions / predicates | yes | yes | yes | context and consolidation tests | yes |
| Inter-effect activation | yes | yes | yes | A activates B test | yes |
| Owner / target isolation | yes | yes | yes | two-owner/two-target tests | yes |
| Fixed/refresh/extension/uniqueness lifecycle | yes | yes | yes | consolidation lifecycle tests | yes |
| Shared/independent stacks | yes | yes | yes | staggered-expiration tests | yes |
| Trigger resource operations | yes | yes | yes | missing/invalid amount tests | yes |
| Explicit staged action resource transaction | yes | pure atomic resolver | integration pending verified action stages | atomicity/cap/audit unit tests | legacy unstructured costs/gains remain unsupported |
| Status duration/periodic/consume/transform | yes | yes | yes | end-to-end status test | yes |
| Action replacement | yes | yes | yes | enhanced action test | yes |
| Damage type replacement | yes | yes | yes | effective type audit/damage test | yes |
| Global Motion Value modifier | yes | yes | yes | numeric personal tests | yes |
| Hit-group-targeted MV | no | no | no | unsupported documented | yes |
| Snapshot trigger/hit and trigger/tick | yes | yes | yes, synthetic | delayed numeric test | mixed WuWa patterns need validation |
| Sibling events and loop protection | yes | yes | yes | queue tests | yes |
| Aggregate action vs real hits | yes | yes | yes | unknown/known hit tests | yes |
| damage-dealt trigger chain | yes | yes | yes | follow-up chain test | yes |
| Random critical-hit events | modeled event only | no | no | deterministic policy test/docs | yes |
| Automatic Resonator loader | yes | yes | yes | Resonator-only test | yes |
| Equipment loader boundary | yes | yes | yes | loadout tests | missing object diagnosed/not loaded |
| Personal ownership/scaling | yes | yes | yes | summon/foreign scaling tests | yes |
| Trigger counter scopes | yes | yes | yes | multi-owner test | yes |
| Tune Break/Rupture | yes | existing formulas | routed, lightly validated | Damage Engine cross-checks | Personal E2E validation still needed |
| Fusion Burst damage | event only | no formula | diagnostic | unsupported test | yes |
| Team DPS | no | no | no | out of scope | explicit |
