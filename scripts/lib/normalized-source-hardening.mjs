const NAME_CONTROL_PATTERN = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/;
const MAX_NAME = 200;
const MAX_SONATA_GROUP_ID = 10_000;

function fail(message) {
  throw new Error(`Normalized source hardening failed: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be an object`);
  return value;
}

function requireArray(value, label, max = 10_000) {
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be an array of at most ${max} items`);
  return value;
}

export function toSingleLineName(value, label = "name") {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_NAME) {
    fail(`${label} must be a non-empty string of at most ${MAX_NAME} characters`);
  }
  if (NAME_CONTROL_PATTERN.test(value)) fail(`${label} contains a forbidden control character`);
  const singleLine = value.replace(/\n+/g, " ").replace(/ +/g, " ").trim();
  if (!singleLine) fail(`${label} is empty after single-line normalization`);
  if (singleLine.length > MAX_NAME) fail(`${label} exceeds ${MAX_NAME} characters after normalization`);
  return singleLine;
}

function normalizedSourceGroupName(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_NAME * 4) {
    fail(`${label} must be a bounded source group name`);
  }
  if (/<\s*(?:script|iframe|object|embed)\b|javascript\s*:|data\s*:\s*text\/html|on[a-z]{2,}\s*=/i.test(value)) {
    fail(`${label} contains script-like markup`);
  }
  if (/https?:\/\//i.test(value)) fail(`${label} contains an unexpected URL`);
  const plain = value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>\r\n]{1,512}>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return toSingleLineName(plain, label);
}

function parseGroupId(value, label) {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_SONATA_GROUP_ID) {
    fail(`${label} must be an integer in 1..${MAX_SONATA_GROUP_ID}`);
  }
  return String(value);
}

function registerIdentity(byId, byName, sourceId, name, label) {
  const previousName = byId.get(sourceId);
  if (previousName !== undefined && previousName !== name) {
    fail(`${label} maps Sonata source ID ${sourceId} to conflicting names`);
  }
  const previousId = byName.get(name);
  if (previousId !== undefined && previousId !== sourceId) {
    fail(`${label} maps Sonata name ${JSON.stringify(name)} to conflicting source IDs`);
  }
  byId.set(sourceId, name);
  byName.set(name, sourceId);
}

/**
 * Build a one-to-one Sonata identity mapping from Encore's structured
 * FetterGroupDetails.Group.Id/FetterGroupName data. Display names are only used
 * to connect the separately normalized FetterDetails definition to the source
 * ID; identity itself is the numeric source ID.
 */
export function buildStableSonataIdentityIndex(echoDetails) {
  const entries = requireArray(echoDetails, "echoDetails", 2_000);
  const byId = new Map();
  const byName = new Map();
  let structuredEchoes = 0;
  let sourceReferences = 0;

  for (const [echoIndex, rawEntry] of entries.entries()) {
    const entry = requireRecord(rawEntry, `echoDetails[${echoIndex}]`);
    const detail = requireRecord(entry.detail, `echoDetails[${echoIndex}].detail`);
    const structured = detail.FetterGroupDetails === undefined
      ? []
      : requireArray(detail.FetterGroupDetails, `echoDetails[${echoIndex}].detail.FetterGroupDetails`, 100);
    const references = detail.FetterGroup === undefined
      ? []
      : requireArray(detail.FetterGroup, `echoDetails[${echoIndex}].detail.FetterGroup`, 100);
    const definitions = detail.FetterDetails === undefined
      ? {}
      : requireRecord(detail.FetterDetails, `echoDetails[${echoIndex}].detail.FetterDetails`);

    sourceReferences += references.length;
    if (structured.length > 0) structuredEchoes += 1;

    const localIds = new Set();
    const localNames = new Set();
    for (const [groupIndex, rawGroupEntry] of structured.entries()) {
      const groupEntry = requireRecord(
        rawGroupEntry,
        `echoDetails[${echoIndex}].detail.FetterGroupDetails[${groupIndex}]`,
      );
      const group = requireRecord(
        groupEntry.Group,
        `echoDetails[${echoIndex}].detail.FetterGroupDetails[${groupIndex}].Group`,
      );
      const sourceId = parseGroupId(
        group.Id,
        `echoDetails[${echoIndex}].detail.FetterGroupDetails[${groupIndex}].Group.Id`,
      );
      const name = normalizedSourceGroupName(
        group.FetterGroupName,
        `echoDetails[${echoIndex}].detail.FetterGroupDetails[${groupIndex}].Group.FetterGroupName`,
      );
      registerIdentity(byId, byName, sourceId, name, `echoDetails[${echoIndex}]`);
      localIds.add(sourceId);
      localNames.add(name);
    }

    if (structured.length === 0 && (references.length > 0 || Object.keys(definitions).length > 0)) {
      // Older/synthetic fixtures may not expose structured group metadata. In
      // that case identity remains unresolved instead of being guessed by name.
      continue;
    }

    for (const [referenceIndex, rawReference] of references.entries()) {
      const sourceId = parseGroupId(
        rawReference,
        `echoDetails[${echoIndex}].detail.FetterGroup[${referenceIndex}]`,
      );
      if (!localIds.has(sourceId)) {
        fail(`echoDetails[${echoIndex}] references Sonata source ID ${sourceId} without a structured local definition`);
      }
    }

    const definitionNames = new Set(
      Object.keys(definitions).map((rawName, definitionIndex) =>
        normalizedSourceGroupName(rawName, `echoDetails[${echoIndex}].detail.FetterDetails key ${definitionIndex}`),
      ),
    );
    for (const name of localNames) {
      if (!definitionNames.has(name)) {
        fail(`echoDetails[${echoIndex}] structured Sonata ${JSON.stringify(name)} has no FetterDetails definition`);
      }
    }
    for (const name of definitionNames) {
      if (!localNames.has(name)) {
        fail(`echoDetails[${echoIndex}] FetterDetails Sonata ${JSON.stringify(name)} has no structured source ID`);
      }
    }
  }

  if (byId.size === 0) {
    return Object.freeze({ resolved: false, byId, byName, structuredEchoes, sourceReferences });
  }
  if (structuredEchoes === 0) fail("internal Sonata identity state is inconsistent");
  return Object.freeze({ resolved: true, byId, byName, structuredEchoes, sourceReferences });
}

function hardenCharacterNames(character, characterIndex) {
  const value = requireRecord(character, `characters[${characterIndex}]`);
  return {
    ...value,
    name: toSingleLineName(value.name, `characters[${characterIndex}].name`),
    properties: requireArray(value.properties, `characters[${characterIndex}].properties`, 200).map(
      (property, propertyIndex) => ({
        ...requireRecord(property, `characters[${characterIndex}].properties[${propertyIndex}]`),
        name: toSingleLineName(
          property.name,
          `characters[${characterIndex}].properties[${propertyIndex}].name`,
        ),
      }),
    ),
    skills: requireArray(value.skills, `characters[${characterIndex}].skills`, 200).map((skill, skillIndex) => {
      const normalizedSkill = requireRecord(skill, `characters[${characterIndex}].skills[${skillIndex}]`);
      return {
        ...normalizedSkill,
        ...(normalizedSkill.name !== undefined
          ? { name: toSingleLineName(normalizedSkill.name, `characters[${characterIndex}].skills[${skillIndex}].name`) }
          : {}),
        attributes: requireArray(
          normalizedSkill.attributes,
          `characters[${characterIndex}].skills[${skillIndex}].attributes`,
          500,
        ).map((attribute, attributeIndex) => ({
          ...requireRecord(
            attribute,
            `characters[${characterIndex}].skills[${skillIndex}].attributes[${attributeIndex}]`,
          ),
          name: toSingleLineName(
            attribute.name,
            `characters[${characterIndex}].skills[${skillIndex}].attributes[${attributeIndex}].name`,
          ),
        })),
      };
    }),
    resonanceChain: requireArray(
      value.resonanceChain,
      `characters[${characterIndex}].resonanceChain`,
      12,
    ).map((node, nodeIndex) => ({
      ...requireRecord(node, `characters[${characterIndex}].resonanceChain[${nodeIndex}]`),
      name: toSingleLineName(
        node.name,
        `characters[${characterIndex}].resonanceChain[${nodeIndex}].name`,
      ),
    })),
    permanentPropertyNodes: requireArray(
      value.permanentPropertyNodes,
      `characters[${characterIndex}].permanentPropertyNodes`,
      500,
    ).map((node, nodeIndex) => {
      const normalizedNode = requireRecord(
        node,
        `characters[${characterIndex}].permanentPropertyNodes[${nodeIndex}]`,
      );
      return {
        ...normalizedNode,
        ...(normalizedNode.title !== undefined
          ? { title: toSingleLineName(normalizedNode.title, `characters[${characterIndex}].permanentPropertyNodes[${nodeIndex}].title`) }
          : {}),
      };
    }),
  };
}

export function hardenNormalizedSourceSnapshot(snapshot, echoDetails) {
  const root = requireRecord(snapshot, "normalized snapshot");
  const characters = requireArray(root.characters, "characters", 2_000).map(hardenCharacterNames);
  const weapons = requireArray(root.weapons, "weapons", 2_000).map((weapon, weaponIndex) => {
    const value = requireRecord(weapon, `weapons[${weaponIndex}]`);
    return {
      ...value,
      name: toSingleLineName(value.name, `weapons[${weaponIndex}].name`),
      properties: requireArray(value.properties, `weapons[${weaponIndex}].properties`, 200).map(
        (property, propertyIndex) => ({
          ...requireRecord(property, `weapons[${weaponIndex}].properties[${propertyIndex}]`),
          name: toSingleLineName(property.name, `weapons[${weaponIndex}].properties[${propertyIndex}].name`),
        }),
      ),
      ...(value.passive
        ? {
            passive: {
              ...requireRecord(value.passive, `weapons[${weaponIndex}].passive`),
              ...(value.passive.name !== undefined
                ? { name: toSingleLineName(value.passive.name, `weapons[${weaponIndex}].passive.name`) }
                : {}),
            },
          }
        : {}),
    };
  });
  const echoes = requireArray(root.echoes, "echoes", 2_000).map((echo, echoIndex) => ({
    ...requireRecord(echo, `echoes[${echoIndex}]`),
    name: toSingleLineName(echo.name, `echoes[${echoIndex}].name`),
  }));
  const sonataSets = requireArray(root.sonataSets, "sonataSets", 2_000).map((sonata, sonataIndex) => ({
    ...requireRecord(sonata, `sonataSets[${sonataIndex}]`),
    name: toSingleLineName(sonata.name, `sonataSets[${sonataIndex}].name`),
  }));

  const identity = buildStableSonataIdentityIndex(echoDetails);
  let hardenedSonataSets = sonataSets;
  const diagnostics = [...requireArray(root.diagnostics, "diagnostics", 1_000)];

  if (identity.resolved) {
    const normalizedNames = new Set(sonataSets.map((entry) => entry.name));
    if (normalizedNames.size !== sonataSets.length) fail("normalized Sonata names contain duplicates");
    if (identity.byName.size !== sonataSets.length) {
      fail(`structured Sonata identity count ${identity.byName.size} does not match normalized Sonata count ${sonataSets.length}`);
    }
    hardenedSonataSets = sonataSets
      .map((sonata) => {
        const sourceId = identity.byName.get(sonata.name);
        if (!sourceId) fail(`normalized Sonata ${JSON.stringify(sonata.name)} has no stable source ID`);
        return { ...sonata, sourceId };
      })
      .sort((left, right) => Number(left.sourceId) - Number(right.sourceId));

    const validIds = new Set(hardenedSonataSets.map((entry) => Number(entry.sourceId)));
    for (const [echoIndex, echo] of echoes.entries()) {
      for (const sourceGroupId of requireArray(
        echo.sourceSonataGroupIds,
        `echoes[${echoIndex}].sourceSonataGroupIds`,
        100,
      )) {
        if (!Number.isInteger(sourceGroupId) || !validIds.has(sourceGroupId)) {
          fail(`echoes[${echoIndex}] references unresolved Sonata source ID ${String(sourceGroupId)}`);
        }
      }
    }
    diagnostics.push({
      code: "sonata-stable-source-id-reviewed",
      severity: "info",
      message: `${hardenedSonataSets.length} Sonata definitions are joined to reviewed Encore FetterGroupDetails source IDs; display names are no longer identity.`,
    });
  } else {
    diagnostics.push({
      code: "sonata-stable-source-id-unavailable",
      severity: "warning",
      message: "Structured Sonata source IDs were unavailable in this source snapshot, so Sonata identity remains intentionally unresolved.",
    });
  }

  return {
    ...root,
    characters,
    weapons,
    echoes,
    sonataSets: hardenedSonataSets,
    diagnostics,
  };
}
