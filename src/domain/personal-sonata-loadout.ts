import echoCatalogProjection from "../../public/data/wuwa/echo-catalog-v1.json";
import {
  resolveEchoLoadoutV1,
  type EchoLoadoutCatalogV1,
} from "@/game-data/echo-loadout";
import type { EffectDefinition } from "./effect-models";
import type { Sonata, UserBuild } from "./models";
import {
  resolveSonataLoadoutFromPieceCountsV1,
  type SonataLoadoutResolutionV1,
} from "./sonata-loadout";

export interface PersonalSonataLoadoutResolution {
  resolution?: SonataLoadoutResolutionV1;
  sonatas: readonly Sonata[];
  effects: readonly EffectDefinition[];
  diagnostics: readonly { code: string; message: string }[];
}

function reviewedEchoCost(value: number, echoId: string): 1 | 3 | 4 {
  if (value !== 1 && value !== 3 && value !== 4) {
    throw new Error(`Echo catalogue ${echoId} has unsupported cost ${value}.`);
  }
  return value;
}

const echoLoadoutCatalog: EchoLoadoutCatalogV1 = {
  echoes: echoCatalogProjection.echoes.map((echo) => ({
    id: echo.id,
    cost: reviewedEchoCost(echo.cost, echo.id),
    sonataSetIds: echo.sonataSetIds,
  })),
  sonataSets: echoCatalogProjection.sonataSets.map((sonata) => ({ id: sonata.id })),
};

/**
 * Canonical Personal DPS bridge for Echo-derived Sonata tiers.
 * Echo legality/counting is owned by Echo Resolver V1; this bridge only exposes
 * the exact structured effects attached to reached 2/3/5-piece tiers.
 * Legacy `build.sonataId` is deliberately not consulted when a five-Echo loadout
 * exists, preventing mixed sets from receiving a fake full-set effect.
 */
export function resolvePersonalSonataLoadout(
  build: UserBuild,
  sonataCatalog: readonly Sonata[],
): PersonalSonataLoadoutResolution {
  if (!build.echoLoadout?.echoes.length) {
    return { sonatas: [], effects: [], diagnostics: [] };
  }

  try {
    const echoResolution = resolveEchoLoadoutV1(
      echoLoadoutCatalog,
      build.echoLoadout,
    );
    const resolution = resolveSonataLoadoutFromPieceCountsV1(
      echoResolution.sonataPieceCounts,
      sonataCatalog,
    );
    const diagnostics = resolution.unresolvedActiveSetIds.map((sonataSetId) => ({
      code: "unresolved-echo-derived-sonata-id",
      message: `Active Echo-derived Sonata ${sonataSetId} is missing from the runtime catalogue.`,
    }));
    const effects = resolution.activeSonatas.flatMap((active) =>
      active.effects.flatMap((effect) =>
        effect.structuredEffect ? [effect.structuredEffect] : [],
      ),
    );
    return {
      resolution,
      sonatas: resolution.activeSonatas.map((active) => active.sonata),
      effects,
      diagnostics,
    };
  } catch (error) {
    return {
      sonatas: [],
      effects: [],
      diagnostics: [
        {
          code: "invalid-echo-derived-sonata-loadout",
          message: error instanceof Error ? error.message : "Echo-derived Sonata resolution failed.",
        },
      ],
    };
  }
}
