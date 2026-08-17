export interface EchoCatalogItemV1 {
  readonly id: string;
  readonly name: string;
  readonly cost: 1 | 3 | 4;
  readonly sonataSetIds: readonly string[];
}

export interface SonataCatalogItemV1 {
  readonly id: string;
  readonly name: string;
}

export interface EchoCatalogProjectionV1 {
  readonly schemaVersion: 1;
  readonly echoes: readonly EchoCatalogItemV1[];
  readonly sonataSets: readonly SonataCatalogItemV1[];
}

type UnknownRecord = Record<string, unknown>;

const MAX_ENTITY_COUNT = 1_000;
const MAX_ID_LENGTH = 200;
const MAX_NAME_LENGTH = 300;
const MAX_SONATA_PER_ECHO = 16;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function fail(message: string): never {
  throw new Error(`Echo catalog projection rejected source: ${message}`);
}

function asRecord(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as UnknownRecord;
}

function safeString(value: unknown, label: string, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim().length === 0 ||
    CONTROL_CHARACTERS.test(value)
  ) {
    fail(`${label} must be a bounded printable string`);
  }
  return value;
}

function safeId(value: unknown, label: string): string {
  return safeString(value, label, MAX_ID_LENGTH);
}

function safeName(value: unknown, label: string): string {
  return safeString(value, label, MAX_NAME_LENGTH);
}

function safeEntityArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ENTITY_COUNT) {
    fail(`${label} must be an array with at most ${MAX_ENTITY_COUNT} entries`);
  }
  return value;
}

function safeSonataIds(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SONATA_PER_ECHO) {
    fail(`${label} must contain between 1 and ${MAX_SONATA_PER_ECHO} ids`);
  }

  const ids = value.map((entry, index) => safeId(entry, `${label}[${index}]`));
  if (new Set(ids).size !== ids.length) fail(`${label} contains duplicate ids`);
  return ids;
}

function safeEchoCost(value: unknown, label: string): 1 | 3 | 4 {
  if (value !== 1 && value !== 3 && value !== 4) fail(`${label} must be 1, 3, or 4`);
  return value;
}

/**
 * Projects the promoted browser-safe GameDatabase into the tiny subset needed
 * by the Echo editor. Descriptions, source parameters, external URLs and RAW
 * fields are deliberately excluded from the response shape.
 */
export function projectEchoCatalogV1(source: unknown): EchoCatalogProjectionV1 {
  const database = asRecord(source, "database");
  const manifest = asRecord(database.manifest, "database.manifest");
  if (manifest.schemaVersion !== 1) fail("database.manifest.schemaVersion must be 1");

  const sonataSource = safeEntityArray(database.sonataSets, "database.sonataSets");
  const sonataSets: SonataCatalogItemV1[] = [];
  const sonataIds = new Set<string>();

  for (const [index, raw] of sonataSource.entries()) {
    const record = asRecord(raw, `database.sonataSets[${index}]`);
    if (record.kind !== "sonata-set") fail(`database.sonataSets[${index}].kind is invalid`);
    const id = safeId(record.id, `database.sonataSets[${index}].id`);
    if (sonataIds.has(id)) fail(`duplicate Sonata id ${id}`);
    sonataIds.add(id);
    sonataSets.push({
      id,
      name: safeName(record.name, `database.sonataSets[${index}].name`),
    });
  }

  const echoSource = safeEntityArray(database.echoes, "database.echoes");
  const echoes: EchoCatalogItemV1[] = [];
  const echoIds = new Set<string>();

  for (const [index, raw] of echoSource.entries()) {
    const record = asRecord(raw, `database.echoes[${index}]`);
    if (record.kind !== "echo") fail(`database.echoes[${index}].kind is invalid`);
    const id = safeId(record.id, `database.echoes[${index}].id`);
    if (echoIds.has(id)) fail(`duplicate Echo id ${id}`);
    echoIds.add(id);

    const sonataSetIds = safeSonataIds(
      record.sonataSetIds,
      `database.echoes[${index}].sonataSetIds`,
    );
    for (const sonataId of sonataSetIds) {
      if (!sonataIds.has(sonataId)) {
        fail(`Echo ${id} references unknown Sonata ${sonataId}`);
      }
    }

    echoes.push({
      id,
      name: safeName(record.name, `database.echoes[${index}].name`),
      cost: safeEchoCost(record.cost, `database.echoes[${index}].cost`),
      sonataSetIds,
    });
  }

  const counts = asRecord(manifest.counts, "database.manifest.counts");
  if (counts.echoes !== echoes.length || counts.sonataSets !== sonataSets.length) {
    fail("manifest counts do not match promoted Echo/Sonata arrays");
  }

  return {
    schemaVersion: 1,
    echoes,
    sonataSets,
  };
}
