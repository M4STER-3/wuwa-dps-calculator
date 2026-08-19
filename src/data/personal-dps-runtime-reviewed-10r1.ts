import type { EffectDefinition } from "@/domain/effect-models";
import type { UserBuild } from "@/domain/models";
import {
  resolvePersonalDpsRuntimeBundle10R1,
  type PersonalDpsRuntimeBundle10R1,
} from "./personal-dps-runtime-effects-10r1";

const actionIs = (...ids: string[]) => ({
  kind: "identity" as const,
  field: "actionId" as const,
  anyOf: ids,
});

const calcharoS2Reviewed: EffectDefinition = {
  id: "calcharo-s2-skill-window-reviewed",
  label: "Calcharo S2 · Zero-Sum Game",
  source: {
    id: "calcharo-s2",
    type: "resonance-chain",
    label: "Calcharo S2",
  },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 15 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "calcharo-s2-skill-dmg-reviewed",
      label: "+30% Resonance Skill DMG after Intro",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["resonanceSkill"] }],
      modifiers: [{ kind: "damage-type-bonus", stacking: "additive", value: 30 }],
    },
  ],
  triggers: [
    {
      id: "calcharo-s2-after-intro-reviewed",
      event: "action-end",
      predicates: [actionIs("calcharo-wanted-outlaw", "calcharo-necessary-means")],
      operations: [
        { kind: "activate-effect", effectId: "calcharo-s2-skill-window-reviewed" },
      ],
    },
  ],
};

const calcharoS3Reviewed: EffectDefinition = {
  id: "calcharo-s3-deathblade-gear-reviewed",
  label: "Calcharo S3 · Iron Fist Diplomacy",
  source: {
    id: "calcharo-s3",
    type: "resonance-chain",
    label: "Calcharo S3",
  },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 11 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "calcharo-s3-electro-during-deathblade",
      label: "+25% Electro DMG during Deathblade Gear",
      accounting: "runtime",
      modifiers: [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 25 },
      ],
    },
  ],
  triggers: [
    {
      id: "calcharo-s3-enter-deathblade",
      event: "action-end",
      predicates: [actionIs("calcharo-phantom-etching")],
      operations: [
        { kind: "activate-effect", effectId: "calcharo-s3-deathblade-gear-reviewed" },
      ],
    },
  ],
};

const calcharoS4Reviewed: EffectDefinition = {
  id: "calcharo-s4-dark-alliance-reviewed",
  label: "Calcharo S4 · Dark Alliance",
  source: {
    id: "calcharo-s4",
    type: "resonance-chain",
    label: "Calcharo S4",
  },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: 30 },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "calcharo-s4-electro-team-reviewed",
      label: "+20% Electro DMG after Shadowy Raid",
      accounting: "runtime",
      modifiers: [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 20 },
      ],
    },
  ],
  triggers: [
    {
      id: "calcharo-s4-after-outro-reviewed",
      event: "action-end",
      predicates: [actionIs("calcharo-shadowy-raid")],
      operations: [
        { kind: "activate-effect", effectId: "calcharo-s4-dark-alliance-reviewed" },
      ],
    },
  ],
};

const calcharoS5Reviewed: EffectDefinition = {
  id: "calcharo-s5-intro-damage-reviewed",
  label: "Calcharo S5 · Unconventional Compact",
  source: {
    id: "calcharo-s5",
    type: "resonance-chain",
    label: "Calcharo S5",
  },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" } },
  rules: [
    {
      id: "calcharo-s5-intro-damage-rule-reviewed",
      label: "Wanted Criminal / Necessary Means +50% DMG",
      accounting: "runtime",
      selectors: [
        {
          kind: "action-id",
          anyOf: ["calcharo-wanted-outlaw", "calcharo-necessary-means"],
        },
      ],
      modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 50 }],
    },
  ],
};

const replacementRegistry = {
  calcharo: {
    removeEffectIds: ["calcharo-s2-skill-window", "calcharo-sequence-damage"],
    additions: [
      { minSequence: 2, effect: calcharoS2Reviewed },
      { minSequence: 3, effect: calcharoS3Reviewed },
      { minSequence: 4, effect: calcharoS4Reviewed },
      { minSequence: 5, effect: calcharoS5Reviewed },
    ],
  },
} as const;

/**
 * Source-review corrections are data-owned overlays. The combat engine stays
 * character-agnostic: it only receives the resulting EffectDefinition bundle.
 */
export function resolveReviewedPersonalDpsRuntimeBundle10R1(
  build: UserBuild,
): PersonalDpsRuntimeBundle10R1 {
  const base = resolvePersonalDpsRuntimeBundle10R1(build);
  const correction = replacementRegistry[
    build.resonatorId as keyof typeof replacementRegistry
  ];
  if (!correction) return base;

  const removed = new Set<string>(correction.removeEffectIds);
  const effects: EffectDefinition[] = base.effects.filter(
    (effect) => !removed.has(effect.id),
  );
  for (const entry of correction.additions) {
    if (build.sequence >= entry.minSequence) effects.push(entry.effect);
  }

  return {
    effects,
    actions: base.actions,
    resources: base.resources,
  };
}
