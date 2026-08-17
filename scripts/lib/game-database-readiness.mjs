const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const CHARACTER_ELEMENTS = new Set(["Aero", "Glacio", "Electro", "Fusion", "Havoc", "Spectro"]);
const WEAPON_TYPES = new Set(["Broadblade", "Gauntlets", "Pistols", "Rectifier", "Sword"]);
const VERIFIED_WEAPON_HALF_INDEXES = new Set([20.5, 40.5, 50.5, 60.5, 70.5, 80.5]);
const MAX_DEPTH = 32;
// Current Encore Release measured 278,038 normalized JSON nodes on 2026-08-17.
// Keep bounded headroom without accepting unreviewed multi-million-node amplification.
const MAX_NODES = 500_000;
const MAX_ARRAY = 50_000;
const MAX_KEYS = 20_000;
const MAX_STRING = 2 * 1024 * 1024;
const MAX_ENTITIES = 2_000;

function fail(message) {
  throw new Error(`GameDatabase readiness rejected input: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}

function validateTree(root) {
  const stack = [{ value: root, depth: 0, label: "$" }];
  let visited = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    visited += 1;
    if (visited > MAX_NODES) fail(`JSON exceeds ${MAX_NODES} nodes`);
    if (current.depth > MAX_DEPTH) fail(`JSON exceeds depth ${MAX_DEPTH}`);
    const value = current.value;
    if (typeof value === "string") {
      if (value.length > MAX_STRING) fail(`string too long at ${current.label}`);
      continue;
    }
    if (value === null || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY) fail(`array too large at ${current.label}`);
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], depth: current.depth + 1, label: `${current.label}[${index}]` });
      }
      continue;
    }
    const keys = Object.keys(value);
    if (keys.length > MAX_KEYS) fail(`object has too many keys at ${current.label}`);
    for (const key of keys) {
      if (DANGEROUS_KEYS.has(key)) fail(`forbidden object key ${key} at ${current.label}`);
      stack.push({ value: value[key], depth: current.depth + 1, label: `${current.label}.${key}` });
    }
  }
}

function safeId(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) fail(`${label} is not a bounded source ID`);
  if (DANGEROUS_KEYS.has(value) || /[\u0000-\u001f\u007f-\u009f]/.test(value)) fail(`${label} is unsafe`);
  return value;
}

function boundedName(value, label) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) fail(`${label} is not a valid display name`);
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) fail(`${label} contains control characters`);
  return value;
}

function exactHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(`${label} is not a lowercase SHA-256`);
  return value;
}

function finiteInteger(value, label, min, max) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(`${label} must be an integer in ${min}..${max}`);
  }
  return value;
}

function requireArray(value, label, max = MAX_ENTITIES) {
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be an array of at most ${max} items`);
  return value;
}

function validateUniqueSourceIds(entries, label) {
  const seen = new Set();
  for (const [index, raw] of entries.entries()) {
    const entry = requireRecord(raw, `${label}[${index}]`);
    const sourceId = safeId(entry.sourceId, `${label}[${index}].sourceId`);
    if (seen.has(sourceId)) fail(`${label} duplicates source ID ${sourceId}`);
    seen.add(sourceId);
  }
  return seen;
}

function validateHashIndex(indexValue, ids, label) {
  const index = requireRecord(indexValue, label);
  const keys = Object.keys(index);
  if (keys.length !== ids.size) fail(`${label} count does not match entity count`);
  for (const id of ids) {
    if (!Object.prototype.hasOwnProperty.call(index, id)) fail(`${label} is missing source ID ${id}`);
    exactHash(index[id], `${label}.${id}`);
  }
  for (const key of keys) {
    safeId(key, `${label} key`);
    if (!ids.has(key)) fail(`${label} contains unknown source ID ${key}`);
  }
}

function countGrowthPoints(properties, label, { weapon = false } = {}) {
  const list = properties === undefined ? [] : requireArray(properties, label, 200);
  let points = 0;
  let fractional = 0;
  for (const [propertyIndex, rawProperty] of list.entries()) {
    const property = requireRecord(rawProperty, `${label}[${propertyIndex}]`);
    const growthValues = property.sourceGrowthValues === undefined
      ? []
      : requireArray(property.sourceGrowthValues, `${label}[${propertyIndex}].sourceGrowthValues`, 1_000);
    for (const [growthIndex, rawGrowth] of growthValues.entries()) {
      const growth = requireRecord(rawGrowth, `${label}[${propertyIndex}].sourceGrowthValues[${growthIndex}]`);
      const index = growth.sourceLevelIndex;
      if (typeof index !== "number" || !Number.isFinite(index) || index < 0 || index > 10_000) {
        fail(`${label}[${propertyIndex}].sourceGrowthValues[${growthIndex}].sourceLevelIndex is invalid`);
      }
      if (!Number.isInteger(index)) {
        if (!weapon || !VERIFIED_WEAPON_HALF_INDEXES.has(index)) {
          fail(`${label}[${propertyIndex}] contains unreviewed fractional source index ${String(index)}`);
        }
        fractional += 1;
      }
      points += 1;
    }
  }
  return { points, fractional };
}

function blocker(code, affectedEntities, affectedItems, scope, message) {
  return Object.freeze({ code, affectedEntities, affectedItems, scope, message });
}

export function analyzeGameDatabaseReadiness(snapshot) {
  validateTree(snapshot);
  const root = requireRecord(snapshot, "snapshot");
  if (root.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (root.sourceProvider !== "encore") fail("sourceProvider must be encore");
  if (root.dataset !== "Release") fail("dataset must be Release");
  if (root.language !== "en") fail("language must be en for the reviewed bridge");
  if (typeof root.sourceImportedAt !== "string" || !Number.isFinite(Date.parse(root.sourceImportedAt))) {
    fail("sourceImportedAt must be a valid timestamp");
  }

  const characters = requireArray(root.characters, "characters");
  const weapons = requireArray(root.weapons, "weapons");
  const echoes = requireArray(root.echoes, "echoes");
  const sonataSets = requireArray(root.sonataSets, "sonataSets");
  const characterIds = validateUniqueSourceIds(characters, "characters");
  const weaponIds = validateUniqueSourceIds(weapons, "weapons");
  const echoIds = validateUniqueSourceIds(echoes, "echoes");

  const counts = requireRecord(root.counts, "counts");
  const actualCounts = {
    characters: characters.length,
    weapons: weapons.length,
    echoes: echoes.length,
    sonataSets: sonataSets.length,
  };
  for (const [key, value] of Object.entries(actualCounts)) {
    if (counts[key] !== value) fail(`counts.${key} does not match normalized data`);
  }

  const hashes = requireRecord(root.sourceHashes, "sourceHashes");
  validateHashIndex(hashes.characters, characterIds, "sourceHashes.characters");
  validateHashIndex(hashes.weapons, weaponIds, "sourceHashes.weapons");
  validateHashIndex(hashes.echoes, echoIds, "sourceHashes.echoes");

  let unnamedSkillItems = 0;
  let charactersWithUnnamedSkills = 0;
  let characterGrowthPoints = 0;
  let charactersWithGrowth = 0;
  for (const [index, raw] of characters.entries()) {
    const character = requireRecord(raw, `characters[${index}]`);
    boundedName(character.name, `characters[${index}].name`);
    if (!CHARACTER_ELEMENTS.has(character.element)) fail(`characters[${index}].element is unknown`);
    if (!WEAPON_TYPES.has(character.weaponType)) fail(`characters[${index}].weaponType is unknown`);
    finiteInteger(character.rarity, `characters[${index}].rarity`, 4, 5);
    const skills = requireArray(character.skills, `characters[${index}].skills`, 200);
    let unnamedOnCharacter = 0;
    for (const [skillIndex, rawSkill] of skills.entries()) {
      const skill = requireRecord(rawSkill, `characters[${index}].skills[${skillIndex}]`);
      safeId(skill.sourceSkillId, `characters[${index}].skills[${skillIndex}].sourceSkillId`);
      if (skill.name === undefined) unnamedOnCharacter += 1;
      else boundedName(skill.name, `characters[${index}].skills[${skillIndex}].name`);
      if (typeof skill.type !== "string" || skill.type.trim().length === 0 || skill.type.length > 120) {
        fail(`characters[${index}].skills[${skillIndex}].type is invalid`);
      }
    }
    if (unnamedOnCharacter > 0) charactersWithUnnamedSkills += 1;
    unnamedSkillItems += unnamedOnCharacter;

    const chain = requireArray(character.resonanceChain, `characters[${index}].resonanceChain`, 12);
    const sequences = new Set();
    for (const [chainIndex, rawNode] of chain.entries()) {
      const node = requireRecord(rawNode, `characters[${index}].resonanceChain[${chainIndex}]`);
      const sequence = finiteInteger(node.sequence, `characters[${index}].resonanceChain[${chainIndex}].sequence`, 1, 6);
      sequences.add(sequence);
      boundedName(node.name, `characters[${index}].resonanceChain[${chainIndex}].name`);
    }
    if (chain.length !== 6 || sequences.size !== 6) fail(`characters[${index}].resonanceChain is incomplete`);

    const growth = countGrowthPoints(character.properties, `characters[${index}].properties`);
    characterGrowthPoints += growth.points;
    if (growth.points > 0) charactersWithGrowth += 1;
  }

  let weaponGrowthPoints = 0;
  let weaponFractionalGrowthPoints = 0;
  let weaponsWithGrowth = 0;
  for (const [index, raw] of weapons.entries()) {
    const weapon = requireRecord(raw, `weapons[${index}]`);
    boundedName(weapon.name, `weapons[${index}].name`);
    if (!WEAPON_TYPES.has(weapon.weaponType)) fail(`weapons[${index}].weaponType is unknown`);
    finiteInteger(weapon.rarity, `weapons[${index}].rarity`, 1, 5);
    const growth = countGrowthPoints(weapon.properties, `weapons[${index}].properties`, { weapon: true });
    weaponGrowthPoints += growth.points;
    weaponFractionalGrowthPoints += growth.fractional;
    if (growth.points > 0) weaponsWithGrowth += 1;
  }

  let echoesWithCost = 0;
  let echoesWithSonataRefs = 0;
  let totalEchoSonataRefs = 0;
  for (const [index, raw] of echoes.entries()) {
    const echo = requireRecord(raw, `echoes[${index}]`);
    boundedName(echo.name, `echoes[${index}].name`);
    if (echo.cost !== undefined) {
      if (![1, 3, 4].includes(echo.cost)) fail(`echoes[${index}].cost is not 1, 3, or 4`);
      echoesWithCost += 1;
    }
    const refs = echo.sourceSonataGroupIds === undefined
      ? []
      : requireArray(echo.sourceSonataGroupIds, `echoes[${index}].sourceSonataGroupIds`, 20);
    if (refs.length > 0) echoesWithSonataRefs += 1;
    totalEchoSonataRefs += refs.length;
    for (const [refIndex, value] of refs.entries()) {
      finiteInteger(value, `echoes[${index}].sourceSonataGroupIds[${refIndex}]`, 1, 10_000);
    }
  }

  let sonataWithStableSourceId = 0;
  for (const [index, raw] of sonataSets.entries()) {
    const sonata = requireRecord(raw, `sonataSets[${index}]`);
    boundedName(sonata.name, `sonataSets[${index}].name`);
    if (sonata.sourceId !== undefined) {
      safeId(String(sonata.sourceId), `sonataSets[${index}].sourceId`);
      sonataWithStableSourceId += 1;
    }
    const bonuses = requireArray(sonata.bonuses, `sonataSets[${index}].bonuses`, 10);
    if (bonuses.length === 0) fail(`sonataSets[${index}] has no bonuses`);
    for (const [bonusIndex, rawBonus] of bonuses.entries()) {
      const bonus = requireRecord(rawBonus, `sonataSets[${index}].bonuses[${bonusIndex}]`);
      finiteInteger(bonus.pieces, `sonataSets[${index}].bonuses[${bonusIndex}].pieces`, 1, 10);
      if (typeof bonus.description !== "string" || bonus.description.trim().length === 0) {
        fail(`sonataSets[${index}].bonuses[${bonusIndex}].description is empty`);
      }
    }
  }

  const blockers = [];
  if (characterGrowthPoints > 0) {
    blockers.push(blocker(
      "character-growth-level-map-unresolved",
      charactersWithGrowth,
      characterGrowthPoints,
      "character-stats",
      "Source growth indexes are preserved facts, not verified game levels; no level-stat progression may be emitted yet.",
    ));
  }
  if (unnamedSkillItems > 0) {
    blockers.push(blocker(
      "character-skill-name-missing",
      charactersWithUnnamedSkills,
      unnamedSkillItems,
      "complete-character-skill-catalog",
      "The source has skills without display names. Their IDs/content remain available, but GameDatabase skill names must not be invented.",
    ));
  }
  if (weaponGrowthPoints > 0) {
    blockers.push(blocker(
      "weapon-growth-level-map-unresolved",
      weaponsWithGrowth,
      weaponGrowthPoints,
      "weapon-stats",
      "Weapon source growth indexes, including reviewed half indexes, must not be reinterpreted as game levels without an explicit mapping.",
    ));
  }
  if (echoesWithCost !== echoes.length) {
    blockers.push(blocker(
      "echo-cost-unresolved",
      echoes.length - echoesWithCost,
      echoes.length - echoesWithCost,
      "echo-canonical-catalog",
      "GameDatabaseV1 requires Echo cost 1/3/4, but the normalized source does not yet provide a reviewed mapping for every Echo.",
    ));
  }
  if (sonataWithStableSourceId !== sonataSets.length) {
    blockers.push(blocker(
      "sonata-stable-source-id-unresolved",
      sonataSets.length - sonataWithStableSourceId,
      sonataSets.length - sonataWithStableSourceId,
      "sonata-canonical-identity",
      "Normalized Sonata definitions are currently merged by name; a stable reviewed source ID is required before canonical promotion.",
    ));
  }
  if (totalEchoSonataRefs > 0 && sonataWithStableSourceId !== sonataSets.length) {
    blockers.push(blocker(
      "echo-sonata-reference-map-unresolved",
      echoesWithSonataRefs,
      totalEchoSonataRefs,
      "echo-sonata-references",
      "Echo source Sonata group IDs cannot be converted to canonical Sonata IDs until the stable Sonata identity mapping is reviewed.",
    ));
  }

  return Object.freeze({
    schemaVersion: 1,
    source: Object.freeze({
      provider: "encore",
      dataset: "Release",
      language: "en",
      importedAt: root.sourceImportedAt,
      counts: Object.freeze(actualCounts),
    }),
    readiness: Object.freeze({
      characters: Object.freeze({
        sourceIdentityReady: characters.length,
        completeNamedSkillCatalogReady: characters.length - charactersWithUnnamedSkills,
        statProgressionReady: characterGrowthPoints === 0 ? characters.length : characters.length - charactersWithGrowth,
      }),
      weapons: Object.freeze({
        sourceIdentityReady: weapons.length,
        statProgressionReady: weaponGrowthPoints === 0 ? weapons.length : weapons.length - weaponsWithGrowth,
      }),
      echoes: Object.freeze({
        sourceIdentityReady: echoes.length,
        costResolved: echoesWithCost,
        canonicalCatalogReady: echoesWithCost === echoes.length && sonataWithStableSourceId === sonataSets.length
          ? echoes.length
          : 0,
      }),
      sonataSets: Object.freeze({
        definitionReady: sonataSets.length,
        stableIdentityReady: sonataWithStableSourceId,
        canonicalCatalogReady: sonataWithStableSourceId === sonataSets.length ? sonataSets.length : 0,
      }),
    }),
    observed: Object.freeze({
      unnamedCharacterSkills: unnamedSkillItems,
      charactersWithUnnamedSkills,
      characterGrowthPoints,
      weaponGrowthPoints,
      weaponFractionalGrowthPoints,
      echoesWithSonataSourceRefs: echoesWithSonataRefs,
      totalEchoSonataSourceRefs: totalEchoSonataRefs,
    }),
    blockers: Object.freeze(blockers),
  });
}
