import { describe, expect, it } from "vitest";
import type { FinalStats, Sequence, UserBuild } from "@/domain/models";
import { runTheoreticalPersonalRotation } from "@/domain/personal-rotation-runner";
import { preciseDpsFutureScenarios } from "./precise-dps-future";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";
import { QIUYUAN_MANUAL, QIUYUAN_NATIVE } from "./precise-dps-qiuyuan-core";

const stats: FinalStats = {
  hp: 20000,
  attack: 2000,
  defense: 1259,
  critRate: 50,
  critDamage: 200,
  energyRegen: 125,
  healingBonus: 0,
  tuneBreakBoost: 0,
  elementalDamageBonus: { aero: 0, glacio: 0, electro: 0, fusion: 0, havoc: 0, spectro: 0 },
  damageTypeBonus: { basicAttack: 0, heavyAttack: 0, resonanceSkill: 0, resonanceLiberation: 0, introSkill: 0, echoSkill: 0 },
};

function build(sequence: Sequence, weaponId: string): UserBuild {
  return {
    id: `qiuyuan-s${sequence}`,
    resonatorId: "qiuyuan",
    sourcePresetId: "precise-qiuyuan-runtime",
    characterLevel: 90,
    sequence,
    skillLevels: { basicAttack: 10, resonanceSkill: 10, forteCircuit: 10, resonanceLiberation: 10, introSkill: 10 },
    weapon: { weaponId, level: 90, rank: 1 },
    finalStats: stats,
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };
}

function run(
  scenarioId: "qiuyuan-standard" | "qiuyuan-s3-dps",
  sequence: Sequence,
  withWeapon = true,
) {
  const resonator = findPreciseDpsResonator("qiuyuan")!;
  const weapon = findPreciseDpsWeapon("qiuyuan")!;
  const scenario = preciseDpsFutureScenarios.find((entry) => entry.id === scenarioId)!;
  return runTheoreticalPersonalRotation({
    scenario,
    resonator,
    build: build(sequence, weapon.id),
    stats,
    target: { level: 90, elementalResistance: { aero: 0.1 }, physicalResistance: 0.1 },
    ...(withWeapon ? { weapon } : {}),
    actions: resonator.combat!.actions,
    baseStatBasis: {
      attack: (resonator.baseStats?.[0]?.attack ?? 0) + (weapon.level90Stats?.baseAttack ?? 0),
      hp: resonator.baseStats?.[0]?.hp,
      defense: resonator.baseStats?.[0]?.defense,
    },
  }).simulation;
}

const hasMotionValue = (
  audit: ReturnType<typeof run>["audits"][number],
  value: number,
): boolean => audit.motionValueContributions.some((entry) => entry.value === value);

describe("Qiuyuan precise DPS runtime", () => {
  it("keeps GameDatabase-native Forte actions exact and adds only verified missing actions", () => {
    const resonator = findPreciseDpsResonator("qiuyuan")!;
    for (const id of Object.values(QIUYUAN_NATIVE)) {
      expect(resonator.combat!.actions.some((action) => action.id === id)).toBe(true);
    }
    for (const id of Object.values(QIUYUAN_MANUAL)) {
      expect(resonator.combat!.actions.some((action) => action.id === id)).toBe(true);
    }
    expect(findPreciseDpsWeapon("qiuyuan")?.level90Stats?.critRate).toBeCloseTo(24.3);
  });

  it("executes the reviewed 400 + 100 + 100 Swordster route and clears the gauge only on Inksplash exit", () => {
    const result = run("qiuyuan-standard", 0);
    const resource = result.finalState.actors.qiuyuan?.resources["swordsters-soliloquy"];
    expect(resource?.current).toBe(0);
    expect(result.stateTransitions.some((entry) => entry.kind === "change-form" && entry.detail === "Inksplash of Mind")).toBe(true);
    expect(result.stateTransitions.some((entry) => entry.kind === "resource-consume-all" && entry.detail === "swordsters-soliloquy")).toBe(true);
    expect(result.perAction[QIUYUAN_MANUAL.intro]?.expected ?? 0).toBeGreaterThan(0);
    expect(result.perAction[QIUYUAN_NATIVE.teach]?.expected ?? 0).toBeGreaterThan(0);
    expect(result.perAction[QIUYUAN_MANUAL.outro]?.expected ?? 0).toBeGreaterThan(0);
  });

  it("activates Quietude on the first Inksplash but gives the S3 second Forte cycle its exact +600% multiplier", () => {
    const result = run("qiuyuan-s3-dps", 3);
    const teachAudits = result.audits.filter((entry) => entry.actionId === QIUYUAN_NATIVE.teach);
    expect(teachAudits.length).toBeGreaterThan(2);
    expect(result.stateTransitions.filter((entry) => entry.kind === "effect-activated" && entry.detail === "precise-qiuyuan-quietude-within")).toHaveLength(1);
    expect(teachAudits.some((audit) => hasMotionValue(audit, 600))).toBe(true);
    expect(teachAudits.some((audit) => !hasMotionValue(audit, 600))).toBe(true);
    expect(result.perAction[QIUYUAN_MANUAL.strawCape]?.expected ?? 0).toBeGreaterThan(0);
    expect(result.perAction[QIUYUAN_MANUAL.s3Outro]?.expected ?? 0).toBeGreaterThan(0);
  });

  it("applies S1 Crit Rate, S3 Liberation, S4 ATK and S5 DEF ignore cumulatively", () => {
    const s0 = run("qiuyuan-standard", 0);
    const s1 = run("qiuyuan-standard", 1);
    const s3 = run("qiuyuan-s3-dps", 3);
    const s4 = run("qiuyuan-s3-dps", 4);
    const s5 = run("qiuyuan-s3-dps", 5);

    const s0Intro = s0.audits.find((entry) => entry.actionId === QIUYUAN_MANUAL.intro)!;
    const s1Intro = s1.audits.find((entry) => entry.actionId === QIUYUAN_MANUAL.intro)!;
    expect(s1Intro.effectiveStats.critRate).toBeGreaterThan(s0Intro.effectiveStats.critRate);

    const s3Liberation = s3.audits.find((entry) => entry.actionId === QIUYUAN_NATIVE.liberation)!;
    expect(hasMotionValue(s3Liberation, 500)).toBe(true);

    const s3Straw = s3.audits.find((entry) => entry.actionId === QIUYUAN_MANUAL.strawCape)!;
    const s4Straw = s4.audits.find((entry) => entry.actionId === QIUYUAN_MANUAL.strawCape)!;
    expect(s4Straw.effectiveStats.attack).toBeGreaterThan(s3Straw.effectiveStats.attack);
    expect(s5.personalDamage.expected).toBeGreaterThan(s4.personalDamage.expected);
  });

  it("emits the S6 Inksplash-exit damage and grants the Straw Cape Crit-DMG window", () => {
    const s5 = run("qiuyuan-s3-dps", 5);
    const s6 = run("qiuyuan-s3-dps", 6);
    expect(s6.perAction[QIUYUAN_MANUAL.s6Exit]?.expected ?? 0).toBeGreaterThan(0);
    expect(s5.perAction[QIUYUAN_MANUAL.s6Exit]?.expected ?? 0).toBe(0);

    const teachAudits = s6.audits.filter((entry) => entry.actionId === QIUYUAN_NATIVE.teach);
    const firstTeach = teachAudits.find((audit) => !hasMotionValue(audit, 600))!;
    const secondTeach = teachAudits.find((audit) => hasMotionValue(audit, 600))!;
    expect(secondTeach.effectiveStats.critDamage).toBeGreaterThan(firstTeach.effectiveStats.critDamage);
  });

  it("executes Emerald Sentence eligibility, two Bamboo Cleaver stacks and the Intro Echo bonus", () => {
    const withWeapon = run("qiuyuan-standard", 0, true);
    const withoutWeapon = run("qiuyuan-standard", 0, false);
    const activated = withWeapon.stateTransitions
      .filter((entry) => entry.kind === "effect-activated")
      .map((entry) => entry.detail);
    expect(activated).toContain("precise-emerald-sentence-eligibility");
    expect(activated).toContain("precise-emerald-sentence-bamboo-cleaver");
    expect(activated).toContain("precise-emerald-sentence-intro-echo-bonus");
    expect(withWeapon.perAction[QIUYUAN_NATIVE.teach]?.expected ?? 0).toBeGreaterThan(withoutWeapon.perAction[QIUYUAN_NATIVE.teach]?.expected ?? 0);
    expect(withWeapon.perAction[QIUYUAN_NATIVE.save]?.expected ?? 0).toBeGreaterThan(withoutWeapon.perAction[QIUYUAN_NATIVE.save]?.expected ?? 0);
  });

  it("remains explicitly partial for team recipients, Concerto routing and Outro handoff", () => {
    const result = run("qiuyuan-s3-dps", 6);
    expect(result.partial).toBe(true);
    expect(result.diagnostics.some((entry) =>
      entry.code === "team-context-required" && entry.message.includes("qiuyuan-team-cycle"),
    )).toBe(true);
  });
});
