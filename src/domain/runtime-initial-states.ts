import type { Sequence } from "./models";

/**
 * Universal actor states that are true before any combat event is processed.
 * Both Personal and Team runtimes must start from the same sequence semantics.
 */
export function sequenceRuntimeStates(sequence: Sequence): readonly string[] {
  return [
    `sequence-${sequence}`,
    ...Array.from(
      { length: sequence },
      (_, index) => `sequence-at-least-${index + 1}`,
    ),
  ];
}

export function initialRuntimeStates(sequence: Sequence): readonly string[] {
  return ["ground", ...sequenceRuntimeStates(sequence)];
}
