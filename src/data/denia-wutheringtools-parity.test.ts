import { describe, expect, it } from "vitest";
import { resolveActionTalentLevel } from "@/domain/talent-engine";
import { findPreciseDpsResonator } from "./precise-dps-loadouts";

/**
 * Deterministic formula-parity fixtures against the current Denia data published by
 * WutheringTools/current references, checked 2026-08-21. These lock formula semantics;
 * they are not claimed as serialized WutheringTools UI exports.
 */
const damage = ({
  attack,
  motionValuePercent,
  damageBonusPercent = 0,
  characterLevel = 90,
  enemyLevel = 100,
  resistance = 0.1,
}: {
  attack: number;
  motionValuePercent: number;
  damageBonusPercent?: number;
  characterLevel?: number;
  enemyLevel?: number;
  resistance?: number;
}) => {
  const characterDefenseTerm = 800 + 8 * characterLevel;
  const enemyDefenseTerm = 8 * enemyLevel + 792;
  const defenseMultiplier = characterDefenseTerm / (characterDefenseTerm + enemyDefenseTerm);
  return (
    attack *
    (motionValuePercent / 100) *
    (1 + damageBonusPercent / 100) *
    defenseMultiplier *
    (1 - resistance)
  );
};

const resonator = findPreciseDpsResonator("denia")!;
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ");
const actionBy = (talent: string, ...tokens: string[]) => {
  const matches = resonator.combat!.actions.filter((action) => {
    if (action.talent !== talent) return false;
    const name = normalize(action.name);
    return tokens.every((token) => name.includes(normalize(token).trim()));
  });
  expect(matches).toHaveLength(1);
  return matches[0]!;
};
const totalMv = (groups: readonly { percent: number; hits: number }[]) =>
  groups.reduce((sum, group) => sum + group.percent * group.hits, 0);

describe("Denia WutheringTools formula parity", () => {
  it("locks Lv10 Banish Stage 2 at three Dark Cores and the S2 x1.4 chain modifier", () => {
    const action = actionBy("resonanceSkill", "Banish", "Breakdown Form", "Stage 2");
    const resolved = resolveActionTalentLevel(action, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    expect(resolved.action.multipliers).toEqual([{ percent: 112.01, hits: 1 }]);
    const s0ThreeCoreMv = totalMv(resolved.action.multipliers) + 150 * 3;
    expect(s0ThreeCoreMv).toBeCloseTo(562.01, 8);
    const s2ThreeCoreMv = s0ThreeCoreMv * 1.4;
    expect(s2ThreeCoreMv).toBeCloseTo(786.814, 8);
    expect(damage({ attack: 1000, motionValuePercent: s2ThreeCoreMv })).toBeCloseTo(
      3458.7453470437017,
      8,
    );
  });

  it("locks the S3 max-Dark-Core Stagecraft Stage 4 additive 1200-point conversion", () => {
    const action = actionBy("basicAttack", "Stagecraft Form", "Stage 4");
    const resolved = resolveActionTalentLevel(action, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    expect(resolved.action.multipliers).toEqual([{ percent: 128, hits: 1 }]);
    const s3MaxCoreMv = totalMv(resolved.action.multipliers) + 1200;
    expect(s3MaxCoreMv).toBe(1328);
    expect(damage({ attack: 1000, motionValuePercent: s3MaxCoreMv })).toBeCloseTo(
      5837.7377892030845,
      8,
    );
  });

  it("locks Final Act Breakdown S3 x1.8 and the S6 Entropy ATK/Fusion bonuses", () => {
    const action = actionBy("resonanceLiberation", "Final Act", "Breakdown Form");
    const resolved = resolveActionTalentLevel(action, 10);
    expect(resolved.status).toBe("supported");
    if (resolved.status !== "supported") return;

    expect(resolved.action.multipliers).toEqual([{ percent: 198.81, hits: 4 }]);
    const baseMv = totalMv(resolved.action.multipliers);
    expect(baseMv).toBeCloseTo(795.24, 8);
    const s3Mv = baseMv * 1.8;
    expect(s3Mv).toBeCloseTo(1431.432, 8);

    // S6 while either Entropy Shift state is active: +60% ATK and +60% Fusion DMG.
    expect(
      damage({ attack: 1600, motionValuePercent: s3Mv, damageBonusPercent: 60 }),
    ).toBeCloseTo(16108.577694601543, 8);
  });
});
