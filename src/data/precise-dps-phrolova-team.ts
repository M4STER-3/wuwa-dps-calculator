import type { ActiveEffectInstance, EffectDefinition } from "@/domain/effect-models";
import type { CombatEffect, Resonator, Sequence } from "@/domain/models";
import type { TeamEmittedAction } from "@/domain/team-engine";
import { PHROLOVA } from "./precise-dps-phrolova";

export const PHROLOVA_MAESTRO_DURATION_SECONDS = 24;
export const PHROLOVA_NOTE_DURATION_SECONDS = 4;
export const PHROLOVA_THEORETICAL_HECATE_ATTACKS_PER_NOTE = 3;
export const PHROLOVA_MAX_TEAM_ECHO_TRIGGERS = 10;

export type PhrolovaPreciseScenarioId =
  | "phrolova-opener-boss"
  | "phrolova-loop-boss"
  | "phrolova-opener-aoe"
  | "phrolova-loop-aoe";

export type PhrolovaVolatileNote = "strings" | "winds" | "cadenza";

export interface PhrolovaTeamEchoTrigger {
  /** Seconds after Phrolova switches off field into the Maestro team window. */
  timeSeconds: number;
  /** Echoes of the same name may trigger Enhanced Hecate only once per Maestro. */
  echoName: string;
  triggeringActorId: string;
}

export interface PhrolovaMaestroScheduleInput {
  scenarioId: PhrolovaPreciseScenarioId;
  sequence: Sequence;
  phrolovaActorId: string;
  targetId?: string;
  /** Defaults to the exact 24s Maestro maximum. Shorter real team cycles may truncate it. */
  durationSeconds?: number;
  /** Exact team-owned Echo casts relative to the off-field handoff. */
  teamEchoTriggers?: readonly PhrolovaTeamEchoTrigger[];
  /** S0/S1 loops can carry Aftersound from a prior cycle; callers may provide the exact carried value. */
  initialAftersound?: number;
  /** Overflow CRIT DMG stacks above capped Aftersound, if carried by a repeatable Team Cycle. */
  initialAftersoundOverflowCrit?: number;
}

export interface PhrolovaScheduledHecateAction {
  kind: "automatic-basic" | "outro-enhanced" | "team-echo-enhanced";
  timeSeconds: number;
  note: PhrolovaVolatileNote;
  action: TeamEmittedAction;
  aftersoundBefore: number;
  aftersoundAfter: number;
  overflowCritBefore: number;
  overflowCritAfter: number;
  echoName?: string;
}

export interface PhrolovaMaestroSchedule {
  durationSeconds: number;
  noteSequence: readonly PhrolovaVolatileNote[];
  scheduledActions: readonly TeamEmittedAction[];
  events: readonly PhrolovaScheduledHecateAction[];
  acceptedTeamEchoTriggers: readonly PhrolovaTeamEchoTrigger[];
  ignoredTeamEchoTriggers: readonly PhrolovaTeamEchoTrigger[];
  finalAftersound: number;
  finalAftersoundOverflowCrit: number;
  notes: readonly string[];
}

const source = {
  kind: "multi-source-verified" as const,
  source: "Prydwen / WutheringTools / WUWA GameDatabase · Phrolova Team Cycle",
  gameVersion: "3.5",
  verifiedAt: "2026-08-20",
};

/**
 * Maestro is a real character state, but the personal rotation contains no damaging
 * Liberation action to hang it from. Team Cycle therefore installs this exact 24s
 * runtime window at the verified handoff point instead of inventing a fake hit.
 */
export const phrolovaMaestroRuntimeEffect: EffectDefinition = {
  id: "precise-phrolova-maestro-runtime",
  label: "Maestro · shared Phrolova/Hecate runtime",
  source: { id: "phrolova-maestro", type: "resonator", label: "Waltz of Forsaken Depths · Maestro" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: {
    duration: { kind: "fixed", seconds: PHROLOVA_MAESTRO_DURATION_SECONDS },
    refresh: "reset-duration",
    uniqueness: "refresh-existing",
  },
  rules: [
    {
      id: "phrolova-maestro-atk",
      label: "Maestro · +120% ATK",
      accounting: "runtime",
      modifiers: [
        {
          kind: "runtime-stat",
          stat: "attack",
          mode: "percent",
          stacking: "additive",
          value: { kind: "constant", value: 120 },
        },
      ],
    },
    {
      id: "phrolova-s6-maestro-offfield-damage",
      label: "S6 · off-field targets take +40% DMG from Hecate and Phrolova",
      accounting: "runtime",
      requiredSequence: 6,
      predicates: [{ kind: "on-field", value: false }],
      modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 40 }],
    },
    {
      id: "phrolova-s6-maestro-onfield-havoc",
      label: "S6 · on-field Maestro +60% Havoc DMG Bonus",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "element", anyOf: ["havoc"] }],
      predicates: [{ kind: "on-field", value: true }],
      modifiers: [{ kind: "elemental-damage-bonus", stacking: "additive", value: 60 }],
    },
  ],
};

const maestroCombatEffect: CombatEffect = {
  id: "phrolova-maestro-runtime",
  name: "Maestro runtime",
  sourceId: phrolovaMaestroRuntimeEffect.source.id,
  trigger: "Waltz of Forsaken Depths / Team Cycle handoff",
  target: "self",
  effect: phrolovaMaestroRuntimeEffect.label,
  source,
  structuredEffect: phrolovaMaestroRuntimeEffect,
};

function patchPhrolovaEffect(effect: CombatEffect): CombatEffect {
  const structured = effect.structuredEffect;
  if (!structured) return effect;

  if (structured.id === "precise-phrolova-sequences") {
    // WutheringTools' later correction removed Echo DMG Amplification from Scarlet Coda's
    // Resonance Skill damage. Scarlet Coda still counts as an Echo Skill CAST for cast triggers.
    const patched: EffectDefinition = {
      ...structured,
      rules: structured.rules.filter((rule) => rule.id !== "phrolova-s3-scarlet-special-inclusion"),
    };
    return { ...effect, structuredEffect: patched, effect: patched.label };
  }

  if (structured.id === "precise-phrolova-s4-self") {
    // S4 is team-wide Attribute DMG Bonus, not a self-only ATK/stat effect.
    const patched: EffectDefinition = { ...structured, target: "team" };
    return { ...effect, target: "team", structuredEffect: patched, effect: patched.label };
  }

  return effect;
}

/** Post-processing layer kept separate from Phrolova's kit file so Team Cycle rules stay reusable. */
export function applyPrecisePhrolovaTeamCycleMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "phrolova" || !resonator.combat) return resonator;
  const effects = resonator.combat.effects.map(patchPhrolovaEffect);
  if (!effects.some((effect) => effect.structuredEffect?.id === phrolovaMaestroRuntimeEffect.id)) {
    effects.push(maestroCombatEffect);
  }
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      effects,
      unknowns: [
        ...resonator.combat.unknowns,
        "Team Cycle: Maestro's exact 24s +120% ATK state and S6 on/off-field modifiers are structured; Hecate action timestamps remain a theoretical cadence calibrated inside each exact team-cycle duration.",
      ],
    },
  };
}

export function createPhrolovaMaestroEffectInstance(
  ownerActorId: string,
  startTimeSeconds = 0,
): ActiveEffectInstance {
  return {
    id: `phrolova-maestro:${ownerActorId}:${startTimeSeconds}`,
    definition: phrolovaMaestroRuntimeEffect,
    ownerId: ownerActorId,
    affectedEntityIds: [ownerActorId],
    startTimeSeconds,
    endTimeSeconds: startTimeSeconds + PHROLOVA_MAESTRO_DURATION_SECONDS,
  };
}

export function phrolovaVolatileNoteSequence(
  scenarioId: PhrolovaPreciseScenarioId,
  sequence: Sequence,
): readonly PhrolovaVolatileNote[] {
  // S3 converts every stored Volatile Note to Cadenza when Scarlet Coda is cast.
  if (sequence >= 3) return ["cadenza", "cadenza", "cadenza", "cadenza", "cadenza", "cadenza"];

  switch (scenarioId) {
    case "phrolova-opener-boss":
      return ["strings", "strings", "winds", "strings", "cadenza", "strings"];
    case "phrolova-loop-boss":
      return ["cadenza", "strings", "winds", "strings", "cadenza", "strings"];
    case "phrolova-opener-aoe":
      return ["strings", "winds", "winds", "winds", "cadenza", "winds"];
    case "phrolova-loop-aoe":
      return ["cadenza", "winds", "winds", "winds", "cadenza", "winds"];
  }
}

function normalizedEchoName(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function noteAtTime(
  notes: readonly PhrolovaVolatileNote[],
  timeSeconds: number,
): PhrolovaVolatileNote {
  const index = Math.min(notes.length - 1, Math.max(0, Math.floor(timeSeconds / PHROLOVA_NOTE_DURATION_SECONDS)));
  return notes[index];
}

function enhancedActionForNote(note: PhrolovaVolatileNote): string {
  if (note === "strings") return PHROLOVA.hecateStrings;
  if (note === "winds") return PHROLOVA.hecateWinds;
  return PHROLOVA.hecateCadenza;
}

function teamAction(
  phrolovaActorId: string,
  targetId: string,
  actionId: string,
  timeSeconds: number,
  triggeringActorId: string,
): TeamEmittedAction {
  return {
    actorId: phrolovaActorId,
    actionId,
    targetId,
    damageOwnerId: phrolovaActorId,
    scalingOwnerId: phrolovaActorId,
    triggeringActorId,
    delaySeconds: timeSeconds,
  };
}

function bounded(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildPhrolovaMaestroSchedule(
  input: PhrolovaMaestroScheduleInput,
): PhrolovaMaestroSchedule {
  const durationSeconds = bounded(
    Number.isFinite(input.durationSeconds) ? (input.durationSeconds as number) : PHROLOVA_MAESTRO_DURATION_SECONDS,
    0,
    PHROLOVA_MAESTRO_DURATION_SECONDS,
  );
  const targetId = input.targetId ?? "target";
  const noteSequence = phrolovaVolatileNoteSequence(input.scenarioId, input.sequence);
  const acceptedTeamEchoTriggers: PhrolovaTeamEchoTrigger[] = [];
  const ignoredTeamEchoTriggers: PhrolovaTeamEchoTrigger[] = [];
  const seenEchoNames = new Set<string>();

  for (const trigger of [...(input.teamEchoTriggers ?? [])].sort((a, b) => a.timeSeconds - b.timeSeconds)) {
    const name = normalizedEchoName(trigger.echoName);
    if (
      !name ||
      !Number.isFinite(trigger.timeSeconds) ||
      trigger.timeSeconds < 0 ||
      trigger.timeSeconds >= durationSeconds ||
      seenEchoNames.has(name) ||
      acceptedTeamEchoTriggers.length >= PHROLOVA_MAX_TEAM_ECHO_TRIGGERS
    ) {
      ignoredTeamEchoTriggers.push(trigger);
      continue;
    }
    seenEchoNames.add(name);
    acceptedTeamEchoTriggers.push(trigger);
  }

  const rawEvents: Array<{
    kind: PhrolovaScheduledHecateAction["kind"];
    timeSeconds: number;
    note: PhrolovaVolatileNote;
    actionId: string;
    triggeringActorId: string;
    echoName?: string;
  }> = [];

  // Outro while Maestro is active adds two immediate Enhanced Hecate attacks.
  if (durationSeconds > 0) {
    for (let index = 0; index < 2; index += 1) {
      const timeSeconds = 0.0001 * (index + 1);
      rawEvents.push({
        kind: "outro-enhanced",
        timeSeconds,
        note: noteAtTime(noteSequence, timeSeconds),
        actionId: enhancedActionForNote(noteAtTime(noteSequence, timeSeconds)),
        triggeringActorId: input.phrolovaActorId,
      });
    }
  }

  // Public calculations place Hecate at roughly 1.2–1.5s per automatic attack.
  // The shared theoretical profile uses 3 evenly spaced attacks inside each exact 4s note window
  // (4/3s cadence), centered away from note boundaries so no frame-exact boundary is claimed.
  let autoIndex = 0;
  for (let noteIndex = 0; noteIndex < noteSequence.length; noteIndex += 1) {
    const noteStart = noteIndex * PHROLOVA_NOTE_DURATION_SECONDS;
    for (let pulse = 0; pulse < PHROLOVA_THEORETICAL_HECATE_ATTACKS_PER_NOTE; pulse += 1) {
      const timeSeconds =
        noteStart +
        ((pulse + 0.5) * PHROLOVA_NOTE_DURATION_SECONDS) /
          PHROLOVA_THEORETICAL_HECATE_ATTACKS_PER_NOTE;
      if (timeSeconds >= durationSeconds) continue;
      rawEvents.push({
        kind: "automatic-basic",
        timeSeconds,
        note: noteSequence[noteIndex],
        actionId: autoIndex % 2 === 0 ? PHROLOVA.hecateBasic1 : PHROLOVA.hecateBasic2,
        triggeringActorId: input.phrolovaActorId,
      });
      autoIndex += 1;
    }
  }

  acceptedTeamEchoTriggers.forEach((trigger, index) => {
    const timeSeconds = Math.min(durationSeconds - Number.EPSILON, trigger.timeSeconds + 0.0001 * (index + 1));
    const note = noteAtTime(noteSequence, timeSeconds);
    rawEvents.push({
      kind: "team-echo-enhanced",
      timeSeconds,
      note,
      actionId: enhancedActionForNote(note),
      triggeringActorId: trigger.triggeringActorId,
      echoName: trigger.echoName,
    });
  });

  rawEvents.sort((a, b) => a.timeSeconds - b.timeSeconds || a.actionId.localeCompare(b.actionId));

  let aftersound = bounded(input.initialAftersound ?? (input.sequence >= 2 ? 24 : 10), 0, 24);
  let overflowCrit = bounded(input.initialAftersoundOverflowCrit ?? 0, 0, 100);
  const events: PhrolovaScheduledHecateAction[] = rawEvents.map((event) => {
    const aftersoundBefore = aftersound;
    const overflowCritBefore = overflowCrit;
    if (event.kind !== "automatic-basic") {
      if (aftersound < 24) aftersound += 1;
      else overflowCrit = Math.min(100, overflowCrit + 1);
    }
    return {
      kind: event.kind,
      timeSeconds: event.timeSeconds,
      note: event.note,
      action: teamAction(
        input.phrolovaActorId,
        targetId,
        event.actionId,
        event.timeSeconds,
        event.triggeringActorId,
      ),
      aftersoundBefore,
      aftersoundAfter: aftersound,
      overflowCritBefore,
      overflowCritAfter: overflowCrit,
      ...(event.echoName ? { echoName: event.echoName } : {}),
    };
  });

  return {
    durationSeconds,
    noteSequence,
    scheduledActions: events.map((event) => event.action),
    events,
    acceptedTeamEchoTriggers,
    ignoredTeamEchoTriggers,
    finalAftersound: aftersound,
    finalAftersoundOverflowCrit: overflowCrit,
    notes: [
      "Maestro duration and 4s Volatile Note windows are exact kit rules.",
      "Automatic Hecate timestamps are theoretical: three evenly spaced attacks per 4s note window (4/3s cadence), matching the reviewed ~1.2–1.5s public cadence without claiming frame data.",
      "All Hecate actions use Phrolova as source, damage owner and scaling owner, so damage remains attributed to Phrolova while another Resonator is active.",
      "Team Echo triggers are capped at 10 and the same Echo name is accepted only once per Maestro window.",
    ],
  };
}
