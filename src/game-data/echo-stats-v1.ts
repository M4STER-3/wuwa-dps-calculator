import type {
  EchoMainStatDefinition,
  EchoStatApplication,
  EchoStatRollDefinition,
  EchoStatTableCatalog,
  EchoStatTarget,
} from "./schema";

const level25 = (
  id: string,
  stat: EchoStatTarget,
  application: EchoStatApplication,
  value: number,
): EchoMainStatDefinition => ({
  id,
  stat,
  application,
  progression: {
    points: [{ level: 25, value }],
    interpolation: "none",
  },
});

const rolls = (
  statId: string,
  stat: EchoStatTarget,
  application: EchoStatApplication,
  values: readonly number[],
): EchoStatRollDefinition => ({ statId, stat, application, values });

const commonPercentRolls = [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6] as const;

/**
 * Reviewed endgame Echo stat table.
 *
 * Scope is deliberately narrow: five-star Echoes at +25 for main stats, and
 * the exact five-star substat roll values. Missing levels/rarities are not
 * interpolated. Values that are percentages are expressed in percentage
 * points, matching FinalStats conventions (e.g. Crit Rate 22 means +22 pp).
 */
export const reviewedEchoStatTableV1 = {
  supportedRarity: 5,
  primaryMainStatsByCost: {
    1: [
      level25("echo-main-1-hp-percent", "hp", "base-percent", 22.8),
      level25("echo-main-1-attack-percent", "attack", "base-percent", 18),
      level25("echo-main-1-defense-percent", "defense", "base-percent", 18),
    ],
    3: [
      level25("echo-main-3-hp-percent", "hp", "base-percent", 30),
      level25("echo-main-3-attack-percent", "attack", "base-percent", 30),
      level25("echo-main-3-defense-percent", "defense", "base-percent", 38),
      level25("echo-main-3-aero-damage", "elementalDamageBonus:aero", "percentage-point", 30),
      level25("echo-main-3-glacio-damage", "elementalDamageBonus:glacio", "percentage-point", 30),
      level25("echo-main-3-electro-damage", "elementalDamageBonus:electro", "percentage-point", 30),
      level25("echo-main-3-fusion-damage", "elementalDamageBonus:fusion", "percentage-point", 30),
      level25("echo-main-3-havoc-damage", "elementalDamageBonus:havoc", "percentage-point", 30),
      level25("echo-main-3-spectro-damage", "elementalDamageBonus:spectro", "percentage-point", 30),
      level25("echo-main-3-energy-regen", "energyRegen", "percentage-point", 32),
    ],
    4: [
      level25("echo-main-4-hp-percent", "hp", "base-percent", 33),
      level25("echo-main-4-attack-percent", "attack", "base-percent", 33),
      level25("echo-main-4-defense-percent", "defense", "base-percent", 41.5),
      level25("echo-main-4-crit-rate", "critRate", "percentage-point", 22),
      level25("echo-main-4-crit-damage", "critDamage", "percentage-point", 44),
      level25("echo-main-4-healing-bonus", "healingBonus", "percentage-point", 26),
    ],
  },
  fixedSecondaryMainStatByCost: {
    1: level25("echo-secondary-1-hp-flat", "hp", "flat", 2280),
    3: level25("echo-secondary-3-attack-flat", "attack", "flat", 100),
    4: level25("echo-secondary-4-attack-flat", "attack", "flat", 150),
  },
  substatRolls: [
    rolls("echo-sub-attack-flat", "attack", "flat", [30, 40, 50, 60]),
    rolls("echo-sub-defense-flat", "defense", "flat", [40, 50, 60, 70]),
    rolls("echo-sub-hp-flat", "hp", "flat", [320, 360, 390, 430, 470, 510, 540, 580]),
    rolls("echo-sub-attack-percent", "attack", "base-percent", commonPercentRolls),
    rolls("echo-sub-hp-percent", "hp", "base-percent", commonPercentRolls),
    rolls("echo-sub-defense-percent", "defense", "base-percent", [8.1, 9, 10, 10.9, 11.8, 12.8, 13.8, 14.7]),
    rolls("echo-sub-energy-regen", "energyRegen", "percentage-point", [6.8, 7.6, 8.4, 9.2, 10, 10.8, 11.6, 12.4]),
    rolls("echo-sub-crit-rate", "critRate", "percentage-point", [6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5]),
    rolls("echo-sub-crit-damage", "critDamage", "percentage-point", [12.6, 13.8, 15, 16.2, 17.4, 18.6, 19.8, 21]),
    rolls("echo-sub-basic-attack-damage", "damageTypeBonus:basicAttack", "percentage-point", commonPercentRolls),
    rolls("echo-sub-heavy-attack-damage", "damageTypeBonus:heavyAttack", "percentage-point", commonPercentRolls),
    rolls("echo-sub-resonance-skill-damage", "damageTypeBonus:resonanceSkill", "percentage-point", commonPercentRolls),
    rolls("echo-sub-resonance-liberation-damage", "damageTypeBonus:resonanceLiberation", "percentage-point", commonPercentRolls),
  ],
  source: {
    kind: "curated-multi-source",
    verifiedAt: "2026-08-17",
    sources: [
      "Wuthering Waves Wiki — Echo/Stats",
      "WutheringWaves.gg — Echo System Guide",
    ],
    notes:
      "Exact five-star +25 main-stat maxima and detailed substat roll values use the current Wiki table; allowed main-stat families and fixed secondary-stat families are cross-checked against WutheringWaves.gg. No intermediate Echo levels are interpolated.",
  },
} satisfies EchoStatTableCatalog;
