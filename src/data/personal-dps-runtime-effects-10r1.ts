import type { EffectDefinition, ValueExpression } from "@/domain/effect-models";
import type { CombatAction, UserBuild } from "@/domain/models";
import { personalDpsRuntimeIdentities10R1 } from "./personal-dps-runtime-identities-10r1";

const c = (value: number): ValueExpression => ({ kind: "constant", value });
const rank = (values: Readonly<Record<number, number>>): ValueExpression => ({
  kind: "rank",
  values,
});
const stacksTimes = (value: ValueExpression): ValueExpression => ({
  kind: "multiply",
  values: [{ kind: "stacks" }, value],
});
const actionIs = (...ids: string[]) => ({
  kind: "identity" as const,
  field: "actionId" as const,
  anyOf: ids,
});
const source = (
  id: string,
  type: EffectDefinition["source"]["type"],
  label: string,
): EffectDefinition["source"] => ({ id, type, label });

const calcharoS2: EffectDefinition = {
  id: "calcharo-s2-skill-window",
  label: "Calcharo S2 · Zero-Sum Game",
  source: source("calcharo-s2", "resonance-chain", "Calcharo S2"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 15 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "calcharo-s2-skill-dmg",
      label: "+30% Resonance Skill DMG after Outro",
      accounting: "runtime",
      modifiers: [
        { kind: "damage-type-bonus", stacking: "additive", value: 30 },
      ],
      selectors: [{ kind: "damage-type", anyOf: ["resonanceSkill"] }],
    },
  ],
  triggers: [
    {
      id: "calcharo-s2-after-outro",
      event: "action-end",
      predicates: [actionIs("calcharo-shadowy-raid")],
      operations: [{ kind: "activate-effect", effectId: "calcharo-s2-skill-window" }],
    },
  ],
};

const calcharoSequences: EffectDefinition = {
  id: "calcharo-sequence-damage",
  label: "Calcharo · Resonance Chain damage rules",
  source: source("calcharo", "resonance-chain", "Calcharo Resonance Chain"),
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" } },
  rules: [
    {
      id: "calcharo-s3-death-messenger-electro",
      label: "S3 · Death Messenger +25% Electro DMG",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: ["calcharo-death-messenger"] }],
      modifiers: [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 25 },
      ],
    },
    {
      id: "calcharo-s5-intro-damage",
      label: "S5 · Wanted Outlaw +50% DMG",
      accounting: "runtime",
      requiredSequence: 5,
      selectors: [{ kind: "action-id", anyOf: ["calcharo-wanted-outlaw"] }],
      modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 50 }],
    },
  ],
};

const calcharoS6PhantomAction: CombatAction = {
  id: "calcharo-s6-phantom",
  name: "Calcharo S6 · Death Messenger Phantom",
  talent: "forteCircuit",
  damageType: "resonanceLiberation",
  level: 10,
  multipliers: [{ percent: 100, hits: 1 }],
  castDurationSeconds: { value: null, confidence: "unknown" },
  recoverySeconds: { value: null, confidence: "unknown" },
  hitTimingsSeconds: { value: null, confidence: "unknown" },
  source: {
    kind: "multi-source-verified",
    source: "WutheringTools pinned Calcharo Resonance Chain transcription",
    verifiedAt: "2026-08-19",
  },
};

const calcharoS6: EffectDefinition = {
  id: "calcharo-s6-phantoms",
  label: "Calcharo S6 · Death Messenger Phantoms",
  source: source("calcharo-s6", "resonance-chain", "Calcharo S6"),
  target: "self",
  rules: [],
  triggers: [
    {
      id: "calcharo-s6-after-death-messenger",
      event: "action-end",
      predicates: [actionIs("calcharo-death-messenger")],
      operations: [
        {
          kind: "emit-action",
          action: {
            actionId: calcharoS6PhantomAction.id,
            attribution: "summon",
            snapshot: { stats: "hit", stacks: "tick" },
          },
        },
        {
          kind: "emit-action",
          action: {
            actionId: calcharoS6PhantomAction.id,
            attribution: "summon",
            snapshot: { stats: "hit", stacks: "tick" },
          },
        },
      ],
    },
  ],
};

const lustrousRazor: EffectDefinition = {
  id: "weapon-lustrous-razor-runtime",
  label: "Lustrous Razor · Incision",
  source: source("lustrous-razor", "weapon", "Lustrous Razor"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 12 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
    stacks: { kind: "shared", max: 3, initial: 0 },
  },
  rules: [
    {
      id: "lustrous-razor-liberation-stacks",
      label: "Liberation DMG per Incision stack",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
      modifiers: [
        {
          kind: "damage-type-bonus",
          stacking: "additive",
          valueExpression: stacksTimes(
            rank({ 1: 7, 2: 8.75, 3: 10.5, 4: 12.25, 5: 14 }),
          ),
        },
      ],
    },
  ],
  triggers: [
    {
      id: "lustrous-razor-skill-cast",
      event: "action-start",
      predicates: [
        actionIs("calcharo-extermination-order-1", "calcharo-extermination-order-2"),
      ],
      operations: [
        { kind: "activate-effect", effectId: "weapon-lustrous-razor-runtime" },
        { kind: "gain-stacks", effectId: "weapon-lustrous-razor-runtime", amount: c(1) },
      ],
    },
  ],
};

const voidThunder: EffectDefinition = {
  id: "sonata-void-thunder-5pc-runtime",
  label: "Void Thunder · 5-piece",
  source: source("void-thunder", "sonata", "Void Thunder"),
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: {
    duration: { kind: "fixed", seconds: 15 },
    stacks: { kind: "independent-expirations", max: 2, initial: 0 },
  },
  rules: [
    {
      id: "void-thunder-electro-stacks",
      label: "+15% Electro DMG per stack",
      accounting: "runtime",
      modifiers: [
        {
          kind: "elemental-damage-bonus",
          stacking: "additive",
          valuePerStack: 15,
          maxStacks: 2,
        },
      ],
    },
  ],
  triggers: [
    {
      id: "void-thunder-skill",
      event: "action-start",
      predicates: [
        actionIs("calcharo-extermination-order-1", "calcharo-extermination-order-2"),
      ],
      operations: [
        { kind: "gain-stacks", effectId: "sonata-void-thunder-5pc-runtime", amount: c(1) },
      ],
    },
  ],
};

const changliInherents: EffectDefinition = {
  id: "changli-inherent-damage-rules",
  label: "Changli · Inherent Skills",
  source: source("changli", "resonator", "Changli"),
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" } },
  rules: [
    {
      id: "changli-secret-strategist",
      label: "Secret Strategist · +5% Fusion per Enflamement",
      accounting: "runtime",
      selectors: [
        {
          kind: "action-id",
          anyOf: ["changli-true-sight-charge", "changli-true-sight-conquest"],
        },
      ],
      modifiers: [
        {
          kind: "elemental-damage-bonus",
          stacking: "additive",
          valueExpression: {
            kind: "multiply",
            values: [
              { kind: "resource", resourceId: "enflamement" },
              c(5),
            ],
          },
        },
      ],
    },
    {
      id: "changli-sweeping-force-fusion",
      label: "Sweeping Force · +20% Fusion",
      accounting: "runtime",
      selectors: [
        {
          kind: "action-id",
          anyOf: ["changli-flaming-sacrifice", "changli-radiance-of-fealty"],
        },
      ],
      modifiers: [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 20 },
        { kind: "defense-ignore", stacking: "additive", value: 0.15 },
      ],
    },
  ],
};

const changliFieryFeather: EffectDefinition = {
  id: "changli-fiery-feather",
  label: "Changli · Fiery Feather",
  source: source("changli", "resonator", "Changli"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 10 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "changli-fiery-feather-atk",
      label: "+25% ATK for Flaming Sacrifice",
      accounting: "runtime",
      selectors: [{ kind: "action-id", anyOf: ["changli-flaming-sacrifice"] }],
      modifiers: [
        {
          kind: "runtime-stat",
          stat: "attack",
          mode: "percent",
          stacking: "additive",
          value: c(25),
        },
      ],
    },
  ],
  triggers: [
    {
      id: "changli-fiery-feather-gain",
      event: "action-end",
      predicates: [actionIs("changli-radiance-of-fealty")],
      operations: [{ kind: "activate-effect", effectId: "changli-fiery-feather" }],
    },
    {
      id: "changli-fiery-feather-consume",
      event: "action-end",
      predicates: [actionIs("changli-flaming-sacrifice")],
      operations: [{ kind: "expire-effect", effectId: "changli-fiery-feather" }],
    },
  ],
};

const changliS2: EffectDefinition = {
  id: "changli-s2-enflamement-crit",
  label: "Changli S2 · Pursuit of Desires",
  source: source("changli-s2", "resonance-chain", "Changli S2"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 8 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "changli-s2-crit",
      label: "+25% Crit Rate after gaining Enflamement",
      accounting: "runtime",
      modifiers: [{ kind: "crit-rate-bonus", stacking: "additive", value: 25 }],
    },
  ],
  triggers: [
    {
      id: "changli-s2-enflamement-gain",
      event: "action-end",
      predicates: [
        actionIs(
          "changli-true-sight-charge",
          "changli-true-sight-conquest",
          "changli-radiance-of-fealty",
        ),
      ],
      operations: [{ kind: "activate-effect", effectId: "changli-s2-enflamement-crit" }],
    },
  ],
};

const changliS4: EffectDefinition = {
  id: "changli-s4-team-atk",
  label: "Changli S4 · Polished Words",
  source: source("changli-s4", "resonance-chain", "Changli S4"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "changli-s4-atk",
      label: "+20% ATK after Intro",
      accounting: "runtime",
      modifiers: [
        {
          kind: "runtime-stat",
          stat: "attack",
          mode: "percent",
          stacking: "additive",
          value: c(20),
        },
      ],
    },
  ],
  triggers: [
    {
      id: "changli-s4-intro",
      event: "action-end",
      predicates: [actionIs("changli-obedience-of-rules")],
      operations: [{ kind: "activate-effect", effectId: "changli-s4-team-atk" }],
    },
  ],
};

const changliSequences: EffectDefinition = {
  id: "changli-sequence-damage",
  label: "Changli · Resonance Chain damage rules",
  source: source("changli", "resonance-chain", "Changli Resonance Chain"),
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" } },
  rules: [
    {
      id: "changli-s1-damage",
      label: "S1 · Tripartite Flames / Flaming Sacrifice +10% DMG",
      accounting: "runtime",
      requiredSequence: 1,
      selectors: [
        {
          kind: "action-id",
          anyOf: [
            "changli-true-sight-charge",
            "changli-true-sight-capture",
            "changli-true-sight-conquest",
            "changli-flaming-sacrifice",
          ],
        },
      ],
      modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 10 }],
    },
    {
      id: "changli-s3-liberation",
      label: "S3 · Radiance of Fealty +80% Liberation DMG",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: ["changli-radiance-of-fealty"] }],
      modifiers: [
        { kind: "damage-type-bonus", stacking: "additive", value: 80 },
      ],
    },
    {
      id: "changli-s5-flaming-mv",
      label: "S5 · Flaming Sacrifice multiplier +50%",
      accounting: "runtime",
      requiredSequence: 5,
      selectors: [{ kind: "action-id", anyOf: ["changli-flaming-sacrifice"] }],
      modifiers: [
        {
          kind: "motion-value",
          mode: "relative-additive",
          stacking: "additive",
          value: c(0.5),
        },
        { kind: "all-damage-bonus", stacking: "additive", value: 50 },
      ],
    },
    {
      id: "changli-s6-defense-ignore",
      label: "S6 · Skill / Flaming Sacrifice / Liberation ignore 40% DEF",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [
        {
          kind: "action-id",
          anyOf: [
            "changli-true-sight-charge",
            "changli-true-sight-capture",
            "changli-true-sight-conquest",
            "changli-flaming-sacrifice",
            "changli-radiance-of-fealty",
          ],
        },
      ],
      modifiers: [{ kind: "defense-ignore", stacking: "additive", value: 0.4 }],
    },
  ],
};

const blazingBrilliance: EffectDefinition = {
  id: "weapon-blazing-brilliance-runtime",
  label: "Blazing Brilliance · Searing Feather",
  source: source("blazing-brilliance", "weapon", "Blazing Brilliance"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "indefinite" },
    uniqueness: "refresh-existing",
    stacks: { kind: "shared", max: 14, initial: 0 },
  },
  rules: [
    {
      id: "blazing-brilliance-skill-bonus",
      label: "Resonance Skill DMG per Searing Feather",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["resonanceSkill"] }],
      modifiers: [
        {
          kind: "damage-type-bonus",
          stacking: "additive",
          valueExpression: stacksTimes(rank({ 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 })),
        },
      ],
    },
  ],
  triggers: [
    {
      id: "blazing-brilliance-damage-stack",
      event: "damage-dealt",
      operations: [
        { kind: "activate-effect", effectId: "weapon-blazing-brilliance-runtime" },
        { kind: "gain-stacks", effectId: "weapon-blazing-brilliance-runtime", amount: c(1) },
      ],
      cooldown: { seconds: 0.5, scope: "owner" },
    },
    {
      id: "blazing-brilliance-skill-stacks",
      event: "action-start",
      predicates: [
        actionIs(
          "changli-true-sight-charge",
          "changli-true-sight-capture",
          "changli-true-sight-conquest",
          "changli-flaming-sacrifice",
        ),
      ],
      operations: [
        { kind: "activate-effect", effectId: "weapon-blazing-brilliance-runtime" },
        { kind: "gain-stacks", effectId: "weapon-blazing-brilliance-runtime", amount: c(5) },
      ],
    },
  ],
};

const moltenRift: EffectDefinition = {
  id: "sonata-molten-rift-5pc-runtime",
  label: "Molten Rift · 5-piece",
  source: source("molten-rift", "sonata", "Molten Rift"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 15 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "molten-rift-fusion",
      label: "+30% Fusion DMG after Resonance Skill",
      accounting: "runtime",
      modifiers: [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 30 },
      ],
    },
  ],
  triggers: [
    {
      id: "molten-rift-skill",
      event: "action-start",
      predicates: [
        actionIs(
          "changli-true-sight-charge",
          "changli-true-sight-capture",
          "changli-true-sight-conquest",
          "changli-flaming-sacrifice",
        ),
      ],
      operations: [{ kind: "activate-effect", effectId: "sonata-molten-rift-5pc-runtime" }],
    },
  ],
};

const aemeathSequences: EffectDefinition = {
  id: "aemeath-sequence-damage",
  label: "Aemeath · Resonance Chain damage rules",
  source: source("aemeath", "resonance-chain", "Aemeath Resonance Chain"),
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" } },
  rules: [
    {
      id: "aemeath-s1-heavy-crit-dmg",
      label: "S1 · Charged Heavy +300% Crit DMG",
      accounting: "runtime",
      requiredSequence: 1,
      selectors: [{ kind: "action-id", anyOf: ["mech-heavy-2"] }],
      modifiers: [{ kind: "crit-damage-bonus", stacking: "additive", value: 300 }],
    },
    {
      id: "aemeath-s2-seraphic-overture",
      label: "S2 · Seraphic Duet Overture multiplier +100%",
      accounting: "runtime",
      requiredSequence: 2,
      selectors: [{ kind: "action-id", anyOf: ["seraphic-overture"] }],
      modifiers: [
        { kind: "motion-value", mode: "relative-additive", stacking: "additive", value: c(1) },
      ],
    },
    {
      id: "aemeath-s2-seraphic-encore",
      label: "S2 · Seraphic Duet Encore multiplier +100%",
      accounting: "runtime",
      requiredSequence: 2,
      selectors: [{ kind: "action-id", anyOf: ["seraphic-encore"] }],
      modifiers: [
        { kind: "motion-value", mode: "relative-additive", stacking: "additive", value: c(1) },
      ],
    },
    {
      id: "aemeath-s3-overdrive",
      label: "S3 · Overdrive multiplier +40%",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: ["overdrive"] }],
      modifiers: [
        { kind: "motion-value", mode: "relative-additive", stacking: "additive", value: c(0.4) },
      ],
    },
    {
      id: "aemeath-s3-finale",
      label: "S3 · Finale multiplier +100%",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: ["finale"] }],
      modifiers: [
        { kind: "motion-value", mode: "relative-additive", stacking: "additive", value: c(1) },
      ],
    },
    {
      id: "aemeath-s6-liberation-amplification",
      label: "S6 · Target takes +40% Aemeath Liberation DMG",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
      modifiers: [
        { kind: "damage-amplification", stacking: "additive", value: 40 },
      ],
    },
  ],
};

const aemeathS4: EffectDefinition = {
  id: "aemeath-s4-all-damage",
  label: "Aemeath S4 · Ethereal Waltz on Binary Tides",
  source: source("aemeath-s4", "resonance-chain", "Aemeath S4"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "aemeath-s4-all-damage-rule",
      label: "+20% All-Attribute DMG",
      accounting: "runtime",
      modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 20 }],
    },
  ],
  triggers: [
    {
      id: "aemeath-s4-cast",
      event: "action-end",
      predicates: [
        actionIs("intro-mech", "seraphic-encore", "seraphic-overture"),
      ],
      operations: [{ kind: "activate-effect", effectId: "aemeath-s4-all-damage" }],
    },
  ],
};

const aemeathTrailblazingStar: EffectDefinition = {
  id: "sonata-trailblazing-star-5pc-runtime-dps",
  label: "Trailblazing Star · 5-piece",
  source: source("trailblazing-star", "sonata", "Trailblazing Star"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 8 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "trailblazing-star-runtime-bonuses",
      label: "+20% Crit Rate / +20% Fusion DMG",
      accounting: "runtime",
      modifiers: [
        { kind: "crit-rate-bonus", stacking: "additive", value: 20 },
        { kind: "elemental-damage-bonus", stacking: "additive", value: 20 },
      ],
    },
  ],
  triggers: [
    {
      id: "trailblazing-star-seraphic-trigger",
      event: "action-start",
      predicates: [actionIs("seraphic-encore", "seraphic-overture")],
      operations: [
        { kind: "activate-effect", effectId: "sonata-trailblazing-star-5pc-runtime-dps" },
      ],
    },
  ],
};

const aemeathEverbright: EffectDefinition = {
  id: "weapon-everbright-polestar-runtime-dps",
  label: "Everbright Polestar · Polestar",
  source: source("everbright-polestar", "weapon", "Everbright Polestar"),
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 8 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "everbright-liberation-ignore",
      label: "Liberation ignores 32% DEF / 10% Fusion RES",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
      modifiers: [
        { kind: "defense-ignore", stacking: "additive", value: 0.32 },
        { kind: "resistance-ignore", stacking: "additive", value: 0.1 },
      ],
    },
  ],
  triggers: [
    {
      id: "everbright-seraphic-trigger",
      event: "action-start",
      predicates: [actionIs("seraphic-encore", "seraphic-overture")],
      operations: [
        { kind: "activate-effect", effectId: "weapon-everbright-polestar-runtime-dps" },
      ],
    },
  ],
};

function sonataCount(build: UserBuild, sonataSetId: string): number {
  return build.echoLoadout?.echoes.filter((echo) => echo.sonataSetId === sonataSetId).length ?? 0;
}

export interface PersonalDpsRuntimeBundle10R1 {
  readonly effects: readonly EffectDefinition[];
  readonly actions: readonly CombatAction[];
  readonly resources: readonly { id: string; name: string; cap: number }[];
}

export function resolvePersonalDpsRuntimeBundle10R1(
  build: UserBuild,
): PersonalDpsRuntimeBundle10R1 {
  const effects: EffectDefinition[] = [];
  const actions: CombatAction[] = [];
  const resources: { id: string; name: string; cap: number }[] = [];

  const characterEffects: Readonly<Record<string, readonly EffectDefinition[]>> = {
    aemeath: [aemeathSequences],
    calcharo: [calcharoSequences],
    changli: [changliInherents, changliFieryFeather, changliSequences],
  };
  effects.push(...(characterEffects[build.resonatorId] ?? []));

  if (build.resonatorId === "changli") {
    resources.push({ id: "enflamement", name: "Enflamement", cap: 4 });
  }

  const sequenceTriggered: Readonly<
    Record<string, readonly { sequence: number; effect: EffectDefinition }[]>
  > = {
    aemeath: [{ sequence: 4, effect: aemeathS4 }],
    calcharo: [
      { sequence: 2, effect: calcharoS2 },
      { sequence: 6, effect: calcharoS6 },
    ],
    changli: [
      { sequence: 2, effect: changliS2 },
      { sequence: 4, effect: changliS4 },
    ],
  };
  for (const entry of sequenceTriggered[build.resonatorId] ?? []) {
    if (build.sequence >= entry.sequence) effects.push(entry.effect);
  }
  if (build.resonatorId === "calcharo" && build.sequence >= 6) {
    actions.push(calcharoS6PhantomAction);
  }

  const weaponEffects: Readonly<Record<string, EffectDefinition>> = {
    "everbright-polestar": aemeathEverbright,
    "lustrous-razor": lustrousRazor,
    "blazing-brilliance": blazingBrilliance,
  };
  const weaponEffect = weaponEffects[build.weapon.weaponId];
  if (weaponEffect) effects.push(weaponEffect);

  const { sonata } = personalDpsRuntimeIdentities10R1;
  if (sonataCount(build, sonata.trailblazingStar) >= 5) {
    effects.push(aemeathTrailblazingStar);
  }
  if (sonataCount(build, sonata.voidThunder) >= 5) effects.push(voidThunder);
  if (sonataCount(build, sonata.moltenRift) >= 5) effects.push(moltenRift);

  return { effects, actions, resources };
}
