import type {
  CharacterCatalogEntry,
  EchoCatalogEntry,
  GameDatabaseV1,
  GameEntityIdentity,
  SonataSetCatalogEntry,
  WeaponCatalogEntry,
} from "./schema";

export interface GameDataDiagnostic {
  code: string;
  message: string;
  entityId?: string;
}

interface EntityIndex<T extends GameEntityIdentity> {
  byId: ReadonlyMap<string, T>;
  byEncoreId: ReadonlyMap<string, T>;
}

function buildIndex<T extends GameEntityIdentity>(
  entries: readonly T[],
  diagnostics: GameDataDiagnostic[],
  family: string,
): EntityIndex<T> {
  const byId = new Map<string, T>();
  const byEncoreId = new Map<string, T>();

  for (const entry of entries) {
    if (!entry.id.trim()) {
      diagnostics.push({
        code: "empty-canonical-id",
        message: `${family} contains an empty canonical id.`,
      });
      continue;
    }
    if (byId.has(entry.id)) {
      diagnostics.push({
        code: "duplicate-canonical-id",
        message: `${family} canonical id is duplicated: ${entry.id}.`,
        entityId: entry.id,
      });
      continue;
    }
    byId.set(entry.id, entry);

    const encoreId = entry.externalIds.encore;
    if (!encoreId) continue;
    if (byEncoreId.has(encoreId)) {
      diagnostics.push({
        code: "duplicate-encore-id",
        message: `${family} Encore id is duplicated: ${encoreId}.`,
        entityId: entry.id,
      });
      continue;
    }
    byEncoreId.set(encoreId, entry);
  }

  return { byId, byEncoreId };
}

function validateReferences(
  database: GameDatabaseV1,
  diagnostics: GameDataDiagnostic[],
) {
  const sonataIds = new Set(database.sonataSets.map((set) => set.id));
  for (const echo of database.echoes) {
    for (const sonataId of echo.sonataSetIds) {
      if (!sonataIds.has(sonataId)) {
        diagnostics.push({
          code: "unknown-sonata-reference",
          message: `Echo ${echo.id} references unknown Sonata set ${sonataId}.`,
          entityId: echo.id,
        });
      }
    }
  }
}

function validateManifest(
  database: GameDatabaseV1,
  diagnostics: GameDataDiagnostic[],
) {
  const actual = {
    characters: database.characters.length,
    weapons: database.weapons.length,
    echoes: database.echoes.length,
    sonataSets: database.sonataSets.length,
  };

  for (const key of Object.keys(actual) as Array<keyof typeof actual>) {
    if (database.manifest.counts[key] !== actual[key]) {
      diagnostics.push({
        code: "manifest-count-mismatch",
        message: `Manifest ${key} count is ${database.manifest.counts[key]}, actual count is ${actual[key]}.`,
      });
    }
  }
}

export interface GameCatalog {
  readonly database: GameDatabaseV1;
  readonly diagnostics: readonly GameDataDiagnostic[];
  readonly valid: boolean;
  readonly characters: {
    get(id: string): CharacterCatalogEntry | undefined;
    byEncoreId(id: string): CharacterCatalogEntry | undefined;
    all(): readonly CharacterCatalogEntry[];
  };
  readonly weapons: {
    get(id: string): WeaponCatalogEntry | undefined;
    byEncoreId(id: string): WeaponCatalogEntry | undefined;
    forType(type: WeaponCatalogEntry["type"]): readonly WeaponCatalogEntry[];
    all(): readonly WeaponCatalogEntry[];
  };
  readonly echoes: {
    get(id: string): EchoCatalogEntry | undefined;
    byEncoreId(id: string): EchoCatalogEntry | undefined;
    forSonata(id: string): readonly EchoCatalogEntry[];
    forCost(cost: EchoCatalogEntry["cost"]): readonly EchoCatalogEntry[];
    all(): readonly EchoCatalogEntry[];
  };
  readonly sonataSets: {
    get(id: string): SonataSetCatalogEntry | undefined;
    byEncoreId(id: string): SonataSetCatalogEntry | undefined;
    all(): readonly SonataSetCatalogEntry[];
  };
}

export function createGameCatalog(database: GameDatabaseV1): GameCatalog {
  const diagnostics: GameDataDiagnostic[] = [];
  const characters = buildIndex(database.characters, diagnostics, "character");
  const weapons = buildIndex(database.weapons, diagnostics, "weapon");
  const echoes = buildIndex(database.echoes, diagnostics, "echo");
  const sonataSets = buildIndex(database.sonataSets, diagnostics, "sonata-set");

  validateReferences(database, diagnostics);
  validateManifest(database, diagnostics);

  return {
    database,
    diagnostics,
    valid: diagnostics.length === 0,
    characters: {
      get: (id) => characters.byId.get(id),
      byEncoreId: (id) => characters.byEncoreId.get(id),
      all: () => database.characters,
    },
    weapons: {
      get: (id) => weapons.byId.get(id),
      byEncoreId: (id) => weapons.byEncoreId.get(id),
      forType: (type) => database.weapons.filter((weapon) => weapon.type === type),
      all: () => database.weapons,
    },
    echoes: {
      get: (id) => echoes.byId.get(id),
      byEncoreId: (id) => echoes.byEncoreId.get(id),
      forSonata: (id) => database.echoes.filter((echo) => echo.sonataSetIds.includes(id)),
      forCost: (cost) => database.echoes.filter((echo) => echo.cost === cost),
      all: () => database.echoes,
    },
    sonataSets: {
      get: (id) => sonataSets.byId.get(id),
      byEncoreId: (id) => sonataSets.byEncoreId.get(id),
      all: () => database.sonataSets,
    },
  };
}
