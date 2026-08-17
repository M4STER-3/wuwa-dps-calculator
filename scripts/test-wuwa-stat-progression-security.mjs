import assert from "node:assert/strict";
import {
  buildReviewedCharacterStatProgressions,
  buildReviewedWeaponStatProgressions,
  reviewedCharacterGrowthRows,
  reviewedWeaponGrowthRows,
} from "./lib/game-stat-progression.mjs";

function characterGrowth(valueAt) {
  return reviewedCharacterGrowthRows.map((row, index) => ({
    sourceLevelIndex: row.sourceLevelIndex,
    sourceGrowthId: row.sourceGrowthId,
    value: valueAt(row, index),
  }));
}

function weaponGrowth(valueAt) {
  return reviewedWeaponGrowthRows.map((row, index) => ({
    sourceLevelIndex: row.sourceLevelIndex,
    value: valueAt(row, index),
  }));
}

function characterProperties() {
  return [
    { name: "HP", baseValue: 831, sourceGrowthValues: characterGrowth((_row, index) => index === 0 ? 831 : 831 + index * 100) },
    { name: "ATK", baseValue: 35, sourceGrowthValues: characterGrowth((_row, index) => index === 0 ? 35 : 35 + index * 4) },
    { name: "DEF", baseValue: 99, sourceGrowthValues: characterGrowth((_row, index) => index === 0 ? 99 : 99 + index * 10) },
    { name: "Crit. Rate", baseValue: 500, sourceGrowthValues: characterGrowth(() => "5%") },
    { name: "Crit. DMG", baseValue: 15000, sourceGrowthValues: characterGrowth(() => "150%") },
    { name: "Tune Break Boost", baseValue: 0, sourceGrowthValues: characterGrowth(() => 0) },
  ];
}

function weaponProperties() {
  return [
    { name: "ATK", baseValue: 47, sourceGrowthValues: weaponGrowth((_row, index) => (47 + index * 5.5).toFixed(2)) },
    { name: "ATK", baseValue: 0.081, sourceGrowthValues: weaponGrowth((_row, index) => `${(8.1 + index * 0.3).toFixed(2)}%`) },
  ];
}

function clone(value) {
  return structuredClone(value);
}

function expectReject(label, fn, pattern) {
  let thrown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, `${label}: expected rejection`);
  assert.match(String(thrown?.message ?? thrown), pattern, label);
}

function testExactMappings() {
  assert.equal(reviewedCharacterGrowthRows.length, 96);
  assert.equal(reviewedWeaponGrowthRows.length, 96);

  const character = buildReviewedCharacterStatProgressions(characterProperties(), "character fixture");
  assert.equal(character.hp.interpolation, "none");
  assert.equal(character.hp.points.length, 96);
  const character20 = character.hp.points.filter((point) => point.level === 20);
  assert.deepEqual(character20.map((point) => point.ascended), [false, true]);
  assert.equal(character.hp.points.at(-1)?.level, 90);

  const weapon = buildReviewedWeaponStatProgressions(weaponProperties(), "weapon fixture");
  assert.equal(weapon.attack.points.length, 96);
  assert.equal(weapon.secondaryStat.unit, "percentage-points");
  assert.equal(weapon.secondaryStat.progression.points[0]?.value, 8.1);
  const weapon20 = weapon.attack.points.filter((point) => point.level === 20);
  assert.deepEqual(weapon20.map((point) => point.ascended), [false, true]);
}

function testCharacterDriftFailsClosed() {
  const missing = clone(characterProperties());
  missing[0].sourceGrowthValues.pop();
  expectReject("missing character point", () => buildReviewedCharacterStatProgressions(missing), /expected exactly 96/);

  const wrongGrowthId = clone(characterProperties());
  wrongGrowthId[0].sourceGrowthValues[20].sourceGrowthId = 999;
  expectReject("wrong character growth id", () => buildReviewedCharacterStatProgressions(wrongGrowthId), /sourceGrowthId/);

  const wrongLevel = clone(characterProperties());
  wrongLevel[0].sourceGrowthValues[20].sourceLevelIndex = 20.5;
  expectReject("character half level", () => buildReviewedCharacterStatProgressions(wrongLevel), /sourceLevelIndex/);

  const textBaseStat = clone(characterProperties());
  textBaseStat[0].sourceGrowthValues[0].value = "831";
  expectReject("character numeric string", () => buildReviewedCharacterStatProgressions(textBaseStat), /finite non-negative number/);
}

function testWeaponDriftFailsClosed() {
  const missing = clone(weaponProperties());
  missing[0].sourceGrowthValues.splice(20, 1);
  expectReject("missing weapon point", () => buildReviewedWeaponStatProgressions(missing), /expected exactly 96/);

  const quarterStep = clone(weaponProperties());
  quarterStep[0].sourceGrowthValues[20].sourceLevelIndex = 20.25;
  expectReject("quarter step", () => buildReviewedWeaponStatProgressions(quarterStep), /sourceLevelIndex/);

  const unexpectedGrowthId = clone(weaponProperties());
  unexpectedGrowthId[0].sourceGrowthValues[0].sourceGrowthId = 1;
  expectReject("invented weapon growth id", () => buildReviewedWeaponStatProgressions(unexpectedGrowthId), /must not invent/);

  const unsafePercent = clone(weaponProperties());
  unsafePercent[1].sourceGrowthValues[0].value = "8.10%;javascript:alert(1)";
  expectReject("unsafe secondary value", () => buildReviewedWeaponStatProgressions(unsafePercent), /exact percentage string/);

  const wrongUnit = clone(weaponProperties());
  wrongUnit[0].sourceGrowthValues[0].value = "47%";
  expectReject("percent base attack", () => buildReviewedWeaponStatProgressions(wrongUnit), /exact decimal string/);
}

testExactMappings();
testCharacterDriftFailsClosed();
testWeaponDriftFailsClosed();
console.log("Reviewed character/weapon stat progression security tests passed.");
