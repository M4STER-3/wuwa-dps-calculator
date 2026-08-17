import { toSingleLineName } from "./normalized-source-hardening.mjs";

const COST_BY_MAIN_PROP_RAND_GROUP = Object.freeze({
  501: 4,
  502: 3,
  503: 1,
});
const MAX_ECHOES = 2_000;
const MAX_SOURCE_ID = 128;

function fail(message) {
  throw new Error(`Echo catalog hardening failed: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}

function array(value, label, max = MAX_ECHOES) {
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be an array of at most ${max} items`);
  return value;
}

function sourceId(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_SOURCE_ID || !/^\d+$/.test(value)) {
    fail(`${label} must be a bounded numeric source ID`);
  }
  return value;
}

function sourceItemId(value, label) {
  const normalized = String(value ?? "");
  if (!/^\d{1,30}$/.test(normalized)) fail(`${label} must be a bounded numeric item ID`);
  return normalized;
}

function isPhantomSkinName(name) {
  return /^Phantom(?::|\s)/i.test(name.trim());
}

function classifyDetail(detail, label) {
  const raw = record(detail, label);
  const phantomType = raw.PhantomType;
  const qualityId = raw.QualityId;
  const itemId = sourceItemId(raw.ItemId, `${label}.ItemId`);
  const rawName = toSingleLineName(raw.MonsterName, `${label}.MonsterName`);
  const randGroup = raw?.MainProp?.RandGroupId;

  if (phantomType === 1 && qualityId === 5) {
    if (isPhantomSkinName(rawName)) {
      return Object.freeze({
        catalogState: "phantom-skin",
        sourceItemId: itemId,
        sourcePhantomType: phantomType,
        sourceQualityId: qualityId,
        ...(Number.isInteger(randGroup) ? { sourceMainPropRandGroupId: randGroup } : {}),
      });
    }

    if (!Object.prototype.hasOwnProperty.call(COST_BY_MAIN_PROP_RAND_GROUP, randGroup)) {
      fail(`${label} is a base Echo with unreviewed MainProp.RandGroupId ${String(randGroup)}`);
    }
    return Object.freeze({
      catalogState: "base",
      cost: COST_BY_MAIN_PROP_RAND_GROUP[randGroup],
      sourceItemId: itemId,
      sourcePhantomType: phantomType,
      sourceQualityId: qualityId,
      sourceMainPropRandGroupId: randGroup,
    });
  }

  return Object.freeze({
    catalogState: "noncanonical",
    sourceItemId: itemId,
    ...(Number.isInteger(phantomType) ? { sourcePhantomType: phantomType } : {}),
    ...(Number.isInteger(qualityId) ? { sourceQualityId: qualityId } : {}),
    ...(Number.isInteger(randGroup) ? { sourceMainPropRandGroupId: randGroup } : {}),
  });
}

/**
 * Classify normalized Encore Echo rows for canonical catalog use.
 *
 * Reviewed Release rule:
 * - PhantomType=1 + QualityId=5 + MonsterName prefixed "Phantom" => skin row;
 * - PhantomType=1 + QualityId=5 + non-Phantom name => base Echo;
 * - other source rows remain noncanonical source data;
 * - only base Echoes receive cost, from the cost-specific main-property groups
 *   501->4, 502->3, 503->1. Any new base group fails closed.
 */
export function hardenEchoCatalogSemantics(normalizedEchoes, echoDetails) {
  const echoes = array(normalizedEchoes, "normalizedEchoes");
  const details = array(echoDetails, "echoDetails");
  if (echoes.length !== details.length) {
    fail(`normalized Echo count ${echoes.length} does not match RAW detail count ${details.length}`);
  }

  const detailBySourceId = new Map();
  for (const [index, rawEntry] of details.entries()) {
    const entry = record(rawEntry, `echoDetails[${index}]`);
    const id = sourceId(entry.sourceId, `echoDetails[${index}].sourceId`);
    if (detailBySourceId.has(id)) fail(`RAW Echo details duplicate source ID ${id}`);
    const detail = record(entry.detail, `echoDetails[${index}].detail`);
    if (detail.MonsterId !== undefined && String(detail.MonsterId) !== id) {
      fail(`RAW Echo detail ${id} MonsterId mismatch`);
    }
    detailBySourceId.set(id, detail);
  }

  const seenNormalizedIds = new Set();
  const seenBaseItemIds = new Set();
  const counts = { base: 0, phantomSkin: 0, noncanonical: 0 };
  const baseCostCounts = { 1: 0, 3: 0, 4: 0 };
  const hardened = echoes.map((rawEcho, index) => {
    const echo = record(rawEcho, `normalizedEchoes[${index}]`);
    const id = sourceId(echo.sourceId, `normalizedEchoes[${index}].sourceId`);
    if (seenNormalizedIds.has(id)) fail(`normalized Echoes duplicate source ID ${id}`);
    seenNormalizedIds.add(id);
    const detail = detailBySourceId.get(id);
    if (!detail) fail(`normalized Echo ${id} has no verified RAW detail`);

    const rawName = toSingleLineName(detail.MonsterName, `RAW Echo ${id}.MonsterName`);
    const normalizedName = toSingleLineName(echo.name, `normalized Echo ${id}.name`);
    if (rawName !== normalizedName) {
      fail(`normalized Echo ${id} name does not match its verified RAW detail`);
    }

    const classification = classifyDetail(detail, `RAW Echo ${id}`);
    if (classification.catalogState === "base") {
      counts.base += 1;
      baseCostCounts[classification.cost] += 1;
      if (seenBaseItemIds.has(classification.sourceItemId)) {
        fail(`base Echoes duplicate source ItemId ${classification.sourceItemId}`);
      }
      seenBaseItemIds.add(classification.sourceItemId);
    } else if (classification.catalogState === "phantom-skin") {
      counts.phantomSkin += 1;
    } else {
      counts.noncanonical += 1;
    }

    return {
      ...echo,
      ...classification,
    };
  });

  if (detailBySourceId.size !== seenNormalizedIds.size) {
    for (const id of detailBySourceId.keys()) {
      if (!seenNormalizedIds.has(id)) fail(`verified RAW Echo ${id} is missing from normalized data`);
    }
  }

  return Object.freeze({
    echoes: hardened,
    summary: Object.freeze({
      rawEchoes: hardened.length,
      baseEchoes: counts.base,
      phantomSkinRows: counts.phantomSkin,
      noncanonicalRows: counts.noncanonical,
      uniqueBaseItemIds: seenBaseItemIds.size,
      baseCostCounts: Object.freeze({ ...baseCostCounts }),
    }),
  });
}

export const reviewedEchoCostByMainPropRandGroup = COST_BY_MAIN_PROP_RAND_GROUP;
