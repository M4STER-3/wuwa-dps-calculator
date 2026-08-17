const COST_BY_MAIN_PROP_GROUP = new Map([
  [501, 4],
  [502, 3],
  [503, 1],
]);
const ALLOWED_RARITIES_BY_MAIN_PROP_GROUP = new Map([
  [501, new Set([2, 3])],
  [502, new Set([1])],
  [503, new Set([0])],
]);
const PHANTOM_NAME_PATTERN = /^Phantom(?::|\s)/i;
const CATALOG_STATES = new Set(["base", "phantom-skin", "noncanonical"]);
const MAX_ENTITIES = 2_000;
const MAX_NAME = 200;

function fail(message) {
  throw new Error(`Echo catalog classifier rejected input: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}

function array(value, label, max = MAX_ENTITIES) {
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be an array of at most ${max} items`);
  return value;
}

function numericSourceId(value, label) {
  const text = String(value ?? "");
  if (!/^\d{1,30}$/.test(text)) fail(`${label} must be a bounded numeric source ID`);
  return text;
}

function optionalNumericSourceId(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  return numericSourceId(value, label);
}

function integer(value, label, min, max) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(`${label} must be an integer in ${min}..${max}`);
  }
  return value;
}

function safeName(value, label) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_NAME) {
    fail(`${label} must be a non-empty bounded name`);
  }
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) fail(`${label} contains control characters`);
  return value;
}

function numericArray(value, label) {
  return array(value ?? [], label, 100).map((entry, index) => integer(entry, `${label}[${index}]`, 1, 10_000));
}

function assertSameNumericArray(left, right, label) {
  if (left.length !== right.length || left.some((value, index) => value !== right[index])) {
    fail(`${label} does not match the verified RAW detail`);
  }
}

function buildDetailIndex(echoDetails) {
  const entries = array(echoDetails, "echoDetails");
  const bySourceId = new Map();
  for (const [index, rawEntry] of entries.entries()) {
    const entry = record(rawEntry, `echoDetails[${index}]`);
    const sourceId = numericSourceId(entry.sourceId, `echoDetails[${index}].sourceId`);
    if (bySourceId.has(sourceId)) fail(`echoDetails duplicates source ID ${sourceId}`);
    const detail = record(entry.detail, `echoDetails[${index}].detail`);
    if (detail.MonsterId !== undefined && numericSourceId(detail.MonsterId, `echoDetails[${index}].detail.MonsterId`) !== sourceId) {
      fail(`Echo ${sourceId} RAW detail MonsterId mismatch`);
    }
    bySourceId.set(sourceId, detail);
  }
  return bySourceId;
}

function classifyOne(rawEcho, rawDetail, index) {
  const echo = record(rawEcho, `echoes[${index}]`);
  const detail = record(rawDetail, `RAW Echo detail ${index}`);
  const sourceId = numericSourceId(echo.sourceId, `echoes[${index}].sourceId`);
  const name = safeName(echo.name, `echoes[${index}].name`);
  const qualityId = integer(echo.qualityId, `echoes[${index}].qualityId`, 1, 10);
  const sourceRarity = integer(echo.sourceRarity, `echoes[${index}].sourceRarity`, 0, 10);
  const levelUpGroupId = integer(echo.levelUpGroupId, `echoes[${index}].levelUpGroupId`, 0, 10_000);

  if (integer(detail.QualityId, `RAW Echo ${sourceId}.QualityId`, 1, 10) !== qualityId) {
    fail(`Echo ${sourceId} normalized QualityId does not match RAW detail`);
  }
  if (integer(detail.Rarity, `RAW Echo ${sourceId}.Rarity`, 0, 10) !== sourceRarity) {
    fail(`Echo ${sourceId} normalized Rarity does not match RAW detail`);
  }
  if (integer(detail.LevelUpGroupId, `RAW Echo ${sourceId}.LevelUpGroupId`, 0, 10_000) !== levelUpGroupId) {
    fail(`Echo ${sourceId} normalized LevelUpGroupId does not match RAW detail`);
  }

  const normalizedSonata = numericArray(echo.sourceSonataGroupIds, `echoes[${index}].sourceSonataGroupIds`);
  const rawSonata = numericArray(detail.FetterGroup, `RAW Echo ${sourceId}.FetterGroup`);
  assertSameNumericArray(normalizedSonata, rawSonata, `Echo ${sourceId} Sonata references`);

  const sourcePhantomType = integer(detail.PhantomType, `RAW Echo ${sourceId}.PhantomType`, 0, 10);
  const sourceMainPropRandGroupId = integer(
    record(detail.MainProp, `RAW Echo ${sourceId}.MainProp`).RandGroupId,
    `RAW Echo ${sourceId}.MainProp.RandGroupId`,
    1,
    100_000,
  );
  const sourceItemId = optionalNumericSourceId(detail.ItemId, `RAW Echo ${sourceId}.ItemId`);

  let catalogState = "noncanonical";
  let cost;
  if (sourcePhantomType === 1 && qualityId === 5) {
    if (PHANTOM_NAME_PATTERN.test(name)) {
      catalogState = "phantom-skin";
    } else {
      catalogState = "base";
      cost = COST_BY_MAIN_PROP_GROUP.get(sourceMainPropRandGroupId);
      if (cost === undefined) {
        fail(`base Echo ${sourceId} uses unreviewed MainProp.RandGroupId ${sourceMainPropRandGroupId}`);
      }
      const allowedRarities = ALLOWED_RARITIES_BY_MAIN_PROP_GROUP.get(sourceMainPropRandGroupId);
      if (!allowedRarities?.has(sourceRarity)) {
        fail(
          `base Echo ${sourceId} source rarity ${sourceRarity} contradicts reviewed MainProp.RandGroupId ${sourceMainPropRandGroupId}`,
        );
      }
      if (!sourceItemId) fail(`base Echo ${sourceId} has no stable ItemId`);
    }
  }

  if (!CATALOG_STATES.has(catalogState)) fail(`internal catalog state ${catalogState} is invalid`);
  return {
    ...echo,
    ...(sourceItemId ? { sourceItemId } : {}),
    sourcePhantomType,
    sourceMainPropRandGroupId,
    catalogState,
    ...(cost !== undefined ? { cost } : {}),
  };
}

export function classifyNormalizedEchoCatalog(snapshot, echoDetails) {
  const root = record(snapshot, "normalized snapshot");
  const echoes = array(root.echoes, "echoes");
  const detailIndex = buildDetailIndex(echoDetails);
  if (detailIndex.size !== echoes.length) {
    fail(`RAW Echo detail count ${detailIndex.size} does not match normalized Echo count ${echoes.length}`);
  }

  const seenSourceIds = new Set();
  const seenBaseItemIds = new Set();
  const seenBaseNames = new Set();
  const counts = { base: 0, phantomSkin: 0, noncanonical: 0 };

  const classified = echoes.map((echo, index) => {
    const sourceId = numericSourceId(record(echo, `echoes[${index}]`).sourceId, `echoes[${index}].sourceId`);
    if (seenSourceIds.has(sourceId)) fail(`normalized Echoes duplicate source ID ${sourceId}`);
    seenSourceIds.add(sourceId);
    const detail = detailIndex.get(sourceId);
    if (!detail) fail(`normalized Echo ${sourceId} has no verified RAW detail`);
    const result = classifyOne(echo, detail, index);

    if (result.catalogState === "base") {
      counts.base += 1;
      if (seenBaseItemIds.has(result.sourceItemId)) fail(`base Echo ItemId ${result.sourceItemId} is duplicated`);
      seenBaseItemIds.add(result.sourceItemId);
      if (seenBaseNames.has(result.name)) fail(`base Echo name ${JSON.stringify(result.name)} is duplicated`);
      seenBaseNames.add(result.name);
    } else if (result.catalogState === "phantom-skin") {
      counts.phantomSkin += 1;
    } else {
      counts.noncanonical += 1;
    }
    return result;
  });

  if (seenSourceIds.size !== detailIndex.size) fail("RAW Echo details contain source IDs absent from normalized data");
  if (counts.base === 0) fail("reviewed Echo classifier produced no base Echoes");

  const diagnostics = array(root.diagnostics ?? [], "diagnostics", 1_000)
    .filter((entry) => !isRecord(entry) || entry.code !== "echo-cost-unresolved");
  diagnostics.push({
    code: "echo-canonical-catalog-reviewed",
    severity: "info",
    message:
      `${counts.base} base Echoes are classified from reviewed Encore Release fields. ` +
      `${counts.phantomSkin} Phantom skin rows and ${counts.noncanonical} other source rows remain preserved but are not promoted automatically. ` +
      "Base Echo cost uses MainProp.RandGroupId 501→4, 502→3, 503→1.",
  });

  return {
    ...root,
    echoes: classified,
    diagnostics,
  };
}

export const reviewedEchoCatalogRules = Object.freeze({
  base: Object.freeze({ phantomType: 1, qualityId: 5, excludesPhantomDisplayNames: true }),
  costByMainPropRandGroupId: Object.freeze({ 501: 4, 502: 3, 503: 1 }),
});
