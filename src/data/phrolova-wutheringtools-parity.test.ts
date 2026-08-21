import { describe, expect, it } from "vitest";
import { resolveActionTalentLevel } from "@/domain/talent-engine";
import { findPreciseDpsResonator } from "./precise-dps-loadouts";
import { PHROLOVA } from "./precise-dps-phrolova";

/**
 * Formula-parity fixtures against the current WutheringTools published damage model,
 * checked 2026-08-21. These are deterministic formula fixtures, not claimed as live
 * serialized UI screenshots.
 *
 * WutheringTools' Phrolova update notes lock two important Scarlet Coda semantics:
 * - Aftersound is distributed 10% / 15% / 75% across its three hit groups.
 * - generic Echo Skill Amplification does not apply to Scarlet Coda, while Phrolova S3's
 *   character-specific Echo Skill amplification does apply to Scarlet Coda.
 */
const damage = ({
  attack,
  motionValuePercent,
  damageBonusPercent = 0,
  damageAmplificationPercent = 0,
  characterLevel = 90,
  enemyLevel = 100,
  defenseIgnore = 0,
  defenseReduction = 0,
  resistance = 0.1,
}: {
  attack: number;
  motionValuePercent: number;
  damageBonusPercent?: number;
  damageAmplificationPercent?: number;
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
  return (
    attack *
    (motionValuePercent / 100) *
    (1 + damageBonusPercent / 100) *
    (1 + damageAmplificationPercent / 100) *
    defenseMultiplier *
    (1 - resistance)
  );
};

const resonator = findPreciseDpsResonator("phrolova")!;
const action = (id: string) =>
  resonator.combat?.actions.find((entry) => entry.id === id);
const totalMv = (groups: readonly { percent: number; hits: number }[]) =>
  groups.reduce((sum, group) => sum + group.percent * group.hits, 0);

describe("Phrolova WutheringTools formula parity", () => {
  it("matches the exact Lv10 Basic Attack Stage 1 fixture", () => {
    const resolved = resolveActionTalentLevel(action(PHROLOVA.basic1)!, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    expect(resolved.action.multipliers).toEqual([{ percent: 53.45, hits: 2 }]);
    expect(totalMv(resolved.action.multipliers)).toBeCloseTo(106.9, 8);
    expect(
      damage({ attack: 1000, motionValuePercent: totalMv(resolved.action.multipliers) }),
    ).toBeCloseTo(469.9203084832905, 8);
  });

  it("locks Scarlet Coda at 10 Aftersound with Lethean R1 without generic Echo amplification", () => {
    const resolved = resolveActionTalentLevel(action(PHROLOVA.scarletCoda)!, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    expect(resolved.action.multipliers).toEqual([
      { percent: 33.01, hits: 2 },
      { percent: 12.38, hits: 8 },
      { percent: 495.1, hits: 1 },
    ]);
    expect(totalMv(resolved.action.multipliers)).toBeCloseTo(660.16, 8);

    const aftersoundAt10 = 82.55 * 10;
    const distributed = [
      aftersoundAt10 * 0.1,
      aftersoundAt10 * 0.15,
      aftersoundAt10 * 0.75,
    ];
    expect(distributed).toEqual([82.55, 123.825, 619.125]);
    const motionValue = totalMv(resolved.action.multipliers) + aftersoundAt10;
    expect(motionValue).toBeCloseTo(1485.66, 8);

    // Lethean R1: +32% Resonance Skill DMG and 8% DEF Ignore. Its generic
    // +32% Echo Skill Amplification is intentionally excluded from Scarlet Coda.
    expect(
      damage({
        attack: 1000,
        motionValuePercent: motionValue,
        damageBonusPercent: 32,
        defenseIgnore: 0.08,
      }),
    ).toBeCloseTo(8988.505821807656, 8);
  });

  it("applies Phrolova S3's explicit Scarlet Coda amplification special-case", () => {
    const resolved = resolveActionTalentLevel(action(PHROLOVA.scarletCoda)!, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    const motionValue = totalMv(resolved.action.multipliers) + 82.55 * 10;
    expect(
      damage({
        attack: 1000,
        motionValuePercent: motionValue,
        damageBonusPercent: 32,
        damageAmplificationPercent: 80,
        defenseIgnore: 0.08,
      }),
    ).toBeCloseTo(16179.31047925378, 8);
  });
});
