import type {
  CharacterBox,
  RecommendedBuildPreset,
  Sequence,
  UserBuild,
} from "./models";
import { damageTypes, elements, skillTypes } from "./models";

export const emptyCharacterBox = (): CharacterBox => ({
  schemaVersion: 1,
  builds: [],
});

export function isSequence(value: unknown): value is Sequence {
  return (
    Number.isInteger(value) &&
    typeof value === "number" &&
    value >= 0 &&
    value <= 6
  );
}

export function createBuildFromPreset(
  preset: RecommendedBuildPreset,
  options: { id: string; now: string },
): UserBuild {
  return {
    id: options.id,
    resonatorId: preset.resonatorId,
    sourcePresetId: preset.id,
    characterLevel: preset.characterLevel,
    sequence: preset.sequence,
    skillLevels: { ...preset.skillLevels },
    weapon: { ...preset.weapon },
    finalStats: {
      ...preset.finalStats,
      elementalDamageBonus: { ...preset.finalStats.elementalDamageBonus },
      damageTypeBonus: { ...preset.finalStats.damageTypeBonus },
    },
    sonataId: preset.sonataId,
    mainEchoId: preset.mainEchoId,
    createdAt: options.now,
    updatedAt: options.now,
  };
}

export function addBuild(box: CharacterBox, build: UserBuild): CharacterBox {
  if (
    box.builds.some((candidate) => candidate.resonatorId === build.resonatorId)
  ) {
    throw new Error("Ce Resonator est déjà présent dans la Box.");
  }
  return { ...box, builds: [...box.builds, build] };
}

export function updateBuild(box: CharacterBox, build: UserBuild): CharacterBox {
  return {
    ...box,
    builds: box.builds.map((candidate) =>
      candidate.id === build.id ? build : candidate,
    ),
  };
}

export function removeBuild(box: CharacterBox, buildId: string): CharacterBox {
  return { ...box, builds: box.builds.filter((build) => build.id !== buildId) };
}

export function resetBuild(
  build: UserBuild,
  preset: RecommendedBuildPreset,
  now: string,
): UserBuild {
  const reset = createBuildFromPreset(preset, { id: build.id, now });
  return { ...reset, createdAt: build.createdAt };
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isValidBuild(build: unknown): build is UserBuild {
  if (!build || typeof build !== "object") return false;
  const value = build as Partial<UserBuild>;
  if (
    typeof value.id !== "string" ||
    typeof value.resonatorId !== "string" ||
    typeof value.sourcePresetId !== "string" ||
    !Number.isInteger(value.characterLevel) ||
    value.characterLevel < 1 ||
    value.characterLevel > 90 ||
    !isSequence(value.sequence) ||
    !value.skillLevels ||
    !value.weapon ||
    !value.finalStats
  )
    return false;
  if (
    !skillTypes.every(
      (skill) =>
        Number.isInteger(value.skillLevels?.[skill]) &&
        (value.skillLevels?.[skill] ?? 0) >= 1 &&
        (value.skillLevels?.[skill] ?? 0) <= 10,
    )
  )
    return false;
  if (
    typeof value.weapon.weaponId !== "string" ||
    !Number.isInteger(value.weapon.level) ||
    value.weapon.level < 1 ||
    value.weapon.level > 90 ||
    !Number.isInteger(value.weapon.rank) ||
    value.weapon.rank < 1 ||
    value.weapon.rank > 5
  )
    return false;
  const stats = value.finalStats;
  const baseStats = [
    stats.hp,
    stats.attack,
    stats.defense,
    stats.critRate,
    stats.critDamage,
    stats.energyRegen,
    stats.healingBonus,
  ];
  if (!baseStats.every(isNonNegativeNumber)) return false;
  if (
    !elements.every((element) =>
      isNonNegativeNumber(stats.elementalDamageBonus?.[element]),
    )
  )
    return false;
  if (
    !damageTypes.every((type) =>
      isNonNegativeNumber(stats.damageTypeBonus?.[type]),
    )
  )
    return false;
  return (
    typeof value.createdAt === "string" && typeof value.updatedAt === "string"
  );
}

export function parseCharacterBox(serialized: string | null): CharacterBox {
  if (!serialized) return emptyCharacterBox();
  try {
    const candidate: unknown = JSON.parse(serialized);
    if (!candidate || typeof candidate !== "object") return emptyCharacterBox();
    const box = candidate as Partial<CharacterBox>;
    if (
      box.schemaVersion !== 1 ||
      !Array.isArray(box.builds) ||
      !box.builds.every(isValidBuild)
    )
      return emptyCharacterBox();
    if (
      new Set(box.builds.map((build) => build.resonatorId)).size !==
      box.builds.length
    )
      return emptyCharacterBox();
    return box as CharacterBox;
  } catch {
    return emptyCharacterBox();
  }
}
