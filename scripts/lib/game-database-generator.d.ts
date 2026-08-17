import type { GameDatabaseV1 } from "../../src/game-data/schema";

export interface GameDatabaseGenerationReport {
  skippedUnnamedCharacterSkills: number;
  omittedPermanentCharacterNodes: number;
  weaponPassiveRankSetsNotRendered: number;
  skippedPhantomSkinRows: number;
  skippedNoncanonicalEchoRows: number;
  characterStatsOmitted: number;
  weaponStatsOmitted: number;
  sourceEchoCount: number;
  generatedCounts: GameDatabaseV1["manifest"]["counts"];
  sonataSourceHashStrategy: string;
  unresolved: string[];
}

export function generateGameDatabaseV1(snapshot: unknown): {
  database: GameDatabaseV1;
  report: GameDatabaseGenerationReport;
};
