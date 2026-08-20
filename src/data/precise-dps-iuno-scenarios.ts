import type { PersonalRotationScenario } from "./personal-rotation-presets";
import type { TemporalRotationDefinition } from "@/domain/temporal-engine";
import { IUNO } from "./precise-dps-iuno";

export type TimedPersonalRotationScenario = PersonalRotationScenario & {
  targetDuration?: TemporalRotationDefinition["targetDuration"];
};

const mainDpsSteps: PersonalRotationScenario["rotation"]["steps"] = [
  { actionId: IUNO.intro },
  { actionId: IUNO.closingRefrain },
  { actionId: IUNO.fluxMoonbow },
  { actionId: IUNO.enhancedMoonbow1 },
  { actionId: IUNO.enhancedMoonbow2 },
  { actionId: IUNO.enhancedMoonbow3 },
  { actionId: IUNO.enhancedArc },
  { actionId: IUNO.liberation },
  { actionId: IUNO.enhancedMoonbow1 },
  { actionId: IUNO.enhancedMoonbow2 },
  { actionId: IUNO.enhancedMoonbow3 },
  { actionId: IUNO.enhancedArc },
  { actionId: IUNO.moonbow1 },
  { actionId: IUNO.moonbow2 },
  { actionId: IUNO.moonbow3 },
  { actionId: IUNO.outro },
];

const hybridSteps: PersonalRotationScenario["rotation"]["steps"] = [
  { actionId: IUNO.intro },
  { actionId: IUNO.liberation },
  { actionId: IUNO.fluxMoonbow },
  { actionId: IUNO.enhancedMoonbow1 },
  { actionId: IUNO.enhancedMoonbow2 },
  { actionId: IUNO.enhancedMoonbow3 },
  { actionId: IUNO.enhancedArc },
  { actionId: IUNO.enhancedArc },
  { actionId: IUNO.absoluteFullness },
  { actionId: IUNO.outro },
];

export const iunoMainDpsScenario: TimedPersonalRotationScenario = {
  id: "iuno-main-dps",
  resonatorId: "iuno",
  name: "Iuno · Main DPS",
  rotation: {
    id: "iuno-main-dps",
    name: "Iuno · Main DPS",
    steps: mainDpsSteps,
  },
  targetDuration: {
    seconds: 8.43,
    confidence: "community-calculation",
    source: "Prydwen Iuno Main DPS rotation · reviewed 2026-08-20",
  },
  assumeLegacyRequirementsSatisfied: true,
  notes: [
    "Main-DPS reference recipe: Intro → Closing Refrain → Flux Moonbow → enhanced Moonbow chain → enhanced Arc → Liberation → enhanced Moonbow chain → enhanced Arc → normal Moonbow chain → Outro.",
    "8.43s is a reviewed whole-rotation target. Per-action timings remain theoretical and are calibrated to that total; no frame-exact attack timing is claimed.",
    "Outgoing Full Moon Domain / Outro teammate buffs remain Team Cycle-owned and are never self-applied to Iuno's Personal DPS.",
    "S6 mechanics are executed by Sequence state, but this S0-S5 reference recipe is not claimed as the optimal S6 recipe.",
  ],
};

export const iunoHybridScenario: TimedPersonalRotationScenario = {
  id: "iuno-hybrid",
  resonatorId: "iuno",
  name: "Iuno · Hybrid / Full Moon Domain",
  rotation: {
    id: "iuno-hybrid",
    name: "Iuno · Hybrid / Full Moon Domain",
    steps: hybridSteps,
  },
  assumeLegacyRequirementsSatisfied: true,
  notes: [
    "Hybrid reference recipe: Intro → Liberation → Flux Moonbow → enhanced Moonbow chain → enhanced Arc ×2 → Absolute Fullness → Outro.",
    "No reviewed public whole-rotation duration is promoted for this Hybrid recipe; its individual action windows remain theoretical and no Main-DPS duration is inherited.",
    "Absolute Fullness is retained because this scenario represents the Full Moon Domain / heal handoff plan even when its personal damage is not the primary reason for casting it.",
    "Full Moon Domain teammate Blessing and the incoming Resonator's +50% Heavy Attack amplification are explicit Team Cycle mechanics, not Iuno self buffs.",
  ],
};

export const iunoPreciseScenarios: readonly TimedPersonalRotationScenario[] = [
  iunoMainDpsScenario,
  iunoHybridScenario,
];
