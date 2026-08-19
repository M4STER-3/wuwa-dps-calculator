import type { ActionResourceOperation } from "@/domain/models";

/**
 * Exact resource transactions required by runtime effects. They are keyed by
 * canonical action id, so the simulator stays character-agnostic.
 */
export const personalDpsRuntimeActionResourceOperations10R1: Readonly<
  Record<string, readonly ActionResourceOperation[]>
> = {
  "changli-true-sight-charge": [
    { resourceId: "enflamement", operation: "gain", amount: 1, stage: "after-action" },
  ],
  "changli-true-sight-conquest": [
    { resourceId: "enflamement", operation: "gain", amount: 1, stage: "after-action" },
  ],
  "changli-radiance-of-fealty": [
    { resourceId: "enflamement", operation: "gain", amount: 4, stage: "after-action" },
  ],
  "changli-flaming-sacrifice": [
    { resourceId: "enflamement", operation: "consume", amount: 4, stage: "before-action" },
  ],
};
