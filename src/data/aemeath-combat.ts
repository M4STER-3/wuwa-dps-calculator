import { generatedCharacterBoxRosterBaselines10R1 } from "@/generated/character-box-roster-baselines-10r1";
import { generatedCharacterBoxCombat10R1 } from "@/generated/character-box-combat-10r1";
import { generatedCommunityEchoPresets10R1 } from "@/generated/community-echo-presets-10r1";
import { applyEchoLoadoutStatsV1 } from "@/game-data/echo-loadout-stats";
import type { CombatAction, CombatEffect } from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import {
  aemeath as runtimeAemeath,
  aemeathGameSource,
  aemeathPreset as runtimeAemeathPreset,
  everbrightPolestar as runtimeEverbrightPolestar,
  sigillum as runtimeSigillum,
  trailblazingStar as runtimeTrailblazingStar,
} from "./aemeath-runtime";

const source = {
  id: "aemeath-between-stars",
  type: "resonator" as const,
  label: "Between the Stars",
  metadata: aemeathGameSource,
};

const betweenStarsPersonal: EffectDefinition = {
  id: "aemeath-between-stars-personal-runtime",
  label: "Between the Stars · personal contribution",
  source,
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "indefinite" },
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "between-stars-tune-own-contributor",
      label: "Tune Rupture · own contributor +20% Crit DMG",
      accounting: "runtime",
      selectors: [{ kind: "resonance-mode", anyOf: ["tune-rupture"] }],
      modifiers: [
        { kind: "crit-damage-bonus", stacking: "highest", value: 20 },
      ],
    },
    {
      id: "between-stars-fusion-own-contributor",
      label: "Fusion Burst · own contributor +30% Crit DMG",
      accounting: "runtime",
      selectors: [{ kind: "resonance-mode", anyOf: ["fusion-burst"] }],
      modifiers: [
        { kind: "crit-damage-bonus", stacking: "highest", value: 30 },
      ],
    },
    {
      id: "between-stars-s3-replacement",
      label: "S3 replacement · +60% Crit DMG",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [
        { kind: "resonance-mode", anyOf: ["tune-rupture", "fusion-burst"] },
      ],
      modifiers: [
        { kind: "crit-damage-bonus", stacking: "highest", value: 60 },
      ],
    },
    {
      id: "between-stars-s3-finale",
      label: "S3 replacement · Finale +25% DMG Amplification",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [
        { kind: "action-id", anyOf: ["finale"] },
        { kind: "resonance-mode", anyOf: ["tune-rupture", "fusion-burst"] },
      ],
      modifiers: [
        { kind: "damage-amplification", stacking: "additive", value: 25 },
      ],
    },
  ],
  triggers: [
    {
      id: "between-stars-own-tune-contribution",
      event: "tune-rupture",
      operations: [
        { kind: "activate-effect", effectId: "aemeath-between-stars-personal-runtime" },
      ],
    },
    {
      id: "between-stars-own-fusion-contribution",
      event: "fusion-burst",
      operations: [
        { kind: "activate-effect", effectId: "aemeath-between-stars-personal-runtime" },
      ],
    },
  ],
};

const betweenStarsLegacy: CombatEffect = {
  id: betweenStarsPersonal.id,
  name: betweenStarsPersonal.label,
  sourceId: source.id,
  trigger: "Aemeath contributes a Tune Rupture or Fusion Burst event",
  target: "self",
  effect:
    "Personal Combat counts only Aemeath's own contributor. Team-member contributor stacks remain a Team Engine responsibility. S3 replacement is deterministic after Aemeath's contribution.",
  structuredEffect: betweenStarsPersonal,
  source: aemeathGameSource,
};

const combatEffects: readonly CombatEffect[] = [
  ...(runtimeAemeath.combat?.effects ?? []),
  betweenStarsLegacy,
];

const normalizeActionName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const generatedNameByActionId: Readonly<Record<string, readonly string[]>> = {
  "aemeath-basic-1": ["Basic Attack - Aemeath Stage 1"],
  "aemeath-basic-2": ["Basic Attack - Aemeath Stage 2"],
  "aemeath-basic-3": ["Basic Attack - Aemeath Stage 3"],
  "aemeath-basic-4": ["Basic Attack - Aemeath Stage 4"],
  "aemeath-heavy-1": ["Heavy Attack - Aemeath Charged I"],
  "aemeath-heavy-2": ["Heavy Attack - Aemeath Charged II"],
  "aemeath-midair": ["Mid-air Attack - Aemeath"],
  "aemeath-dodge-counter": ["Dodge Counter - Aemeath"],
  "armament-merge": ["Sync Strike: Armament Merge"],
  "call-of-dawn": ["Sync Strike: Call of Dawn"],
  "mech-basic-1": ["Basic Attack - Mech Stage 1"],
  "mech-basic-2": ["Basic Attack - Mech Stage 2"],
  "mech-basic-3": ["Basic Attack - Mech Stage 3"],
  "mech-basic-4": ["Basic Attack - Mech Stage 4"],
  "mech-heavy-1": ["Heavy Attack - Mech Charged I"],
  "mech-heavy-2": ["Heavy Attack - Mech Charged II"],
  "mech-midair": ["Mid-air Attack - Mech"],
  "mech-dodge-counter": ["Dodge Counter - Mech"],
  overdrive: ["Heavenfall Edict: Overdrive"],
  finale: ["Heavenfall Edict: Finale"],
  "intro-normal": ["Songs Across the Universe"],
  "intro-mech": ["Debut of Meteoric Radiance"],
  "seraphic-encore": ["Seraphic Duet: Encore"],
  "seraphic-overture": ["Seraphic Duet: Overture"],
  starburst: ["Tune Rupture Response - Starburst", "Tune Rupture Response: Starburst"],
  "seraphic-bonus": ["Seraphic Duet Bonus", "Seraphic Duet Bonus (Per Instance)"],
};

const generatedAemeathActions = generatedCharacterBoxCombat10R1.aemeath.actions;

function withExactTalentLevels(action: CombatAction): CombatAction {
  if (!action.multipliers.length || action.id === "aemeath-fusion-burst") return action;
  const aliases = generatedNameByActionId[action.id];
  if (!aliases) {
    throw new Error(`Aemeath action ${action.id} is missing a reviewed GameDatabase talent alias.`);
  }
  const normalizedAliases = new Set(aliases.map(normalizeActionName));
  const matches = generatedAemeathActions.filter((candidate) =>
    normalizedAliases.has(normalizeActionName(candidate.name)),
  );
  if (matches.length !== 1) {
    throw new Error(
      `Aemeath action ${action.id} resolves to ${matches.length} GameDatabase talent rows (${generatedAemeathActions.map((candidate) => candidate.name).join(" | ")}).`,
    );
  }
  const generated = matches[0]!;
  return {
    ...action,
    multipliersByTalentLevel: generated.multipliersByTalentLevel,
  };
}

function completeAemeathAction(action: CombatAction): CombatAction {
  const withTalentLevels = withExactTalentLevels(action);
  if (action.id === "aemeath-heavy-2" || action.id === "mech-heavy-2") {
    return {
      ...withTalentLevels,
      damageType: "resonanceLiberation",
      conditionalDamageType: undefined,
      notes: [
        ...(withTalentLevels.notes ?? []),
        "Charged II is always considered Resonance Liberation DMG; Instant Response only changes charge/gameplay state and mode application rules.",
      ],
    };
  }
  return withTalentLevels;
}

const completedActions = (runtimeAemeath.combat?.actions ?? []).map(completeAemeathAction);

export const aemeath = {
  ...runtimeAemeath,
  combat: runtimeAemeath.combat
    ? {
        ...runtimeAemeath.combat,
        level10Only: false,
        actions: completedActions,
        effects: combatEffects,
        unknowns: [
          "Durée de cast et recovery/endlag de chaque action — non bloquant pour la complétude DPS.",
          "Timestamps individuels des hits — non bloquant pour la complétude DPS.",
          "Fenêtres exactes de cancel en secondes ou frames — non bloquant pour la complétude DPS.",
          "Starflux natural regeneration / Starflux Thrust consumption are movement-only and excluded from Personal DPS completeness.",
          "Per-hit Synchronization Rate gains are scenario-owned for theoretical rotation ordering until exact event-stage data is available; they do not change any individual damage formula.",
        ],
      }
    : undefined,
};

const permanentRuntimeEffect = (effect: CombatEffect): CombatEffect =>
  effect.structuredEffect
    ? {
        ...effect,
        structuredEffect: {
          ...effect.structuredEffect,
          activationPolicy: "initially-active",
          rules: effect.structuredEffect.rules.map((rule) => ({
            ...rule,
            accounting: "runtime" as const,
          })),
        },
      }
    : effect;

export const everbrightPolestar = {
  ...runtimeEverbrightPolestar,
  effects: (runtimeEverbrightPolestar.effects ?? []).map((effect) =>
    effect.id === "everbright-r1-base" ? permanentRuntimeEffect(effect) : effect,
  ),
};

export const trailblazingStar = {
  ...runtimeTrailblazingStar,
  effects: (runtimeTrailblazingStar.effects ?? []).map((effect) =>
    effect.id === "trailblazing-2pc" ? permanentRuntimeEffect(effect) : effect,
  ),
};

export const sigillum = {
  ...runtimeSigillum,
  effects: (runtimeSigillum.effects ?? []).map((effect) =>
    effect.id === "sigillum-main-aemeath" ? permanentRuntimeEffect(effect) : effect,
  ),
};

const generatedEcho = generatedCommunityEchoPresets10R1.aemeath.echoLoadout;
const baseline = generatedCharacterBoxRosterBaselines10R1.aemeath;
const aemeathBaseStatBasis = {
  hp: 11025,
  attack: 425 + 587.5,
  defense: 1148.87,
};
const withEchoes = applyEchoLoadoutStatsV1(
  baseline,
  aemeathBaseStatBasis,
  generatedEcho,
).finalStats;
const aemeathFinalStats = {
  ...withEchoes,
  attack: withEchoes.attack + aemeathBaseStatBasis.attack * 0.12,
  critRate: withEchoes.critRate + 8,
};

export const aemeathPreset = {
  ...runtimeAemeathPreset,
  id: "aemeath-s0-l90-everbright-trailblazing",
  label: "Aemeath S0 Lv90 · Everbright Polestar · Trailblazing Star",
  progression: { inherentSkillsUnlocked: true, minorFortesUnlocked: true },
  finalStats: aemeathFinalStats,
  echoLoadout: generatedEcho,
  sonataId: "trailblazing-star",
  mainEchoId: "sigillum",
  notes: [
    "Permanent panel stats are derived from the exact Lv90 Aemeath + Everbright baseline, the validated five-Echo loadout, and Aemeath's +8% Crit Rate / +12% ATK minor Fortes exactly once.",
    "Everbright +12% All-DMG, Trailblazing Star 2-piece +10% Fusion and Sigillum +25% Liberation are non-panel damage modifiers executed as initially-active runtime effects, not baked into finalStats.",
    "The conditional Everbright and Trailblazing 5-piece windows remain event-driven and are not double-counted.",
    "All configurable damaging talents resolve exact GameDatabase Lv1-Lv10 multipliers; no interpolation is used.",
    "Personal timing uses the shared theoretical WUWA LAB profile policy and does not gate DPS completeness.",
  ],
};

export { aemeathGameSource };
