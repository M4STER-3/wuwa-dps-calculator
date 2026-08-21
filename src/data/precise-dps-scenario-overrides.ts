import type { PersonalRotationScenario } from "./personal-rotation-presets";
import type { TemporalRotationDefinition } from "@/domain/temporal-engine";
import { galbrenaPreciseScenario } from "./precise-dps-galbrena-scenario";
import { hiyukiPreciseScenarios } from "./precise-dps-hiyuki-scenarios";
import { iunoPreciseScenarios } from "./precise-dps-iuno-scenarios";

export type PreciseScenarioOverride = PersonalRotationScenario & {
  targetDuration?: TemporalRotationDefinition["targetDuration"];
};

const overrides = new Map<string, PreciseScenarioOverride>();
for (const scenario of [
  galbrenaPreciseScenario,
  ...iunoPreciseScenarios,
  ...hiyukiPreciseScenarios,
]) {
  if (overrides.has(scenario.id)) {
    throw new Error(`Duplicate precise scenario override ${scenario.id}.`);
  }
  overrides.set(scenario.id, scenario);
}

export function preciseScenarioOverrideFor(scenarioId: string): PreciseScenarioOverride | undefined {
  return overrides.get(scenarioId);
}
