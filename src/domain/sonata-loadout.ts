import type { UserEchoLoadoutV1 } from "./user-echo-loadout";

export const sonataPieceThresholds = [2, 3, 5] as const;
export type SonataPieceThreshold = (typeof sonataPieceThresholds)[number];

export interface ResolvedSonataSetV1 {
  sonataSetId: string;
  pieceCount: number;
  reachedThresholds: readonly SonataPieceThreshold[];
}

/**
 * Resolves Sonata ownership from the five persisted Echo pieces themselves.
 *
 * This intentionally does not invent a composite Sonata id for mixed sets. Each
 * equipped Echo contributes exactly one piece to its own sonataSetId, and the
 * reached 2p / 3p / 5p thresholds are exposed for the data-owned runtime layer
 * to map to the corresponding effect definitions.
 */
export function resolveSonataSetsFromEchoLoadoutV1(
  loadout: UserEchoLoadoutV1 | undefined,
): readonly ResolvedSonataSetV1[] {
  if (!loadout?.echoes.length) return [];

  const counts = new Map<string, number>();
  for (const echo of loadout.echoes) {
    counts.set(echo.sonataSetId, (counts.get(echo.sonataSetId) ?? 0) + 1);
  }

  return [...counts.entries()].map(([sonataSetId, pieceCount]) => ({
    sonataSetId,
    pieceCount,
    reachedThresholds: sonataPieceThresholds.filter(
      (threshold) => pieceCount >= threshold,
    ),
  }));
}

export function resolveActiveSonataSetIdsV1(
  loadout: UserEchoLoadoutV1 | undefined,
): readonly string[] {
  return resolveSonataSetsFromEchoLoadoutV1(loadout)
    .filter((set) => set.reachedThresholds.length > 0)
    .map((set) => set.sonataSetId);
}
