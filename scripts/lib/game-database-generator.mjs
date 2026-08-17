import { createHash } from "node:crypto";

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const ELEMENTS = new Set(["Aero", "Glacio", "Electro", "Fusion", "Havoc", "Spectro"]);
const WEAPON_TYPES = new Set(["Broadblade", "Gauntlets", "Pistols", "Rectifier", "Sword"]);
const ECHO_CATALOG_STATES = new Set(["base", "phantom-skin", "noncanonical"]);
const MAX_ENTITIES = 2_000;
const MAX_SKILLS = 300;
const MAX_TEXT = 100_000;
const MAX_NAME = 200;
const MAX_ID = 160;

function fail(message) {
  throw new Error(`GameDatabase generator rejected input: ${message}`);
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

function safeSourceId(value, label) {
  if (typeof value !== "string" || !/^\d{1,30}$/.test(value) || DANGEROUS_KEYS.has(value)) {
    fail(`${label} must be a bounded numeric source ID`);
  }
  return value;
}

function safeCanonicalId(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ID || !/^[a-z0-9:-]+$/.test(value)) {
    fail(`${label} is not a safe canonical ID`);
  }
  return value;
}

function safeName(value, label) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_NAME) {
    fail(`${label} must be a non-empty string of at most ${MAX_NAME} characters`);
  }
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) fail(`${label} contains control characters`);
  if (/<\s*(?:script|iframe|object|embed)\b|javascript\s*:|data\s*:\s*text\/html|on[a-z]{2,}\s*=/i.test(value)) {
    fail(`${label} contains script-like content`);
  }
  if (/https?:\/\//i.test(value)) fail(`${label} contains an unexpected URL`);
  return value;
}

function safeText(value, label, { optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (typeof value !== "string" || value.length > MAX_TEXT) fail(`${label} must be bounded text`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(value)) {
    fail(`${label} contains forbidden control characters`);
  }
  if (/<\s*(?:script|iframe|object|embed)\b|javascript\s*:|data\s*:\s*text\/html|on[a-z]{2,}\s*=/i.test(value)) {
    fail(`${label} contains script-like content`);
  }
  if (/https?:\/\//i.test(value)) fail(`${label} contains an unexpected URL`);
  return value;
}

function safeHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(`${label} must be a lowercase SHA-256`);
  return value;
}

function finiteInteger(value, label, min, max) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(`${label} must be an integer in ${min}..${max}`);
  }
  return value;
}

function finiteNumber(value, label, min = -1e12, max = 1e12) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(`${label} must be a finite number in the reviewed range`);
  }
  return value;
}

function canonicalId(kind, sourceId) {
  return safeCanonicalId(`${kind}:${sourceId}`, `${kind} canonical ID`);
}

function canonicalChildId(parentId, kind, sourceId) {
  return safeCanonicalId(`${parentId}:${kind}:${sourceId}`, `${kind} canonical child ID`);
}

function sourceMetadata(sourceId, sourceHash, importedAt) {
  return {
    provider: "encore",
    externalId: sourceId,
    sourceHash,
    importedAt,
  };
}

function externalIds(sourceId, sourceItemId) {
  const ids = [{ provider: "encore", value: sourceId }];
  if (sourceItemId !== undefined) {
    ids.push({ provider: "encore-item", value: safeSourceId(String(sourceItemId), "Encore item ID") });
  }
  return ids;
}

function exactHashIndex(value, entries, label) {
  const index = record(value, label);
  const ids = new Set(entries.map((entry) => safeSourceId(record(entry, `${label} entity`).sourceId, `${label} entity sourceId`)));
  if (Object.keys(index).length !== ids.size) fail(`${label} hash count does not match entity count`);
  const output = new Map();
  for (const id of ids) {
    if (!Object.prototype.hasOwnProperty.call(index, id)) fail(`${label} is missing source ID ${id}`);
    output.set(id, safeHash(index[id], `${label}.${id}`));
  }
  for (const key of Object.keys(index)) {
    if (!ids.has(key)) fail(`${label} contains unknown source ID ${key}`);
  }
  return output;
}

function normalizeSkillAttributes(value, label) {
  return array(value ?? [], label, 1_000).map((raw, index) => {
    const attribute = record(raw, `${label}[${index}]`);
    const sourceAttributeId = safeSourceId(String(attribute.sourceAttributeId), `${label}[${index}].sourceAttributeId`);
    const name = safeName(attribute.name, `${label}[${index}].name`);
    const values = array(attribute.values ?? [], `${label}[${index}].values`, 100).map((entry, valueIndex) =>
      safeText(String(entry), `${label}[${index}].values[${valueIndex}]`),
    );
    return { sourceAttributeId, name, values };
  });
}

function buildCharacter(raw, sourceHash, importedAt, report) {
  const value = record(raw, "character");
  const sourceId = safeSourceId(value.sourceId, "character.sourceId");
  const id = canonicalId("character", sourceId);
  const skills = [];
  for (const [index, rawSkill] of array(value.skills ?? [], `character ${sourceId}.skills`, MAX_SKILLS).entries()) {
    const skill = record(rawSkill, `character ${sourceId}.skills[${index}]`);
    const sourceSkillId = safeSourceId(String(skill.sourceSkillId), `character ${sourceId}.skills[${index}].sourceSkillId`);
    if (skill.name === undefined) {
      report.skippedUnnamedCharacterSkills += 1;
      continue;
    }
    const description = safeText(skill.description ?? "", `character ${sourceId}.skills[${index}].description`);
    const attributes = normalizeSkillAttributes(skill.attributes, `character ${sourceId}.skills[${index}].attributes`);
    skills.push({
      id: canonicalChildId(id, "skill", sourceSkillId),
      name: safeName(skill.name, `character ${sourceId}.skills[${index}].name`),
      type: safeName(skill.type, `character ${sourceId}.skills[${index}].type`),
      ...(description ? { description } : {}),
      ...(attributes.length > 0 ? { sourceParameters: { attributes } } : {}),
    });
  }

  const sequences = array(value.resonanceChain ?? [], `character ${sourceId}.resonanceChain`, 12).map((rawNode, index) => {
    const node = record(rawNode, `character ${sourceId}.resonanceChain[${index}]`);
    const sequence = finiteInteger(node.sequence, `character ${sourceId}.resonanceChain[${index}].sequence`, 1, 6);
    return {
      id: canonicalChildId(id, "sequence", String(sequence)),
      sequence,
      name: safeName(node.name, `character ${sourceId}.resonanceChain[${index}].name`),
      ...(node.description !== undefined
        ? { description: safeText(node.description, `character ${sourceId}.resonanceChain[${index}].description`) }
        : {}),
    };
  });
  if (sequences.length !== 6 || new Set(sequences.map((entry) => entry.sequence)).size !== 6) {
    fail(`character ${sourceId} must have exactly Resonance Chain sequences 1..6`);
  }

  const passiveNodes = [];
  for (const [index, rawNode] of array(value.permanentPropertyNodes ?? [], `character ${sourceId}.permanentPropertyNodes`, 1_000).entries()) {
    const node = record(rawNode, `character ${sourceId}.permanentPropertyNodes[${index}]`);
    if (node.title === undefined) {
      report.skippedUntitledPassiveNodes += 1;
      continue;
    }
    const sourceNodeId = safeSourceId(String(node.sourceNodeId), `character ${sourceId}.permanentPropertyNodes[${index}].sourceNodeId`);
    passiveNodes.push({
      id: canonicalChildId(id, "passive", sourceNodeId),
      name: safeName(node.title, `character ${sourceId}.permanentPropertyNodes[${index}].title`),
      ...(node.description !== undefined
        ? { description: safeText(node.description, `character ${sourceId}.permanentPropertyNodes[${index}].description`) }
        : {}),
    });
  }

  if (!ELEMENTS.has(value.element)) fail(`character ${sourceId} has unknown element`);
  if (!WEAPON_TYPES.has(value.weaponType)) fail(`character ${sourceId} has unknown weapon type`);
  return {
    id,
    externalIds: externalIds(sourceId),
    name: safeName(value.name, `character ${sourceId}.name`),
    element: value.element,
    weaponType: value.weaponType,
    rarity: finiteInteger(value.rarity, `character ${sourceId}.rarity`, 4, 5),
    maxLevel: finiteInteger(value.maxLevel, `character ${sourceId}.maxLevel`, 1, 100),
    skills,
    sequences,
    passiveNodes,
    source: sourceMetadata(sourceId, sourceHash, importedAt),
  };
}

function buildWeapon(raw, sourceHash, importedAt, report) {
  const value = record(raw, "weapon");
  const sourceId = safeSourceId(value.sourceId, "weapon.sourceId");
  const id = canonicalId("weapon", sourceId);
  if (!WEAPON_TYPES.has(value.weaponType)) fail(`weapon ${sourceId} has unknown weapon type`);
  let passive;
  if (value.passive !== undefined) {
    const sourcePassive = record(value.passive, `weapon ${sourceId}.passive`);
    if (sourcePassive.name !== undefined) {
      passive = {
        name: safeName(sourcePassive.name, `weapon ${sourceId}.passive.name`),
        ...(sourcePassive.descriptionTemplate !== undefined
          ? { description: safeText(sourcePassive.descriptionTemplate, `weapon ${sourceId}.passive.descriptionTemplate`) }
          : {}),
        ranks: [],
      };
      const rankSets = array(sourcePassive.rankParameterSets ?? [], `weapon ${sourceId}.passive.rankParameterSets`, 20);
      if (rankSets.length > 0) report.weaponPassiveRankSetsNotRendered += rankSets.length;
    } else {
      report.skippedUnnamedWeaponPassives += 1;
    }
  }
  return {
    id,
    externalIds: externalIds(sourceId),
    name: safeName(value.name, `weapon ${sourceId}.name`),
    type: value.weaponType,
    rarity: finiteInteger(value.rarity, `weapon ${sourceId}.rarity`, 1, 5),
    baseStats: {},
    ...(passive ? { passive } : {}),
    source: sourceMetadata(sourceId, sourceHash, importedAt),
  };
}

function derivedSonataHash(sonata, contributingEchoHashes) {
  const payload = JSON.stringify({
    sourceId: sonata.sourceId,
    name: sonata.name,
    bonuses: sonata.bonuses,
    contributors: contributingEchoHashes,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function buildSonata(raw, importedAt, echoHashes, echoes) {
  const value = record(raw, "sonata");
  const sourceId = safeSourceId(String(value.sourceId), "sonata.sourceId");
  const sourceIdNumber = Number(sourceId);
  const bonuses = array(value.bonuses ?? [], `sonata ${sourceId}.bonuses`, 20).map((rawBonus, index) => {
    const bonus = record(rawBonus, `sonata ${sourceId}.bonuses[${index}]`);
    return {
      pieces: finiteInteger(bonus.pieces, `sonata ${sourceId}.bonuses[${index}].pieces`, 1, 10),
      description: safeText(bonus.description, `sonata ${sourceId}.bonuses[${index}].description`),
    };
  });
  if (bonuses.length === 0) fail(`sonata ${sourceId} has no bonuses`);
  const contributorPairs = [];
  for (const rawEcho of echoes) {
    const echo = record(rawEcho, "echo for Sonata provenance");
    const refs = array(echo.sourceSonataGroupIds ?? [], `echo ${echo.sourceId}.sourceSonataGroupIds`, 100);
    if (!refs.includes(sourceIdNumber)) continue;
    const echoSourceId = safeSourceId(echo.sourceId, "echo source ID for Sonata provenance");
    const hash = echoHashes.get(echoSourceId);
    if (!hash) fail(`sonata ${sourceId} contributor ${echoSourceId} has no source hash`);
    contributorPairs.push({ sourceId: echoSourceId, sourceHash: hash });
  }
  contributorPairs.sort((left, right) => Number(left.sourceId) - Number(right.sourceId));
  if (contributorPairs.length === 0) fail(`sonata ${sourceId} has no contributing Echo source hashes`);
  const normalizedSonata = {
    sourceId,
    name: safeName(value.name, `sonata ${sourceId}.name`),
    bonuses,
  };
  return {
    id: canonicalId("sonata", sourceId),
    externalIds: externalIds(sourceId),
    name: normalizedSonata.name,
    bonuses,
    source: sourceMetadata(
      sourceId,
      derivedSonataHash(normalizedSonata, contributorPairs),
      importedAt,
    ),
  };
}

function buildEcho(raw, sourceHash, importedAt, sonataIds) {
  const value = record(raw, "echo");
  const sourceId = safeSourceId(value.sourceId, "echo.sourceId");
  if (!ECHO_CATALOG_STATES.has(value.catalogState)) {
    fail(`echo ${sourceId} is missing a reviewed catalogState`);
  }
  if (value.catalogState !== "base") return null;
  const cost = finiteInteger(value.cost, `echo ${sourceId}.cost`, 1, 4);
  if (![1, 3, 4].includes(cost)) fail(`echo ${sourceId}.cost must be 1, 3, or 4`);
  const sonataSetIds = array(value.sourceSonataGroupIds ?? [], `echo ${sourceId}.sourceSonataGroupIds`, 100).map((rawId, index) => {
    const sourceSonataId = safeSourceId(String(rawId), `echo ${sourceId}.sourceSonataGroupIds[${index}]`);
    const id = canonicalId("sonata", sourceSonataId);
    if (!sonataIds.has(id)) fail(`echo ${sourceId} references unknown Sonata ${sourceSonataId}`);
    return id;
  });
  if (new Set(sonataSetIds).size !== sonataSetIds.length) fail(`echo ${sourceId} contains duplicate Sonata references`);

  let skill;
  if (value.skill !== undefined) {
    const sourceSkill = record(value.skill, `echo ${sourceId}.skill`);
    const descriptionSource = sourceSkill.description ?? sourceSkill.summary;
    if (descriptionSource !== undefined && sourceSkill.sourceSkillId !== undefined) {
      const sourceSkillId = safeSourceId(String(sourceSkill.sourceSkillId), `echo ${sourceId}.skill.sourceSkillId`);
      skill = {
        id: canonicalChildId(canonicalId("echo", sourceId), "skill", sourceSkillId),
        description: safeText(descriptionSource, `echo ${sourceId}.skill.description`),
        ...(sourceSkill.cooldownSeconds !== undefined
          ? { cooldownSeconds: finiteNumber(sourceSkill.cooldownSeconds, `echo ${sourceId}.skill.cooldownSeconds`, 0, 10_000) }
          : {}),
      };
    }
  }

  return {
    id: canonicalId("echo", sourceId),
    externalIds: externalIds(sourceId, value.sourceItemId),
    name: safeName(value.name, `echo ${sourceId}.name`),
    cost,
    sonataSetIds,
    ...(skill ? { skill } : {}),
    source: sourceMetadata(sourceId, sourceHash, importedAt),
  };
}

function assertUniqueIds(entries, label) {
  const ids = new Set();
  for (const entry of entries) {
    safeCanonicalId(entry.id, `${label} ID`);
    if (ids.has(entry.id)) fail(`${label} contains duplicate canonical ID ${entry.id}`);
    ids.add(entry.id);
  }
}

export function generateGameDatabaseV1(snapshot) {
  const root = record(snapshot, "normalized snapshot");
  if (root.schemaVersion !== 1 || root.sourceProvider !== "encore" || root.dataset !== "Release" || root.language !== "en") {
    fail("normalized snapshot envelope is outside the reviewed Encore Release boundary");
  }
  const importedAt = safeText(root.sourceImportedAt, "sourceImportedAt");
  if (!Number.isFinite(Date.parse(importedAt))) fail("sourceImportedAt must be a valid timestamp");
  const charactersRaw = array(root.characters, "characters");
  const weaponsRaw = array(root.weapons, "weapons");
  const echoesRaw = array(root.echoes, "echoes");
  const sonataRaw = array(root.sonataSets, "sonataSets");

  const counts = record(root.counts, "counts");
  for (const [key, actual] of Object.entries({
    characters: charactersRaw.length,
    weapons: weaponsRaw.length,
    echoes: echoesRaw.length,
    sonataSets: sonataRaw.length,
  })) {
    if (counts[key] !== actual) fail(`counts.${key} does not match normalized data`);
  }

  const hashes = record(root.sourceHashes, "sourceHashes");
  const characterHashes = exactHashIndex(hashes.characters, charactersRaw, "sourceHashes.characters");
  const weaponHashes = exactHashIndex(hashes.weapons, weaponsRaw, "sourceHashes.weapons");
  const echoHashes = exactHashIndex(hashes.echoes, echoesRaw, "sourceHashes.echoes");

  const report = {
    skippedUnnamedCharacterSkills: 0,
    skippedUntitledPassiveNodes: 0,
    skippedUnnamedWeaponPassives: 0,
    weaponPassiveRankSetsNotRendered: 0,
    skippedNonBaseEchoes: 0,
    characterStatsOmitted: charactersRaw.length,
    weaponStatsOmitted: weaponsRaw.length,
    sourceEchoCount: echoesRaw.length,
  };

  const characters = charactersRaw
    .map((entry) => {
      const sourceId = safeSourceId(record(entry, "character").sourceId, "character.sourceId");
      return buildCharacter(entry, characterHashes.get(sourceId), importedAt, report);
    })
    .sort((left, right) => Number(left.source.externalId) - Number(right.source.externalId));
  const weapons = weaponsRaw
    .map((entry) => {
      const sourceId = safeSourceId(record(entry, "weapon").sourceId, "weapon.sourceId");
      return buildWeapon(entry, weaponHashes.get(sourceId), importedAt, report);
    })
    .sort((left, right) => Number(left.source.externalId) - Number(right.source.externalId));
  const sonataSets = sonataRaw
    .map((entry) => buildSonata(entry, importedAt, echoHashes, echoesRaw))
    .sort((left, right) => Number(left.source.externalId) - Number(right.source.externalId));
  const sonataIds = new Set(sonataSets.map((entry) => entry.id));
  const echoes = [];
  for (const entry of echoesRaw) {
    const sourceId = safeSourceId(record(entry, "echo").sourceId, "echo.sourceId");
    const generated = buildEcho(entry, echoHashes.get(sourceId), importedAt, sonataIds);
    if (generated) echoes.push(generated);
    else report.skippedNonBaseEchoes += 1;
  }
  echoes.sort((left, right) => Number(left.source.externalId) - Number(right.source.externalId));

  assertUniqueIds(characters, "characters");
  assertUniqueIds(weapons, "weapons");
  assertUniqueIds(echoes, "echoes");
  assertUniqueIds(sonataSets, "sonataSets");

  const database = {
    schemaVersion: 1,
    source: {
      provider: "encore",
      gameVersion: "Release",
      generatedAt: importedAt,
    },
    counts: {
      characters: characters.length,
      weapons: weapons.length,
      echoes: echoes.length,
      sonataSets: sonataSets.length,
    },
    characters,
    weapons,
    echoes,
    sonataSets,
  };

  return {
    database,
    report: {
      ...report,
      generatedCounts: database.counts,
      sonataSourceHashStrategy: "sha256(normalized Sonata definition + sorted contributing Echo raw hashes)",
      unresolved: [
        "character level/stat growth source-index mapping",
        "weapon level/stat growth source-index mapping",
        "weapon passive rank placeholder rendering",
        ...(report.skippedUnnamedCharacterSkills > 0 ? ["source character skills without display names"] : []),
      ],
    },
  };
}
