import type { CombatPredicate, EffectDefinition, ValueExpression } from "@/domain/effect-models";
import type { CombatEffect, Resonator, Weapon } from "@/domain/models";
import { QIUYUAN_MANUAL, QIUYUAN_NATIVE } from "./precise-dps-qiuyuan-core";

const constant = (value: number): ValueExpression => ({ kind: "constant", value });
const rank = (values: readonly number[]): ValueExpression => ({
  kind: "rank",
  values: Object.fromEntries(values.map((value, index) => [index + 1, value])),
});
const stacks = (): ValueExpression => ({ kind: "stacks" });
const actionPredicate = (...ids: readonly string[]): CombatPredicate => ({
  kind: "identity",
  field: "actionId",
  anyOf: ids,
});
const sequenceAtLeast = (value: number): CombatPredicate => ({
  kind: "state-active",
  id: `sequence-at-least-${value}`,
});
const hasEffect = (id: string): CombatPredicate => ({ kind: "has-effect", id });
const and = (...predicates: readonly CombatPredicate[]): CombatPredicate => ({
  kind: "and",
  predicates,
});

const forteHeavies = [QIUYUAN_NATIVE.teach, QIUYUAN_NATIVE.save, QIUYUAN_NATIVE.sacrifice] as const;
const basicActions = [
  "precise-qiuyuan-attr-1308001",
  "precise-qiuyuan-attr-1308002",
  "precise-qiuyuan-attr-1308003",
  "precise-qiuyuan-attr-1308004",
  "precise-qiuyuan-attr-1308006",
  "precise-qiuyuan-attr-1308008",
] as const;

const source = {
  kind: "multi-source-verified" as const,
  source: "WUWA GameDatabase / Wuthering Waves Wiki / Prydwen · Qiuyuan kit",
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

const stateMachine: EffectDefinition = {
  id: "precise-qiuyuan-state-machine",
  label: "Qiuyuan · Swordster's Soliloquy / Inksplash of Mind",
  source: { id: "qiuyuan-forte", type: "resonator", label: "Verdant Edge" },
  target: "self",
  rules: [],
  triggers: [
    {
      id: "qiuyuan-enter-inksplash",
      event: "action-end",
      predicates: [actionPredicate(QIUYUAN_NATIVE.inkwash4)],
      operations: [{ kind: "change-form", stateId: "Inksplash of Mind" }],
    },
    {
      id: "qiuyuan-exit-inksplash",
      event: "action-end",
      predicates: [actionPredicate(QIUYUAN_NATIVE.sacrifice)],
      operations: [
        { kind: "change-form", stateId: "Baseline" },
        { kind: "resource", operation: "consume-all", resourceId: "swordsters-soliloquy" },
      ],
    },
    {
      id: "qiuyuan-s6-exit-damage",
      event: "action-end",
      predicates: [and(actionPredicate(QIUYUAN_NATIVE.sacrifice), sequenceAtLeast(6))],
      operations: [{
        kind: "emit-action",
        action: {
          actionId: QIUYUAN_MANUAL.s6Exit,
          attribution: "follow-up",
          delaySeconds: 0.0001,
          snapshot: { stats: "trigger", stacks: "trigger" },
        },
      }],
    },
  ],
};

const quietude: EffectDefinition = {
  id: "precise-qiuyuan-quietude-within",
  label: "Quietude Within",
  source: { id: "qiuyuan-quietude", type: "resonator", label: "Quietude Within" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 10 },
    refresh: "no-refresh",
    uniqueness: "refresh-existing",
    endOnSwitchOut: "owner",
  },
  rules: [{
    id: "qiuyuan-quietude-forte-heavy-damage",
    label: "To Teach / To Save / To Sacrifice deal +50% DMG",
    accounting: "runtime",
    selectors: [{ kind: "action-id", anyOf: forteHeavies }],
    modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 50 }],
  }],
  triggers: [
    {
      id: "qiuyuan-quietude-first-inksplash",
      event: "action-end",
      predicates: [actionPredicate(QIUYUAN_NATIVE.inkwash4)],
      maxTriggers: 1,
      triggerCountScope: "instance",
      operations: [{ kind: "activate-effect", effectId: "precise-qiuyuan-quietude-within" }],
    },
    {
      id: "qiuyuan-straw-removes-quietude",
      event: "action-start",
      predicates: [actionPredicate(QIUYUAN_MANUAL.strawCape)],
      operations: [{ kind: "expire-effect", effectId: "precise-qiuyuan-quietude-within" }],
    },
  ],
};

const bambooShade: EffectDefinition = {
  id: "precise-qiuyuan-bamboos-shade-self",
  label: "Bamboo's Shade · personal Echo Skill DMG",
  source: { id: "qiuyuan-bamboo-shade", type: "resonator", label: "Bamboo's Shade" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "qiuyuan-bamboo-shade-echo-bonus",
      label: "+30% Echo Skill DMG Bonus for 30s at 400 Swordster's Soliloquy",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["echoSkill"] }],
      modifiers: [{ kind: "damage-type-bonus", stacking: "additive", value: 30 }],
    },
    {
      id: "qiuyuan-s2-bamboo-shade-amplification",
      label: "S2 · +30% Echo Skill DMG Amplification while Bamboo's Shade is active",
      accounting: "runtime",
      requiredSequence: 2,
      selectors: [{ kind: "damage-type", anyOf: ["echoSkill"] }],
      modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 30 }],
    },
  ],
  triggers: [
    {
      id: "qiuyuan-bamboo-shade-on-intro-400",
      event: "action-end",
      predicates: [actionPredicate(QIUYUAN_MANUAL.intro)],
      operations: [{ kind: "activate-effect", effectId: "precise-qiuyuan-bamboos-shade-self" }],
    },
    {
      id: "qiuyuan-bamboo-shade-on-straw-400",
      event: "action-end",
      predicates: [actionPredicate(QIUYUAN_MANUAL.strawCape)],
      operations: [{ kind: "activate-effect", effectId: "precise-qiuyuan-bamboos-shade-self" }],
    },
  ],
};

const liberationCritDamage: EffectDefinition = {
  id: "precise-qiuyuan-sundering-strike-crit-dmg",
  label: "Sundering Strike · excess Crit Rate → Crit DMG",
  source: { id: "qiuyuan-liberation", type: "resonator", label: "Sundering Strike" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "qiuyuan-liberation-crit-dmg-formula",
    label: "Each 1% Crit Rate above 50% grants +2% Crit DMG, capped at +30%",
    accounting: "runtime",
    modifiers: [{
      kind: "runtime-stat",
      stat: "critDamage",
      mode: "flat",
      stacking: "additive",
      value: {
        kind: "clamp",
        min: 0,
        max: 30,
        value: {
          kind: "multiply",
          values: [
            { kind: "subtract", left: { kind: "stat", stat: "critRate", view: "effective" }, right: constant(50) },
            constant(2),
          ],
        },
      },
    }],
  }],
  triggers: [{
    id: "qiuyuan-liberation-crit-dmg-on-cast",
    event: "action-end",
    predicates: [actionPredicate(QIUYUAN_NATIVE.liberation)],
    operations: [{ kind: "activate-effect", effectId: "precise-qiuyuan-sundering-strike-crit-dmg" }],
  }],
};

const flowingPanacea: EffectDefinition = {
  id: "precise-qiuyuan-flowing-panacea",
  label: "Flowing Panacea",
  source: { id: "qiuyuan-panacea", type: "resonator", label: "Drink Away Woes Age-Old" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "refresh-existing" },
  rules: [],
  triggers: [
    {
      id: "qiuyuan-panacea-on-forte-echo-cast",
      event: "action-end",
      predicates: [actionPredicate(...forteHeavies)],
      operations: [{ kind: "activate-effect", effectId: "precise-qiuyuan-flowing-panacea" }],
    },
    {
      id: "qiuyuan-panacea-consumed-by-straw-resource-gain",
      event: "action-end",
      predicates: [and(actionPredicate(QIUYUAN_MANUAL.strawCape), hasEffect("precise-qiuyuan-flowing-panacea"))],
      operations: [
        { kind: "expire-effect", effectId: "precise-qiuyuan-flowing-panacea" },
        { kind: "activate-effect", effectId: "precise-qiuyuan-panacea-atk" },
      ],
    },
  ],
};

const flowingPanaceaAtk: EffectDefinition = {
  id: "precise-qiuyuan-panacea-atk",
  label: "Drink Away Woes Age-Old · +10% ATK",
  source: { id: "qiuyuan-panacea", type: "resonator", label: "Drink Away Woes Age-Old" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 20 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "qiuyuan-panacea-atk-rule",
    label: "+10% ATK for 20s after the next Swordster's Soliloquy gain",
    accounting: "runtime",
    modifiers: [{
      kind: "runtime-stat",
      stat: "attack",
      mode: "percent",
      stacking: "additive",
      value: constant(10),
    }],
  }],
};

const sequencePassives: EffectDefinition = {
  id: "precise-qiuyuan-sequence-passives",
  label: "Qiuyuan Resonance Chain · personal damage",
  source: { id: "qiuyuan-chain", type: "resonance-chain", label: "Qiuyuan Resonance Chain" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "qiuyuan-s1-crit-rate",
      label: "S1 · +20% Crit Rate",
      accounting: "runtime",
      requiredSequence: 1,
      modifiers: [{
        kind: "runtime-stat",
        stat: "critRate",
        mode: "flat",
        stacking: "additive",
        value: constant(20),
      }],
    },
    {
      id: "qiuyuan-s3-liberation-multiplier",
      label: "S3 · Sundering Strike multiplier +500%",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: [QIUYUAN_NATIVE.liberation] }],
      modifiers: [{
        kind: "motion-value",
        mode: "relative-additive",
        stacking: "additive",
        value: constant(500),
      }],
    },
    {
      id: "qiuyuan-s4-atk",
      label: "S4 · +20% ATK",
      accounting: "runtime",
      requiredSequence: 4,
      modifiers: [{
        kind: "runtime-stat",
        stat: "attack",
        mode: "percent",
        stacking: "additive",
        value: constant(20),
      }],
    },
    {
      id: "qiuyuan-s5-defense-ignore",
      label: "S5 · ignore 15% target DEF",
      accounting: "runtime",
      requiredSequence: 5,
      modifiers: [{ kind: "defense-ignore", stacking: "additive", value: 15 }],
    },
  ],
};

const secondForteCycle: EffectDefinition = {
  id: "precise-qiuyuan-s3-second-forte-cycle",
  label: "S3 · Straw Cape second Forte cycle",
  source: { id: "qiuyuan-s3", type: "resonance-chain", label: "Qiuyuan S3" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "refresh-existing" },
  rules: [{
    id: "qiuyuan-s3-second-cycle-forte-multiplier",
    label: "S3 · second To Teach / Save / Sacrifice cycle gains +600% DMG Multiplier",
    accounting: "runtime",
    requiredSequence: 3,
    selectors: [{ kind: "action-id", anyOf: forteHeavies }],
    modifiers: [{
      kind: "motion-value",
      mode: "relative-additive",
      stacking: "additive",
      value: constant(600),
    }],
  }],
  triggers: [
    {
      id: "qiuyuan-s3-second-cycle-on-straw",
      event: "action-end",
      predicates: [and(actionPredicate(QIUYUAN_MANUAL.strawCape), sequenceAtLeast(3))],
      operations: [{ kind: "activate-effect", effectId: "precise-qiuyuan-s3-second-forte-cycle" }],
    },
    {
      id: "qiuyuan-s3-second-cycle-end",
      event: "action-end",
      predicates: [and(actionPredicate(QIUYUAN_NATIVE.sacrifice), hasEffect("precise-qiuyuan-s3-second-forte-cycle"))],
      operations: [{ kind: "expire-effect", effectId: "precise-qiuyuan-s3-second-forte-cycle" }],
    },
  ],
};

const s6StrawCritDamage: EffectDefinition = {
  id: "precise-qiuyuan-s6-straw-crit-dmg",
  label: "S6 · Straw Cape Crit DMG",
  source: { id: "qiuyuan-s6", type: "resonance-chain", label: "Qiuyuan S6" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 6 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
    endOnSwitchOut: "owner",
  },
  rules: [{
    id: "qiuyuan-s6-straw-crit-dmg-rule",
    label: "S6 · +100% Crit DMG for 6s after Straw Cape",
    accounting: "runtime",
    requiredSequence: 6,
    modifiers: [{
      kind: "runtime-stat",
      stat: "critDamage",
      mode: "flat",
      stacking: "additive",
      value: constant(100),
    }],
  }],
  triggers: [{
    id: "qiuyuan-s6-straw-crit-dmg-trigger",
    event: "action-end",
    predicates: [and(actionPredicate(QIUYUAN_MANUAL.strawCape), sequenceAtLeast(6))],
    operations: [{ kind: "activate-effect", effectId: "precise-qiuyuan-s6-straw-crit-dmg" }],
  }],
};

const teamCyclePending: EffectDefinition = {
  id: "precise-qiuyuan-team-cycle-pending",
  label: "Qiuyuan · team-only Bamboo / Outro mechanics require Team Cycle",
  source: { id: "qiuyuan-team-cycle", type: "resonator", label: "Qiuyuan team mechanics" },
  target: "team",
  teamContextRequired: true,
  rules: [
    {
      id: "qiuyuan-bamboo-team-pending",
      label: "Bamboo's Shade grants the active team Echo Skill DMG Bonus; S2 adds team Echo Skill amplification.",
      accounting: "informational",
      modifiers: [],
    },
    {
      id: "qiuyuan-liberation-team-crit-dmg-pending",
      label: "Sundering Strike's excess-Crit conversion also buffs other active Resonators.",
      accounting: "informational",
      modifiers: [],
    },
    {
      id: "qiuyuan-outro-incoming-amplification-pending",
      label: "Strike Before Ready amplifies the incoming Resonator's Echo Skill DMG; the S3 replacement Outro also requires the switch timeline.",
      accounting: "informational",
      modifiers: [],
    },
    {
      id: "qiuyuan-s6-stagnation-pending",
      label: "S6 To Sacrifice stagnation/control has no personal DPS shortcut and remains non-damage state logic.",
      accounting: "informational",
      modifiers: [],
    },
  ],
};

export function applyPreciseQiuyuanMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "qiuyuan" || !resonator.combat) return resonator;
  const effects: readonly CombatEffect[] = [
    combatEffect("qiuyuan-state", "Qiuyuan state machine", "Forte resource / Inksplash", stateMachine),
    combatEffect("qiuyuan-quietude", "Quietude Within", "first Inksplash", quietude),
    combatEffect("qiuyuan-bamboo", "Bamboo's Shade", "400 Swordster's Soliloquy", bambooShade),
    combatEffect("qiuyuan-liberation-crit", "Sundering Strike Crit conversion", "Liberation", liberationCritDamage),
    combatEffect("qiuyuan-panacea", "Flowing Panacea", "Echo Skill cast → next resource gain", flowingPanacea),
    combatEffect("qiuyuan-panacea-atk", "Flowing Panacea ATK", "resource gain", flowingPanaceaAtk),
    combatEffect("qiuyuan-sequences", "Qiuyuan sequence passives", "sequence", sequencePassives),
    combatEffect("qiuyuan-s3-cycle", "Qiuyuan S3 second Forte cycle", "Straw Cape", secondForteCycle),
    combatEffect("qiuyuan-s6-crit", "Qiuyuan S6 Straw Crit DMG", "Straw Cape", s6StrawCritDamage),
    combatEffect("qiuyuan-team-pending", "Qiuyuan Team Cycle dependencies", "team cycle", teamCyclePending),
  ];

  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      effects: [...resonator.combat.effects, ...effects],
      unknowns: [
        ...resonator.combat.unknowns,
        "Partiel: public kit text does not publish a per-cast Swordster's Soliloquy cost for To Teach / To Save / To Sacrifice. The exact scenario keeps the full gauge during the chain and clears it only when Inksplash ends; no synthetic 200/200/200 split is used.",
        "Partiel: S3 Straw Cape requires full Concerto Energy. The precise scenario owns that eligibility, but personal DPS does not synthesize missing Concerto routing.",
        "Partiel: team recipients of Bamboo's Shade, Sundering Strike and Outro amplification require Team Cycle.",
      ],
    },
  };
}

const weaponSource = {
  kind: "multi-source-verified" as const,
  source: "WUWA GameDatabase / current community references · Emerald Sentence",
  gameVersion: "3.5",
  verifiedAt: "2026-08-19",
};

const emeraldPermanent: EffectDefinition = {
  id: "precise-emerald-sentence-permanent",
  label: "Emerald Sentence · permanent ATK",
  source: { id: "precise-qiuyuan-signature", type: "weapon", label: "Emerald Sentence" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "emerald-sentence-atk",
    label: "R1–R5 · +12/15/18/21/24% ATK",
    accounting: "already-in-final-stats",
    modifiers: [{
      kind: "runtime-stat",
      stat: "attack",
      mode: "percent",
      stacking: "additive",
      value: rank([12, 15, 18, 21, 24]),
    }],
  }],
};

const emeraldEligibility: EffectDefinition = {
  id: "precise-emerald-sentence-eligibility",
  label: "Emerald Sentence · Intro/Basic 10s eligibility",
  source: { id: "precise-qiuyuan-signature", type: "weapon", label: "Emerald Sentence" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 10 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [],
  triggers: [
    {
      id: "emerald-eligibility-intro",
      event: "action-start",
      predicates: [actionPredicate(QIUYUAN_MANUAL.intro)],
      operations: [{ kind: "activate-effect", effectId: "precise-emerald-sentence-eligibility" }],
    },
    {
      id: "emerald-eligibility-basic",
      event: "action-start",
      predicates: [actionPredicate(...basicActions)],
      operations: [{ kind: "activate-effect", effectId: "precise-emerald-sentence-eligibility" }],
    },
  ],
};

const emeraldBambooCleaver: EffectDefinition = {
  id: "precise-emerald-sentence-bamboo-cleaver",
  label: "Emerald Sentence · Bamboo Cleaver",
  source: { id: "precise-qiuyuan-signature", type: "weapon", label: "Emerald Sentence" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 12 },
    refresh: "no-reset-at-max-stacks",
    uniqueness: "refresh-existing",
    stacks: { kind: "shared", max: 2, initial: 0 },
  },
  rules: [{
    id: "emerald-bamboo-cleaver-heavy-bonus",
    label: "R1–R5 · +30/37.5/45/52.5/60% Heavy Attack DMG per stack, max 2",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["heavyAttack"] }],
    modifiers: [{
      kind: "damage-type-bonus",
      stacking: "additive",
      valueExpression: { kind: "multiply", values: [stacks(), rank([30, 37.5, 45, 52.5, 60])] },
    }],
  }],
  triggers: [{
    id: "emerald-bamboo-cleaver-on-echo-cast",
    event: "action-start",
    predicates: [and(actionPredicate(...forteHeavies), hasEffect("precise-emerald-sentence-eligibility"))],
    cooldown: { seconds: 10, scope: "action" },
    operations: [
      { kind: "activate-effect", effectId: "precise-emerald-sentence-bamboo-cleaver" },
      { kind: "gain-stacks", effectId: "precise-emerald-sentence-bamboo-cleaver", amount: constant(1) },
    ],
  }],
};

const emeraldIntroEchoBonus: EffectDefinition = {
  id: "precise-emerald-sentence-intro-echo-bonus",
  label: "Emerald Sentence · Intro team Echo Skill DMG Bonus",
  source: { id: "precise-qiuyuan-signature", type: "weapon", label: "Emerald Sentence" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [{
    id: "emerald-intro-echo-bonus-self",
    label: "R1–R5 · +20/25/30/35/40% Echo Skill DMG Bonus for 30s after Intro",
    accounting: "runtime",
    selectors: [{ kind: "damage-type", anyOf: ["echoSkill"] }],
    modifiers: [{
      kind: "damage-type-bonus",
      stacking: "additive",
      valueExpression: rank([20, 25, 30, 35, 40]),
    }],
  }],
  triggers: [{
    id: "emerald-intro-echo-bonus-trigger",
    event: "action-start",
    predicates: [actionPredicate(QIUYUAN_MANUAL.intro)],
    operations: [{ kind: "activate-effect", effectId: "precise-emerald-sentence-intro-echo-bonus" }],
  }],
};

const emeraldTeamPending: EffectDefinition = {
  id: "precise-emerald-sentence-team-pending",
  label: "Emerald Sentence · other team recipients",
  source: { id: "precise-qiuyuan-signature", type: "weapon", label: "Emerald Sentence" },
  target: "other-team-members",
  teamContextRequired: true,
  rules: [{
    id: "emerald-team-echo-bonus-pending",
    label: "Intro also grants the same Echo Skill DMG Bonus to nearby team members; Team Cycle owns recipients.",
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
  target: structuredEffect.target === "other-team-members" ? "other-team-members" : "self",
  effect: structuredEffect.label,
  source: weaponSource,
  structuredEffect,
});

export function applyPreciseQiuyuanWeaponMechanics(
  resonatorId: string,
  weapon: Weapon,
): Weapon {
  if (resonatorId !== "qiuyuan") return weapon;
  return {
    ...weapon,
    level90Stats: { ...weapon.level90Stats!, critRate: 24.3 },
    effects: [
      ...(weapon.effects ?? []),
      weaponEffect("emerald-permanent", "Emerald Sentence permanent ATK", "permanent", emeraldPermanent),
      weaponEffect("emerald-eligibility", "Emerald Sentence eligibility", "Intro / Basic", emeraldEligibility),
      weaponEffect("emerald-cleaver", "Bamboo Cleaver", "Echo Skill within 10s", emeraldBambooCleaver),
      weaponEffect("emerald-intro", "Emerald Sentence Intro Echo bonus", "Intro", emeraldIntroEchoBonus),
      weaponEffect("emerald-team", "Emerald Sentence team recipients", "team cycle", emeraldTeamPending),
    ],
    passiveDescription: "Partiel · Emerald Sentence R1–R5 structuré: ATK permanent upstream, Bamboo Cleaver 2 stacks Heavy DMG, et Intro Echo Skill bonus runtime. Les autres destinataires d'équipe restent Team Cycle-owned.",
  };
}
