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
 * Converts already-validated GameDatabase Sonata piece counts into reached tiers.
 * This is the canonical gameplay path: Echo legality stays owned by
 * `resolveEchoLoadoutV1`, while this module only interprets the validated counts.
 */
export function resolveSonataSetsFromPieceCountsV1(
  pieceCounts: Readonly<Record<string, number>>,
): readonly ResolvedSonataSetV1[] {
  return Object.entries(pieceCounts)
    .filter(([, pieceCount]) => Number.isInteger(pieceCount) && pieceCount > 0)
    .map(([sonataSetId, pieceCount]) => ({
      sonataSetId,
      pieceCount,
      reachedThresholds: sonataPieceThresholds.filter(
        (threshold) => pieceCount >= threshold,
      ),
    }));
}

/**
 * Compatibility helper for persisted/UI data that has not yet gone through the
 * GameDatabase Echo resolver. Gameplay callers should prefer validated counts.
 */
export function countSonataPiecesFromEchoLoadoutV1(
  loadout: UserEchoLoadoutV1 | undefined,
): Readonly<Record<string, number>> {
  if (!loadout?.echoes.length) return {};

  const counts: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const echo of loadout.echoes) {
    counts[echo.sonataSetId] = (counts[echo.sonataSetId] ?? 0) + 1;
  }
  return counts;
}

export function resolveSonataSetsFromEchoLoadoutV1(
  loadout: UserEchoLoadoutV1 | undefined,
): readonly ResolvedSonataSetV1[] {
  return resolveSonataSetsFromPieceCountsV1(countSonataPiecesFromEchoLoadoutV1(loadout));
}

export function resolveActiveSonataSetIdsFromPieceCountsV1(
  pieceCounts: Readonly<Record<string, number>>,
): readonly string[] {
  return resolveSonataSetsFromPieceCountsV1(pieceCounts)
    .filter((set) => set.reachedThresholds.length > 0)
    .map((set) => set.sonataSetId);
}

export function resolveActiveSonataSetIdsV1(
  loadout: UserEchoLoadoutV1 | undefined,
): readonly string[] {
  return resolveActiveSonataSetIdsFromPieceCountsV1(
    countSonataPiecesFromEchoLoadoutV1(loadout),
  );
}

function mapActiveSonatasV1(
  sets: readonly ResolvedSonataSetV1[],
  sonataCatalog: readonly Sonata[],
): SonataLoadoutResolutionV1 {
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

/**
 * Canonical runtime mapping from GameDatabase-validated piece counts to explicit
 * Sonata tier data.
 *
 * Legacy `Sonata.effects` are intentionally ignored here: Echo-derived mixed
 * loadouts may only activate effects that declare their piece requirement in
 * `pieceBonuses`. This prevents a 2p or 3p mixed set from silently receiving a
 * full legacy 5p effect list.
 */
export function resolveSonataLoadoutFromPieceCountsV1(
  pieceCounts: Readonly<Record<string, number>>,
  sonataCatalog: readonly Sonata[],
): SonataLoadoutResolutionV1 {
  return mapActiveSonatasV1(
    resolveSonataSetsFromPieceCountsV1(pieceCounts),
    sonataCatalog,
  );
}

/** Compatibility wrapper for callers that only own persisted Echo data. */
export function resolveSonataLoadoutV1(
  loadout: UserEchoLoadoutV1 | undefined,
  sonataCatalog: readonly Sonata[],
): SonataLoadoutResolutionV1 {
  return resolveSonataLoadoutFromPieceCountsV1(
    countSonataPiecesFromEchoLoadoutV1(loadout),
    sonataCatalog,
  );
}
