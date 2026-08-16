import { describe, expect, it } from "vitest";
import { resolveActionResourceTransaction, type ActionResourceOperation } from "./action-resource-transactions";

describe("action resource transactions", () => {
  const resources = {
    ring: { current: 80, max: 100 },
    thread: { current: 10, max: 20 },
  };

  it("consumes a complete stage atomically and records an audit", () => {
    const operations: ActionResourceOperation[] = [
      { resourceId: "ring", operation: "consume", amount: 60, stage: "before-action" },
      { resourceId: "thread", operation: "consume", amount: 5, stage: "before-action" },
    ];
    const result = resolveActionResourceTransaction(resources, operations, "before-action");
    expect(result).toMatchObject({
      status: "applied",
      resources: { ring: { current: 20 }, thread: { current: 5 } },
      audit: [{ resourceId: "ring", before: 80, after: 20 }, { resourceId: "thread", before: 10, after: 5 }],
    });
    expect(resources.ring.current).toBe(80);
  });

  it("rejects the whole payment when any cost is unavailable", () => {
    const result = resolveActionResourceTransaction(resources, [
      { resourceId: "ring", operation: "consume", amount: 20, stage: "before-action" },
      { resourceId: "thread", operation: "consume", amount: 11, stage: "before-action" },
    ], "before-action");
    expect(result).toEqual({ status: "rejected", resources, audit: [], diagnostic: "insufficient-action-resource", resourceId: "thread" });
  });

  it("applies only the requested stage and caps gains", () => {
    const operations: ActionResourceOperation[] = [
      { resourceId: "ring", operation: "consume", amount: 10, stage: "before-action" },
      { resourceId: "thread", operation: "gain", amount: 50, stage: "after-action" },
    ];
    const result = resolveActionResourceTransaction(resources, operations, "after-action");
    expect(result).toMatchObject({ status: "applied", resources: { ring: { current: 80 }, thread: { current: 20 } } });
  });

  it("rejects missing resources and invalid amounts without mutation", () => {
    expect(resolveActionResourceTransaction(resources, [{ resourceId: "unknown", operation: "consume", amount: 1, stage: "before-action" }], "before-action")).toMatchObject({ status: "rejected", diagnostic: "missing-action-resource" });
    expect(resolveActionResourceTransaction(resources, [{ resourceId: "ring", operation: "gain", amount: Number.NaN, stage: "after-action" }], "after-action")).toMatchObject({ status: "rejected", diagnostic: "invalid-action-resource-change" });
  });

  it("never lets a same-stage gain finance a cost", () => {
    const result = resolveActionResourceTransaction({ ring: { current: 0, max: 100 } }, [
      { resourceId: "ring", operation: "gain", amount: 100, stage: "before-action" },
      { resourceId: "ring", operation: "consume", amount: 100, stage: "before-action" },
    ], "before-action");
    expect(result).toMatchObject({ status: "rejected", diagnostic: "mixed-action-resource-stage", resources: { ring: { current: 0 } } });
  });

  it("defines empty stages as successful no-ops and audits zero operations", () => {
    expect(resolveActionResourceTransaction(resources, [], "before-action")).toEqual({ status: "applied", resources: { ...resources }, audit: [] });
    const zero = resolveActionResourceTransaction(resources, [{ resourceId: "ring", operation: "consume", amount: 0, stage: "before-action" }], "before-action");
    expect(zero).toMatchObject({ status: "applied", resources: { ring: { current: 80 } }, audit: [{ before: 80, after: 80 }] });
  });
});
