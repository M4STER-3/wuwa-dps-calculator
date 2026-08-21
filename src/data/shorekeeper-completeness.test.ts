import { describe, expect, it } from "vitest";
import { preciseCharacterBoxPresets } from "./precise-character-box-presets";
import { findPreciseDpsResonator, findPreciseDpsWeapon } from "./precise-dps-loadouts";
import { SHOREKEEPER_MANUAL, SHOREKEEPER_NATIVE } from "./precise-dps-shorekeeper-core";

const resonator = findPreciseDpsResonator("shorekeeper")!;
const weapon = findPreciseDpsWeapon("shorekeeper")!;
const weaponEffects = weapon.effects ?? [];
const presets = preciseCharacterBoxPresets.filter(
  (entry) => entry.resonatorId === "shorekeeper",
);

describe("Shorekeeper completion audit", () => {
  it("keeps the reviewed Character Box package exactly once", () => {
    expect(resonator).toMatchObject({
      id: "shorekeeper",
      element: "spectro",
      rarity: 5,
      weaponType: "rectifier",
    });
    expect(weapon).toMatchObject({
      id: "precise-shorekeeper-signature",
      name: "Stellar Symphony",
      rarity: 5,
      level90Stats: { baseAttack: 412.5, energyRegen: 77 },
    });

    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({
      id: "shorekeeper-s0-l90-signature-precise",
      resonatorId: "shorekeeper",
      characterLevel: 90,
      sequence: 0,
      progression: {
        inherentSkillsUnlocked: true,
        minorFortesUnlocked: true,
      },
      weapon: { weaponId: weapon.id, level: 90, rank: 1 },
      mainEchoId: "fallacy-of-no-return",
    });
    expect(presets[0]?.echoLoadout?.echoes).toHaveLength(5);
    expect(
      presets[0]?.notes?.some((note) => note.includes("inclus exactement une fois dans finalStats")),
    ).toBe(true);
  });

  it("keeps every native damage row exact at Lv1 and Lv10 while End Loop stays zero-MV", () => {
    const nativeDamageActions = (resonator.combat?.actions ?? []).filter(
      (action) => action.id !== SHOREKEEPER_MANUAL.endLoop && action.multipliers.length > 0,
    );
    expect(nativeDamageActions.length).toBeGreaterThan(15);
    for (const action of nativeDamageActions) {
      expect(action.multipliersByTalentLevel?.[1], `${action.id} Lv1`).toBeDefined();
      expect(action.multipliersByTalentLevel?.[10], `${action.id} Lv10`).toBeDefined();
    }

    for (const id of Object.values(SHOREKEEPER_NATIVE)) {
      expect(resonator.combat?.actions.some((action) => action.id === id), id).toBe(true);
    }
    const endLoop = resonator.combat?.actions.find(
      (action) => action.id === SHOREKEEPER_MANUAL.endLoop,
    );
    expect(endLoop?.multipliers).toEqual([]);
  });

  it("keeps Stellar Symphony permanent HP upstream and temporary/team effects out of finalStats", () => {
    const permanent = weaponEffects.find(
      (effect) => effect.structuredEffect?.id === "precise-stellar-symphony-permanent",
    )?.structuredEffect;
    const personal = weaponEffects.find(
      (effect) => effect.structuredEffect?.id === "precise-stellar-symphony-personal",
    )?.structuredEffect;
    const team = weaponEffects.find(
      (effect) => effect.structuredEffect?.id === "precise-stellar-symphony-team-pending",
    )?.structuredEffect;

    expect(permanent?.activationPolicy).toBe("initially-active");
    expect(permanent?.rules).toHaveLength(1);
    expect(permanent?.rules[0]?.accounting).toBe("already-in-final-stats");
    expect(personal?.rules.every((rule) => rule.accounting === "informational")).toBe(true);
    expect(team?.teamContextRequired).toBe(true);
    expect(team?.rules.every((rule) => rule.accounting === "informational")).toBe(true);
  });

  it("keeps Supernal/Discernment eligibility explicit instead of silently inventing allied Intro events", () => {
    const loop = resonator.combat?.unknowns ?? [];
    expect(loop.some((note) => note.includes("Supernal Stellarealm") && note.includes("Team Cycle-owned"))).toBe(true);

    const teamPending = resonator.combat?.effects.find(
      (effect) => effect.structuredEffect?.id === "precise-shorekeeper-team-cycle-pending",
    )?.structuredEffect;
    expect(teamPending?.teamContextRequired).toBe(true);
    expect(
      teamPending?.rules.some((rule) => rule.id === "shorekeeper-stellarealm-evolution-pending"),
    ).toBe(true);
  });
});
