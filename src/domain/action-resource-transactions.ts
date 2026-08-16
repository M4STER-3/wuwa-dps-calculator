import type { ResourceView } from "./combat-context";

export type ActionResourceStage = "before-action" | "after-action";

export interface ActionResourceOperation {
  resourceId: string;
  operation: "consume" | "gain";
  amount: number;
  stage: ActionResourceStage;
}

export interface ActionResourceAuditEntry extends ActionResourceOperation {
  before: number;
  after: number;
}

export type ActionResourceTransactionResult =
  | {
      status: "applied";
      resources: Readonly<Record<string, ResourceView>>;
      audit: readonly ActionResourceAuditEntry[];
    }
  | {
      status: "rejected";
      resources: Readonly<Record<string, ResourceView>>;
      audit: readonly [];
      diagnostic: "invalid-action-resource-change" | "missing-action-resource" | "insufficient-action-resource";
      resourceId: string;
    };

/**
 * Resolves one declared action stage atomically. Validation is performed against
 * a private working copy and a rejection always returns the original state.
 */
export function resolveActionResourceTransaction(
  resources: Readonly<Record<string, ResourceView>>,
  operations: readonly ActionResourceOperation[],
  stage: ActionResourceStage,
): ActionResourceTransactionResult {
  const working: Record<string, ResourceView> = { ...resources };
  const audit: ActionResourceAuditEntry[] = [];

  for (const operation of operations) {
    if (operation.stage !== stage) continue;
    const view = working[operation.resourceId];
    if (!view) return rejected(resources, "missing-action-resource", operation.resourceId);
    if (!Number.isFinite(operation.amount) || operation.amount < 0 || !Number.isFinite(view.current) || !Number.isFinite(view.max) || view.max <= 0 || view.current < 0 || view.current > view.max) {
      return rejected(resources, "invalid-action-resource-change", operation.resourceId);
    }
    if (operation.operation === "consume" && view.current < operation.amount) {
      return rejected(resources, "insufficient-action-resource", operation.resourceId);
    }
    const after = operation.operation === "consume"
      ? view.current - operation.amount
      : Math.min(view.max, view.current + operation.amount);
    working[operation.resourceId] = { ...view, current: after };
    audit.push({ ...operation, before: view.current, after });
  }

  return { status: "applied", resources: working, audit };
}

function rejected(
  resources: Readonly<Record<string, ResourceView>>,
  diagnostic: Extract<ActionResourceTransactionResult, { status: "rejected" }>['diagnostic'],
  resourceId: string,
): ActionResourceTransactionResult {
  return { status: "rejected", resources, audit: [], diagnostic, resourceId };
}
