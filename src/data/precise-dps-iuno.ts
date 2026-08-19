import type { EffectDefinition } from "@/domain/effect-models";
import type { CombatAction, CombatEffect, CombatResource, Resonator, Weapon } from "@/domain/models";

const source = {
  kind: "multi-source-verified" as const,
  source: "Encore GameDatabase · Prydwen Iuno guide/calculations · WutheringTools cross-check",
  gameVersion: "3.5",
  verifiedAt: "2026-08-20",
  notes: "Stable action identities and motion values come from the promoted GameDatabase projection. Kit semantics and reference rotations are reviewed separately; per-action timings remain theoretical unless explicitly sourced.",
};

const actionId = (attributeId: string): string => `precise-iuno-attr-${attributeId}`;
const constant = (value: number) => ({ kind: "constant" as const, value });
const rank = (values: readonly number[]) => ({
  kind: "rank" as const,
  values: Object.fromEntries(values.map((value, index) => [index + 1, value])),
});
const actionPredicate = (...ids: string[]) => ({
  kind: "identity" as const,
  field: "actionId" as const,
  anyOf: ids,
});
const formPredicate = (...forms: string[]) => ({
  kind: "identity" as const,
  field: "form" as const,
  anyOf: forms,
});

export const IUNO = {
  moonring1: actionId("1410001"),
  moonring2: actionId("1410002"),
  moonring3: actionId("1410003"),
  midair: actionId("1410004"),
  closingRefrain: actionId("1410009"),
  arc: actionId("1410012"),
  fluxMoonbow: actionId("1410016"),
  fluxMoonring: actionId("1410017"),
  moonbow1: actionId("1410018"),
  moonbow2: actionId("1410019"),
  moonbow3: actionId("1410020"),
  moonbowDodge: actionId("1410021"),
  enhancedMoonbow1: actionId("1410022"),
  enhancedMoonbow2: actionId("1410023"),
  enhancedMoonbow3: actionId("1410024"),
  enhancedMoonbowDodge: actionId("1410025"),
  enhancedArc: actionId("1410026"),
  absoluteFullness: actionId("1410032"),
  liberation: actionId("1410036"),
  intro: actionId("1410040"),
  unfinishedRefrain: actionId("1410043"),
  outro: "precise-iuno-outro",
} as const;

const liberationDamageIds = [
  IUNO.fluxMoonbow,
  IUNO.fluxMoonring,
  IUNO.moonbow1,
  IUNO.moonbow2,
  IUNO.moonbow3,
  IUNO.moonbowDodge,
  IUNO.arc,
  IUNO.enhancedMoonbow1,
  IUNO.enhancedMoonbow2,
  IUNO.enhancedMoonbow3,
  IUNO.enhancedMoonbowDodge,
  IUNO.enhancedArc,
  IUNO.absoluteFullness,
] as const;

const moonbowAndArcIds = [
  IUNO.moonbow1,
  IUNO.moonbow2,
  IUNO.moonbow3,
  IUNO.moonbowDodge,
  IUNO.arc,
  IUNO.enhancedMoonbow1,
  IUNO.enhancedMoonbow2,
  IUNO.enhancedMoonbow3,
  IUNO.enhancedMoonbowDodge,
  IUNO.enhancedArc,
] as const;

const shieldCastIds = [
  IUNO.intro,
  IUNO.closingRefrain,
  IUNO.unfinishedRefrain,
  IUNO.liberation,
  IUNO.fluxMoonbow,
  IUNO.fluxMoonring,
  IUNO.moonring1,
  IUNO.moonring2,
  IUNO.moonring3,
  IUNO.midair,
  IUNO.moonbow1,
  IUNO.moonbow2,
  IUNO.moonbow3,
  IUNO.moonbowDodge,
  IUNO.arc,
  IUNO.enhancedMoonbow1,
  IUNO.enhancedMoonbow2,
  IUNO.enhancedMoonbow3,
  IUNO.enhancedMoonbowDodge,
  IUNO.enhancedArc,
  IUNO.absoluteFullness,
] as const;

const unknownTiming = () => ({ value: null, confidence: "unknown" as const });
const outroAction: CombatAction = {
  id: IUNO.outro,
  name: "From Gloom to Gleam",
  talent: "outroSkill",
  damageType: "outroSkill",
  scaling: "damage",
  scalingAttribute: "attack",
  level: 10,
  multipliers: [{ percent: 100, hits: 1 }],
  castDurationSeconds: unknownTiming(),
  recoverySeconds: unknownTiming(),
  hitTimingsSeconds: unknownTiming(),
  source,
  notes: [
    "The 100% Aero hit belongs to Iuno's personal damage.",
    "The +50% Heavy Attack amplification belongs to the incoming Resonator and is represented separately as an incoming-recipient effect.",
  ],
};

export function applyPreciseIunoActionPatches(actions: readonly CombatAction[]): readonly CombatAction[] {
  let hasOutro = false;
  const patched = actions.map((action) => {
    if (action.id === IUNO.outro) hasOutro = true;
    if (!liberationDamageIds.includes(action.id as (typeof liberationDamageIds)[number])) return action;
    return {
      ...action,
      damageType: "resonanceLiberation" as const,
      scalingAttribute: "attack" as const,
      notes: [
        ...(action.notes ?? []),
        "Iuno kit override: this action is considered Resonance Liberation DMG.",
      ],
    };
  });
  return hasOutro ? patched : [...patched, outroAction];
}

const sentience: EffectDefinition = {
  id: "precise-iuno-sentience",
  label: "Iuno · Sentience",
  source: { id: "iuno-forte", type: "resonator", label: "Ebb and Flow · Sentience" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [],
  triggers: [
    {
      id: "iuno-sentience-intro",
      event: "action-end",
      predicates: [actionPredicate(IUNO.intro)],
      operations: [{ kind: "resource", operation: "gain", resourceId: "sentience", amount: constant(40) }],
    },
    {
      id: "iuno-sentience-refrain",
      event: "action-end",
      predicates: [actionPredicate(IUNO.closingRefrain, IUNO.unfinishedRefrain)],
      operations: [{ kind: "resource", operation: "gain", resourceId: "sentience", amount: constant(25) }],
    },
    {
      id: "iuno-sentience-liberation",
      event: "action-end",
      predicates: [actionPredicate(IUNO.liberation)],
      operations: [{ kind: "resource", operation: "gain", resourceId: "sentience", amount: constant(60) }],
    },
    {
      id: "iuno-sentience-moonbow-chain",
      event: "action-end",
      predicates: [actionPredicate(IUNO.enhancedMoonbow3)],
      operations: [{ kind: "resource", operation: "consume-up-to", resourceId: "sentience", amount: constant(50) }],
    },
    {
      id: "iuno-sentience-arc",
      event: "action-end",
      predicates: [actionPredicate(IUNO.enhancedArc)],
      operations: [{ kind: "resource", operation: "consume-up-to", resourceId: "sentience", amount: constant(25) }],
    },
    {
      id: "iuno-s6-fullness-refill",
      event: "action-end",
      predicates: [actionPredicate(IUNO.absoluteFullness)],
      operations: [{ kind: "resource", operation: "set-max", resourceId: "sentience" }],
    },
  ],
};

const lunarCycle: EffectDefinition = {
  id: "precise-iuno-lunar-cycle",
  label: "Iuno · Lunar Cycle",
  source: { id: "iuno-forte", type: "resonator", label: "Ebb and Flow · Lunar Cycle" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [],
  triggers: [
    {
      id: "iuno-enter-half-moon",
      event: "action-end",
      predicates: [actionPredicate(IUNO.closingRefrain, IUNO.unfinishedRefrain, IUNO.liberation)],
      operations: [{ kind: "change-form", stateId: "Lunar Cycle - Half Moon" }],
    },
    {
      id: "iuno-flux-to-new-moon",
      event: "action-end",
      predicates: [actionPredicate(IUNO.fluxMoonbow)],
      operations: [{ kind: "change-form", stateId: "Lunar Cycle - New Moon" }],
    },
    {
      id: "iuno-flux-to-half-moon",
      event: "action-end",
      predicates: [actionPredicate(IUNO.fluxMoonring)],
      operations: [{ kind: "change-form", stateId: "Lunar Cycle - Half Moon" }],
    },
    {
      id: "iuno-fullness-exit-cycle-s0-s5",
      event: "action-end",
      predicates: [
        actionPredicate(IUNO.absoluteFullness),
        { kind: "not", predicate: { kind: "stat", stat: "sequence", comparison: "gte", value: constant(6) } },
      ],
      operations: [{ kind: "change-form", stateId: "Baseline" }],
    },
  ],
};

const blessing: EffectDefinition = {
  id: "precise-iuno-blessing",
  label: "Blessing of the Wan Light · self",
  source: { id: "iuno-derivation", type: "resonator", label: "Derivation" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 10 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
    stacks: { kind: "shared", max: 10, initial: 0 },
    endOnSwitchOut: "affected-recipient",
  },
  rules: [
    {
      id: "iuno-blessing-amplification",
      label: "+4% All DMG Amplification per Blessing stack",
      accounting: "runtime",
      modifiers: [{ kind: "damage-amplification", stacking: "additive", valuePerStack: 4, maxStacks: 10 }],
    },
    {
      id: "iuno-s2-ten-stack-amplification",
      label: "S2 · +40% All DMG Amplification at 10 Blessing stacks",
      accounting: "runtime",
      requiredSequence: 2,
      modifiers: [{
        kind: "damage-amplification",
        stacking: "additive",
        valueExpression: {
          kind: "stack-threshold",
          threshold: 10,
          then: constant(40),
          otherwise: constant(0),
        },
      }],
    },
  ],
  triggers: [
    {
      id: "iuno-blessing-on-intro-or-liberation",
      event: "action-end",
      predicates: [actionPredicate(IUNO.intro, IUNO.liberation)],
      operations: [
        { kind: "activate-effect", effectId: "precise-iuno-blessing" },
        { kind: "gain-stacks", effectId: "precise-iuno-blessing", amount: constant(5) },
      ],
    },
  ],
};

const waxingAscent: EffectDefinition = {
  id: "precise-iuno-waxing-ascent",
  label: "Waxing Ascent · personal Shield events",
  source: { id: "iuno-waxing-ascent", type: "resonator", label: "Waxing Ascent" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [],
  triggers: [{
    id: "iuno-waxing-ascent-shield",
    event: "action-start",
    predicates: [actionPredicate(...shieldCastIds)],
    operations: [{ kind: "emit-event", eventKind: "shield-gained", delaySeconds: 0 }],
  }],
};

const sequences: EffectDefinition = {
  id: "precise-iuno-sequences",
  label: "Iuno Resonance Chain · personal damage",
  source: { id: "iuno-chain", type: "resonance-chain", label: "Iuno Resonance Chain" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "iuno-s1-lunar-cycle-atk",
      label: "S1 · +40% ATK during Lunar Cycle",
      accounting: "runtime",
      requiredSequence: 1,
      predicates: [{ kind: "or", predicates: [formPredicate("Lunar Cycle - Half Moon"), formPredicate("Lunar Cycle - New Moon")] }],
      modifiers: [{ kind: "runtime-stat", stat: "attack", mode: "percent", stacking: "additive", value: constant(40) }],
    },
    {
      id: "iuno-s3-new-moon-amplification",
      label: "S3 · +65% Moonbow / Arc DMG Amplification during Lunar Cycle",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: moonbowAndArcIds }],
      predicates: [formPredicate("Lunar Cycle - New Moon")],
      modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 65 }],
    },
    {
      id: "iuno-s5-liberation-bonus",
      label: "S5 · +20% Resonance Liberation DMG Bonus",
      accounting: "runtime",
      requiredSequence: 5,
      selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
      modifiers: [{ kind: "damage-type-bonus", stacking: "additive", value: 20 }],
    },
    {
      id: "iuno-s6-absolute-fullness-mv",
      label: "S6 · Absolute Fullness DMG Multiplier +1600%",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: [IUNO.absoluteFullness] }],
      modifiers: [{ kind: "motion-value", mode: "additive-percent", stacking: "additive", value: constant(1600) }],
    },
  ],
  triggers: [{
    id: "iuno-s6-fullness-new-moon",
    event: "action-end",
    predicates: [actionPredicate(IUNO.absoluteFullness)],
    operations: [{ kind: "change-form", stateId: "Lunar Cycle - New Moon" }],
  }],
};

const incomingOutro: EffectDefinition = {
  id: "precise-iuno-outro-incoming-heavy",
  label: "From Gloom to Gleam · incoming Heavy amplification",
  source: { id: "iuno-outro", type: "resonator", label: "From Gloom to Gleam" },
  target: "incoming-resonator",
  teamContextRequired: true,
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 14 },
    uniqueness: "refresh-existing",
    endOnSwitchOut: "affected-recipient",
  },
  rules: [{
    id: "iuno-outro-heavy-amplification",
    label: "Incoming Resonator · +50% Heavy Attack DMG Amplification",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["heavyAttack"] }],
    modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 50 }],
  }],
  triggers: [{
    id: "iuno-outro-heavy-window",
    event: "action-end",
    predicates: [actionPredicate(IUNO.outro)],
    operations: [{ kind: "activate-effect", effectId: "precise-iuno-outro-incoming-heavy" }],
  }],
};

const teamDomain: EffectDefinition = {
  id: "precise-iuno-full-moon-domain-team",
  label: "Full Moon Domain · team recipient mechanics",
  source: { id: "iuno-full-moon-domain", type: "resonator", label: "Full Moon Domain" },
  target: "team",
  teamContextRequired: true,
  rules: [{
    id: "iuno-domain-team-blessing",
    label: "Shielded recipient in domain may gain Blessing once every 0.5s",
    accounting: "informational",
    modifiers: [],
  }],
};

const resources: readonly CombatResource[] = [
  {
    id: "sentience",
    name: "Sentience",
    cap: 100,
    semantic: "character-resource",
    notes: [
      "Intro +40; Liberation +60; Closing/Unfinished Refrain +25.",
      "The reviewed scenarios consume 50 at the end of a full enhanced Moonbow three-chain and up to 25 per enhanced Arc. This checkpoint model avoids inventing a per-hit Sentience split.",
    ],
  },
];

const combatEffect = (definition: EffectDefinition): CombatEffect => ({
  id: definition.id,
  name: definition.label,
  sourceId: definition.source.id,
  trigger: definition.triggers?.map((trigger) => trigger.event).join(" / ") ?? "passive",
  target: definition.target === "team" || definition.target === "other-team-members" ? definition.target : "self",
  effect: definition.label,
  source,
  structuredEffect: definition,
});

export function applyPreciseIunoMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "iuno" || !resonator.combat) return resonator;
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      forms: ["Baseline", "Lunar Cycle - Half Moon", "Lunar Cycle - New Moon"],
      defaultForm: "Baseline",
      resources,
      actions: applyPreciseIunoActionPatches(resonator.combat.actions),
      effects: [
        ...resonator.combat.effects,
        combatEffect(sentience),
        combatEffect(lunarCycle),
        combatEffect(blessing),
        combatEffect(waxingAscent),
        combatEffect(sequences),
        combatEffect(incomingOutro),
        combatEffect(teamDomain),
      ],
      unknowns: [
        ...resonator.combat.unknowns,
        "Hybrid/Sub-DPS has multiple reviewed recipes (with/without Augusta and with/without Absolute Fullness). No exact public total duration is promoted until a sourced total is available.",
        "S6 changes the optimal Main-DPS recipe substantially. S6 mechanics are structured, but the ordinary S0-S5 reference recipe must not be presented as an exact S6 rotation.",
      ],
    },
  };
}

const weaponPermanent: EffectDefinition = {
  id: "precise-moongazer-permanent",
  label: "Moongazer's Sigil · ATK",
  source: { id: "precise-iuno-signature", type: "weapon", label: "Moongazer's Sigil" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "moongazer-atk",
    label: "R1-R5 · +12/15/18/21/24% ATK",
    accounting: "already-in-final-stats",
    modifiers: [{ kind: "runtime-stat", stat: "attack", mode: "percent", stacking: "additive", value: rank([12, 15, 18, 21, 24]) }],
  }],
};

const weaponLiberationBonus: EffectDefinition = {
  id: "precise-moongazer-liberation-window",
  label: "Moongazer's Sigil · Liberation DMG window",
  source: { id: "precise-iuno-signature", type: "weapon", label: "Moongazer's Sigil" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 15 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
  rules: [{
    id: "moongazer-liberation-bonus",
    label: "Intro/Liberation · +20/25/30/35/40% Resonance Liberation DMG Bonus",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
    modifiers: [{ kind: "damage-type-bonus", stacking: "additive", valueExpression: rank([20, 25, 30, 35, 40]) }],
  }],
  triggers: [{
    id: "moongazer-liberation-window-trigger",
    event: "action-end",
    predicates: [actionPredicate(IUNO.intro, IUNO.liberation)],
    operations: [{ kind: "activate-effect", effectId: "precise-moongazer-liberation-window" }],
  }],
};

const weaponIntroMax: EffectDefinition = {
  id: "precise-moongazer-intro-max-def-ignore",
  label: "Moongazer's Sigil · Intro max DEF Ignore",
  source: { id: "precise-iuno-signature", type: "weapon", label: "Moongazer's Sigil" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 3 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
  rules: [{
    id: "moongazer-intro-max-def-ignore",
    label: "Intro · immediate 5 stacks for 3s",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
    modifiers: [{ kind: "defense-ignore", stacking: "additive", valueExpression: rank([0.36, 0.42, 0.48, 0.54, 0.60]) }],
  }],
  triggers: [{
    id: "moongazer-intro-max-trigger",
    event: "action-end",
    predicates: [actionPredicate(IUNO.intro)],
    operations: [{ kind: "activate-effect", effectId: "precise-moongazer-intro-max-def-ignore" }],
  }],
};

const weaponShieldStacks: EffectDefinition = {
  id: "precise-moongazer-shield-def-ignore",
  label: "Moongazer's Sigil · Shield DEF Ignore stacks",
  source: { id: "precise-iuno-signature", type: "weapon", label: "Moongazer's Sigil" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 7 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
    stacks: { kind: "shared", max: 5, initial: 0 },
  },
  rules: [{
    id: "moongazer-shield-stack-def-ignore",
    label: "Shield gained · 7.2/8.4/9.6/10.8/12% DEF Ignore per stack, max 5",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
    predicates: [{ kind: "not", predicate: { kind: "has-effect", id: "precise-moongazer-intro-max-def-ignore" } }],
    modifiers: [{
      kind: "defense-ignore",
      stacking: "additive",
      valueExpression: {
        kind: "multiply",
        values: [{ kind: "stacks" }, rank([0.072, 0.084, 0.096, 0.108, 0.12])],
      },
    }],
  }],
  triggers: [{
    id: "moongazer-shield-stack-trigger",
    event: "shield-gained",
    cooldown: { seconds: 0.5, scope: "owner" },
    operations: [
      { kind: "activate-effect", effectId: "precise-moongazer-shield-def-ignore" },
      { kind: "gain-stacks", effectId: "precise-moongazer-shield-def-ignore", amount: constant(1) },
    ],
  }],
};

const weaponEffect = (definition: EffectDefinition): CombatEffect => ({
  id: definition.id,
  name: definition.label,
  sourceId: definition.source.id,
  trigger: definition.triggers?.map((trigger) => trigger.event).join(" / ") ?? "permanent",
  target: "self",
  effect: definition.label,
  source,
  structuredEffect: definition,
});

export function applyPreciseIunoWeaponMechanics(resonatorId: string, weapon: Weapon): Weapon {
  if (resonatorId !== "iuno") return weapon;
  return {
    ...weapon,
    level90Stats: {
      ...weapon.level90Stats!,
      baseAttack: 500,
      displayBaseAttack: 500,
      critRate: 36,
    },
    effects: [
      ...(weapon.effects ?? []),
      weaponEffect(weaponPermanent),
      weaponEffect(weaponLiberationBonus),
      weaponEffect(weaponIntroMax),
      weaponEffect(weaponShieldStacks),
    ],
    passiveDescription:
      "R1-R5 structuré: ATK permanent reste upstream dans finalStats; Intro/Liberation ouvre le bonus Liberation 15s; Intro donne immédiatement le DEF Ignore maximal 3s; les vrais événements de bouclier maintiennent ensuite les stacks 7s avec ICD 0.5s.",
  };
}
