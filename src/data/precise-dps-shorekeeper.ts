import type { CombatPredicate, EffectDefinition, ValueExpression } from "@/domain/effect-models";
import type { CombatEffect, Resonator, Weapon } from "@/domain/models";
import { SHOREKEEPER_MANUAL, SHOREKEEPER_NATIVE } from "./precise-dps-shorekeeper-core";

const constant = (value: number): ValueExpression => ({ kind: "constant", value });
const rank = (values: readonly number[]): ValueExpression => ({
  kind: "rank",
  values: Object.fromEntries(values.map((value, index) => [index + 1, value])),
});
const actionPredicate = (...ids: readonly string[]): CombatPredicate => ({
  kind: "identity",
  field: "actionId",
  anyOf: ids,
});
const sequenceAtLeast = (value: number): CombatPredicate => ({
  kind: "state-active",
  id: `sequence-at-least-${value}`,
});
const resource = (
  resourceId: string,
  comparison: "eq" | "gte" | "lte" | "max" | "available",
  value?: number,
): CombatPredicate => ({
  kind: "resource",
  resourceId,
  comparison,
  ...(value === undefined ? {} : { value: constant(value) }),
});
const and = (...predicates: readonly CombatPredicate[]): CombatPredicate => ({
  kind: "and",
  predicates,
});

const normalBasics = [
  SHOREKEEPER_NATIVE.basic1,
  SHOREKEEPER_NATIVE.basic2,
  SHOREKEEPER_NATIVE.basic3,
  SHOREKEEPER_NATIVE.basic4,
] as const;

const source = {
  kind: "multi-source-verified" as const,
  source: "WUWA GameDatabase / Wuthering Waves Wiki / Prydwen · Shorekeeper kit",
  gameVersion: "3.5",
  verifiedAt: "2026-08-19",
};

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
        : structuredEffect.target === "other-team-members"
          ? "other-team-members"
          : "self",
  effect: structuredEffect.label,
  source,
  structuredEffect,
});

const collapsedCores: EffectDefinition = {
  id: "precise-shorekeeper-collapsed-cores",
  label: "Astral Chord · Collapsed Cores / Flare Star Butterflies",
  source: { id: "shorekeeper-forte", type: "resonator", label: "Astral Chord" },
  target: "self",
  rules: [],
  triggers: [
    {
      id: "shorekeeper-basic-hit-gain-core",
      event: "action-hit",
      predicates: [and(actionPredicate(...normalBasics), resource("collapsed-core", "lte", 4))],
      operations: [{
        kind: "resource",
        operation: "gain",
        resourceId: "collapsed-core",
        amount: constant(1),
      }],
    },
    {
      id: "shorekeeper-basic-hit-convert-core-at-cap",
      event: "action-hit",
      predicates: [and(actionPredicate(...normalBasics), resource("collapsed-core", "gte", 5))],
      operations: [
        {
          kind: "resource",
          operation: "consume",
          resourceId: "collapsed-core",
          amount: constant(1),
        },
        {
          kind: "emit-action",
          action: {
            actionId: SHOREKEEPER_NATIVE.flareStarButterfly,
            attribution: "follow-up",
            delaySeconds: 0.0001,
            snapshot: { stats: "trigger", stacks: "trigger" },
          },
        },
        {
          kind: "resource",
          operation: "gain",
          resourceId: "collapsed-core",
          amount: constant(1),
        },
      ],
    },
    {
      id: "shorekeeper-illation-start-core-drain",
      event: "action-start",
      predicates: [and(
        actionPredicate(SHOREKEEPER_NATIVE.illation),
        resource("collapsed-core", "available"),
      )],
      operations: [
        {
          kind: "resource",
          operation: "consume",
          resourceId: "collapsed-core",
          amount: constant(1),
        },
        {
          kind: "emit-action",
          action: {
            actionId: SHOREKEEPER_NATIVE.flareStarButterfly,
            attribution: "follow-up",
            delaySeconds: 0.0001,
            snapshot: { stats: "trigger", stacks: "trigger" },
          },
        },
        { kind: "emit-event", eventKind: "custom", delaySeconds: 0.0002 },
      ],
    },
    {
      id: "shorekeeper-illation-continue-core-drain",
      event: "custom",
      predicates: [and(
        actionPredicate(SHOREKEEPER_NATIVE.illation),
        resource("collapsed-core", "available"),
      )],
      operations: [
        {
          kind: "resource",
          operation: "consume",
          resourceId: "collapsed-core",
          amount: constant(1),
        },
        {
          kind: "emit-action",
          action: {
            actionId: SHOREKEEPER_NATIVE.flareStarButterfly,
            attribution: "follow-up",
            delaySeconds: 0.0001,
            snapshot: { stats: "trigger", stacks: "trigger" },
          },
        },
        { kind: "emit-event", eventKind: "custom", delaySeconds: 0.0002 },
      ],
    },
  ],
};

const discernment: EffectDefinition = {
  id: "precise-shorekeeper-discernment",
  label: "Discernment · guaranteed Critical Resonance Liberation DMG",
  source: { id: "shorekeeper-discernment", type: "resonator", label: "Discernment" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "shorekeeper-discernment-guaranteed-crit",
      label: "Discernment is guaranteed to Crit",
      accounting: "runtime",
      selectors: [{ kind: "action-id", anyOf: [SHOREKEEPER_NATIVE.discernment] }],
      modifiers: [{ kind: "crit-rate-bonus", stacking: "additive", value: 100 }],
    },
    {
      id: "shorekeeper-s6-discernment-multiplier",
      label: "S6 · Discernment DMG Multiplier +42%",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: [SHOREKEEPER_NATIVE.discernment] }],
      modifiers: [{
        kind: "motion-value",
        mode: "relative-additive",
        stacking: "additive",
        value: constant(42),
      }],
    },
    {
      id: "shorekeeper-s6-discernment-crit-dmg",
      label: "S6 · Discernment Crit DMG +500%",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: [SHOREKEEPER_NATIVE.discernment] }],
      modifiers: [{ kind: "crit-damage-bonus", stacking: "additive", value: 500 }],
    },
  ],
};

const s4Healing: EffectDefinition = {
  id: "precise-shorekeeper-s4-healing",
  label: "S4 · Overflowing Quietude",
  source: { id: "shorekeeper-s4", type: "resonance-chain", label: "Overflowing Quietude" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "shorekeeper-s4-chaos-healing-bonus",
    label: "S4 · +70% Healing Bonus when casting Chaos Theory",
    accounting: "runtime",
    requiredSequence: 4,
    selectors: [{ kind: "action-id", anyOf: [SHOREKEEPER_NATIVE.chaosTheory] }],
    modifiers: [{
      kind: "runtime-stat",
      stat: "healingBonus",
      mode: "flat",
      stacking: "additive",
      value: constant(70),
    }],
  }],
};

const endLoopPersonal: EffectDefinition = {
  id: "precise-shorekeeper-end-loop-personal",
  label: "End Loop · personal Stellarealm semantics",
  source: { id: "shorekeeper-liberation", type: "resonator", label: "End Loop" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    extension: { seconds: 10, limitSeconds: 40, maxExtensions: 1 },
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "shorekeeper-self-gravitation-energy-regen",
    label: "Self Gravitation · +10% Energy Regen within Stellarealm",
    accounting: "runtime",
    modifiers: [{
      kind: "runtime-stat",
      stat: "energyRegen",
      mode: "flat",
      stacking: "additive",
      value: constant(10),
    }],
  }],
  triggers: [
    {
      id: "shorekeeper-end-loop-create-stellarealm-self",
      event: "action-end",
      predicates: [actionPredicate(SHOREKEEPER_MANUAL.endLoop)],
      operations: [{ kind: "activate-effect", effectId: "precise-shorekeeper-end-loop-personal" }],
    },
    {
      id: "shorekeeper-s1-extend-stellarealm-self",
      event: "action-end",
      predicates: [and(actionPredicate(SHOREKEEPER_MANUAL.endLoop), sequenceAtLeast(1))],
      operations: [{ kind: "extend-effect", effectId: "precise-shorekeeper-end-loop-personal" }],
    },
    {
      id: "shorekeeper-discernment-end-stellarealm-s0",
      event: "action-end",
      predicates: [and(
        actionPredicate(SHOREKEEPER_NATIVE.discernment),
        { kind: "not", predicate: sequenceAtLeast(1) },
      )],
      operations: [{ kind: "expire-effect", effectId: "precise-shorekeeper-end-loop-personal" }],
    },
  ],
};

const sequenceDocumentation: EffectDefinition = {
  id: "precise-shorekeeper-sequence-documentation",
  label: "Shorekeeper Resonance Chain · non-personal-DPS semantics",
  source: { id: "shorekeeper-chain", type: "resonator", label: "Shorekeeper Resonance Chain" },
  target: "self",
  rules: [
    {
      id: "shorekeeper-s1-stellarealm-semantics",
      label: "S1 · Stellarealm range +150%, duration +10s, Discernment no longer ends it",
      accounting: "informational",
      requiredSequence: 1,
      modifiers: [],
    },
    {
      id: "shorekeeper-s3-concerto",
      label: "S3 · End Loop grants 20 Concerto Energy, once every 25s",
      accounting: "informational",
      requiredSequence: 3,
      modifiers: [],
    },
    {
      id: "shorekeeper-s5-range",
      label: "S5 · Basic Attack Stage 3 pull range +50%, Illation range +30%",
      accounting: "informational",
      requiredSequence: 5,
      modifiers: [],
    },
  ],
};

const teamCyclePending: EffectDefinition = {
  id: "precise-shorekeeper-team-cycle-pending",
  label: "Shorekeeper · Stellarealm team evolution requires Team Cycle",
  source: { id: "shorekeeper-team-cycle", type: "resonator", label: "Outer / Inner / Supernal Stellarealm" },
  target: "team",
  teamContextRequired: true,
  rules: [
    {
      id: "shorekeeper-stellarealm-evolution-pending",
      label: "Allied Intro Skills evolve Outer → Inner → Supernal Stellarealm and determine Discernment eligibility.",
      accounting: "informational",
      modifiers: [],
    },
    {
      id: "shorekeeper-s2-team-atk-pending",
      label: "S2 · Outer Stellarealm increases nearby party ATK by 40%.",
      accounting: "informational",
      requiredSequence: 2,
      modifiers: [],
    },
    {
      id: "shorekeeper-binary-butterfly-pending",
      label: "Outro Binary Butterfly and the incoming switch/handoff require the real team timeline.",
      accounting: "informational",
      modifiers: [],
    },
  ],
};

export function applyPreciseShorekeeperMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "shorekeeper" || !resonator.combat) return resonator;

  const effects: readonly CombatEffect[] = [
    combatEffect("shorekeeper-cores", "Collapsed Cores / Flare Star Butterflies", "Normal hit / Illation", collapsedCores),
    combatEffect("shorekeeper-discernment", "Discernment", "Intro", discernment),
    combatEffect("shorekeeper-s4", "Overflowing Quietude", "Chaos Theory", s4Healing),
    combatEffect("shorekeeper-end-loop", "End Loop personal Stellarealm", "Liberation", endLoopPersonal),
    combatEffect("shorekeeper-sequence-info", "Shorekeeper sequence semantics", "sequence", sequenceDocumentation),
    combatEffect("shorekeeper-team-pending", "Shorekeeper Team Cycle dependencies", "team cycle", teamCyclePending),
  ];

  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      effects: [...resonator.combat.effects, ...effects],
      unknowns: [
        ...resonator.combat.unknowns,
        "Partiel: automatic 6-second Collapsed Core expiry outside the reviewed BA1–4 → Illation route is not scheduled because exact per-hit source timestamps are theoretical; the reviewed route converts all Cores before that timeout.",
        "Partiel: Outer → Inner → Supernal Stellarealm evolution and Discernment eligibility are Team Cycle-owned; the loop scenario states Supernal as an explicit external precondition.",
        "Partiel: S3 Concerto Energy and S5 pull/range changes are modeled as exact non-DPS semantics but are not used as personal damage shortcuts.",
      ],
    },
  };
}

const weaponSource = {
  kind: "multi-source-verified" as const,
  source: "WUWA GameDatabase / current community references · Stellar Symphony",
  gameVersion: "3.5",
  verifiedAt: "2026-08-19",
};

const stellarPermanent: EffectDefinition = {
  id: "precise-stellar-symphony-permanent",
  label: "Stellar Symphony · Max HP",
  source: { id: "precise-shorekeeper-signature", type: "weapon", label: "Stellar Symphony" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "stellar-symphony-max-hp",
    label: "R1–R5 · Max HP +12/15/18/21/24%",
    accounting: "already-in-final-stats",
    modifiers: [{
      kind: "runtime-stat",
      stat: "hp",
      mode: "percent",
      stacking: "additive",
      value: rank([12, 15, 18, 21, 24]),
    }],
  }],
};

const stellarPersonalDocumentation: EffectDefinition = {
  id: "precise-stellar-symphony-personal",
  label: "Stellar Symphony · Concerto restore",
  source: { id: "precise-shorekeeper-signature", type: "weapon", label: "Stellar Symphony" },
  target: "self",
  rules: [{
    id: "stellar-symphony-concerto",
    label: "R1–R5 · End Loop restores 8/10/12/14/16 Concerto Energy, once every 20s",
    accounting: "informational",
    modifiers: [],
  }],
};

const stellarTeamPending: EffectDefinition = {
  id: "precise-stellar-symphony-team-pending",
  label: "Stellar Symphony · team ATK after healing Resonance Skill",
  source: { id: "precise-shorekeeper-signature", type: "weapon", label: "Stellar Symphony" },
  target: "team",
  teamContextRequired: true,
  rules: [{
    id: "stellar-symphony-team-atk",
    label: "R1–R5 · healing Resonance Skill grants nearby party ATK +14/17.5/21/24.5/28% for 30s",
    accounting: "informational",
    modifiers: [],
  }],
};

const weaponEffect = (
  id: string,
  name: string,
  trigger: string,
  structuredEffect: EffectDefinition,
): CombatEffect => ({
  id,
  name,
  sourceId: structuredEffect.source.id,
  trigger,
  target: structuredEffect.target === "team" ? "team" : "self",
  effect: structuredEffect.label,
  source: weaponSource,
  structuredEffect,
});

export function applyPreciseShorekeeperWeaponMechanics(
  resonatorId: string,
  weapon: Weapon,
): Weapon {
  if (resonatorId !== "shorekeeper") return weapon;
  return {
    ...weapon,
    level90Stats: { ...weapon.level90Stats!, energyRegen: 77 },
    effects: [
      ...(weapon.effects ?? []),
      weaponEffect("stellar-permanent", "Stellar Symphony Max HP", "permanent", stellarPermanent),
      weaponEffect("stellar-concerto", "Stellar Symphony Concerto", "End Loop", stellarPersonalDocumentation),
      weaponEffect("stellar-team", "Stellar Symphony team ATK", "healing Resonance Skill", stellarTeamPending),
    ],
    passiveDescription: "Partiel · Stellar Symphony R1–R5 structuré: Max HP permanent upstream, 8–16 Concerto sur Liberation documenté, et ATK équipe 14–28% après Skill de soin laissé Team Cycle-owned.",
  };
}
