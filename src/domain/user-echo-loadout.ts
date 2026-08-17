export interface UserEchoSubstatV1 {
  statId: string;
  value: number;
}

export interface UserEquippedEchoV1 {
  echoId: string;
  sonataSetId: string;
  rarity: 5;
  level: 25;
  primaryMainStatId: string;
  substats: readonly UserEchoSubstatV1[];
}

/**
 * Persisted Character Box representation of the reviewed Echo Loadout V1 input.
 *
 * This shape is intentionally data-only. Gameplay/catalog compatibility and exact
 * roll validation remain the responsibility of resolveEchoLoadoutV1 / Build Resolver.
 */
export interface UserEchoLoadoutV1 {
  echoes: readonly UserEquippedEchoV1[];
  mainEchoId?: string;
}

const MAX_SAFE_ID_LENGTH = 200;
const MAX_ECHOES_V1 = 5;
const MAX_SUBSTATS_V1 = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSafeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SAFE_ID_LENGTH
  );
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isUserEchoLoadoutV1(value: unknown): value is UserEchoLoadoutV1 {
  if (!isRecord(value) || !Array.isArray(value.echoes)) return false;
  if (value.echoes.length > MAX_ECHOES_V1) return false;

  const seenEchoIds = new Set<string>();
  for (const rawEcho of value.echoes) {
    if (!isRecord(rawEcho)) return false;
    if (
      !isSafeId(rawEcho.echoId) ||
      !isSafeId(rawEcho.sonataSetId) ||
      rawEcho.rarity !== 5 ||
      rawEcho.level !== 25 ||
      !isSafeId(rawEcho.primaryMainStatId) ||
      !Array.isArray(rawEcho.substats) ||
      rawEcho.substats.length > MAX_SUBSTATS_V1
    ) {
      return false;
    }
    if (seenEchoIds.has(rawEcho.echoId)) return false;
    seenEchoIds.add(rawEcho.echoId);

    const seenSubstats = new Set<string>();
    for (const rawSubstat of rawEcho.substats) {
      if (
        !isRecord(rawSubstat) ||
        !isSafeId(rawSubstat.statId) ||
        !isFiniteNonNegativeNumber(rawSubstat.value)
      ) {
        return false;
      }
      if (seenSubstats.has(rawSubstat.statId)) return false;
      seenSubstats.add(rawSubstat.statId);
    }
  }

  if (value.mainEchoId !== undefined) {
    if (!isSafeId(value.mainEchoId) || !seenEchoIds.has(value.mainEchoId)) {
      return false;
    }
  }

  return true;
}

export function sanitizeUserEchoLoadoutV1(
  loadout: UserEchoLoadoutV1,
): UserEchoLoadoutV1 {
  return {
    echoes: loadout.echoes.map((echo) => ({
      echoId: echo.echoId,
      sonataSetId: echo.sonataSetId,
      rarity: 5,
      level: 25,
      primaryMainStatId: echo.primaryMainStatId,
      substats: echo.substats.map((substat) => ({
        statId: substat.statId,
        value: substat.value,
      })),
    })),
    ...(loadout.mainEchoId !== undefined
      ? { mainEchoId: loadout.mainEchoId }
      : {}),
  };
}
