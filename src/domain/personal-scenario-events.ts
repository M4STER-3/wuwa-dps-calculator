import type { PersonalRotationScenario, SequencePayloadOverride } from "@/data/personal-rotation-presets";

import type { Sequence } from "./models";
import type { CombatEvent } from "./state-engine";
import type { TemporalTimeline } from "./temporal-engine";

export interface PersonalScenarioEventCompileInput {
  scenario: PersonalRotationScenario;
  timeline: TemporalTimeline;
  sequence: Sequence;
  actorId: string;
  targetId: string;
  /** Team injects scenario events as external timeline inputs; Personal keeps them internal. */
  external?: boolean;
  /** Global Team-cycle offset. Personal and actor-local compilation use zero. */
  timestampOffsetSeconds?: number;
  /** Optional suffix keeps repeated cycle event ids unique without changing scenario semantics. */
  eventIdSuffix?: string;
}

const highestApplicableOverride = (
  overrides: readonly SequencePayloadOverride[] | undefined,
  sequence: Sequence,
): SequencePayloadOverride | undefined => {
  const applicable = [...(overrides ?? [])]
    .filter((override) => override.minimumSequence <= sequence)
    .sort((a, b) => a.minimumSequence - b.minimumSequence);
  return applicable[applicable.length - 1];
};

/**
 * Canonical compiler for data-owned Personal rotation special events.
 * Personal DPS and automatic Team DPS consume this exact function so sequence
 * gates, repeat ordering, payload overrides and anchor timing cannot diverge.
 */
export function compilePersonalScenarioEvents(
  input: PersonalScenarioEventCompileInput,
): readonly CombatEvent[] {
  const events: CombatEvent[] = [];
  const offset = input.timestampOffsetSeconds ?? 0;
  const suffix = input.eventIdSuffix ? `:${input.eventIdSuffix}` : "";

  for (const preset of input.scenario.specialEvents ?? []) {
    if (
      preset.minimumSequence !== undefined &&
      input.sequence < preset.minimumSequence
    ) {
      continue;
    }
    if (
      preset.maximumSequence !== undefined &&
      input.sequence > preset.maximumSequence
    ) {
      continue;
    }

    const anchor = input.timeline.entries[preset.anchor.stepIndex];
    if (!anchor) {
      throw new Error(
        `Rotation scenario ${input.scenario.id} references missing step ${preset.anchor.stepIndex} for ${preset.id}.`,
      );
    }
    const baseTime =
      preset.anchor.at === "start"
        ? anchor.startTimeSeconds
        : anchor.endTimeSeconds;
    const repeat = preset.repeat ?? 1;
    if (!Number.isInteger(repeat) || repeat <= 0) {
      throw new Error(
        `Rotation special event ${preset.id} has an invalid repeat count.`,
      );
    }
    const override = highestApplicableOverride(
      preset.sequenceOverrides,
      input.sequence,
    );

    for (let index = 0; index < repeat; index += 1) {
      const payload = {
        ...(preset.payload ?? {}),
        ...(preset.payloadByRepeat?.[index] ?? {}),
        ...(override?.payload ?? {}),
        ...(override?.payloadByRepeat?.[index] ?? {}),
        scenarioId: input.scenario.id,
      };
      const occurrence = `scenario:${input.scenario.id}:${preset.id}:${index}`;
      events.push({
        id: `${occurrence}:${input.actorId}${suffix}`,
        timestamp:
          offset +
          baseTime +
          (preset.anchor.offsetSeconds ?? 0) +
          index * 0.000001,
        kind: preset.kind,
        ownerId: input.actorId,
        actorId: input.actorId,
        targetId: input.targetId,
        actionId: preset.actionId,
        occurrence,
        external: input.external ?? false,
        payload,
      });
    }
  }

  return events;
}
