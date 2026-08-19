import { describe, expect, it } from "vitest";
import { presets, resonators } from "@/data/catalog";
import {
  aemeathPersonalDpsProfile10R1,
  calcharoPersonalDpsProfile10R1,
  changliPersonalDpsProfile10R1,
} from "@/data/personal-dps-pilots-10r1";
import { materializeCharacterBoxBuild10R1 } from "@/game-data/character-box-final-stats-10r1";
import { createBuildFromPreset } from "./character-box";
import { simulatePersonalDpsBuildV1 } from "./personal-dps-simulation";
import type { PersonalDpsProfileV1 } from "./personal-dps-engine";
import type { Resonator, Sequence, UserBuild } from "./models";

function fixture(resonatorId: string, profile: PersonalDpsProfileV1) {
  const preset = presets.find((candidate) => candidate.resonatorId === resonatorId);
  const resonator = resonators.find((candidate) => candidate.id === resonatorId);
  if (!preset || !resonator) throw new Error(`Missing ${resonatorId} fixture.`);
  const build = materializeCharacterBoxBuild10R1(
    createBuildFromPreset(preset, {
      id: `runtime-${resonatorId}`,
      now: "2026-08-19T00:00:00.000Z",
    }),
  );
  return { build, resonator, profile };
}

function simulate(input: {
  build: UserBuild;
  resonator: Resonator;
  profile: PersonalDpsProfileV1;
}) {
  return simulatePersonalDpsBuildV1({
    ...input,
    rotationId: input.profile.rotations[0]!.id,
    target: {
      id: "test-target",
      level: 90,
      elementalResistance: { [input.profile.element]: 0.1 },
      physicalResistance: 0.1,
    },
  });
}

function atSequence(build: UserBuild, sequence: Sequence): UserBuild {
  return { ...build, sequence };
}

describe("universal personal DPS runtime simulation", () => {
  it("uses the Aemeath-style Temporal Engine for all three pilots", () => {
    const aemeath = simulate(fixture("aemeath", aemeathPersonalDpsProfile10R1));
    const calcharo = simulate(fixture("calcharo", calcharoPersonalDpsProfile10R1));
    const changli = simulate(fixture("changli", changliPersonalDpsProfile10R1));

    expect(aemeath.rotationDurationSeconds).toBeCloseTo(11.69, 8);
    expect(aemeath.timingConfidence).toBe("estimated-calibrated");
    expect(calcharo.rotationDurationSeconds).toBeGreaterThan(0);
    expect(changli.rotationDurationSeconds).toBeGreaterThan(0);
    expect(calcharo.timingConfidence).toBe("estimated-default");
    expect(changli.timingConfidence).toBe("estimated-default");
    expect(calcharo.dps.expected).toBeGreaterThan(0);
    expect(changli.dps.expected).toBeGreaterThan(0);
  });

  it("applies Calcharo S2 after Intro and S3 across the Deathblade Gear window", () => {
    const base = fixture("calcharo", calcharoPersonalDpsProfile10R1);
    const s0 = simulate({ ...base, build: atSequence(base.build, 0) });
    const s2 = simulate({ ...base, build: atSequence(base.build, 2) });
    const s3 = simulate({ ...base, build: atSequence(base.build, 3) });

    expect(
      s2.perAction["calcharo-extermination-order-1"]!.expected,
    ).toBeGreaterThan(
      s0.perAction["calcharo-extermination-order-1"]!.expected,
    );
    expect(
      s2.perAction["calcharo-extermination-order-2"]!.expected,
    ).toBeGreaterThan(
      s0.perAction["calcharo-extermination-order-2"]!.expected,
    );
    expect(s2.perAction["calcharo-wanted-outlaw"]!.expected).toBeCloseTo(
      s0.perAction["calcharo-wanted-outlaw"]!.expected,
      8,
    );

    expect(s3.perAction["calcharo-hounds-roar-1"]!.expected).toBeGreaterThan(
      s2.perAction["calcharo-hounds-roar-1"]!.expected,
    );
    expect(s3.perAction["calcharo-death-messenger"]!.expected).toBeGreaterThan(
      s2.perAction["calcharo-death-messenger"]!.expected,
    );
  });

  it("applies Calcharo S5 Intro damage and S6 emitted phantoms", () => {
    const base = fixture("calcharo", calcharoPersonalDpsProfile10R1);
    const s4 = simulate({ ...base, build: atSequence(base.build, 4) });
    const s5 = simulate({ ...base, build: atSequence(base.build, 5) });
    const s6 = simulate({ ...base, build: atSequence(base.build, 6) });

    expect(s5.perAction["calcharo-wanted-outlaw"]!.expected).toBeGreaterThan(
      s4.perAction["calcharo-wanted-outlaw"]!.expected,
    );
    expect(s6.totals.expected).toBeGreaterThan(s5.totals.expected);
    expect(s6.perAction["calcharo-s6-phantom"]?.expected ?? 0).toBeGreaterThan(0);
  });

  it("applies Changli resources, inherents and sequence rules without changing the engine", () => {
    const base = fixture("changli", changliPersonalDpsProfile10R1);
    const s0 = simulate({ ...base, build: atSequence(base.build, 0) });
    const s6 = simulate({ ...base, build: atSequence(base.build, 6) });

    expect(base.build.echoLoadout?.mainEchoId).toBeDefined();
    expect(base.build.finalStats.elementalDamageBonus.fusion).toBeGreaterThan(0);
    expect(base.build.finalStats.damageTypeBonus.resonanceSkill).toBeGreaterThan(0);
    expect(s0.perAction["changli-flaming-sacrifice"]?.expected ?? 0).toBeGreaterThan(0);
    expect(s6.totals.expected).toBeGreaterThan(s0.totals.expected);
    expect(s6.dps.expected).toBeGreaterThan(s0.dps.expected);
  });

  it("activates matching weapon and five-piece Sonata runtime effects from build identities", () => {
    const base = fixture("calcharo", calcharoPersonalDpsProfile10R1);
    const equipped = simulate(base);
    const stripped = simulate({
      ...base,
      build: {
        ...base.build,
        weapon: { ...base.build.weapon, weaponId: "no-runtime-weapon" },
        echoLoadout: undefined,
      },
    });

    expect(equipped.totals.expected).toBeGreaterThan(stripped.totals.expected);
  });

  it("never mutates UserBuild.finalStats while resolving runtime effects", () => {
    const base = fixture("changli", changliPersonalDpsProfile10R1);
    const before = structuredClone(base.build.finalStats);
    simulate({ ...base, build: atSequence(base.build, 6) });
    expect(base.build.finalStats).toEqual(before);
  });
});
