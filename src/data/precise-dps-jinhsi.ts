import type { CombatPredicate, EffectDefinition, ValueExpression } from "@/domain/effect-models";
import type { CombatAction, CombatEffect, Resonator, Weapon } from "@/domain/models";

const constant = (value: number): ValueExpression => ({ kind: "constant", value });
const stacks = (): ValueExpression => ({ kind: "stacks" });
const rank = (values: readonly number[]): ValueExpression => ({
  kind: "rank",
  values: Object.fromEntries(values.map((value, index) => [index + 1, value])),
});
const actionPredicate = (...ids: string[]): CombatPredicate => ({
  kind: "identity",
  field: "actionId",
  anyOf: ids,
});
const sequenceAtLeast = (value: number): CombatPredicate => ({
  kind: "state-active",
  id: `sequence-at-least-${value}`,
});
const and = (...predicates: readonly CombatPredicate[]): CombatPredicate => ({
  kind: "and",
  predicates,
});
const actionId = (sourceAttributeId: string): string =>
  `precise-jinhsi-attr-${sourceAttributeId}`;

const JINHSI = {
  normal1: actionId("1304001"),
  overflowingRadiance: actionId("1304012"),
  purgeOfLight: actionId("1304016"),
  intro: actionId("1304020"),
  incarnation1: actionId("1304023"),
  incarnation2: actionId("1304024"),
  incarnation3: actionId("1304025"),
  incarnation4: actionId("1304026"),
  crescentDivinity: actionId("1304027"),
  solarFlare: actionId("1304030"),
  stellaGlamor: actionId("1304039"),
} as const;

const incarnationSkillDamageIds = [
  JINHSI.incarnation1,
  JINHSI.incarnation2,
  JINHSI.incarnation3,
  JINHSI.incarnation4,
  JINHSI.crescentDivinity,
  JINHSI.solarFlare,
  JINHSI.stellaGlamor,
] as const;

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
    source: "WUWA GameDatabase / Wuwa Wiki / Prydwen Jinhsi kit",
    gameVersion: "3.5",
    verifiedAt: "2026-08-19",
  },
  structuredEffect,
});

function exactAction(resonator: Resonator, id: string): CombatAction {
  const action = resonator.combat?.actions.find((candidate) => candidate.id === id);
  if (!action) throw new Error(`Jinhsi precise mechanic is missing exact action ${id}.`);
  return action;
}

const jinhsiWeaponSource = {
  kind: "multi-source-verified" as const,
  source: "WUWA GameDatabase / Wuwa Wiki · Ages of Harvest",
  gameVersion: "3.5",
  verifiedAt: "2026-08-19",
};

export function applyPreciseJinhsiMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "jinhsi" || !resonator.combat) return resonator;

  const normal1 = exactAction(resonator, JINHSI.normal1);
  const overflowing = exactAction(resonator, JINHSI.overflowingRadiance);
  const purge = exactAction(resonator, JINHSI.purgeOfLight);
  const intro = exactAction(resonator, JINHSI.intro);
  const incarnation1 = exactAction(resonator, JINHSI.incarnation1);
  const incarnation2 = exactAction(resonator, JINHSI.incarnation2);
  const incarnation3 = exactAction(resonator, JINHSI.incarnation3);
  const incarnation4 = exactAction(resonator, JINHSI.incarnation4);
  const crescent = exactAction(resonator, JINHSI.crescentDivinity);
  const solar = exactAction(resonator, JINHSI.solarFlare);
  const stella = exactAction(resonator, JINHSI.stellaGlamor);

  const patchedActions = resonator.combat.actions.map((action) =>
    incarnationSkillDamageIds.includes(action.id as (typeof incarnationSkillDamageIds)[number])
      ? { ...action, damageType: "resonanceSkill" as const }
      : action,
  );

  const inherentSkills: EffectDefinition = {
    id: "precise-jinhsi-inherent-skills",
    label: "Jinhsi · Radiant Surge / Converged Flash",
    source: { id: "jinhsi-inherent", type: "resonator", label: "Jinhsi Inherent Skills" },
    target: "self",
    activationPolicy: "initially-active",
    lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
    rules: [
      {
        id: "jinhsi-radiant-surge-spectro",
        label: "Radiant Surge · +20% Spectro DMG",
        accounting: "runtime",
        selectors: [{ kind: "element", anyOf: ["spectro"] }],
        modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 20 }],
      },
      {
        id: "jinhsi-converged-flash-intro",
        label: "Converged Flash · Loong's Halo multiplier +50%",
        accounting: "runtime",
        selectors: [{ kind: "action-id", anyOf: [intro.id] }],
        modifiers: [{
          kind: "motion-value",
          mode: "relative-additive",
          stacking: "additive",
          value: constant(50),
        }],
      },
    ],
  };

  const scenarioResources: EffectDefinition = {
    id: "precise-jinhsi-scenario-resource-bootstrap",
    label: "Jinhsi · explicit Incandescence scenario preconditions",
    source: { id: "jinhsi-incandescence", type: "resonator", label: "Jinhsi Incandescence" },
    target: "self",
    rules: [],
    triggers: [
      {
        id: "jinhsi-loop-reviewed-full-incandescence",
        event: "rotation-step-start",
        predicates: [actionPredicate(intro.id)],
        maxTriggers: 1,
        operations: [{ kind: "resource", operation: "set-max", resourceId: "incandescence" }],
      },
      {
        id: "jinhsi-s2-opener-out-of-combat-full-incandescence",
        event: "rotation-step-start",
        predicates: [and(actionPredicate(normal1.id), sequenceAtLeast(2))],
        maxTriggers: 1,
        operations: [{ kind: "resource", operation: "set-max", resourceId: "incandescence" }],
      },
    ],
  };

  const formStateMachine: EffectDefinition = {
    id: "precise-jinhsi-form-state-machine",
    label: "Jinhsi · Normal / Incarnation / Ordination Glow",
    source: { id: "jinhsi-forte", type: "resonator", label: "Luminal Synthesis" },
    target: "self",
    rules: [],
    triggers: [
      {
        id: "jinhsi-overflowing-enter-incarnation",
        event: "action-end",
        predicates: [actionPredicate(overflowing.id)],
        operations: [{ kind: "change-form", stateId: "Incarnation" }],
      },
      {
        id: "jinhsi-incarnation4-enter-ordination",
        event: "action-end",
        predicates: [actionPredicate(incarnation4.id)],
        operations: [{ kind: "change-form", stateId: "Ordination Glow" }],
      },
      {
        id: "jinhsi-illuminous-return-normal",
        event: "action-end",
        predicates: [actionPredicate(solar.id)],
        operations: [{ kind: "change-form", stateId: "Normal State" }],
      },
    ],
  };

  const illuminousEpiphany: EffectDefinition = {
    id: "precise-jinhsi-illuminous-epiphany",
    label: "Illuminous Epiphany · Solar Flare → Stella Glamor / Incandescence",
    source: { id: "jinhsi-illuminous", type: "resonator", label: "Illuminous Epiphany" },
    target: "self",
    activationPolicy: "initially-active",
    lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
    rules: [
      {
        id: "jinhsi-stella-incandescence-multiplier",
        label: "Stella Glamor · +44.54 percentage points per Incandescence",
        accounting: "runtime",
        selectors: [{ kind: "action-id", anyOf: [stella.id] }],
        modifiers: [{
          kind: "motion-value",
          mode: "additive-percent",
          stacking: "additive",
          value: {
            kind: "multiply",
            values: [{ kind: "resource", resourceId: "incandescence" }, constant(44.54)],
          },
        }],
      },
      {
        id: "jinhsi-s6-incandescence-extra-multiplier",
        label: "S6 · Incandescence multiplier contribution +45%",
        accounting: "runtime",
        requiredSequence: 6,
        selectors: [{ kind: "action-id", anyOf: [stella.id] }],
        modifiers: [{
          kind: "motion-value",
          mode: "additive-percent",
          stacking: "additive",
          value: {
            kind: "multiply",
            values: [
              { kind: "resource", resourceId: "incandescence" },
              constant(44.54),
              constant(0.45),
            ],
          },
        }],
      },
    ],
    triggers: [
      {
        id: "jinhsi-solar-emit-stella",
        event: "action-hit",
        predicates: [actionPredicate(solar.id)],
        maxTriggers: 1,
        triggerCountScope: "instance",
        operations: [{
          kind: "emit-action",
          action: {
            actionId: stella.id,
            attribution: "follow-up",
            delaySeconds: 0.0001,
            snapshot: { stats: "hit", stacks: "tick" },
          },
        }],
      },
      {
        id: "jinhsi-illuminous-consume-incandescence",
        event: "action-end",
        predicates: [actionPredicate(solar.id)],
        operations: [{
          kind: "resource",
          operation: "consume-up-to",
          resourceId: "incandescence",
          amount: constant(50),
        }],
      },
    ],
  };

  const heraldOfRevival: EffectDefinition = {
    id: "precise-jinhsi-herald-of-revival",
    label: "S1 · Herald of Revival",
    source: { id: "jinhsi-s1", type: "resonance-chain", label: "Abyssal Ascension" },
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 6 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
      stacks: { kind: "shared", max: 4, initial: 0 },
    },
    rules: [{
      id: "jinhsi-s1-illuminous-damage",
      label: "S1 · Illuminous Epiphany damage +20% per Herald stack",
      accounting: "runtime",
      requiredSequence: 1,
      selectors: [{ kind: "action-id", anyOf: [solar.id, stella.id] }],
      modifiers: [{
        kind: "damage-amplification",
        stacking: "additive",
        valuePerStack: 20,
        maxStacks: 4,
      }],
    }],
    triggers: [
      ...[
        incarnation1.id,
        incarnation2.id,
        incarnation3.id,
        incarnation4.id,
        crescent.id,
      ].map((id, index) => ({
        id: `jinhsi-s1-herald-gain-${index}`,
        event: "action-end" as const,
        predicates: [and(actionPredicate(id), sequenceAtLeast(1))],
        operations: [
          { kind: "activate-effect" as const, effectId: "precise-jinhsi-herald-of-revival" },
          { kind: "gain-stacks" as const, effectId: "precise-jinhsi-herald-of-revival", amount: constant(1) },
        ],
      })),
      {
        id: "jinhsi-s1-herald-consume",
        event: "action-end",
        predicates: [and(actionPredicate(solar.id), sequenceAtLeast(1))],
        operations: [{ kind: "clear-stacks", effectId: "precise-jinhsi-herald-of-revival" }],
      },
    ],
  };

  const immortalDescendancy: EffectDefinition = {
    id: "precise-jinhsi-immortal-descendancy",
    label: "S3 · Immortal's Descendancy",
    source: { id: "jinhsi-s3", type: "resonance-chain", label: "Celestial Incarnate" },
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 20 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
      stacks: { kind: "shared", max: 2, initial: 0 },
    },
    rules: [{
      id: "jinhsi-s3-atk-per-stack",
      label: "S3 · +25% ATK per Immortal's Descendancy stack",
      accounting: "runtime",
      requiredSequence: 3,
      modifiers: [{
        kind: "runtime-stat",
        stat: "attack",
        mode: "percent",
        stacking: "additive",
        value: { kind: "multiply", values: [stacks(), constant(25)] },
      }],
    }],
    triggers: [{
      id: "jinhsi-s3-intro-stack",
      event: "action-end",
      predicates: [and(actionPredicate(intro.id), sequenceAtLeast(3))],
      operations: [
        { kind: "activate-effect", effectId: "precise-jinhsi-immortal-descendancy" },
        { kind: "gain-stacks", effectId: "precise-jinhsi-immortal-descendancy", amount: constant(1) },
      ],
    }],
  };

  const sequenceDamage: EffectDefinition = {
    id: "precise-jinhsi-sequence-damage",
    label: "Jinhsi Resonance Chain · direct personal damage",
    source: { id: "jinhsi-chain", type: "resonance-chain", label: "Jinhsi Resonance Chain" },
    target: "self",
    activationPolicy: "initially-active",
    lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
    rules: [
      {
        id: "jinhsi-s5-purge-multiplier",
        label: "S5 · Purge of Light multiplier +120%",
        accounting: "runtime",
        requiredSequence: 5,
        selectors: [{ kind: "action-id", anyOf: [purge.id] }],
        modifiers: [{
          kind: "motion-value",
          mode: "relative-additive",
          stacking: "additive",
          value: constant(120),
        }],
      },
      {
        id: "jinhsi-s6-illuminous-multiplier",
        label: "S6 · Illuminous Epiphany multiplier +45%",
        accounting: "runtime",
        requiredSequence: 6,
        selectors: [{ kind: "action-id", anyOf: [solar.id, stella.id] }],
        modifiers: [{
          kind: "motion-value",
          mode: "relative-additive",
          stacking: "additive",
          value: constant(45),
        }],
      },
    ],
  };

  const benevolentGrace: EffectDefinition = {
    id: "precise-jinhsi-benevolent-grace",
    label: "S4 · Benevolent Grace",
    source: { id: "jinhsi-s4", type: "resonance-chain", label: "Benevolent Grace" },
    target: "team",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 20 },
      refresh: "reset-duration",
      uniqueness: "refresh-existing",
    },
    rules: [{
      id: "jinhsi-s4-attribute-damage",
      label: "S4 · team +20% Attribute DMG",
      accounting: "runtime",
      requiredSequence: 4,
      modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 20 }],
    }],
    triggers: [
      {
        id: "jinhsi-s4-purge-trigger",
        event: "action-start",
        predicates: [and(actionPredicate(purge.id), sequenceAtLeast(4))],
        operations: [{ kind: "activate-effect", effectId: "precise-jinhsi-benevolent-grace" }],
      },
      {
        id: "jinhsi-s4-illuminous-trigger",
        event: "action-start",
        predicates: [and(actionPredicate(solar.id), sequenceAtLeast(4))],
        operations: [{ kind: "activate-effect", effectId: "precise-jinhsi-benevolent-grace" }],
      },
    ],
  };

  const unison: EffectDefinition = {
    id: "precise-jinhsi-unison",
    label: "Jinhsi · Unison",
    source: { id: "jinhsi-unison", type: "resonator", label: "Unison" },
    target: "self",
    activationPolicy: "triggered",
    lifecycle: {
      duration: { kind: "fixed", seconds: 5 },
      refresh: "no-refresh",
      uniqueness: "refresh-existing",
    },
    rules: [{
      id: "jinhsi-unison-marker",
      label: "Unison permits Outro/Intro handoff without consuming Concerto Energy; Team Cycle owns the switch.",
      accounting: "informational",
      modifiers: [],
    }],
    triggers: [{
      id: "jinhsi-gain-unison",
      event: "action-end",
      predicates: [actionPredicate(solar.id)],
      cooldown: { seconds: 25, scope: "owner" },
      operations: [{ kind: "activate-effect", effectId: "precise-jinhsi-unison" }],
    }],
  };

  const teamCyclePending: EffectDefinition = {
    id: "precise-jinhsi-team-cycle-pending",
    label: "Jinhsi · Eras in Unity / Temporal Bender require Team Cycle",
    source: { id: "jinhsi-team-cycle", type: "resonator", label: "Eras in Unity / Temporal Bender" },
    target: "team",
    teamContextRequired: true,
    rules: [
      {
        id: "jinhsi-incandescence-team-generation-pending",
        label: "Team Attribute DMG grants 1 Incandescence and Coordinated Attack DMG grants 2, independently by Attribute every 3s.",
        accounting: "informational",
        modifiers: [],
      },
      {
        id: "jinhsi-outro-temporal-bender-pending",
        label: "Temporal Bender changes Eras in Unity same-Attribute cadence to once every 1s for 20s after Outro.",
        accounting: "informational",
        modifiers: [],
      },
      {
        id: "jinhsi-unison-switch-pending",
        label: "Unison consumption and the outgoing/incoming switch pair require the full team timeline.",
        accounting: "informational",
        modifiers: [],
      },
    ],
  };

  const effects: readonly CombatEffect[] = [
    combatEffect("jinhsi-inherent", "Jinhsi inherent skills", "permanent / Intro", inherentSkills),
    combatEffect("jinhsi-scenario-resource", "Jinhsi Incandescence scenario bootstrap", "rotation entry", scenarioResources),
    combatEffect("jinhsi-form-state", "Jinhsi form state machine", "Overflowing / Incarnation 4 / Illuminous", formStateMachine),
    combatEffect("jinhsi-illuminous", "Illuminous Epiphany", "Solar Flare / Stella Glamor", illuminousEpiphany),
    combatEffect("jinhsi-s1", "Herald of Revival", "Incarnation / Crescent Divinity", heraldOfRevival),
    combatEffect("jinhsi-s3", "Immortal's Descendancy", "Intro", immortalDescendancy),
    combatEffect("jinhsi-sequence-damage", "Jinhsi direct sequence damage", "sequence", sequenceDamage),
    combatEffect("jinhsi-s4", "Benevolent Grace", "Purge / Illuminous", benevolentGrace),
    combatEffect("jinhsi-unison", "Unison", "Illuminous", unison),
    combatEffect("jinhsi-team-cycle-pending", "Jinhsi Team Cycle dependencies", "team cycle", teamCyclePending),
  ];

  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      actions: patchedActions,
      effects: [...resonator.combat.effects, ...effects],
      unknowns: [
        ...resonator.combat.unknowns,
        "Partiel: Stella Glamor is emitted from Solar Flare with a minimal theoretical delay because the public kit states only that it detonates after a short delay, not an exact frame timestamp.",
        "Partiel: the loop's 50 Incandescence is an explicit reviewed scenario precondition; its real Attribute/Coordinated Attack generation remains Team Cycle-owned and is never averaged.",
        "Partiel: Unison consumption and Temporal Bender require a real switch/team timeline before complete status.",
      ],
    },
  };
}

const agesPermanent: EffectDefinition = {
  id: "precise-ages-of-harvest-permanent",
  label: "Divine Blessing · Attribute DMG",
  source: { id: "precise-jinhsi-signature", type: "weapon", label: "Ages of Harvest" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "ages-attribute-damage",
    label: "R1–R5 · +12/15/18/21/24% Attribute DMG",
    accounting: "already-in-final-stats",
    modifiers: [{
      kind: "all-damage-bonus",
      stacking: "additive",
      valueExpression: rank([12, 15, 18, 21, 24]),
    }],
  }],
};

const agesAgelessMarking: EffectDefinition = {
  id: "precise-ages-of-harvest-ageless-marking",
  label: "Divine Blessing · Ageless Marking",
  source: { id: "precise-jinhsi-signature", type: "weapon", label: "Ages of Harvest" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 12 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "ages-ageless-skill-damage",
    label: "Intro cast · +24/30/36/42/48% Resonance Skill DMG for 12s",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["resonanceSkill"] }],
    modifiers: [{
      kind: "damage-type-bonus",
      stacking: "additive",
      valueExpression: rank([24, 30, 36, 42, 48]),
    }],
  }],
  triggers: [{
    id: "ages-ageless-on-intro",
    event: "action-start",
    predicates: [actionPredicate(JINHSI.intro)],
    operations: [{ kind: "activate-effect", effectId: "precise-ages-of-harvest-ageless-marking" }],
  }],
};

const agesEtherealEndowment: EffectDefinition = {
  id: "precise-ages-of-harvest-ethereal-endowment",
  label: "Divine Blessing · Ethereal Endowment",
  source: { id: "precise-jinhsi-signature", type: "weapon", label: "Ages of Harvest" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 12 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "ages-ethereal-skill-damage",
    label: "Resonance Skill cast · +24/30/36/42/48% Resonance Skill DMG for 12s",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["resonanceSkill"] }],
    modifiers: [{
      kind: "damage-type-bonus",
      stacking: "additive",
      valueExpression: rank([24, 30, 36, 42, 48]),
    }],
  }],
  triggers: [
    {
      id: "ages-ethereal-on-overflowing",
      event: "action-start",
      predicates: [actionPredicate(JINHSI.overflowingRadiance)],
      operations: [{ kind: "activate-effect", effectId: "precise-ages-of-harvest-ethereal-endowment" }],
    },
    {
      id: "ages-ethereal-on-crescent",
      event: "action-start",
      predicates: [actionPredicate(JINHSI.crescentDivinity)],
      operations: [{ kind: "activate-effect", effectId: "precise-ages-of-harvest-ethereal-endowment" }],
    },
    {
      id: "ages-ethereal-on-illuminous",
      event: "action-start",
      predicates: [actionPredicate(JINHSI.solarFlare)],
      operations: [{ kind: "activate-effect", effectId: "precise-ages-of-harvest-ethereal-endowment" }],
    },
  ],
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
  target: "self",
  effect: structuredEffect.label,
  source: jinhsiWeaponSource,
  structuredEffect,
});

export function applyPreciseJinhsiWeaponMechanics(
  resonatorId: string,
  weapon: Weapon,
): Weapon {
  if (resonatorId !== "jinhsi") return weapon;
  return {
    ...weapon,
    level90Stats: { ...weapon.level90Stats!, critRate: 24.3 },
    effects: [
      ...(weapon.effects ?? []),
      weaponEffect("ages-permanent", "Divine Blessing · Attribute DMG", "permanent", agesPermanent),
      weaponEffect("ages-ageless", "Divine Blessing · Ageless Marking", "Intro", agesAgelessMarking),
      weaponEffect("ages-ethereal", "Divine Blessing · Ethereal Endowment", "Resonance Skill", agesEtherealEndowment),
    ],
    passiveDescription: "Partiel · Ages of Harvest R1–R5 structuré. Attribute DMG permanent reste upstream dans finalStats; Ageless Marking et Ethereal Endowment sont deux fenêtres runtime indépendantes de 12s.",
  };
}
