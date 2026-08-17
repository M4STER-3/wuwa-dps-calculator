const ASCENSION_LEVELS = new Set([20, 40, 50, 60, 70, 80]);
const EXPECTED_POINT_COUNT = 96;
const MAX_VALUE = 1_000_000_000;

function fail(label, message) {
  throw new Error(`Reviewed stat progression rejected ${label}: ${message}`);
}

function record(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(label, "expected object");
  return value;
}

function array(value, label, expectedLength) {
  if (!Array.isArray(value)) fail(label, "expected array");
  if (expectedLength !== undefined && value.length !== expectedLength) {
    fail(label, `expected exactly ${expectedLength} entries, received ${value.length}`);
  }
  return value;
}

function safeName(value, label) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) {
    fail(label, "expected bounded non-empty name");
  }
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) fail(label, "contains control characters");
  return value;
}

function finiteNonNegative(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) {
    fail(label, "expected finite non-negative number in reviewed range");
  }
  return value;
}

function parseDecimal(value, label, { percent = false } = {}) {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    fail(label, "expected bounded decimal string");
  }
  const pattern = percent ? /^(\d+(?:\.\d+)?)%$/ : /^(\d+(?:\.\d+)?)$/;
  const match = pattern.exec(value);
  if (!match) fail(label, percent ? "expected exact percentage string" : "expected exact decimal string");
  const parsed = Number(match[1]);
  return finiteNonNegative(parsed, label);
}

function characterExpectedRows() {
  const rows = [];
  let sourceGrowthId = 1;
  for (let level = 1; level <= 90; level += 1) {
    rows.push({ sourceLevelIndex: level, sourceGrowthId, level, ...(ASCENSION_LEVELS.has(level) ? { ascended: false } : {}) });
    sourceGrowthId += 1;
    if (ASCENSION_LEVELS.has(level)) {
      rows.push({ sourceLevelIndex: level, sourceGrowthId, level, ascended: true });
      sourceGrowthId += 1;
    }
  }
  if (rows.length !== EXPECTED_POINT_COUNT || sourceGrowthId !== EXPECTED_POINT_COUNT + 1) {
    throw new Error("Internal reviewed character growth mapping is inconsistent");
  }
  return rows;
}

function weaponExpectedRows() {
  const rows = [];
  for (let level = 1; level <= 90; level += 1) {
    rows.push({ sourceLevelIndex: level, level, ...(ASCENSION_LEVELS.has(level) ? { ascended: false } : {}) });
    if (ASCENSION_LEVELS.has(level)) {
      rows.push({ sourceLevelIndex: level + 0.5, level, ascended: true });
    }
  }
  if (rows.length !== EXPECTED_POINT_COUNT) {
    throw new Error("Internal reviewed weapon growth mapping is inconsistent");
  }
  return rows;
}

export const reviewedCharacterGrowthRows = Object.freeze(characterExpectedRows().map(Object.freeze));
export const reviewedWeaponGrowthRows = Object.freeze(weaponExpectedRows().map(Object.freeze));
export const reviewedAscensionLevels = Object.freeze([...ASCENSION_LEVELS]);

function assertCharacterSignature(growthValues, label) {
  const rows = array(growthValues, label, EXPECTED_POINT_COUNT);
  for (let index = 0; index < reviewedCharacterGrowthRows.length; index += 1) {
    const actual = record(rows[index], `${label}[${index}]`);
    const expected = reviewedCharacterGrowthRows[index];
    if (actual.sourceLevelIndex !== expected.sourceLevelIndex) {
      fail(`${label}[${index}].sourceLevelIndex`, `expected ${expected.sourceLevelIndex}, received ${String(actual.sourceLevelIndex)}`);
    }
    if (actual.sourceGrowthId !== expected.sourceGrowthId) {
      fail(`${label}[${index}].sourceGrowthId`, `expected ${expected.sourceGrowthId}, received ${String(actual.sourceGrowthId)}`);
    }
  }
  return rows;
}

function assertWeaponSignature(growthValues, label) {
  const rows = array(growthValues, label, EXPECTED_POINT_COUNT);
  for (let index = 0; index < reviewedWeaponGrowthRows.length; index += 1) {
    const actual = record(rows[index], `${label}[${index}]`);
    const expected = reviewedWeaponGrowthRows[index];
    if (actual.sourceLevelIndex !== expected.sourceLevelIndex) {
      fail(`${label}[${index}].sourceLevelIndex`, `expected ${expected.sourceLevelIndex}, received ${String(actual.sourceLevelIndex)}`);
    }
    if (actual.sourceGrowthId !== undefined) {
      fail(`${label}[${index}].sourceGrowthId`, "weapon growth rows must not invent a source growth id");
    }
  }
  return rows;
}

function numericProgression(rows, expectedRows, label) {
  return {
    points: rows.map((raw, index) => {
      const row = record(raw, `${label}[${index}]`);
      const expected = expectedRows[index];
      const value = finiteNonNegative(row.value, `${label}[${index}].value`);
      return {
        level: expected.level,
        value,
        ...(expected.ascended !== undefined ? { ascended: expected.ascended } : {}),
      };
    }),
    interpolation: "none",
  };
}

function decimalProgression(rows, expectedRows, label, options) {
  return {
    points: rows.map((raw, index) => {
      const row = record(raw, `${label}[${index}]`);
      const expected = expectedRows[index];
      const value = parseDecimal(row.value, `${label}[${index}].value`, options);
      return {
        level: expected.level,
        value,
        ...(expected.ascended !== undefined ? { ascended: expected.ascended } : {}),
      };
    }),
    interpolation: "none",
  };
}

function indexProperties(properties, label) {
  const list = array(properties, label);
  const byName = new Map();
  for (let index = 0; index < list.length; index += 1) {
    const property = record(list[index], `${label}[${index}]`);
    const name = safeName(property.name, `${label}[${index}].name`);
    if (byName.has(name)) {
      const existing = byName.get(name);
      if (!Array.isArray(existing)) byName.set(name, [existing, property]);
      else existing.push(property);
    } else {
      byName.set(name, property);
    }
  }
  return { list, byName };
}

function exactNamedProperty(byName, name, label) {
  const value = byName.get(name);
  if (!value) fail(label, `missing required ${name} property`);
  if (Array.isArray(value)) fail(label, `duplicates required ${name} property`);
  return value;
}

export function buildReviewedCharacterStatProgressions(properties, label = "character.properties") {
  const { list, byName } = indexProperties(properties, label);
  for (let index = 0; index < list.length; index += 1) {
    const property = record(list[index], `${label}[${index}]`);
    assertCharacterSignature(property.sourceGrowthValues, `${label}[${index}].sourceGrowthValues`);
  }

  const hp = exactNamedProperty(byName, "HP", label);
  const attack = exactNamedProperty(byName, "ATK", label);
  const defense = exactNamedProperty(byName, "DEF", label);
  const definitions = [
    ["hp", hp],
    ["attack", attack],
    ["defense", defense],
  ];
  const output = {};
  for (const [key, property] of definitions) {
    const rows = assertCharacterSignature(property.sourceGrowthValues, `${label}.${key}.sourceGrowthValues`);
    const progression = numericProgression(rows, reviewedCharacterGrowthRows, `${label}.${key}.sourceGrowthValues`);
    const baseValue = finiteNonNegative(property.baseValue, `${label}.${key}.baseValue`);
    if (progression.points[0]?.value !== baseValue) {
      fail(`${label}.${key}`, `level 1 value ${String(progression.points[0]?.value)} does not match baseValue ${baseValue}`);
    }
    output[key] = progression;
  }
  return output;
}

export function buildReviewedWeaponStatProgressions(properties, label = "weapon.properties") {
  const list = array(properties, label, 2);
  const first = record(list[0], `${label}[0]`);
  const second = record(list[1], `${label}[1]`);
  if (safeName(first.name, `${label}[0].name`) !== "ATK") {
    fail(`${label}[0].name`, "first weapon property must be ATK");
  }
  const secondaryName = safeName(second.name, `${label}[1].name`);

  const firstRows = assertWeaponSignature(first.sourceGrowthValues, `${label}[0].sourceGrowthValues`);
  const secondRows = assertWeaponSignature(second.sourceGrowthValues, `${label}[1].sourceGrowthValues`);
  const attack = decimalProgression(firstRows, reviewedWeaponGrowthRows, `${label}[0].sourceGrowthValues`, { percent: false });
  const baseValue = finiteNonNegative(first.baseValue, `${label}[0].baseValue`);
  if (attack.points[0]?.value !== baseValue) {
    fail(label, `weapon level 1 ATK ${String(attack.points[0]?.value)} does not match baseValue ${baseValue}`);
  }

  return {
    attack,
    secondaryStat: {
      stat: secondaryName,
      unit: "percentage-points",
      progression: decimalProgression(
        secondRows,
        reviewedWeaponGrowthRows,
        `${label}[1].sourceGrowthValues`,
        { percent: true },
      ),
    },
  };
}

export function assertReviewedCharacterGrowth(properties, label) {
  buildReviewedCharacterStatProgressions(properties, label);
}

export function assertReviewedWeaponGrowth(properties, label) {
  buildReviewedWeaponStatProgressions(properties, label);
}
