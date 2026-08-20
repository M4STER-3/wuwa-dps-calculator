import { describe, expect, it } from "vitest";
import { resolveActiveEffects } from "@/domain/effect-engine";
import type { ActiveEffectInstance } from "@/domain/effect-models";
import type { FinalStats, Weapon } from "@/domain/models";
import { applyPreciseWeaponMechanics } from "./precise-dps-weapons";

const panel: FinalStats = {
  hp: 20000,
  attack: 2000,
  defense: 3000,
  critRate: 5,
  critDamage: 150,
  energyRegen: 100,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
};
const base = (id: string, name: string, type: Weapon["type"], baseAttack: number): Weapon => ({
  id,
  name,
  type,
  rarity: 5,
  level90Stats: { baseAttack },
  source: { kind: "verified-game-data", source: "test" },
});
const active = (weapon: Weapon, effectIndex: number, stacks?: number): ActiveEffectInstance => ({
  id: `active-${effectIndex}`,
  definition: weapon.effects![effectIndex]!.structuredEffect!,
  ownerId: "actor",
  stacks,
});
const context = (rank: number, damageType: "basicAttack" | "resonanceLiberation" = "basicAttack") => ({
  actorId: "actor",
  targetId: "enemy",
  teamMemberIds: ["actor"],
  element: "spectro" as const,
  damageType,
  rank,
  combatContext: {
    timestamp: 0,
    actorId: "actor",
    ownerId: "actor",
    targetId: "enemy",
    panelStats: panel,
    element: "spectro" as const,
    damageType,
  },
});

describe("precise signature weapon mechanics", () => {
  it("projects Spectrum Blaster Lv90 Crit Rate and exact R1/R5 Basic window", () => {
    const weapon = applyPreciseWeaponMechanics("lynae", base("precise-lynae-signature", "Spectrum Blaster", "pistols", 587.5));
    expect(weapon.level90Stats?.critRate).toBeCloseTo(24.3);
    const r1 = resolveActiveEffects([active(weapon, 1)], context(1));
    const r5 = resolveActiveEffects([active(weapon, 1)], context(5));
    expect(r1.damageModifiers.additionalDamageTypeBonusPercent).toBe(36);
    expect(r5.damageModifiers.additionalDamageTypeBonusPercent).toBe(72);
  });

  it("projects Spectrum Blaster exact three-stack R1/R5 team All-DMG", () => {
    const weapon = applyPreciseWeaponMechanics("lynae", base("precise-lynae-signature", "Spectrum Blaster", "pistols", 587.5));
    const r1 = resolveActiveEffects([active(weapon, 2, 3)], context(1));
    const r5 = resolveActiveEffects([active(weapon, 2, 3)], context(5));
    expect(r1.damageModifiers.allDamageBonusPercent).toBe(24);
    expect(r5.damageModifiers.allDamageBonusPercent).toBe(48);
  });

  it("projects Starfield Calibrator Lv90 ER and exact R1/R5 team Crit DMG", () => {
    const weapon = applyPreciseWeaponMechanics("mornye", base("precise-mornye-signature", "Starfield Calibrator", "broadblade", 412.5));
    expect(weapon.level90Stats?.energyRegen).toBeCloseTo(77.04);
    const r1 = resolveActiveEffects([active(weapon, 2)], context(1, "resonanceLiberation"));
    const r5 = resolveActiveEffects([active(weapon, 2)], context(5, "resonanceLiberation"));
    expect(r1.damageModifiers.critDamageBonusPercent).toBe(20);
    expect(r5.damageModifiers.critDamageBonusPercent).toBe(40);
  });

  it("keeps permanent weapon stat passives upstream instead of double-counting them at runtime", () => {
    const spectrum = applyPreciseWeaponMechanics("lynae", base("precise-lynae-signature", "Spectrum Blaster", "pistols", 587.5));
    const starfield = applyPreciseWeaponMechanics("mornye", base("precise-mornye-signature", "Starfield Calibrator", "broadblade", 412.5));
    expect(spectrum.effects?.[0]?.structuredEffect?.rules[0]?.accounting).toBe("already-in-final-stats");
    expect(starfield.effects?.[0]?.structuredEffect?.rules[0]?.accounting).toBe("already-in-final-stats");
  });
});
