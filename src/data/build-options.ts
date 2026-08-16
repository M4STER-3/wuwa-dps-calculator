import { mainEchoes, presets, resonators, sonatas, weapons } from "./catalog";

/**
 * Presets act as the allow-list for editor choices. Merely sharing a weapon
 * type is not enough to expose an item for a real Resonator.
 */
export function getConfiguredBuildOptions(resonatorId: string) {
  const resonator = resonators.find(
    (candidate) => candidate.id === resonatorId,
  );
  const resonatorPresets = presets.filter(
    (preset) => preset.resonatorId === resonatorId,
  );
  const isTechnicalFixture = resonator?.source.kind === "technical-fixture";
  const isExposable = (sourceKind: string) =>
    isTechnicalFixture || sourceKind !== "technical-fixture";

  const weaponIds = new Set(
    resonatorPresets.map((preset) => preset.weapon.weaponId),
  );
  const sonataIds = new Set(
    resonatorPresets.flatMap((preset) =>
      preset.sonataId ? [preset.sonataId] : [],
    ),
  );
  const mainEchoIds = new Set(
    resonatorPresets.flatMap((preset) =>
      preset.mainEchoId ? [preset.mainEchoId] : [],
    ),
  );

  return {
    weapons: weapons.filter(
      (weapon) =>
        weaponIds.has(weapon.id) &&
        weapon.type === resonator?.weaponType &&
        isExposable(weapon.source.kind),
    ),
    sonatas: sonatas.filter(
      (sonata) => sonataIds.has(sonata.id) && isExposable(sonata.source.kind),
    ),
    mainEchoes: mainEchoes.filter(
      (mainEcho) =>
        mainEchoIds.has(mainEcho.id) && isExposable(mainEcho.source.kind),
    ),
  };
}
