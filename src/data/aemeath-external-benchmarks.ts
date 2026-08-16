import type { ExternalDamageBenchmark } from "@/domain/external-benchmark";
import type { FinalStats } from "@/domain/models";

export const nakedAemeathLevel90Stats: FinalStats = {
  hp: 11025, attack: 425, defense: 1148, critRate: 5, critDamage: 150,
  energyRegen: 100, healingBonus: 0, tuneBreakBoost: 10,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
};

type Display = readonly [actionId: string, normal: number, average: number, crit: number, perHit?: readonly number[]];

// Static transcription of the WutheringTools 2026-08-16 output. Values are
// intentionally not generated from our Motion Values or engine at test time.
const standardDisplays: readonly Display[] = [
  ["aemeath-basic-1", 89, 92, 134, [89]],
  ["aemeath-basic-2", 134, 137, 200, [27, 40, 67]],
  ["aemeath-basic-3", 179, 184, 268, [18, 18, 18, 36, 90]],
  ["aemeath-basic-4", 259, 265, 388, [13, 13, 13, 13, 13, 194]],
  ["aemeath-heavy-1", 179, 183, 268, [36, 143]],
  ["aemeath-heavy-2", 445, 456, 668, [23, 23, 23, 23, 356]],
  ["aemeath-midair", 166, 170, 249, [166]],
  ["aemeath-dodge-counter", 499, 512, 749, [50, 50, 50, 100, 250]],
  ["armament-merge", 259, 265, 388, [52, 78, 130]],
  ["call-of-dawn", 314, 321, 470, [32, 32, 32, 220]],
  ["mech-basic-1", 134, 137, 201, [45, 45, 45]],
  ["mech-basic-2", 179, 183, 268, [36, 143]],
  ["mech-basic-3", 224, 230, 336, [8, 8, 8, 8, 8, 8, 157, 23]],
  ["mech-basic-4", 259, 265, 388, [78, 181]],
  ["mech-heavy-1", 179, 183, 268, [179]],
  ["mech-heavy-2", 445, 456, 668, [445]],
  ["mech-midair", 166, 170, 249, [141, 9, 9, 9]],
  ["mech-dodge-counter", 544, 558, 816, [19, 19, 19, 19, 19, 19, 381, 55]],
  ["overdrive", 1926, 1974, 2888, [386, 514, 514, 514]],
  ["finale", 3432, 3517, 5147, [3432]],
  ["seraphic-encore", 687, 704, 1030, [35, 35, 35, 35, 69, 69, 69, 344]],
  ["seraphic-overture", 687, 704, 1030, [35, 29, 29, 29, 29, 29, 29, 46, 46, 46, 115, 115, 115]],
  ["intro-normal", 259, 265, 388, [26, 26, 207]],
  ["intro-mech", 314, 321, 470, [126, 188]],
];

const common = {
  resonator: "Aemeath", sourceName: "WutheringTools", sourceVerificationDate: "2026-08-16",
  scenarioDescription: "Naked Aemeath S0 Lv90, talent 10, no weapon/Echo/runtime buffs, against Lv90 10% RES target.",
  characterLevel: 90, sequence: 0 as const, talentLevel: 10, finalStats: nakedAemeathLevel90Stats,
  weaponEquipmentState: "No weapon; no Echo; no Sonata; no equipment effects.",
  targetLevel: 90, targetResistance: { elemental: 0.1, physical: 0.1 }, tuneEnemyClass: "4C" as const,
  enabledEffects: [] as const, provenance: "Manually verified and transcribed from WutheringTools; offline versioned fixture.",
  confidence: "high" as const, displayRule: "ceiling" as const,
  notes: "External totals and individual hits are displayed as integers. Comparison applies ceiling only at the display boundary; internal values remain full precision.",
};

export const aemeathNakedStandardBenchmarks: readonly ExternalDamageBenchmark[] = standardDisplays.map(
  ([actionId, normal, average, crit, expectedDisplayedPerHit]) => ({
    ...common, id: `wutheringtools-aemeath-naked-l90-${actionId}`, actionId,
    expectedDisplayed: { normal, average, crit }, expectedDisplayedPerHit,
  }),
);

export const aemeathNakedTuneBenchmarks: readonly ExternalDamageBenchmark[] = [
  { ...common, id: "wutheringtools-aemeath-naked-l90-tune-break-4c", actionId: "tune-break", expectedDisplayed: { normal: 79625, average: 79625, crit: 79625 }, confidence: "qualified", displayTolerance: 2, notes: "External 79625 differs from the verified full-precision formula (79623.375...) by two displayed points after ceiling. Rounding alone does not explain it; hidden enemy-base precision or intermediate conventions are unverified, so the 4C constant is unchanged." },
  { ...common, id: "wutheringtools-aemeath-naked-l90-starburst", actionId: "starburst", expectedDisplayed: { normal: 29682, average: 29682, crit: 29682 } },
  { ...common, id: "wutheringtools-aemeath-naked-l90-seraphic-bonus", actionId: "seraphic-bonus", expectedDisplayed: { normal: 5442, average: 5442, crit: 5442 } },
];
