import type { CombatAction, Resonator } from "@/domain/models";

type ReviewedMappedAction = {
  readonly actionId: string;
  readonly multipliersByTalentLevel: CombatAction["multipliersByTalentLevel"];
};

type ReviewedCombatProjection = {
  readonly sourceItemId: string;
  readonly name: string;
  readonly mappedActions: readonly ReviewedMappedAction[];
};

export function applyReviewedGameDatabaseTalentLevels(
  resonator: Resonator,
  projection: ReviewedCombatProjection,
): Resonator {
  if (projection.name !== resonator.name) {
    throw new Error(
      `Reviewed GameDatabase projection identity mismatch: expected ${resonator.name}, received ${projection.name}.`,
    );
  }

  const generatedByActionId = new Map<string, ReviewedMappedAction>(
    projection.mappedActions.map((entry) => [entry.actionId, entry]),
  );

  const actions = resonator.combat?.actions.map((action) => {
    if (!action.multipliers.length) return action;
    const generated = generatedByActionId.get(action.id);
    if (!generated) {
      throw new Error(
        `${resonator.name} action ${action.id} is missing from reviewed GameDatabase projection ${projection.sourceItemId}.`,
      );
    }
    return {
      ...action,
      multipliersByTalentLevel: generated.multipliersByTalentLevel,
    } satisfies CombatAction;
  });

  if (!resonator.combat || !actions) return resonator;

  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      level10Only: false,
      actions,
      unknowns: resonator.combat.unknowns.filter(
        (unknown) => unknown !== "Talent levels 2-9.",
      ),
    },
  };
}
