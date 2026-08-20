import type { EffectDefinition } from "@/domain/effect-models";
import type { CombatEffect, Resonator } from "@/domain/models";
import { PHROLOVA } from "./precise-dps-phrolova";

const source = {
  kind: "multi-source-verified" as const,
  source: "Prydwen / WutheringTools · Phrolova S3 Scarlet Coda exception",
  gameVersion: "3.5",
  verifiedAt: "2026-08-20",
  notes:
    "Scarlet Coda remains Resonance Skill DMG. Generic Echo Skill DMG Amplification must not match it, but Phrolova S3 explicitly includes Scarlet Coda in its own +80% amplification.",
};

const scarletS3Exception: EffectDefinition = {
  id: "precise-phrolova-s3-scarlet-coda-exception",
  label: "S3 · Scarlet Coda explicit Echo amplification exception",
  source: {
    id: "phrolova-s3-scarlet-exception",
    type: "resonance-chain",
    label: "Phrolova S3 · Scarlet Coda",
  },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "phrolova-s3-scarlet-special-inclusion-corrected",
      label: "S3 · Scarlet Coda receives Phrolova's own +80% Echo Skill DMG Amplification",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: [PHROLOVA.scarletCoda] }],
      modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 80 }],
    },
  ],
};

const combatEffect: CombatEffect = {
  id: "phrolova-s3-scarlet-coda-exception",
  name: "S3 Scarlet Coda exception",
  sourceId: scarletS3Exception.source.id,
  trigger: "S3 permanent special-case",
  target: "self",
  effect: scarletS3Exception.label,
  source,
  structuredEffect: scarletS3Exception,
};

/**
 * Applies source-verified post-release corrections that intentionally cannot be
 * inferred from damage type alone. Keeping this as structured data prevents a
 * global "Echo cast == Echo damage" rule from contaminating future characters.
 */
export function applyPrecisePhrolovaCorrections(resonator: Resonator): Resonator {
  if (resonator.id !== "phrolova" || !resonator.combat) return resonator;
  if (
    resonator.combat.effects.some(
      (effect) => effect.structuredEffect?.id === scarletS3Exception.id,
    )
  ) {
    return resonator;
  }
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      effects: [...resonator.combat.effects, combatEffect],
    },
  };
}
