import { createHash } from "node:crypto";

const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const ELEMENTS = new Set(["Aero", "Glacio", "Electro", "Fusion", "Havoc", "Spectro"]);
const WEAPON_TYPES = new Set(["Broadblade", "Gauntlets", "Pistols", "Rectifier", "Sword"]);
const ECHO_CATALOG_STATES = new Set(["base", "phantom-skin", "noncanonical"]);
const MAX_ENTITIES = 2_000;
const MAX_SKILLS = 300;
const MAX_TEXT = 100_000;
const MAX_NAME = 200;
const MAX_ID = 180;

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

function safeEntitySourceId(value, label) {
  if (typeof value !== "string" || !/^\d{1,30}$/.test(value) || DANGEROUS_KEYS.has(value)) {
    fail(`${label} must be a bounded numeric source ID`);
  }
  return value;
}

function safeOpaqueSourceId(value, label) {
  const text = String(value ?? "");
  if (
    text.length === 0 ||
    text.length > 160 ||
    DANGEROUS_KEYS.has(text) ||
    /[\u0000-\u001f\u007f-\u009f]/.test(text) ||
    !/^[A-Za-z0-9._:-]+$/.test(text)
  ) {
    fail(`${label} is not a reviewed bounded source identifier`);
  }
  return text;
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

function childCanonicalId(parentId, kind, sourceId) {
  const digest = createHash("sha256").update(String(sourceId), "utf8").digest("hex").slice(0, 20);
  return safeCanonicalId(`${parentId}:${kind}:${digest}`, `${kind} canonical child ID`);
}

function sourceMetadata(sourceId, sourceHash, importedAt, language) {
  return {
    provider: "encore",
    externalId: sourceId,
    language,
    dataset: "Release",
    importedAt,
    sourceHash,
  };
}

function externalIds(sourceId, wuwaId) {
  return {
    encore: sourceId,
    ...(wuwaId !== undefined ? { wuwa: safeEntitySourceId(String(wuwaId), "Wuthering Waves external ID") } : {}),
  };
}

function exactHashIndex(value, entries, label) {
  const index = record(value, label);
  const ids = new Set(
    entries.map((entry) => safeEntitySourceId(record(entry, `${label} entity`).sourceId, `${label} entity sourceId`)),
  );
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
    const sourceAttributeId = safeOpaqueSourceId(attribute.sourceAttributeId, `${label}[${index}].sourceAttributeId`);
    const name = safeName(attribute.name, `${label}[${index}].name`);
    const values = array(attribute.values ?? [], `${label}[${index}].values`, 100).map((entry, valueIndex) =>
      safeText(String(entry), `${label}[${index}].values[${valueIndex}]`),
    );
    return { sourceAttributeId, name, values };
  });
}

function buildCharacter(raw, sourceHash, importedAt, language, report) {
  const value = record(raw, "character");
  const sourceId = safeEntitySourceId(value.sourceId, "character.sourceId");
  const id = canonicalId("character", sourceId);
  if (!ELEMENTS.has(value.element)) fail(`character ${sourceId} has unknown element`);
  if (!WEAPON_TYPES.has(value.weaponType)) fail(`character ${sourceId} has unknown weapon type`);

  const skills = [];
  for (const [index, rawSkill] of array(value.skills ?? [], `character ${sourceId}.skills`, MAX_SKILLS).entries()) {
    const skill = record(rawSkill, `character ${sourceId}.skills[${index}]`);
    const sourceSkillId = safeOpaqueSourceId(skill.sourceSkillId, `character ${sourceId}.skills[${index}].sourceSkillId`);
    if (skill.name === undefined) {
      report.skippedUnnamedCharacterSkills += 1;
      continue;
    }
    const type = safeName(skill.type, `character ${sourceId}.skills[${index}].type`);
    const attributes = normalizeSkillAttributes(skill.attributes, `character ${sourceId}.skills[${index}].attributes`);
    const description = safeText(skill.description ?? "", `character ${sourceId}.skills[${index}].description`);
    skills.push({
      id: childCanonicalId(id, "skill", sourceSkillId),
      name: safeName(skill.name, `character ${sourceId}.skills[${index}].name`),
      ...(description ? { description } : {}),
      sourceParameters: {
        sourceSkillId,
        type,
        ...(attributes.length > 0 ? { attributes } : {}),
      },
    });
  }

  const sequences = array(value.resonanceChain ?? [], `character ${sourceId}.resonanceChain`, 12).map((rawNode, index) => {
    const node = record(rawNode, `character ${sourceId}.resonanceChain[${index}]`);
    return {
      sequence: finiteInteger(node.sequence, `character ${sourceId}.resonanceChain[${index}].sequence`, 1, 6),
      name: safeName(node.name, `character ${sourceId}.resonanceChain[${index}].name`),
      description: safeText(node.description, `character ${sourceId}.resonanceChain[${index}].description`),
    };
  });
  if (sequences.length !== 6 || new Set(sequences.map((entry) => entry.sequence)).size !== 6) {
    fail(`character ${sourceId} must have exactly Resonance Chain sequences 1..6`);
  }

  const passiveNodes = array(value.permanentPropertyNodes ?? [], `character ${sourceId}.permanentPropertyNodes`, 1_000);
  report.omittedPermanentCharacterNodes += passiveNodes.length;

  return {
    kind: "character",
    id,
    externalIds: externalIds(sourceId, sourceId),
    name: safeName(value.name, `character ${sourceId}.name`),
    source: sourceMetadata(sourceId, sourceHash, importedAt, language),
    rarity: finiteInteger(value.rarity, `character ${sourceId}.rarity`, 4, 5),
    element: value.element,
    weaponType: value.weaponType,
    skills,
    sequences,
  };
}

function buildWeapon(raw, sourceHash, importedAt, language, report) {
  const value = record(raw, "weapon");
  const sourceId = safeEntitySourceId(value.sourceId, "weapon.sourceId");
  if (!WEAPON_TYPES.has(value.weaponType)) fail(`weapon ${sourceId} has unknown weapon type`);

  let passive;
  if (value.passive !== undefined) {
    const sourcePassive = record(value.passive, `weapon ${sourceId}.passive`);
    const name = sourcePassive.name === undefined
      ? undefined
      : safeName(sourcePassive.name, `weapon ${sourceId}.passive.name`);
    const description = sourcePassive.descriptionTemplate === undefined
      ? undefined
      : safeText(sourcePassive.descriptionTemplate, `weapon ${sourceId}.passive.descriptionTemplate`);
    const rankSets = array(sourcePassive.rankParameterSets ?? [], `weapon ${sourceId}.passive.rankParameterSets`, 20);
    report.weaponPassiveRankSetsNotRendered += rankSets.length;
    if (name !== undefined || description !== undefined || rankSets.length > 0) {
      passive = {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ranks: [],
      };
    }
  }

  return {
    kind: "weapon",
    id: canonicalId("weapon", sourceId),
    externalIds: externalIds(sourceId, sourceId),
    name: safeName(value.name, `weapon ${sourceId}.name`),
    source: sourceMetadata(sourceId, sourceHash, importedAt, language),
    type: value.weaponType,
    rarity: finiteInteger(value.rarity, `weapon ${sourceId}.rarity`, 1, 5),
    baseStats: {},
    ...(passive ? { passive } : {}),
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

function buildSonata(raw, importedAt, language, echoHashes, echoes) {
  const value = record(raw, "sonata");
  const sourceId = safeEntitySourceId(String(value.sourceId), "sonata.sourceId");
  const sourceIdNumber = Number(sourceId);
  const bonuses = array(value.bonuses ?? [], `sonata ${sourceId}.bonuses`, 20).map((rawBonus, index) => {
    const bonus = record(rawBonus, `sonata ${sourceId}.bonuses[${index}]`);
    return {
      pieces: finiteInteger(bonus.pieces, `sonata ${sourceId}.bonuses[${index}].pieces`, 1, 10),
      description: safeText(bonus.description, `sonata ${sourceId}.bonuses[${index}].description`),
    };
  });
  if (bonuses.length === 0) fail(`sonata ${sourceId} has no bonuses`);

  const contributors = [];
  for (const rawEcho of echoes) {
    const echo = record(rawEcho, "echo for Sonata provenance");
    const refs = array(echo.sourceSonataGroupIds ?? [], `echo ${echo.sourceId}.sourceSonataGroupIds`, 100);
    if (!refs.includes(sourceIdNumber)) continue;
    const echoSourceId = safeEntitySourceId(echo.sourceId, "echo source ID for Sonata provenance");
    const sourceHash = echoHashes.get(echoSourceId);
    if (!sourceHash) fail(`sonata ${sourceId} contributor ${echoSourceId} has no source hash`);
    contributors.push({ sourceId: echoSourceId, sourceHash });
  }
  contributors.sort((left, right) => Number(left.sourceId) - Number(right.sourceId));
  if (contributors.length === 0) fail(`sonata ${sourceId} has no contributing Echo source hashes`);

  const normalizedSonata = {
    sourceId,
    name: safeName(value.name, `sonata ${sourceId}.name`),
    bonuses,
  };
  return {
    kind: "sonata-set",
    id: canonicalId("sonata-set", sourceId),
    externalIds: externalIds(sourceId),
    name: normalizedSonata.name,
    source: sourceMetadata(
      sourceId,
      derivedSonataHash(normalizedSonata, contributors),
      importedAt,
      language,
    ),
    bonuses,
  };
}

function buildEcho(raw, sourceHash, importedAt, language, sonataIds, report) {
  const value = record(raw, "echo");
  const sourceId = safeEntitySourceId(value.sourceId, "echo.sourceId");
  if (!ECHO_CATALOG_STATES.has(value.catalogState)) {
    fail(`echo ${sourceId} is missing a reviewed catalogState`);
  }
  if (value.catalogState !== "base") {
    if (value.catalogState === "phantom-skin") report.skippedPhantomSkinRows += 1;
    else report.skippedNoncanonicalEchoRows += 1;
    return null;
  }

  const cost = finiteInteger(value.cost, `echo ${sourceId}.cost`, 1, 4);
  if (![1, 3, 4].includes(cost)) fail(`echo ${sourceId}.cost must be 1, 3, or 4`);
  const sourceItemId = safeEntitySourceId(value.sourceItemId, `echo ${sourceId}.sourceItemId`);
  const sonataSetIds = array(value.sourceSonataGroupIds ?? [], `echo ${sourceId}.sourceSonataGroupIds`, 100).map((rawId, index) => {
    const sourceSonataId = safeEntitySourceId(String(rawId), `echo ${sourceId}.sourceSonataGroupIds[${index}]`);
    const id = canonicalId("sonata-set", sourceSonataId);
    if (!sonataIds.has(id)) fail(`echo ${sourceId} references unknown Sonata ${sourceSonataId}`);
    return id;
  });
  if (new Set(sonataSetIds).size !== sonataSetIds.length) fail(`echo ${sourceId} contains duplicate Sonata references`);

  let echoSkill;
  if (value.skill !== undefined) {
    const skill = record(value.skill, `echo ${sourceId}.skill`);
    const descriptionSource = skill.description ?? skill.summary;
    if (descriptionSource !== undefined) {
      const sourceParameters = {};
      if (skill.sourceSkillId !== undefined) {
        sourceParameters.sourceSkillId = safeOpaqueSourceId(skill.sourceSkillId, `echo ${sourceId}.skill.sourceSkillId`);
      }
      if (skill.cooldownSeconds !== undefined) {
        sourceParameters.cooldownSeconds = finiteNumber(skill.cooldownSeconds, `echo ${sourceId}.skill.cooldownSeconds`, 0, 10_000);
      }
      if (skill.summary !== undefined && skill.summary !== descriptionSource) {
        sourceParameters.summary = safeText(skill.summary, `echo ${sourceId}.skill.summary`);
      }
      echoSkill = {
        description: safeText(descriptionSource, `echo ${sourceId}.skill.description`),
        ...(Object.keys(sourceParameters).length > 0 ? { sourceParameters } : {}),
      };
    }
  }

  return {
    kind: "echo",
    id: canonicalId("echo", sourceId),
    externalIds: externalIds(sourceId, sourceItemId),
    name: safeName(value.name, `echo ${sourceId}.name`),
    source: sourceMetadata(sourceId, sourceHash, importedAt, language),
    cost,
    sonataSetIds,
    ...(echoSkill ? { echoSkill } : {}),
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
  const language = safeName(root.language, "language");

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
    if (counts[key] !== actual) fail(`counts.${key} does not match normalized source data`);
  }

  const hashes = record(root.sourceHashes, "sourceHashes");
  const characterHashes = exactHashIndex(hashes.characters, charactersRaw, "sourceHashes.characters");
  const weaponHashes = exactHashIndex(hashes.weapons, weaponsRaw, "sourceHashes.weapons");
  const echoHashes = exactHashIndex(hashes.echoes, echoesRaw, "sourceHashes.echoes");

  const report = {
    skippedUnnamedCharacterSkills: 0,
    omittedPermanentCharacterNodes: 0,
    weaponPassiveRankSetsNotRendered: 0,
    skippedPhantomSkinRows: 0,
    skippedNoncanonicalEchoRows: 0,
    characterStatsOmitted: charactersRaw.length,
    weaponStatsOmitted: weaponsRaw.length,
    sourceEchoCount: echoesRaw.length,
  };

  const characters = charactersRaw
    .map((entry) => {
      const sourceId = safeEntitySourceId(record(entry, "character").sourceId, "character.sourceId");
      return buildCharacter(entry, characterHashes.get(sourceId), importedAt, language, report);
    })
    .sort((left, right) => Number(left.source.externalId) - Number(right.source.externalId));

  const weapons = weaponsRaw
    .map((entry) => {
      const sourceId = safeEntitySourceId(record(entry, "weapon").sourceId, "weapon.sourceId");
      return buildWeapon(entry, weaponHashes.get(sourceId), importedAt, language, report);
    })
    .sort((left, right) => Number(left.source.externalId) - Number(right.source.externalId));

  const sonataSets = sonataRaw
    .map((entry) => buildSonata(entry, importedAt, language, echoHashes, echoesRaw))
    .sort((left, right) => Number(left.source.externalId) - Number(right.source.externalId));
  const sonataIds = new Set(sonataSets.map((entry) => entry.id));

  const echoes = [];
  for (const entry of echoesRaw) {
    const sourceId = safeEntitySourceId(record(entry, "echo").sourceId, "echo.sourceId");
    const generated = buildEcho(entry, echoHashes.get(sourceId), importedAt, language, sonataIds, report);
    if (generated) echoes.push(generated);
  }
  echoes.sort((left, right) => Number(left.source.externalId) - Number(right.source.externalId));

  assertUniqueIds(characters, "characters");
  assertUniqueIds(weapons, "weapons");
  assertUniqueIds(echoes, "echoes");
  assertUniqueIds(sonataSets, "sonataSets");

  const database = {
    manifest: {
      schemaVersion: 1,
      dataset: "Release",
      generatedAt: importedAt,
      sourceProvider: "encore",
      sourceImportedAt: importedAt,
      counts: {
        characters: characters.length,
        weapons: weapons.length,
        echoes: echoes.length,
        sonataSets: sonataSets.length,
      },
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
      generatedCounts: database.manifest.counts,
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
