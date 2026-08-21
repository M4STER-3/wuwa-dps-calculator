import { registryPersonalRotationScenarios } from "@/data/personal-dps-roster-registry";
import { preciseDpsFutureScenarios } from "@/data/precise-dps-future";
import {
  personalRotationScenarios,
  type PersonalRotationScenario,
} from "@/data/personal-rotation-presets";

function candidatesForResonator(
  resonatorId: string,
): readonly PersonalRotationScenario[] {
  return [
    ...personalRotationScenarios,
    ...preciseDpsFutureScenarios,
    ...registryPersonalRotationScenarios,
  ].filter((candidate) => candidate.resonatorId === resonatorId);
}

/**
 * Single scenario-selection policy shared by Personal DPS and Team DPS.
 * An explicit mode may override a persisted preference; otherwise the build-owned
 * Personal scenario id wins. Runtime engines consume the selected data and never
 * branch on a specific resonator id.
 */
export function selectPersonalRotationScenario(
  resonatorId: string,
  resonanceMode?: string,
  preferredScenarioId?: string,
): PersonalRotationScenario | undefined {
  const candidates = candidatesForResonator(resonatorId);
  if (!candidates.length) return undefined;

  if (preferredScenarioId) {
    const preferred = candidates.find(
      (candidate) => candidate.id === preferredScenarioId,
    );
    if (
      preferred &&
      (!resonanceMode || preferred.resonanceMode === resonanceMode)
    ) {
      return preferred;
    }
  }

  if (resonanceMode) {
    return (
      candidates.find((candidate) => candidate.resonanceMode === resonanceMode) ??
      candidates.find((candidate) => candidate.resonanceMode === undefined) ??
      candidates[0]
    );
  }

  return (
    candidates.find((candidate) => candidate.resonanceMode === undefined) ??
    candidates[0]
  );
}
