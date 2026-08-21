import type { CombatEffect, Sonata } from "@/domain/models";
import type { EffectDefinition } from "@/domain/effect-models";
import {
  preciseModernSonatas,
  preciseSonataSource,
  preciseSonataTierCoverage,
  type PreciseSonataTierCoverage,
} from "./precise-sonata-runtime";

const FLAMEWING_HEAVY_CRIT_ID = "sonata-set:22:3pc:heavy-crit";
const FLAMEWING_ECHO_CRIT_ID = "sonata-set:22:3pc:echo-crit";
export const FLAMEWING_FUSION_CONJUNCTION_ID = "sonata-set:22:3pc:fusion-conjunction";

const flamewingFusionConjunctionDefinition: EffectDefinition = {
  id: FLAMEWING_FUSION_CONJUNCTION_ID,
  label: "Flamewing's Shadow 3-piece — dual-window Fusion DMG",
  source: {
    id: "sonata-set:22",
    type: "sonata",
    label: "Flamewing's Shadow",
    metadata: preciseSonataSource,
  },
  target: "self",
  activationPolicy: "initially-active",
  rules: [
    {
      id: `${FLAMEWING_FUSION_CONJUNCTION_ID}:rule`,
      label: "+16% Fusion DMG while both Flamewing Crit windows are active",
      accounting: "runtime",
      selectors: [{ kind: "element", anyOf: ["fusion"] }],
      predicates: [
        { kind: "has-effect", id: FLAMEWING_HEAVY_CRIT_ID },
        { kind: "has-effect", id: FLAMEWING_ECHO_CRIT_ID },
      ],
      modifiers: [
        { kind: "elemental-damage-bonus", stacking: "additive", value: 16 },
      ],
    },
  ],
};

const flamewingFusionConjunction: CombatEffect = {
  id: flamewingFusionConjunctionDefinition.id,
  name: flamewingFusionConjunctionDefinition.label,
  sourceId: flamewingFusionConjunctionDefinition.source.id,
  trigger: "Both Flamewing Crit windows active",
  target: "self",
  effect:
    "While the Echo-triggered Heavy Crit window and Heavy-triggered Echo Crit window overlap, gain +16% Fusion DMG. The predicate is evaluated from the two live effect instances, so the bonus ends immediately when either 6s window ends.",
  structuredEffect: flamewingFusionConjunctionDefinition,
  source: preciseSonataSource,
};

function completeFlamewingPersonalRuntime(sonata: Sonata): Sonata {
  if (sonata.id !== "sonata-set:22") return sonata;
  return {
    ...sonata,
    pieceBonuses: sonata.pieceBonuses?.map((tier) => {
      if (tier.pieces !== 3) return tier;
      const effects = tier.effects ?? [];
      if (effects.some((effect) => effect.id === FLAMEWING_FUSION_CONJUNCTION_ID)) {
        return tier;
      }
      return {
        ...tier,
        effects: [...effects, flamewingFusionConjunction],
      };
    }),
  };
}

/**
 * Personal-DPS completion layer for reviewed Sonata mechanics that were still
 * marked partial in the base runtime catalogue. Team-owned handoffs remain out
 * of this layer by design.
 */
export const preciseModernSonatasWithPersonalCompletions: readonly Sonata[] =
  preciseModernSonatas.map(completeFlamewingPersonalRuntime);

export const preciseSonataTierCoverageWithPersonalCompletions:
  readonly PreciseSonataTierCoverage[] = preciseSonataTierCoverage.map((entry) =>
    entry.sonataSetId === "sonata-set:22" && entry.pieces === 3
      ? {
          ...entry,
          coverage: "personal-complete",
          note:
            "Both 6s Crit windows and the +16% Fusion conjunction are executable. The conjunction is live only while both source effects overlap.",
        }
      : entry,
  );
