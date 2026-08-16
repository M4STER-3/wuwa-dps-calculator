import type { CombatAction } from "./models";

/** Actor identities are deliberately independent: a future TeamState supplies them. */
export interface CombatOwnership {
  triggeringActorId: string;
  activeActorId: string;
  sourceEntityId: string;
  damageOwnerId: string;
  scalingOwnerId: string;
}

export interface CoordinatedResponseDefinition {
  id: string;
  targetStatusId: string;
  ownerId: string;
  internalCooldownSeconds: number;
  action: CombatAction;
}

export interface TargetLocalTriggerState {
  statusesByTarget: Readonly<Record<string, Readonly<Record<string, number>>> >;
  lastTriggerByDefinitionAndTarget: Readonly<Record<string, number>>;
}

export interface CoordinatedResponseEvent {
  definitionId: string;
  targetId: string;
  timestamp: number;
  action: CombatAction;
  ownership: CombatOwnership;
  attribution: "coordinated";
}

export function applyTargetStatus(state: TargetLocalTriggerState, targetId: string, statusId: string, expiresAt: number): TargetLocalTriggerState {
  return { ...state, statusesByTarget: { ...state.statusesByTarget, [targetId]: { ...state.statusesByTarget[targetId], [statusId]: expiresAt } } };
}

export function triggerCoordinatedResponse(input: {
  definition: CoordinatedResponseDefinition; state: TargetLocalTriggerState; targetId: string;
  timestamp: number; triggeringActorId: string; activeActorId: string;
}): { state: TargetLocalTriggerState; event?: CoordinatedResponseEvent; reason?: "target-status-inactive" | "internal-cooldown" } {
  const { definition, state, targetId, timestamp } = input;
  if ((state.statusesByTarget[targetId]?.[definition.targetStatusId] ?? -Infinity) < timestamp) return { state, reason: "target-status-inactive" };
  const key = `${definition.id}:${targetId}`;
  const last = state.lastTriggerByDefinitionAndTarget[key];
  if (last !== undefined && timestamp - last < definition.internalCooldownSeconds) return { state, reason: "internal-cooldown" };
  const next = { ...state, lastTriggerByDefinitionAndTarget: { ...state.lastTriggerByDefinitionAndTarget, [key]: timestamp } };
  return { state: next, event: { definitionId: definition.id, targetId, timestamp, action: definition.action, attribution: "coordinated", ownership: {
    triggeringActorId: input.triggeringActorId, activeActorId: input.activeActorId, sourceEntityId: definition.ownerId,
    damageOwnerId: definition.ownerId, scalingOwnerId: definition.ownerId,
  } } };
}
