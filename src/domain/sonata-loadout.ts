import type { CombatEffect, Sonata, SonataPieceBonus } from "./models";
import type { UserEchoLoadoutV1 } from "./user-echo-loadout";

export const sonataPieceThresholds = [2, 3, 5] as const;
export type SonataPieceThreshold = (typeof sonataPieceThresholds)[number];

export interface ResolvedSonataSetV1 {
  sonataSetId: string;
  pieceCount: number;
  reachedThresholds: readonly SonataPieceThreshold[];
}

export interface ResolvedActiveSonataV1 extends ResolvedSonataSetV1 {
  sonata: Sonata;
  activePieceBonuses: readonly SonataPieceBonus[];
  effects: readonly CombatEffect[];
}

export interface SonataLoadoutResolutionV1 {
  sets: readonly ResolvedSonataSetV1[];
  activeSonatas: readonly ResolvedActiveSonataV1[];
  unresolvedActiveSetIds: readonly string[];
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

/**
 * Maps reached piece thresholds to explicit Sonata data.
 *
 * Legacy `Sonata.effects` are intentionally ignored here: Echo-derived mixed
 * loadouts may only activate effects that declare their piece requirement in
 * `pieceBonuses`. This prevents a 2p or 3p mixed set from silently receiving a
 * full legacy 5p effect list.
 */
export function resolveSonataLoadoutV1(
  loadout: UserEchoLoadoutV1 | undefined,
  sonataCatalog: readonly Sonata[],
): SonataLoadoutResolutionV1 {
  const sets = resolveSonataSetsFromEchoLoadoutV1(loadout);
  const activeSets = sets.filter((set) => set.reachedThresholds.length > 0);
  const unresolvedActiveSetIds: string[] = [];
  const activeSonatas: ResolvedActiveSonataV1[] = [];

  for (const set of activeSets) {
    const sonata = sonataCatalog.find((candidate) => candidate.id === set.sonataSetId);
    if (!sonata) {
      unresolvedActiveSetIds.push(set.sonataSetId);
      continue;
    }

    const activePieceBonuses = (sonata.pieceBonuses ?? []).filter((bonus) =>
      set.reachedThresholds.includes(bonus.pieces),
    );
    const effects = activePieceBonuses.flatMap((bonus) => bonus.effects ?? []);
    activeSonatas.push({
      ...set,
      sonata,
      activePieceBonuses,
      effects,
    });
  }

  return { sets, activeSonatas, unresolvedActiveSetIds };
}
