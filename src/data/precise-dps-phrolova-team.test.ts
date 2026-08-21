import { describe, expect, it } from "vitest";
import { findPreciseDpsResonator } from "./precise-dps-loadouts";
import {
  buildPhrolovaMaestroSchedule,
  PHROLOVA_MAESTRO_DURATION_SECONDS,
  phrolovaVolatileNoteSequence,
} from "./precise-dps-phrolova-team";
import { PHROLOVA } from "./precise-dps-phrolova";

describe("Phrolova precise Team Cycle contract", () => {
  it("materializes the six reviewed Volatile Notes for opener/loop and boss/AoE", () => {
    expect(phrolovaVolatileNoteSequence("phrolova-opener-boss", 0)).toEqual([
      "strings", "strings", "winds", "strings", "cadenza", "strings",
    ]);
    expect(phrolovaVolatileNoteSequence("phrolova-loop-boss", 0)).toEqual([
      "cadenza", "strings", "winds", "strings", "cadenza", "strings",
    ]);
    expect(phrolovaVolatileNoteSequence("phrolova-opener-aoe", 0)).toEqual([
      "strings", "winds", "winds", "winds", "cadenza", "winds",
    ]);
    expect(phrolovaVolatileNoteSequence("phrolova-loop-aoe", 0)).toEqual([
      "cadenza", "winds", "winds", "winds", "cadenza", "winds",
    ]);
  });

  it("converts every stored note to Cadenza at S3+ before Maestro", () => {
    expect(phrolovaVolatileNoteSequence("phrolova-opener-boss", 3)).toEqual([
      "cadenza", "cadenza", "cadenza", "cadenza", "cadenza", "cadenza",
    ]);
    expect(phrolovaVolatileNoteSequence("phrolova-loop-aoe", 6)).toEqual([
      "cadenza", "cadenza", "cadenza", "cadenza", "cadenza", "cadenza",
    ]);
  });

  it("builds a 24s theoretical Hecate cadence without claiming frame-exact attack timing", () => {
    const schedule = buildPhrolovaMaestroSchedule({
      scenarioId: "phrolova-opener-boss",
      sequence: 0,
      phrolovaActorId: "phrolova",
    });
    expect(schedule.durationSeconds).toBe(PHROLOVA_MAESTRO_DURATION_SECONDS);
    expect(schedule.events.filter((event) => event.kind === "automatic-basic")).toHaveLength(18);
    expect(schedule.events.filter((event) => event.kind === "outro-enhanced")).toHaveLength(2);
    expect(schedule.notes.some((note) => note.includes("theoretical"))).toBe(true);
  });

  it("deduplicates same-name team Echo casts and caps their Enhanced Hecate triggers at ten", () => {
    const triggers = [
      { timeSeconds: 1, echoName: "Echo A", triggeringActorId: "ally-a" },
      { timeSeconds: 2, echoName: "Echo A", triggeringActorId: "ally-a" },
      ...Array.from({ length: 12 }, (_, index) => ({
        timeSeconds: 3 + index,
        echoName: `Echo ${index + 1}`,
        triggeringActorId: index % 2 ? "ally-a" : "ally-b",
      })),
    ];
    const schedule = buildPhrolovaMaestroSchedule({
      scenarioId: "phrolova-loop-boss",
      sequence: 0,
      phrolovaActorId: "phrolova",
      teamEchoTriggers: triggers,
    });
    expect(schedule.acceptedTeamEchoTriggers).toHaveLength(10);
    expect(schedule.ignoredTeamEchoTriggers.length).toBeGreaterThanOrEqual(3);
    expect(schedule.events.filter((event) => event.kind === "team-echo-enhanced")).toHaveLength(10);
  });

  it("keeps source, damage ownership and scaling ownership on Phrolova while teammates trigger Hecate", () => {
    const schedule = buildPhrolovaMaestroSchedule({
      scenarioId: "phrolova-loop-aoe",
      sequence: 0,
      phrolovaActorId: "phrolova-instance",
      teamEchoTriggers: [
        { timeSeconds: 5, echoName: "Ally Echo", triggeringActorId: "ally-instance" },
      ],
    });
    for (const event of schedule.events) {
      expect(event.action.actorId).toBe("phrolova-instance");
      expect(event.action.damageOwnerId).toBe("phrolova-instance");
      expect(event.action.scalingOwnerId).toBe("phrolova-instance");
    }
    const triggered = schedule.events.find((event) => event.kind === "team-echo-enhanced");
    expect(triggered?.action.triggeringActorId).toBe("ally-instance");
    expect(triggered?.action.actionId).toBe(PHROLOVA.hecateWinds);
  });

  it("tracks Aftersound gains only from off-field Enhanced Hecate and exposes overflow CRIT ramp", () => {
    const s0 = buildPhrolovaMaestroSchedule({
      scenarioId: "phrolova-opener-boss",
      sequence: 0,
      phrolovaActorId: "phrolova",
      teamEchoTriggers: Array.from({ length: 10 }, (_, index) => ({
        timeSeconds: 1 + index,
        echoName: `Unique ${index}`,
        triggeringActorId: "ally",
      })),
    });
    expect(s0.finalAftersound).toBe(22);
    expect(s0.finalAftersoundOverflowCrit).toBe(0);

    const s2 = buildPhrolovaMaestroSchedule({
      scenarioId: "phrolova-opener-boss",
      sequence: 2,
      phrolovaActorId: "phrolova",
      teamEchoTriggers: Array.from({ length: 10 }, (_, index) => ({
        timeSeconds: 1 + index,
        echoName: `Unique ${index}`,
        triggeringActorId: "ally",
      })),
    });
    expect(s2.finalAftersound).toBe(24);
    expect(s2.finalAftersoundOverflowCrit).toBe(12);
  });

  it("patches the latest Phrolova corrections and installs Maestro runtime mechanics", () => {
    const resonator = findPreciseDpsResonator("phrolova")!;
    const effects = resonator.combat!.effects.map((effect) => effect.structuredEffect).filter(Boolean);
    const sequences = effects.find((effect) => effect!.id === "precise-phrolova-sequences")!;
    expect(sequences.rules.some((rule) => rule.id === "phrolova-s3-scarlet-special-inclusion")).toBe(false);

    const s4 = effects.find((effect) => effect!.id === "precise-phrolova-s4-self")!;
    expect(s4.target).toBe("team");

    const maestro = effects.find((effect) => effect!.id === "precise-phrolova-maestro-runtime")!;
    expect(maestro.lifecycle?.duration).toEqual({ kind: "fixed", seconds: 24 });
    expect(maestro.rules.some((rule) => rule.id === "phrolova-maestro-atk")).toBe(true);
    expect(maestro.rules.some((rule) => rule.id === "phrolova-s6-maestro-offfield-damage")).toBe(true);
  });
});
