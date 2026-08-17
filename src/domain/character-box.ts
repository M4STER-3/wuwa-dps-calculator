import type {
  CharacterBox,
  RecommendedBuildPreset,
  Sequence,
  UserBuild,
} from "./models";
import { damageTypes, elements, skillTypes } from "./models";

export const MAX_CHARACTER_BOX_SERIALIZED_LENGTH = 1_000_000;

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
  const build: UserBuild = {
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
  assertValidBuild(build);
  return build;
}

export function addBuild(box: CharacterBox, build: UserBuild): CharacterBox {
  assertValidBuild(build);
  if (
    box.builds.some((candidate) => candidate.resonatorId === build.resonatorId)
  ) {
    throw new Error("Ce Resonator est déjà présent dans la Box.");
  }
  return { ...box, builds: [...box.builds, build] };
}

export function updateBuild(box: CharacterBox, build: UserBuild): CharacterBox {
  assertValidBuild(build);
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

function isSafeString(value: unknown, maxLength = 200): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

export function isValidBuild(build: unknown): build is UserBuild {
  if (!build || typeof build !== "object") return false;
  const value = build as Partial<UserBuild>;
  if (
    !isSafeString(value.id) ||
    !isSafeString(value.resonatorId) ||
    !isSafeString(value.sourcePresetId) ||
    typeof value.characterLevel !== "number" ||
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
    !isSafeString(value.weapon.weaponId) ||
    !Number.isInteger(value.weapon.level) ||
    value.weapon.level < 1 ||
    value.weapon.level > 90 ||
    !Number.isInteger(value.weapon.rank) ||
    value.weapon.rank < 1 ||
    value.weapon.rank > 5
  )
    return false;
  if (value.sonataId !== undefined && !isSafeString(value.sonataId)) return false;
  if (value.mainEchoId !== undefined && !isSafeString(value.mainEchoId)) return false;
  const stats = value.finalStats;
  const baseStats = [
    stats.hp,
    stats.attack,
    stats.defense,
    stats.critRate,
    stats.critDamage,
    stats.energyRegen,
    stats.healingBonus,
    stats.tuneBreakBoost,
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
    isSafeString(value.createdAt, 100) && isSafeString(value.updatedAt, 100)
  );
}

export function assertValidBuild(build: unknown): asserts build is UserBuild {
  if (!isValidBuild(build)) {
    throw new Error("Le build contient des valeurs invalides.");
  }
}

function sanitizeValidatedBuild(build: UserBuild): UserBuild {
  return {
    id: build.id,
    resonatorId: build.resonatorId,
    sourcePresetId: build.sourcePresetId,
    characterLevel: build.characterLevel,
    sequence: build.sequence,
    skillLevels: {
      basicAttack: build.skillLevels.basicAttack,
      resonanceSkill: build.skillLevels.resonanceSkill,
      forteCircuit: build.skillLevels.forteCircuit,
      resonanceLiberation: build.skillLevels.resonanceLiberation,
      introSkill: build.skillLevels.introSkill,
    },
    weapon: {
      weaponId: build.weapon.weaponId,
      level: build.weapon.level,
      rank: build.weapon.rank,
    },
    finalStats: {
      hp: build.finalStats.hp,
      attack: build.finalStats.attack,
      defense: build.finalStats.defense,
      critRate: build.finalStats.critRate,
      critDamage: build.finalStats.critDamage,
      energyRegen: build.finalStats.energyRegen,
      healingBonus: build.finalStats.healingBonus,
      tuneBreakBoost: build.finalStats.tuneBreakBoost,
      elementalDamageBonus: {
        aero: build.finalStats.elementalDamageBonus.aero,
        glacio: build.finalStats.elementalDamageBonus.glacio,
        electro: build.finalStats.elementalDamageBonus.electro,
        fusion: build.finalStats.elementalDamageBonus.fusion,
        havoc: build.finalStats.elementalDamageBonus.havoc,
        spectro: build.finalStats.elementalDamageBonus.spectro,
      },
      damageTypeBonus: {
        basicAttack: build.finalStats.damageTypeBonus.basicAttack,
        heavyAttack: build.finalStats.damageTypeBonus.heavyAttack,
        resonanceSkill: build.finalStats.damageTypeBonus.resonanceSkill,
        resonanceLiberation: build.finalStats.damageTypeBonus.resonanceLiberation,
        introSkill: build.finalStats.damageTypeBonus.introSkill,
        echoSkill: build.finalStats.damageTypeBonus.echoSkill,
      },
    },
    ...(build.sonataId !== undefined ? { sonataId: build.sonataId } : {}),
    ...(build.mainEchoId !== undefined ? { mainEchoId: build.mainEchoId } : {}),
    createdAt: build.createdAt,
    updatedAt: build.updatedAt,
  };
}

export function parseCharacterBox(serialized: string | null): CharacterBox {
  if (!serialized || serialized.length > MAX_CHARACTER_BOX_SERIALIZED_LENGTH) {
    return emptyCharacterBox();
  }
  try {
    const candidate: unknown = JSON.parse(serialized);
    if (!candidate || typeof candidate !== "object") return emptyCharacterBox();
    const rawBox = candidate as { schemaVersion?: unknown; builds?: unknown };
    // V0.2 adds a permanent stat without discarding otherwise valid V0.1 boxes.
    const normalizedBuilds = Array.isArray(rawBox.builds)
      ? rawBox.builds.map((build: unknown) => {
          if (
            build &&
            typeof build === "object" &&
            "finalStats" in build &&
            build.finalStats &&
            typeof build.finalStats === "object" &&
            !("tuneBreakBoost" in build.finalStats)
          ) {
            const record = build as Record<string, unknown>;
            return {
              ...record,
              finalStats: {
                ...(record.finalStats as Record<string, unknown>),
                tuneBreakBoost: record.resonatorId === "aemeath" ? 10 : 0,
              },
            };
          }
          return build;
        })
      : rawBox.builds;
    if (
      rawBox.schemaVersion !== 1 ||
      !Array.isArray(normalizedBuilds) ||
      !normalizedBuilds.every(isValidBuild)
    )
      return emptyCharacterBox();
    const validatedBuilds = normalizedBuilds as UserBuild[];
    if (
      new Set(validatedBuilds.map((build) => build.resonatorId)).size !==
      validatedBuilds.length
    )
      return emptyCharacterBox();
    return {
      schemaVersion: 1,
      builds: validatedBuilds.map(sanitizeValidatedBuild),
    };
  } catch {
    return emptyCharacterBox();
  }
}
