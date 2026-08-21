import { describe, expect, it } from "vitest";
import { chisa } from "./chisa-combat";
import { resolveActionTalentLevel } from "@/domain/talent-engine";

/**
 * Formula-parity fixtures against the current WutheringTools published damage model,
 * checked 2026-08-21. These are not claimed as live serialized UI screenshots.
 *
 * Damage = ATK × MV × total damage bonus × defense multiplier × resistance multiplier.
 * Defense multiplier = (800 + 8 × character level) /
 *   ((800 + 8 × character level) + (8 × enemy level + 792) × (1 - DEF ignore) × (1 - DEF reduction)).
 * The Chisa Eradication fixture also locks WutheringTools' published 20%/80% split of
 * the additive Ring multiplier across Eradication's two hit groups.
 */
const damage = ({
  attack,
  motionValuePercent,
  damageBonusPercent = 0,
  characterLevel = 90,
  enemyLevel = 100,
  defenseIgnore = 0,
  defenseReduction = 0,
  resistance = 0.1,
}: {
  attack: number;
  motionValuePercent: number;
  damageBonusPercent?: number;
  characterLevel?: number;
  enemyLevel?: number;
  defenseIgnore?: number;
  defenseReduction?: number;
  resistance?: number;
}) => {
  const characterDefenseTerm = 800 + 8 * characterLevel;
  const enemyDefenseTerm =
    (8 * enemyLevel + 792) * (1 - defenseIgnore) * (1 - defenseReduction);
  const defenseMultiplier =
    characterDefenseTerm / (characterDefenseTerm + enemyDefenseTerm);
  const resistanceMultiplier = 1 - resistance;
  return (
    attack *
    (motionValuePercent / 100) *
    (1 + damageBonusPercent / 100) *
    defenseMultiplier *
    resistanceMultiplier
  );
};

const action = (id: string) => chisa.combat?.actions.find((entry) => entry.id === id);
const totalMv = (groups: readonly { percent: number; hits: number }[]) =>
  groups.reduce((sum, group) => sum + group.percent * group.hits, 0);

describe("Chisa WutheringTools formula parity", () => {
  it("matches an exact Lv10 Basic Attack Stage 1 fixture", () => {
    const resolved = resolveActionTalentLevel(action("chisa-basic-1")!, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    expect(totalMv(resolved.action.multipliers)).toBeCloseTo(33.42, 8);
    expect(
      damage({ attack: 1000, motionValuePercent: totalMv(resolved.action.multipliers) }),
    ).toBeCloseTo(146.91053984575836, 8);
  });

  it("matches Moment of Nihility with Kumokiri's 3-stack Liberation and max-stack All-Attribute bonuses", () => {
    const resolved = resolveActionTalentLevel(action("chisa-moment-of-nihility")!, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    expect(totalMv(resolved.action.multipliers)).toBeCloseTo(954.29, 8);
    expect(
      damage({
        attack: 1000,
        motionValuePercent: totalMv(resolved.action.multipliers),
        damageBonusPercent: 48,
      }),
    ).toBeCloseTo(6208.527331619538, 8);
  });

  it("locks Eradication's 20/80 Ring distribution with Snare/Bane defense modifiers", () => {
    const resolved = resolveActionTalentLevel(action("chisa-sawring-eradication")!, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    const baseGroups = resolved.action.multipliers;
    expect(baseGroups).toEqual([
      { percent: 51.54, hits: 1 },
      { percent: 206.13, hits: 1 },
    ]);

    const ringAt100 = 259;
    const distributedGroups = [
      baseGroups[0]!.percent + ringAt100 * 0.2,
      baseGroups[1]!.percent + ringAt100 * 0.8,
    ];
    expect(distributedGroups[0]).toBeCloseTo(103.34, 8);
    expect(distributedGroups[1]).toBeCloseTo(413.33, 8);
    expect(distributedGroups[0] + distributedGroups[1]).toBeCloseTo(516.67, 8);

    expect(
      damage({
        attack: 1000,
        motionValuePercent: 516.67,
        damageBonusPercent: 24,
        defenseIgnore: 0.18,
        defenseReduction: 0.06,
      }),
    ).toBeCloseTo(3190.394654229079, 8);
  });

  it("does not expose resolved GameDatabase gaps as final unknowns", () => {
    expect(chisa.combat?.unknowns).not.toContain("Heavy Attack Lv1 disputed.");
    expect(chisa.combat?.unknowns).not.toContain("Basic-family Lv2-9 unavailable.");
  });
});
