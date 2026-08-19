import type { CombatResource, Resonator, Sequence } from "@/domain/models";

type ResourceCapOverride = {
  resonatorId: string;
  resourceId: string;
  capBySequence: Readonly<Partial<Record<Sequence, number>>>;
};

const preciseResourceCapOverrides: readonly ResourceCapOverride[] = [
  {
    resonatorId: "denia",
    resourceId: "dark-core",
    capBySequence: { 3: 5 },
  },
];

function applyResourceOverride(
  resonatorId: string,
  resource: CombatResource,
): CombatResource {
  const override = preciseResourceCapOverrides.find(
    (entry) => entry.resonatorId === resonatorId && entry.resourceId === resource.id,
  );
  if (!override) return resource;
  return {
    ...resource,
    capBySequence: override.capBySequence,
    notes: [
      ...resource.notes,
      "Sequence-dependent cap is data-owned and resolved fail-closed by the universal rotation runner.",
    ],
  };
}

export function applyPreciseResourceMechanics(resonator: Resonator): Resonator {
  if (!resonator.combat) return resonator;
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      resources: resonator.combat.resources.map((resource) =>
        applyResourceOverride(resonator.id, resource),
      ),
    },
  };
}
