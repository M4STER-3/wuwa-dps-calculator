import type { CombatEffect, Resonator } from "@/domain/models";
import type { CombatAction } from "@/domain/models";
import type { CombatPredicate, EffectDefinition, ValueExpression } from "@/domain/effect-models";

const constant = (value: number): ValueExpression => ({ kind: "constant", value });
const normalize = (value: string): string =>
  value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const hasTokens = (value: string, tokens: readonly string[]): boolean => {
  const haystack = normalize(value);
  return tokens.every((token) => haystack.includes(normalize(token)));
};
const actionPredicate = (...ids: string[]): CombatPredicate => ({
  kind: "identity",
  field: "actionId",
  anyOf: ids,
});
const resourceAvailable = (resourceId: string): CombatPredicate => ({
  kind: "resource",
  resourceId,
  comparison: "available",
});
const resourceMax = (resourceId: string): CombatPredicate => ({
  kind: "resource",
  resourceId,
  comparison: "max",
});
const sequenceAtLeast = (value: number): CombatPredicate => ({
  kind: "state-active",
  id: `sequence-at-least-${value}`,
});
const and = (...predicates: readonly CombatPredicate[]): CombatPredicate => ({ kind: "and", predicates });
const not = (predicate: CombatPredicate): CombatPredicate => ({ kind: "not", predicate });

function oneAction(
  resonator: Resonator,
  talent: CombatAction["talent"],
  tokens: readonly string[],
): CombatAction {
  const matches = (resonator.combat?.actions ?? []).filter(
    (action) => action.talent === talent && hasTokens(action.name, tokens),
  );
  if (matches.length !== 1) {
    throw new Error(`Denia precise mechanic selector ${talent}:${tokens.join("+")} resolved ${matches.length} actions.`);
  }
  return matches[0]!;
}

function allActions(
  resonator: Resonator,
  talent: CombatAction["talent"],
  tokens: readonly string[],
): readonly CombatAction[] {
  return (resonator.combat?.actions ?? []).filter(
    (action) => action.talent === talent && hasTokens(action.name, tokens),
  );
}

const combatEffect = (
  id: string,
  name: string,
  trigger: string,
  structuredEffect: EffectDefinition,
): CombatEffect => ({
  id,
  name,
  sourceId: structuredEffect.source.id,
  trigger,
  target:
    structuredEffect.target === "enemy"
      ? "enemy"
      : structuredEffect.target === "team"
        ? "team"
        : "self",
  effect: structuredEffect.label,
  source: {
    kind: "multi-source-verified",
    source: "WUWA GameDatabase / Prydwen Denia kit",
    gameVersion: "3.5",
    verifiedAt: "2026-08-19",
  },
  structuredEffect,
});

export function applyPreciseDeniaMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "denia" || !resonator.combat) return resonator;

  const intro = oneAction(resonator, "introSkill", ["It's Been A While"]);
  const stagecraft4 = oneAction(resonator, "basicAttack", ["Stagecraft Form", "Stage 4"]);
  const phantom = oneAction(resonator, "resonanceSkill", ["Phantom Bubble", "Stagecraft Form"]);
  const finalStagecraft = oneAction(resonator, "resonanceLiberation", ["Final Act", "Stagecraft Form"]);
  const banish1 = oneAction(resonator, "resonanceSkill", ["Banish", "Breakdown Form", "Stage 1"]);
  const banish2 = oneAction(resonator, "resonanceSkill", ["Banish", "Breakdown Form", "Stage 2"]);
  const finalBreakdown = oneAction(resonator, "resonanceLiberation", ["Final Act", "Breakdown Form"]);
  const erosion = oneAction(resonator, "forteCircuit", ["Erosion Field"]);
  const breakdownNormals = allActions(resonator, "basicAttack", ["Breakdown Form"]).filter(
    (action) => !normalize(action.name).includes("heavy attack") && !normalize(action.name).includes("dodge counter"),
  );
  if (breakdownNormals.length < 4) {
    throw new Error(`Denia precise mechanics expected multiple Breakdown Normal Attacks, got ${breakdownNormals.length}.`);
  }

  const patchedActions = resonator.combat.actions.map((action) => {
    if (action.id === intro.id) {
      return {
        ...action,
        resourceOperations: [
          { resourceId: "dark-core", operation: "gain" as const, amount: 1, stage: "after-action" as const },
          { resourceId: "void-particle", operation: "gain" as const, amount: 25, stage: "after-action" as const },
        ],
      };
    }
    if (action.id === phantom.id) {
      return {
        ...action,
        resourceOperations: [
          { resourceId: "void-particle", operation: "gain" as const, amount: 25, stage: "after-action" as const },
        ],
      };
    }
    if (action.id === banish1.id || action.id === banish2.id || action.id === erosion.id) {
      return { ...action, damageType: "resonanceLiberation" as const };
    }
    return action;
  });

  const entropyBreakdown: EffectDefinition = {
    id: "precise-denia-entropy-breakdown",
    label: "Entropy Shift · Breakdown Form",
    source: { id: "denia-final-act", type: "resonator", label: "Denia · Final Act" },
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 12 },
      refresh: "reset-duration",
      uniqueness: "replace-existing",
      exclusiveGroup: "denia-entropy-shift",
    },
    rules: [{
      id: "denia-entropy-breakdown-atk",
      label: "+30% ATK while Entropy Shift: Breakdown Form is active",
      accounting: "runtime",
      modifiers: [{ kind: "runtime-stat", stat: "attack", mode: "percent", stacking: "additive", value: constant(30) }],
    }],
  };

  const entropyStagecraft: EffectDefinition = {
    id: "precise-denia-entropy-stagecraft",
    label: "Entropy Shift · Stagecraft Form",
    source: { id: "denia-final-act", type: "resonator", label: "Denia · Final Act" },
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 30 },
      refresh: "reset-duration",
      uniqueness: "replace-existing",
      exclusiveGroup: "denia-entropy-shift",
    },
    rules: [{
      id: "denia-entropy-stagecraft-marker",
      label: "Stagecraft Entropy marker; periodic Void Particle regeneration remains team-cycle owned",
      accounting: "informational",
      modifiers: [],
    }],
  };

  const stateMachine: EffectDefinition = {
    id: "precise-denia-state-machine",
    label: "Denia · Stagecraft / Breakdown form transitions",
    source: { id: "denia", type: "resonator", label: "Denia Forms" },
    target: "self",
    rules: [],
    triggers: [
      {
        id: "denia-final-stagecraft-enter-breakdown",
        event: "action-end",
        predicates: [actionPredicate(finalStagecraft.id)],
        operations: [
          { kind: "change-form", stateId: "Breakdown Form" },
          { kind: "activate-effect", effectId: entropyBreakdown.id },
        ],
      },
      {
        id: "denia-final-breakdown-enter-stagecraft",
        event: "action-end",
        predicates: [actionPredicate(finalBreakdown.id)],
        operations: [
          { kind: "change-form", stateId: "Stagecraft Form" },
          { kind: "activate-effect", effectId: entropyStagecraft.id },
          { kind: "resource", operation: "consume-all", resourceId: "conformal-charge" },
          { kind: "resource", operation: "consume-all", resourceId: "void-particle" },
        ],
      },
    ],
  };

  const combatEntryResources: EffectDefinition = {
    id: "precise-denia-combat-entry-resources",
    label: "Vestiges of Falsehood · combat entry resources",
    source: { id: "denia-vestiges", type: "resonator", label: "Vestiges of Falsehood" },
    target: "self",
    rules: [],
    triggers: [
      {
        id: "denia-entry-base-resources",
        event: "rotation-step-start",
        predicates: [not(sequenceAtLeast(3))],
        maxTriggers: 1,
        operations: [
          { kind: "resource", operation: "set", resourceId: "dark-core", amount: constant(2) },
          { kind: "resource", operation: "set", resourceId: "void-particle", amount: constant(20) },
        ],
      },
      {
        id: "denia-entry-s3-resources",
        event: "rotation-step-start",
        predicates: [sequenceAtLeast(3)],
        maxTriggers: 1,
        operations: [
          { kind: "resource", operation: "set-max", resourceId: "dark-core" },
          { kind: "resource", operation: "set-max", resourceId: "void-particle" },
        ],
      },
    ],
  };

  const banishCoreScaling: EffectDefinition = {
    id: "precise-denia-banish-dark-core",
    label: "Banish · Dark Core scaling",
    source: { id: "denia-dark-core", type: "resonator", label: "Denia Dark Core" },
    target: "self",
    activationPolicy: "initially-active",
    lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
    rules: [
      {
        id: "denia-banish-core-additive-mv",
        label: "+150 percentage points to Banish Stage 2 multiplier per consumed Dark Core",
        accounting: "runtime",
        selectors: [{ kind: "action-id", anyOf: [banish2.id] }],
        modifiers: [{
          kind: "motion-value",
          mode: "additive-percent",
          stacking: "additive",
          value: { kind: "multiply", values: [{ kind: "resource", resourceId: "dark-core" }, constant(150)] },
        }],
      },
      {
        id: "denia-s2-banish-multiplier",
        label: "S2 · Banish multiplier +40%",
        accounting: "runtime",
        requiredSequence: 2,
        selectors: [{ kind: "action-id", anyOf: [banish1.id, banish2.id] }],
        modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(40) }],
      },
    ],
    triggers: [{
      id: "denia-banish-stage2-spend-cores",
      event: "action-end",
      predicates: [actionPredicate(banish2.id)],
      operations: [
        { kind: "resource", operation: "consume-all", resourceId: "dark-core" },
        { kind: "resource", operation: "gain", resourceId: "conformal-charge", amount: constant(40) },
      ],
    }],
  };

  const breakdownNormalRules: EffectDefinition["rules"] = breakdownNormals.map((action) => ({
    id: `denia-breakdown-void-${action.id}`,
    label: `${action.name} · Void Particle enhancement`,
    accounting: "runtime" as const,
    selectors: [{ kind: "action-id" as const, anyOf: [action.id] }],
    predicates: [resourceAvailable("void-particle")],
    modifiers: [
      { kind: "motion-value" as const, mode: "relative-additive" as const, stacking: "additive" as const, value: constant(50) },
      {
        kind: "damage-type-replacement" as const,
        damageType: "resonanceLiberation" as const,
        condition: and(actionPredicate(action.id), resourceAvailable("void-particle")),
      },
    ],
  }));
  const breakdownVoid: EffectDefinition = {
    id: "precise-denia-breakdown-void-particle",
    label: "Breakdown Normal Attack · Void Particle enhancement",
    source: { id: "denia-void-particle", type: "resonator", label: "Denia Void Particle" },
    target: "self",
    activationPolicy: "initially-active",
    lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
    rules: breakdownNormalRules,
  };

  const sequences: EffectDefinition = {
    id: "precise-denia-sequences",
    label: "Denia Resonance Chain · personal on-field mechanics",
    source: { id: "denia-chain", type: "resonance-chain", label: "Denia Resonance Chain" },
    target: "self",
    activationPolicy: "initially-active",
    lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
    rules: [
      {
        id: "denia-s1-crit-dmg",
        label: "S1 · +30% Crit DMG",
        accounting: "runtime",
        requiredSequence: 1,
        modifiers: [{ kind: "crit-damage-bonus", stacking: "additive", value: 30 }],
      },
      {
        id: "denia-s3-final-breakdown-multiplier",
        label: "S3 · Final Act Breakdown multiplier +80%",
        accounting: "runtime",
        requiredSequence: 3,
        selectors: [{ kind: "action-id", anyOf: [finalBreakdown.id] }],
        modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(80) }],
      },
      {
        id: "denia-s3-max-core-stagecraft4",
        label: "S3 · max Dark Core Stagecraft 4 +1200 percentage points",
        accounting: "runtime",
        requiredSequence: 3,
        selectors: [{ kind: "action-id", anyOf: [stagecraft4.id] }],
        predicates: [resourceMax("dark-core")],
        modifiers: [
          { kind: "motion-value", mode: "additive-percent", stacking: "additive", value: constant(1200) },
          { kind: "damage-type-replacement", damageType: "resonanceLiberation", condition: and(actionPredicate(stagecraft4.id), resourceMax("dark-core"), sequenceAtLeast(3)) },
        ],
      },
      {
        id: "denia-s3-max-core-phantom",
        label: "S3 · max Dark Core Phantom Bubble +1200 percentage points",
        accounting: "runtime",
        requiredSequence: 3,
        selectors: [{ kind: "action-id", anyOf: [phantom.id] }],
        predicates: [resourceMax("dark-core")],
        modifiers: [
          { kind: "motion-value", mode: "additive-percent", stacking: "additive", value: constant(1200) },
          { kind: "damage-type-replacement", damageType: "resonanceLiberation", condition: and(actionPredicate(phantom.id), resourceMax("dark-core"), sequenceAtLeast(3)) },
        ],
      },
      {
        id: "denia-s5-final-stagecraft-multiplier",
        label: "S5 · Final Act Stagecraft multiplier +100%",
        accounting: "runtime",
        requiredSequence: 5,
        selectors: [{ kind: "action-id", anyOf: [finalStagecraft.id] }],
        modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(100) }],
      },
      {
        id: "denia-s6-entropy-atk",
        label: "S6 · +60% ATK during Entropy Shift",
        accounting: "runtime",
        requiredSequence: 6,
        predicates: [{
          kind: "or",
          predicates: [
            { kind: "has-effect", id: entropyBreakdown.id },
            { kind: "has-effect", id: entropyStagecraft.id },
          ],
        }],
        modifiers: [{ kind: "runtime-stat", stat: "attack", mode: "percent", stacking: "additive", value: constant(60) }],
      },
      {
        id: "denia-s6-entropy-fusion",
        label: "S6 · +60% Fusion DMG during Entropy Shift",
        accounting: "runtime",
        requiredSequence: 6,
        selectors: [{ kind: "element", anyOf: ["fusion"] }],
        predicates: [{
          kind: "or",
          predicates: [
            { kind: "has-effect", id: entropyBreakdown.id },
            { kind: "has-effect", id: entropyStagecraft.id },
          ],
        }],
        modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 60 }],
      },
    ],
    triggers: [
      {
        id: "denia-s3-stagecraft4-consume-max-cores",
        event: "action-end",
        predicates: [and(actionPredicate(stagecraft4.id), resourceMax("dark-core"), sequenceAtLeast(3))],
        operations: [{ kind: "resource", operation: "consume-all", resourceId: "dark-core" }],
      },
      {
        id: "denia-s3-phantom-consume-max-cores",
        event: "action-end",
        predicates: [and(actionPredicate(phantom.id), resourceMax("dark-core"), sequenceAtLeast(3))],
        operations: [{ kind: "resource", operation: "consume-all", resourceId: "dark-core" }],
      },
    ],
  };

  const modeBuffs: EffectDefinition = {
    id: "precise-denia-etched-colors",
    label: "Etched Colors · mode-dependent team buff",
    source: { id: "denia-etched-colors", type: "resonator", label: "Etched Colors" },
    target: "team",
    activationPolicy: "initially-active",
    lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
    rules: [
      {
        id: "denia-fusion-burst-etched-colors",
        label: "Fusion Burst mode · +30% Fusion DMG while Entropy Shift is active",
        accounting: "runtime",
        selectors: [
          { kind: "resonance-mode", anyOf: ["fusion-burst"] },
          { kind: "element", anyOf: ["fusion"] },
        ],
        predicates: [{
          kind: "or",
          predicates: [
            { kind: "has-effect", id: entropyBreakdown.id },
            { kind: "has-effect", id: entropyStagecraft.id },
          ],
        }],
        modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 30 }],
      },
      {
        id: "denia-tune-strain-base-break-boost",
        label: "Tune Strain mode · +10 Tune Break Boost while Entropy Shift is active",
        accounting: "runtime",
        selectors: [{ kind: "resonance-mode", anyOf: ["tune-strain"] }],
        predicates: [{
          kind: "or",
          predicates: [
            { kind: "has-effect", id: entropyBreakdown.id },
            { kind: "has-effect", id: entropyStagecraft.id },
          ],
        }],
        modifiers: [{ kind: "runtime-stat", stat: "tuneBreakBoost", mode: "flat", stacking: "additive", value: constant(10) }],
      },
    ],
  };

  const offFieldPending: EffectDefinition = {
    id: "precise-denia-off-field-team-cycle-pending",
    label: "Denia · Erosion Field / mode applications / Outro require Team Cycle",
    source: { id: "denia-off-field", type: "resonator", label: "Denia off-field mechanics" },
    target: "team",
    teamContextRequired: true,
    rules: [
      {
        id: "denia-erosion-field-pending",
        label: "Erosion Field: 30s, 4s interval (3s at S4), Liberation DMG; aggregation waits for full team-cycle duration",
        accounting: "informational",
        modifiers: [],
      },
      {
        id: "denia-mode-applications-pending",
        label: "Fusion Burst / Tune Strain Shifting applications and Outro handoff require target/team state",
        accounting: "informational",
        modifiers: [],
      },
    ],
  };

  const effects: readonly CombatEffect[] = [
    combatEffect("denia-entropy-breakdown", "Entropy Shift · Breakdown", "Final Act Stagecraft", entropyBreakdown),
    combatEffect("denia-entropy-stagecraft", "Entropy Shift · Stagecraft", "Final Act Breakdown", entropyStagecraft),
    combatEffect("denia-state-machine", "Denia form state machine", "Final Act", stateMachine),
    combatEffect("denia-entry-resources", "Vestiges of Falsehood", "combat entry", combatEntryResources),
    combatEffect("denia-banish-core", "Banish Dark Core scaling", "Banish Stage 2", banishCoreScaling),
    combatEffect("denia-breakdown-void", "Breakdown Void Particle conversion", "Breakdown Normal Attack", breakdownVoid),
    combatEffect("denia-sequences", "Denia Resonance Chain", "sequence", sequences),
    combatEffect("denia-mode-buffs", "Etched Colors", "Entropy Shift + Resonance Mode", modeBuffs),
    combatEffect("denia-off-field-pending", "Denia off-field Team Cycle", "team cycle", offFieldPending),
  ];

  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      actions: patchedActions,
      effects: [...resonator.combat.effects, ...effects],
      unknowns: [
        ...resonator.combat.unknowns,
        "Partiel: exact per-hit Void Particle consumption and ordinary Breakdown Conformal Charge gains are not silently inferred.",
        "Partiel: Erosion Field/off-field Fusion Burst or Tune Strain applications are stored but excluded from the 6s personal on-field denominator until Team Cycle owns the elapsed time.",
        "Partiel: S3 periodic Dark Core/Void regeneration, S4 Erosion cadence and S6 team-triggered reaction damage require full-cycle scheduling before complete status.",
      ],
    },
  };
}
