import { registryPersonalRotationScenarios } from "@/data/personal-dps-roster-registry";
import { preciseDpsFutureScenarios } from "@/data/precise-dps-future";
import {
  findPersonalRotationScenario,
  type PersonalRotationScenario,
} from "@/data/personal-rotation-presets";

function findPreciseRotationScenario(
  resonatorId: string,
  resonanceMode?: string,
): PersonalRotationScenario | undefined {
  const candidates = preciseDpsFutureScenarios.filter(
    (candidate) => candidate.resonatorId === resonatorId,
  );
  if (resonanceMode) {
    const exactMode = candidates.find(
      (candidate) => candidate.resonanceMode === resonanceMode,
    );
    if (exactMode) return exactMode;
  }
  return candidates.find((candidate) => !candidate.resonanceMode) ?? candidates[0];
}

/**
 * Single scenario-selection policy shared by Personal DPS and Team DPS.
 * Runtime engines consume the selected data; neither engine branches on a
 * specific resonator id.
 */
export function selectPersonalRotationScenario(
  resonatorId: string,
  resonanceMode?: string,
): PersonalRotationScenario | undefined {
  return (
    findPersonalRotationScenario(resonatorId, resonanceMode) ??
    findPreciseRotationScenario(resonatorId, resonanceMode) ??
    registryPersonalRotationScenarios.find(
      (candidate) => candidate.resonatorId === resonatorId,
    )
  );
}
