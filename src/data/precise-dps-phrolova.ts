import type { CombatPredicate, EffectDefinition, ValueExpression } from "@/domain/effect-models";
import type { CombatAction, CombatEffect, Resonator, Weapon } from "@/domain/models";

export const PHROLOVA = {
  basic1: "precise-phrolova-attr-1608001",
  basic2: "precise-phrolova-attr-1608002",
  basic3: "precise-phrolova-attr-1608003",
  scarletCoda: "precise-phrolova-attr-1608005",
  whispers: "precise-phrolova-attr-1608013",
  hecateBasic1: "precise-phrolova-attr-1608016",
  hecateBasic2: "precise-phrolova-attr-1608017",
  hecateStrings: "precise-phrolova-attr-1608019",
  hecateWinds: "precise-phrolova-attr-1608020",
  hecateCadenza: "precise-phrolova-attr-1608021",
  curtainCall: "precise-phrolova-attr-1608022",
  suiteQuietus: "precise-phrolova-attr-1608025",
  suiteImmortality: "precise-phrolova-attr-1608026",
  movement: "precise-phrolova-attr-1608029",
  murmurs: "precise-phrolova-attr-1608030",
  apparition: "precise-phrolova-s6-apparition-of-beyond",
} as const;

const constant = (value: number): ValueExpression => ({ kind: "constant", value });
const rank = (values: readonly number[]): ValueExpression => ({
  kind: "rank",
  values: Object.fromEntries(values.map((value, index) => [index + 1, value])),
});
const resourceValue = (resourceId: string): ValueExpression => ({ kind: "resource", resourceId });
const multiply = (...values: readonly ValueExpression[]): ValueExpression => ({ kind: "multiply", values });
const action = (...ids: readonly string[]): CombatPredicate => ({ kind: "identity", field: "actionId", anyOf: ids });
const sequenceAtLeast = (value: number): CombatPredicate => ({ kind: "state-active", id: `sequence-at-least-${value}` });
const and = (...predicates: readonly CombatPredicate[]): CombatPredicate => ({ kind: "and", predicates });
const hasEffect = (id: string, minStacks?: number): CombatPredicate => ({
  kind: "has-effect",
  id,
  ...(minStacks === undefined ? {} : { minStacks }),
});

const source = {
  kind: "multi-source-verified" as const,
  source: "WUWA GameDatabase / Wuthering Waves Wiki / Prydwen / WutheringTools · Phrolova",
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
    structuredEffect.target === "team"
      ? "team"
      : structuredEffect.target === "other-team-members"
        ? "other-team-members"
        : structuredEffect.target === "enemy"
          ? "enemy"
          : "self",
  effect: structuredEffect.label,
  source,
  structuredEffect,
});

const unknownTiming = (note: string) => ({
  value: null,
  confidence: "unknown" as const,
  sourceNote: note,
});

const apparitionAction: CombatAction = {
  id: PHROLOVA.apparition,
  name: "Apparition of Beyond - Hecate",
  talent: "echoSkill",
  damageType: "echoSkill",
  scaling: "damage",
  scalingAttribute: "attack",
  level: 10,
  multipliers: [{ percent: 216.42, hits: 1 }],
  castDurationSeconds: unknownTiming("S6 follow-up is emitted from Movement/Murmurs; no independent animation duration is authored."),
  recoverySeconds: unknownTiming("S6 follow-up has no independent reviewed recovery timing."),
  hitTimingsSeconds: unknownTiming("The emitted follow-up owns a deterministic queue event, not claimed frame data."),
  notes: ["S6 exact fixed multiplier from Phrolova Resonance Chain; considered Echo Skill DMG."],
  source,
};

const FORTE_ACTIONS = [PHROLOVA.movement, PHROLOVA.murmurs] as const;
const HECATE_ECHO_ACTIONS = [
  PHROLOVA.hecateBasic1,
  PHROLOVA.hecateBasic2,
  PHROLOVA.hecateStrings,
  PHROLOVA.hecateWinds,
  PHROLOVA.hecateCadenza,
  PHROLOVA.apparition,
] as const;
const ENHANCED_HECATE_ACTIONS = [
  PHROLOVA.hecateStrings,
  PHROLOVA.hecateWinds,
  PHROLOVA.hecateCadenza,
] as const;

const volatileNotes: EffectDefinition = {
  id: "precise-phrolova-volatile-notes",
  label: "Rhapsody of a New World · Volatile Notes",
  source: { id: "phrolova-forte", type: "resonator", label: "Rhapsody of a New World" },
  target: "self",
  rules: [],
  triggers: [
    {
      id: "phrolova-string-note-basic3-movement",
      event: "action-end",
      predicates: [action(PHROLOVA.basic3, PHROLOVA.movement)],
      operations: [{ kind: "resource", operation: "gain", resourceId: "volatile-note", amount: constant(1) }],
    },
    {
      id: "phrolova-wind-note-whispers-murmurs",
      event: "action-end",
      predicates: [action(PHROLOVA.whispers, PHROLOVA.murmurs)],
      operations: [{ kind: "resource", operation: "gain", resourceId: "volatile-note", amount: constant(1) }],
    },
  ],
};

const octet: EffectDefinition = {
  id: "precise-phrolova-octet",
  label: "Octet · Aftersound bootstrap and Crit DMG",
  source: { id: "phrolova-octet", type: "resonator", label: "Octet" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "phrolova-aftersound-crit-dmg",
    label: "+2.5% Crit DMG per Aftersound",
    accounting: "runtime",
    modifiers: [{
      kind: "crit-damage-bonus",
      stacking: "additive",
      valueExpression: multiply(resourceValue("aftersound"), constant(2.5)),
    }],
  }],
  triggers: [{
    id: "phrolova-enter-battle-10-aftersound",
    event: "action-start",
    predicates: [{ kind: "resource", resourceId: "aftersound", comparison: "eq", value: constant(0) }],
    operations: [{ kind: "resource", operation: "set", resourceId: "aftersound", amount: constant(10) }],
    maxTriggers: 1,
    triggerCountScope: "owner",
  }],
};

const scarletCoda: EffectDefinition = {
  id: "precise-phrolova-scarlet-coda",
  label: "Scarlet Coda · Aftersound Motion Value",
  source: { id: "phrolova-scarlet-coda", type: "resonator", label: "Scarlet Coda" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "phrolova-scarlet-aftersound-base",
      label: "+82.55% total MV per Aftersound, distributed across Scarlet Coda hit groups",
      accounting: "runtime",
      selectors: [{ kind: "action-id", anyOf: [PHROLOVA.scarletCoda] }],
      modifiers: [{
        kind: "motion-value",
        mode: "additive-percent",
        stacking: "additive",
        value: multiply(resourceValue("aftersound"), constant(82.55)),
        groupDistribution: [
          { groupIndex: 0, weight: 0.10 },
          { groupIndex: 1, weight: 0.15 },
          { groupIndex: 2, weight: 0.75 },
        ],
      }],
    },
    {
      id: "phrolova-s2-scarlet-base",
      label: "S2 · Scarlet Coda DMG Multiplier +75%",
      accounting: "runtime",
      requiredSequence: 2,
      selectors: [{ kind: "action-id", anyOf: [PHROLOVA.scarletCoda] }],
      modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(75) }],
    },
    {
      id: "phrolova-s2-scarlet-aftersound-extra",
      label: "S2 · Aftersound contribution additionally +75%",
      accounting: "runtime",
      requiredSequence: 2,
      selectors: [{ kind: "action-id", anyOf: [PHROLOVA.scarletCoda] }],
      modifiers: [{
        kind: "motion-value",
        mode: "additive-percent",
        stacking: "additive",
        value: multiply(resourceValue("aftersound"), constant(82.55), constant(0.75)),
        groupDistribution: [
          { groupIndex: 0, weight: 0.10 },
          { groupIndex: 1, weight: 0.15 },
          { groupIndex: 2, weight: 0.75 },
        ],
      }],
    },
  ],
  triggers: [{
    id: "phrolova-s2-scarlet-grants-aftersound",
    event: "action-end",
    predicates: [and(action(PHROLOVA.scarletCoda), sequenceAtLeast(2))],
    operations: [{ kind: "resource", operation: "gain", resourceId: "aftersound", amount: constant(14) }],
  }],
};

const referenceEchoMarker: EffectDefinition = {
  id: "precise-phrolova-reference-echo-marker",
  label: "Reference rotation · damaging Main Echo immediately after second enhanced Forte",
  source: { id: "phrolova-reference-echo", type: "system", label: "Prydwen reference Echo timing" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 0.01 }, uniqueness: "refresh-existing" },
  rules: [],
};

const referenceForteCounter: EffectDefinition = {
  id: "precise-phrolova-reference-forte-counter",
  label: "Reference rotation · enhanced Forte counter",
  source: { id: "phrolova-reference-echo", type: "system", label: "Prydwen reference Echo timing" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: {
    duration: { kind: "indefinite" },
    uniqueness: "replace-existing",
    stacks: { kind: "shared", max: 3, initial: 0 },
  },
  rules: [],
  triggers: [
    {
      id: "phrolova-reference-echo-after-second-forte",
      event: "action-end",
      predicates: [and(action(...FORTE_ACTIONS), hasEffect("precise-phrolova-reference-forte-counter", 1))],
      operations: [{ kind: "activate-effect", effectId: "precise-phrolova-reference-echo-marker" }],
      maxTriggers: 1,
      triggerCountScope: "owner",
    },
    {
      id: "phrolova-count-enhanced-forte",
      event: "action-end",
      predicates: [action(...FORTE_ACTIONS)],
      operations: [{ kind: "gain-stacks", effectId: "precise-phrolova-reference-forte-counter", amount: constant(1) }],
    },
  ],
};

const sequences: EffectDefinition = {
  id: "precise-phrolova-sequences",
  label: "Phrolova Resonance Chain",
  source: { id: "phrolova-chain", type: "resonance-chain", label: "Phrolova Resonance Chain" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "phrolova-s1-forte-multiplier",
      label: "S1 · Movement / Murmurs DMG Multiplier +80%",
      accounting: "runtime",
      requiredSequence: 1,
      selectors: [{ kind: "action-id", anyOf: FORTE_ACTIONS }],
      modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(80) }],
    },
    {
      id: "phrolova-s3-echo-amplification",
      label: "S3 · Echo Skill DMG Amplification +80%",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "damage-type", anyOf: ["echoSkill"] }],
      modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 80 }],
    },
    {
      id: "phrolova-s3-scarlet-special-inclusion",
      label: "S3 · Scarlet Coda receives the character Echo Skill amplification special-case",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: [PHROLOVA.scarletCoda] }],
      modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 80 }],
    },
    {
      id: "phrolova-s6-enhanced-hecate-multiplier",
      label: "S6 · Enhanced Attack - Hecate DMG Multiplier +24%",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: ENHANCED_HECATE_ACTIONS }],
      modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(24) }],
    },
  ],
  triggers: [
    {
      id: "phrolova-s6-apparition",
      event: "action-end",
      predicates: [and(action(...FORTE_ACTIONS), sequenceAtLeast(6))],
      operations: [{
        kind: "emit-action",
        action: {
          actionId: PHROLOVA.apparition,
          attribution: "summon",
          delaySeconds: 0.0001,
          snapshot: { stats: "trigger", stacks: "trigger" },
        },
      }],
    },
    {
      id: "phrolova-s6-apparition-aftersound",
      event: "damage-dealt",
      predicates: [and(action(PHROLOVA.apparition), sequenceAtLeast(6))],
      operations: [{ kind: "resource", operation: "gain", resourceId: "aftersound", amount: constant(8) }],
    },
  ],
};

const s4Self: EffectDefinition = {
  id: "precise-phrolova-s4-self",
  label: "S4 · Attribute DMG Bonus after Echo Skill cast",
  source: { id: "phrolova-s4", type: "resonance-chain", label: "A Torch Illuminating the Path" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 30 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
  rules: [{
    id: "phrolova-s4-havoc-self",
    label: "S4 · +20% Havoc DMG Bonus",
    accounting: "runtime",
    requiredSequence: 4,
    modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 20 }],
  }],
  triggers: [
    {
      id: "phrolova-s4-reference-main-echo",
      event: "action-end",
      predicates: [and(hasEffect("precise-phrolova-reference-echo-marker"), sequenceAtLeast(4))],
      operations: [{ kind: "activate-effect", effectId: "precise-phrolova-s4-self" }],
      maxTriggers: 1,
      triggerCountScope: "owner",
    },
    {
      id: "phrolova-s4-scarlet-counts-as-echo-cast",
      event: "action-end",
      predicates: [and(action(PHROLOVA.scarletCoda), sequenceAtLeast(4))],
      operations: [{ kind: "activate-effect", effectId: "precise-phrolova-s4-self" }],
    },
  ],
};

const teamCyclePending: EffectDefinition = {
  id: "precise-phrolova-team-cycle-pending",
  label: "Phrolova · Maestro / Hecate off-field team dependencies",
  source: { id: "phrolova-team-cycle", type: "resonator", label: "Maestro / Hecate" },
  target: "team",
  teamContextRequired: true,
  rules: [
    {
      id: "phrolova-offfield-hecate-pending",
      label: "Maestro lasts 24s; off-field Hecate cadence, note playback and teammate Echo-triggered Enhanced Attacks require Team Cycle.",
      accounting: "informational",
      modifiers: [],
    },
    {
      id: "phrolova-aftersound-overflow-pending",
      label: "Aftersound beyond 24 grants +1% Crit DMG per additional stack up to +100%; exact loop overflow depends on prior off-field Hecate events.",
      accounting: "informational",
      modifiers: [],
    },
    {
      id: "phrolova-s4-team-pending",
      label: "S4 grants the same +20% Attribute DMG Bonus to all Resonators for 30s.",
      accounting: "informational",
      requiredSequence: 4,
      modifiers: [],
    },
    {
      id: "phrolova-s6-maestro-pending",
      label: "S6 Maestro on/off-field +60% Havoc / +40% Hecate-Phrolova taken-DMG semantics require the real Team Cycle state.",
      accounting: "informational",
      requiredSequence: 6,
      modifiers: [],
    },
  ],
};

export function applyPrecisePhrolovaMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "phrolova" || !resonator.combat) return resonator;

  const patchedActions = resonator.combat.actions.map((candidate) => {
    if ([PHROLOVA.scarletCoda, PHROLOVA.suiteImmortality, PHROLOVA.movement, PHROLOVA.murmurs].includes(candidate.id as never)) {
      return { ...candidate, damageType: "resonanceSkill" as const };
    }
    if (HECATE_ECHO_ACTIONS.includes(candidate.id as never)) {
      return { ...candidate, damageType: "echoSkill" as const };
    }
    return candidate;
  });

  const effects: readonly CombatEffect[] = [
    combatEffect("phrolova-notes", "Volatile Notes", "BA3 / Forte / Skill", volatileNotes),
    combatEffect("phrolova-octet", "Octet", "enter battle / Aftersound", octet),
    combatEffect("phrolova-scarlet", "Scarlet Coda", "Aftersound", scarletCoda),
    combatEffect("phrolova-reference-forte", "Reference Forte counter", "enhanced Forte", referenceForteCounter),
    combatEffect("phrolova-reference-echo", "Reference Echo marker", "after second Forte", referenceEchoMarker),
    combatEffect("phrolova-sequences", "Phrolova Resonance Chain", "sequence", sequences),
    combatEffect("phrolova-s4", "A Torch Illuminating the Path", "Echo Skill cast", s4Self),
    combatEffect("phrolova-team", "Maestro / Hecate team dependencies", "Team Cycle", teamCyclePending),
  ];

  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      actions: [...patchedActions, apparitionAction],
      effects: [...resonator.combat.effects, ...effects],
      unknowns: [
        ...resonator.combat.unknowns,
        "Partiel: the reference on-field route is executable, but Maestro off-field Hecate cadence and teammate Echo triggers are Team Cycle-owned and are not invented in Personal DPS.",
        "Partiel: later-loop Aftersound above the exact 10-stack battle bootstrap depends on the prior Team Cycle; the personal reference therefore exposes that dependency rather than guessing an overflow value.",
        "Reference Echo timing: Prydwen places a damaging Main Echo immediately after the second enhanced Forte; its build-owned damage is excluded, while cast-triggered buffs are modeled through the marker effect.",
      ],
    },
  };
}

const weaponSource = {
  kind: "multi-source-verified" as const,
  source: "WUWA GameDatabase / Prydwen / Wuthering Waves Wiki · Lethean Elegy",
  gameVersion: "3.5",
  verifiedAt: "2026-08-19",
};

const letheanPermanent: EffectDefinition = {
  id: "precise-lethean-permanent",
  label: "Lethean Elegy · permanent ATK",
  source: { id: "precise-phrolova-signature", type: "weapon", label: "Lethean Elegy" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "lethean-atk",
    label: "R1–R5 · ATK +12/15/18/21/24%",
    accounting: "already-in-final-stats",
    modifiers: [{ kind: "runtime-stat", stat: "attack", mode: "percent", stacking: "additive", value: rank([12, 15, 18, 21, 24]) }],
  }],
};

const letheanWindow: EffectDefinition = {
  id: "precise-lethean-window",
  label: "Lethean Elegy · 12s after Echo Skill DMG",
  source: { id: "precise-phrolova-signature", type: "weapon", label: "Underworld Requiem" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 12 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
  rules: [
    {
      id: "lethean-skill-bonus",
      label: "R1–R5 · Resonance Skill DMG Bonus +32/40/48/56/64%",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["resonanceSkill"] }],
      modifiers: [{ kind: "damage-type-bonus", stacking: "additive", valueExpression: rank([32, 40, 48, 56, 64]) }],
    },
    {
      id: "lethean-echo-amplification",
      label: "R1–R5 · Echo Skill DMG Amplification +32/40/48/56/64%",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["echoSkill"] }],
      modifiers: [{ kind: "damage-amplification", stacking: "additive", valueExpression: rank([32, 40, 48, 56, 64]) }],
    },
    {
      id: "lethean-defense-ignore",
      label: "R1–R5 · ignore 8/10/12/14/16% DEF when dealing damage",
      accounting: "runtime",
      modifiers: [{ kind: "defense-ignore", stacking: "additive", valueExpression: rank([8, 10, 12, 14, 16]) }],
    },
  ],
  triggers: [
    {
      id: "lethean-reference-damaging-main-echo",
      event: "action-end",
      predicates: [hasEffect("precise-phrolova-reference-echo-marker")],
      operations: [{ kind: "activate-effect", effectId: "precise-lethean-window" }],
      maxTriggers: 1,
      triggerCountScope: "owner",
    },
    {
      id: "lethean-real-echo-damage",
      event: "damage-dealt",
      predicates: [{ kind: "identity", field: "damageType", anyOf: ["echoSkill"] }],
      operations: [{ kind: "activate-effect", effectId: "precise-lethean-window" }],
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
  source: weaponSource,
  structuredEffect,
});

export function applyPrecisePhrolovaWeaponMechanics(resonatorId: string, weapon: Weapon): Weapon {
  if (resonatorId !== "phrolova") return weapon;
  return {
    ...weapon,
    level90Stats: { ...weapon.level90Stats!, critRate: 24.3 },
    effects: [
      ...(weapon.effects ?? []),
      weaponEffect("lethean-permanent", "Lethean Elegy ATK", "permanent", letheanPermanent),
      weaponEffect("lethean-window", "Underworld Requiem", "after Echo Skill DMG", letheanWindow),
    ],
    passiveDescription: "Exact R1–R5 structuré: ATK permanent +12–24%; après Echo Skill DMG pendant 12s, Skill DMG Bonus +32–64%, Echo Skill DMG Amplification +32–64% et DEF Ignore +8–16%.",
  };
}
