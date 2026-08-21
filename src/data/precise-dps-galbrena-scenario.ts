import type { Resonator } from "@/domain/models";
import type { PersonalRotationScenario } from "./personal-rotation-presets";
import {
  GALBRENA,
  GALBRENA_DEMON_EXIT_EVENT,
  GALBRENA_REFERENCE_ECHO_EVENT,
  galbrenaScenarioEffects,
} from "./precise-dps-galbrena";

export const GALBRENA_REFERENCE_DURATION_SECONDS = 12.2;

/**
 * Prydwen mono-target reference route. Individual action timings remain theoretical;
 * only the total 12.2s rotation duration is calibrated exactly.
 */
export const galbrenaPreciseScenario: PersonalRotationScenario = {
  id: "galbrena-standard",
  resonatorId: "galbrena",
  name: "Galbrena · Standard Demon Hypostasis · precise reference",
  rotation: {
    id: "galbrena-standard",
    name: "Galbrena standard Demon Hypostasis",
    steps: [
      { actionId: GALBRENA.intro },
      { actionId: GALBRENA.basic2 },
      { actionId: GALBRENA.basic3 },
      { actionId: GALBRENA.basic4 },
      { actionId: GALBRENA.basic2 },
      { actionId: GALBRENA.basic3 },
      { label: "Reference Main Echo cast · build-owned Echo damage excluded", profileId: "echo-skill" },
      { actionId: GALBRENA.ascent },
      { actionId: GALBRENA.liberation },
      { actionId: GALBRENA.seraphic2 },
      { actionId: GALBRENA.seraphic3 },
      { actionId: GALBRENA.seraphic4 },
      { actionId: GALBRENA.seraphic5 },
      { actionId: GALBRENA.seraphic3 },
      { actionId: GALBRENA.seraphic4 },
      { actionId: GALBRENA.seraphic5 },
      { actionId: GALBRENA.outro },
    ],
  },
  // Reference team has two distinct allied Echo casts before Galbrena enters.
  // Her own Main Echo below supplies the third +8, reaching 24 Afterflame / +36%.
  initialResources: { afterflame: 16, sinflame: 0, "purging-flame": 0 },
  assumeLegacyRequirementsSatisfied: true,
  extraEffects: galbrenaScenarioEffects,
  specialEvents: [
    {
      id: "galbrena-reference-main-echo",
      kind: "echo-skill",
      actionId: GALBRENA_REFERENCE_ECHO_EVENT,
      anchor: { stepIndex: 6, at: "end", offsetSeconds: 0.0001 },
      payload: { noDamage: true, buildOwnedEchoDamageExcluded: true },
    },
    {
      id: "galbrena-reference-demon-exit",
      kind: "custom",
      actionId: GALBRENA_DEMON_EXIT_EVENT,
      anchor: { stepIndex: 15, at: "end", offsetSeconds: 0.0001 },
      payload: { noDamage: true, reviewedPurgingFlameDepletionEndpoint: true },
    },
  ],
  notes: [
    "Prydwen reviewed mono-target reference duration: exactly 12.2s. Shared action profiles are calibrated to this total and do not claim frame-exact animation data.",
    "The reference team supplies two distinct allied Echo casts before entry (16 Afterflame); Galbrena's own Main Echo adds 8 before Ascent, for 24 Afterflame and +36% Demon damage amplification.",
    "Public data verifies the 100 Sinflame Ascent threshold, 1:1 conversion to Purging Flame, and depletion at the end of the standard enhanced string. Per-hit resource deltas are intentionally not invented.",
    "Main Echo damage itself remains build-owned; only the cast event needed by Afterflame/S4 is scenario-owned here.",
  ],
};

export function applyGalbrenaReferenceDuration(resonator: Resonator): Resonator {
  if (resonator.id !== "galbrena" || !resonator.combat) return resonator;
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      rotations: [
        ...resonator.combat.rotations.filter(
          (rotation) => rotation.id !== "galbrena-reviewed-reference-duration",
        ),
        {
          id: "galbrena-reviewed-reference-duration",
          name: "Galbrena reviewed standard rotation duration",
          sequence: 0,
          policy: "no-quickswap",
          steps: [],
          totalDurationSeconds: {
            value: GALBRENA_REFERENCE_DURATION_SECONDS,
            confidence: "community-calculation",
            sourceNote: "Prydwen Galbrena mono-target reference calculation.",
          },
          notes: [
            "Duration calibration only; individual attack and hit timings remain theoretical unless explicitly sourced.",
          ],
          source: {
            kind: "community-calculation",
            source: "Prydwen Galbrena calculations · WUWA LAB precise scenario",
            verifiedAt: "2026-08-20",
          },
        },
      ],
    },
  };
}
