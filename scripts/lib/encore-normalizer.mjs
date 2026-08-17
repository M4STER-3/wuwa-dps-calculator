const MAX_DISPLAY_TEXT = 20_000;
const MAX_NAME = 200;
const MAX_PARAMETER = 512;
const MAX_ARRAY_ITEMS = 50_000;

const SCRIPT_LIKE_PATTERN =
  /<\s*(?:script|iframe|object|embed)\b|javascript\s*:|data\s*:\s*text\/html|on[a-z]{2,}\s*=/i;
const URL_PATTERN = /https?:\/\//i;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const MARKUP_PATTERN = /<[^>\r\n]{1,512}>/g;
const BREAK_PATTERN = /<\s*br\s*\/?\s*>/gi;

const CHARACTER_ELEMENTS = new Set(["Aero", "Glacio", "Electro", "Fusion", "Havoc", "Spectro"]);
const WEAPON_TYPES = new Set(["Broadblade", "Gauntlets", "Pistols", "Rectifier", "Sword"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(label, message) {
  throw new Error(`${label}: ${message}`);
}

export function normalizeSourceId(value, label = "source id") {
  if (value === null || value === undefined || value === "") fail(label, "missing");
  const id = String(value);
  if (id.length > 128) fail(label, "too long");
  if (CONTROL_PATTERN.test(id)) fail(label, "contains control characters");
  CONTROL_PATTERN.lastIndex = 0;
  if (id === "__proto__" || id === "prototype" || id === "constructor") {
    fail(label, "forbidden object key");
  }
  return id;
}

export function normalizeDisplayText(
  value,
  label,
  { required = false, maxLength = MAX_DISPLAY_TEXT, allowUrls = false } = {},
) {
  if (value === null || value === undefined) {
    if (required) fail(label, "missing text");
    return undefined;
  }
  if (typeof value !== "string") fail(label, "expected string");
  if (value.length > maxLength * 4) fail(label, `source text exceeds ${maxLength * 4} characters`);
  if (SCRIPT_LIKE_PATTERN.test(value)) fail(label, "contains script-like markup");
  if (!allowUrls && URL_PATTERN.test(value)) fail(label, "contains an unexpected URL");

  const normalized = value
    .replace(BREAK_PATTERN, "\n")
    .replace(MARKUP_PATTERN, "")
    .replace(CONTROL_PATTERN, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.length > maxLength) fail(label, `normalized text exceeds ${maxLength} characters`);
  if (required && normalized.length === 0) fail(label, "empty after plain-text normalization");
  return normalized || undefined;
}

function normalizeParameter(value, label) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(label, "non-finite numeric parameter");
    return value;
  }
  if (typeof value !== "string") fail(label, "parameter must be string or number");
  if (value.length > MAX_PARAMETER) fail(label, `parameter exceeds ${MAX_PARAMETER} characters`);
  if (SCRIPT_LIKE_PATTERN.test(value) || URL_PATTERN.test(value)) fail(label, "unsafe parameter content");
  const normalized = value.replace(CONTROL_PATTERN, " ").trim();
  return normalized;
}

function normalizeFiniteNumber(value, label, { integer = false, min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(label, "expected finite number");
  if (integer && !Number.isInteger(value)) fail(label, "expected integer");
  if (value < min || value > max) fail(label, `outside accepted range ${min}..${max}`);
  return value;
}

function normalizeOptionalFiniteNumber(value, label, options) {
  if (value === null || value === undefined) return undefined;
  return normalizeFiniteNumber(value, label, options);
}

function normalizeArray(value, label, mapper, maxItems = MAX_ARRAY_ITEMS) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) fail(label, "expected array");
  if (value.length > maxItems) fail(label, `exceeds ${maxItems} items`);
  return value.map((item, index) => mapper(item, `${label}[${index}]`));
}

function normalizeEnum(value, allowed, label) {
  const normalized = normalizeDisplayText(value, label, { required: true, maxLength: 80 });
  if (!allowed.has(normalized)) fail(label, `unknown value ${JSON.stringify(normalized)}`);
  return normalized;
}

function normalizePropertyGrowthValue(value, label) {
  if (!isRecord(value)) fail(label, "expected object");
  return {
    sourceLevelIndex: normalizeFiniteNumber(value.level ?? value.Level, `${label}.level`, {
      integer: true,
      min: 0,
      max: 10_000,
    }),
    ...(value.growthId !== undefined
      ? {
          sourceGrowthId: normalizeFiniteNumber(value.growthId, `${label}.growthId`, {
            integer: true,
            min: 0,
            max: 10_000,
          }),
        }
      : {}),
    value: normalizeParameter(value.value ?? value.Value, `${label}.value`),
  };
}

function normalizeProperties(value, label) {
  return normalizeArray(value, label, (property, propertyLabel) => {
    if (!isRecord(property)) fail(propertyLabel, "expected property object");
    return {
      name: normalizeDisplayText(property.Name, `${propertyLabel}.Name`, {
        required: true,
        maxLength: MAX_NAME,
      }),
      baseValue: normalizeFiniteNumber(property.BaseValue, `${propertyLabel}.BaseValue`),
      sourceGrowthValues: normalizeArray(
        property.GrowthValues,
        `${propertyLabel}.GrowthValues`,
        normalizePropertyGrowthValue,
        500,
      ),
    };
  }, 100);
}

function normalizeSkillAttributes(value, label) {
  return normalizeArray(value, label, (attribute, attributeLabel) => {
    if (!isRecord(attribute)) fail(attributeLabel, "expected object");
    return {
      sourceAttributeId: normalizeSourceId(attribute.attributeId, `${attributeLabel}.attributeId`),
      name: normalizeDisplayText(attribute.attributeName, `${attributeLabel}.attributeName`, {
        required: true,
        maxLength: MAX_NAME,
      }),
      ...(normalizeDisplayText(attribute.Description, `${attributeLabel}.Description`, {
        maxLength: 120,
      })
        ? {
            unitOrProperty: normalizeDisplayText(attribute.Description, `${attributeLabel}.Description`, {
              maxLength: 120,
            }),
          }
        : {}),
      values: normalizeArray(
        attribute.values,
        `${attributeLabel}.values`,
        (entry, entryLabel) => normalizeParameter(entry, entryLabel),
        200,
      ),
    };
  }, 200);
}

function normalizeCharacterSkill(skill, label) {
  if (!isRecord(skill)) fail(label, "expected skill object");
  const description = normalizeDisplayText(skill.SkillDescribe, `${label}.SkillDescribe`, {
    maxLength: MAX_DISPLAY_TEXT,
  });
  return {
    sourceSkillId: normalizeSourceId(skill.SkillId, `${label}.SkillId`),
    name: normalizeDisplayText(skill.SkillName, `${label}.SkillName`, {
      required: true,
      maxLength: MAX_NAME,
    }),
    type: normalizeDisplayText(skill.SkillType, `${label}.SkillType`, {
      required: true,
      maxLength: 120,
    }),
    ...(description ? { description } : {}),
    attributes: normalizeSkillAttributes(skill.SkillAttributes, `${label}.SkillAttributes`),
  };
}

function normalizeResonanceChain(value, label) {
  const nodes = normalizeArray(value, label, (node, nodeLabel) => {
    if (!isRecord(node)) fail(nodeLabel, "expected chain node object");
    const sequence = normalizeFiniteNumber(node.GroupIndex, `${nodeLabel}.GroupIndex`, {
      integer: true,
      min: 1,
      max: 6,
    });
    return {
      sequence,
      sourceNodeId: normalizeSourceId(node.Id, `${nodeLabel}.Id`),
      name: normalizeDisplayText(node.NodeName, `${nodeLabel}.NodeName`, {
        required: true,
        maxLength: MAX_NAME,
      }),
      description: normalizeDisplayText(node.AttributesDescription, `${nodeLabel}.AttributesDescription`, {
        required: true,
        maxLength: MAX_DISPLAY_TEXT,
      }),
    };
  }, 12).sort((a, b) => a.sequence - b.sequence);

  const sequences = new Set(nodes.map((node) => node.sequence));
  if (nodes.length !== 6 || sequences.size !== 6 || ![1, 2, 3, 4, 5, 6].every((n) => sequences.has(n))) {
    fail(label, "expected exactly one node for each sequence 1..6");
  }
  return nodes;
}

function normalizeSkillTree(value, label) {
  return normalizeArray(value, label, (node, nodeLabel) => {
    if (!isRecord(node)) fail(nodeLabel, "expected skill-tree node object");
    const title = normalizeDisplayText(node.PropertyNodeTitle, `${nodeLabel}.PropertyNodeTitle`, {
      maxLength: MAX_NAME,
    });
    const description = normalizeDisplayText(node.PropertyNodeDescribe, `${nodeLabel}.PropertyNodeDescribe`, {
      maxLength: 2_000,
    });
    if (!title && !description) return null;
    return {
      sourceNodeId: normalizeSourceId(node.Id, `${nodeLabel}.Id`),
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    };
  }, 200).filter(Boolean);
}

export function normalizeEncoreCharacter(detail, sourceId) {
  if (!isRecord(detail)) fail("character detail", "expected object");
  const id = normalizeSourceId(sourceId, "character source id");
  if (detail.Id !== undefined && String(detail.Id) !== id) {
    fail(`character ${id}`, `detail Id ${detail.Id} does not match source id`);
  }
  const quality = normalizeFiniteNumber(detail.QualityId, `character ${id}.QualityId`, {
    integer: true,
    min: 4,
    max: 5,
  });
  return {
    sourceId: id,
    name: normalizeDisplayText(detail.Name?.Content, `character ${id}.Name.Content`, {
      required: true,
      maxLength: MAX_NAME,
    }),
    element: normalizeEnum(detail.ElementName, CHARACTER_ELEMENTS, `character ${id}.ElementName`),
    weaponType: normalizeEnum(detail.WeaponTypeName, WEAPON_TYPES, `character ${id}.WeaponTypeName`),
    rarity: quality,
    maxLevel: normalizeFiniteNumber(detail.MaxLevel, `character ${id}.MaxLevel`, {
      integer: true,
      min: 1,
      max: 100,
    }),
    properties: normalizeProperties(detail.Properties, `character ${id}.Properties`),
    skills: normalizeArray(
      detail.Skills,
      `character ${id}.Skills`,
      normalizeCharacterSkill,
      100,
    ),
    resonanceChain: normalizeResonanceChain(detail.ResonantChain, `character ${id}.ResonantChain`),
    permanentPropertyNodes: normalizeSkillTree(detail.SkillTree, `character ${id}.SkillTree`),
  };
}

function normalizeWeaponPassive(detail, label) {
  const name = normalizeDisplayText(detail.ResonName, `${label}.ResonName`, {
    maxLength: MAX_NAME,
  });
  const descriptionTemplate = normalizeDisplayText(detail.Desc, `${label}.Desc`, {
    maxLength: MAX_DISPLAY_TEXT,
  });
  const rankParameterSets = normalizeArray(
    detail.DescParams,
    `${label}.DescParams`,
    (set, setLabel) => {
      if (!isRecord(set)) fail(setLabel, "expected parameter-set object");
      return normalizeArray(
        set.ArrayString,
        `${setLabel}.ArrayString`,
        (entry, entryLabel) => normalizeParameter(entry, entryLabel),
        200,
      );
    },
    20,
  );
  if (!name && !descriptionTemplate && rankParameterSets.length === 0) return undefined;
  return {
    ...(name ? { name } : {}),
    ...(descriptionTemplate ? { descriptionTemplate } : {}),
    rankParameterSets,
  };
}

export function normalizeEncoreWeapon(detail, sourceId) {
  if (!isRecord(detail)) fail("weapon detail", "expected object");
  const id = normalizeSourceId(sourceId, "weapon source id");
  if (detail.ItemId !== undefined && String(detail.ItemId) !== id) {
    fail(`weapon ${id}`, `detail ItemId ${detail.ItemId} does not match source id`);
  }
  const description = normalizeDisplayText(
    detail.AttributesDescription ?? detail.BgDescription,
    `weapon ${id}.AttributesDescription`,
    { maxLength: MAX_DISPLAY_TEXT },
  );
  const passive = normalizeWeaponPassive(detail, `weapon ${id}`);
  return {
    sourceId: id,
    name: normalizeDisplayText(detail.WeaponName, `weapon ${id}.WeaponName`, {
      required: true,
      maxLength: MAX_NAME,
    }),
    weaponType: normalizeEnum(detail.WeaponTypeName, WEAPON_TYPES, `weapon ${id}.WeaponTypeName`),
    rarity: normalizeFiniteNumber(detail.QualityId, `weapon ${id}.QualityId`, {
      integer: true,
      min: 1,
      max: 5,
    }),
    ...(description ? { description } : {}),
    properties: normalizeProperties(detail.Properties, `weapon ${id}.Properties`),
    ...(passive ? { passive } : {}),
    breaches: normalizeArray(detail.Breaches, `weapon ${id}.Breaches`, (breach, breachLabel) => {
      if (!isRecord(breach)) fail(breachLabel, "expected breach object");
      return {
        sourceBreachLevel: normalizeFiniteNumber(breach.Level, `${breachLabel}.Level`, {
          integer: true,
          min: 0,
          max: 20,
        }),
        levelLimit: normalizeFiniteNumber(breach.LevelLimit, `${breachLabel}.LevelLimit`, {
          integer: true,
          min: 1,
          max: 100,
        }),
      };
    }, 20),
  };
}

function normalizeEchoSkill(value, label) {
  if (!isRecord(value)) return undefined;
  const summary = normalizeDisplayText(value.SimplyDescription, `${label}.SimplyDescription`, {
    maxLength: 4_000,
  });
  const description = normalizeDisplayText(value.DescriptionEx, `${label}.DescriptionEx`, {
    maxLength: MAX_DISPLAY_TEXT,
  });
  const skillId = value.Id === undefined ? undefined : normalizeSourceId(value.Id, `${label}.Id`);
  const cooldown = normalizeOptionalFiniteNumber(value.SkillCD, `${label}.SkillCD`, {
    min: 0,
    max: 600,
  });
  if (!summary && !description && !skillId && cooldown === undefined) return undefined;
  return {
    ...(skillId ? { sourceSkillId: skillId } : {}),
    ...(summary ? { summary } : {}),
    ...(description ? { description } : {}),
    ...(cooldown !== undefined ? { cooldownSeconds: cooldown } : {}),
  };
}

function normalizeSonataDefinitions(value, label) {
  if (value === null || value === undefined) return [];
  if (!isRecord(value)) fail(label, "expected Sonata object");
  const definitions = [];
  for (const [rawName, rawDefinition] of Object.entries(value)) {
    const name = normalizeDisplayText(rawName, `${label}.name`, {
      required: true,
      maxLength: MAX_NAME,
    });
    if (!isRecord(rawDefinition)) fail(`${label}.${name}`, "expected definition object");
    const keys = normalizeArray(
      rawDefinition.EffectKeys,
      `${label}.${name}.EffectKeys`,
      (entry, entryLabel) => normalizeFiniteNumber(entry, entryLabel, {
        integer: true,
        min: 1,
        max: 10,
      }),
      10,
    );
    const descriptions = normalizeArray(
      rawDefinition.EffectDescriptions,
      `${label}.${name}.EffectDescriptions`,
      (entry, entryLabel) => normalizeDisplayText(entry, entryLabel, {
        required: true,
        maxLength: MAX_DISPLAY_TEXT,
      }),
      10,
    );
    if (keys.length !== descriptions.length || keys.length === 0) {
      fail(`${label}.${name}`, "Sonata effect key/description arrays differ or are empty");
    }
    const lore = normalizeArray(
      rawDefinition.DefineDescriptions,
      `${label}.${name}.DefineDescriptions`,
      (entry, entryLabel) => normalizeDisplayText(entry, entryLabel, {
        maxLength: 2_000,
      }),
      10,
    ).filter(Boolean);
    definitions.push({
      name,
      bonuses: keys.map((pieces, index) => ({ pieces, description: descriptions[index] })),
      ...(lore.length > 0 ? { sourceLore: [...new Set(lore)] } : {}),
    });
  }
  return definitions.sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeEncoreEcho(detail, sourceId) {
  if (!isRecord(detail)) fail("Echo detail", "expected object");
  const id = normalizeSourceId(sourceId, "Echo source id");
  if (detail.MonsterId !== undefined && String(detail.MonsterId) !== id) {
    fail(`Echo ${id}`, `detail MonsterId ${detail.MonsterId} does not match source id`);
  }
  const intensity = normalizeDisplayText(detail.Handbook?.Intensity, `Echo ${id}.Handbook.Intensity`, {
    maxLength: 120,
  });
  const element = normalizeDisplayText(detail.Element?.Name, `Echo ${id}.Element.Name`, {
    maxLength: 80,
  });
  return {
    sourceId: id,
    name: normalizeDisplayText(detail.MonsterName, `Echo ${id}.MonsterName`, {
      required: true,
      maxLength: MAX_NAME,
    }),
    ...(element ? { element } : {}),
    qualityId: normalizeFiniteNumber(detail.QualityId, `Echo ${id}.QualityId`, {
      integer: true,
      min: 1,
      max: 10,
    }),
    sourceRarity: normalizeFiniteNumber(detail.Rarity, `Echo ${id}.Rarity`, {
      integer: true,
      min: 0,
      max: 10,
    }),
    levelUpGroupId: normalizeFiniteNumber(detail.LevelUpGroupId, `Echo ${id}.LevelUpGroupId`, {
      integer: true,
      min: 0,
      max: 100,
    }),
    ...(intensity ? { sourceIntensity: intensity } : {}),
    sourceSonataGroupIds: normalizeArray(
      detail.FetterGroup,
      `Echo ${id}.FetterGroup`,
      (entry, entryLabel) => normalizeFiniteNumber(entry, entryLabel, {
        integer: true,
        min: 1,
        max: 10_000,
      }),
      20,
    ),
    ...(normalizeEchoSkill(detail.Skill, `Echo ${id}.Skill`)
      ? { skill: normalizeEchoSkill(detail.Skill, `Echo ${id}.Skill`) }
      : {}),
    sonataDefinitions: normalizeSonataDefinitions(detail.FetterDetails, `Echo ${id}.FetterDetails`),
  };
}

function mergeSonataDefinitions(echoes) {
  const byName = new Map();
  for (const echo of echoes) {
    for (const definition of echo.sonataDefinitions) {
      const existing = byName.get(definition.name);
      if (!existing) {
        byName.set(definition.name, definition);
        continue;
      }
      const currentBonuses = JSON.stringify(definition.bonuses);
      const existingBonuses = JSON.stringify(existing.bonuses);
      if (currentBonuses !== existingBonuses) {
        fail(`Sonata ${definition.name}`, "conflicting effect definitions across Echo payloads");
      }
      const lore = new Set([...(existing.sourceLore ?? []), ...(definition.sourceLore ?? [])]);
      if (lore.size > 0) existing.sourceLore = [...lore].sort();
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeEncoreSourceSnapshot({ manifest, characterDetails, weaponDetails, echoDetails }) {
  if (!isRecord(manifest)) fail("manifest", "expected object");
  if (manifest.sourceProvider !== "encore" || manifest.dataset !== "Release") {
    fail("manifest", "unexpected source provider or dataset");
  }

  const characters = characterDetails
    .map(({ sourceId, detail }) => normalizeEncoreCharacter(detail, sourceId))
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const weapons = weaponDetails
    .map(({ sourceId, detail }) => normalizeEncoreWeapon(detail, sourceId))
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const echoes = echoDetails
    .map(({ sourceId, detail }) => normalizeEncoreEcho(detail, sourceId))
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const sonataSets = mergeSonataDefinitions(echoes);

  return {
    schemaVersion: 1,
    sourceProvider: "encore",
    language: manifest.language ?? "en",
    dataset: "Release",
    sourceImportedAt: manifest.importedAt,
    counts: {
      characters: characters.length,
      weapons: weapons.length,
      echoes: echoes.length,
      sonataSets: sonataSets.length,
    },
    characters,
    weapons,
    echoes: echoes.map(({ sonataDefinitions, ...echo }) => echo),
    sonataSets,
    diagnostics: [
      {
        code: "source-growth-index-not-game-level",
        severity: "warning",
        message:
          "Character and weapon GrowthValues are preserved with sourceLevelIndex. They are not mapped to game levels until the source curve semantics are verified.",
      },
      {
        code: "echo-cost-unresolved",
        severity: "warning",
        message:
          "Echo source rarity/quality/intensity are preserved, but Echo cost is intentionally unresolved until an explicit verified mapping is added.",
      },
      {
        code: "source-damage-runtime-disabled",
        severity: "info",
        message:
          "Structured source DamageList/condition/formula data remains in RAW only and is not converted into executable combat logic.",
      },
    ],
  };
}

export const encoreNormalizerLimits = Object.freeze({
  maxDisplayText: MAX_DISPLAY_TEXT,
  maxName: MAX_NAME,
  maxParameter: MAX_PARAMETER,
  maxArrayItems: MAX_ARRAY_ITEMS,
});
