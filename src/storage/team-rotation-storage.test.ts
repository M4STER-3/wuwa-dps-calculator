import { describe, expect, it } from "vitest";

import type { TeamRotationDraft } from "@/domain/team-rotation-builder";
import { sanitizeTeamRotationDraft } from "./team-rotation-storage";

function draft(overrides: Partial<TeamRotationDraft> = {}): TeamRotationDraft {
  return {
    version: 1,
    selectedBuildIds: ["old-a", "old-b", "old-c"],
    actorIds: ["actor-a", "actor-b", "actor-c"],
    startingActorId: "actor-a",
    steps: [{ kind: "action", actorId: "actor-a", actionId: "legacy-action" }],
    initialResourcesByActorId: {
      "actor-a": { meter: 1 },
      "actor-b": { meter: 2 },
      "actor-c": { meter: 3 },
    },
    ...overrides,
  };
}

describe("Team rotation storage", () => {
  it("removes a fully stale 3/3 draft so current Character Box builds can be selected", () => {
    const result = sanitizeTeamRotationDraft(draft(), ["fresh-build"]);

    expect(result.selectedBuildIds).toEqual([]);
    expect(result.actorIds).toEqual([]);
    expect(result.startingActorId).toBe("");
    expect(result.steps).toEqual([]);
    expect(result.initialResourcesByActorId).toEqual({});
  });

  it("preserves valid selections, realigns the starter, and clears stale manual steps", () => {
    const result = sanitizeTeamRotationDraft(
      draft({
        selectedBuildIds: ["old-a", "keep", "old-c"],
        actorIds: ["actor-a", "actor-keep", "actor-c"],
      }),
      ["keep", "fresh-build"],
    );

    expect(result.selectedBuildIds).toEqual(["keep"]);
    expect(result.actorIds).toEqual(["actor-keep"]);
    expect(result.startingActorId).toBe("actor-keep");
    expect(result.steps).toEqual([]);
    expect(result.initialResourcesByActorId).toEqual({});
  });

  it("keeps an unchanged valid draft intact", () => {
    const input = draft({
      selectedBuildIds: ["keep-a", "keep-b"],
      actorIds: ["actor-a", "actor-b"],
      startingActorId: "actor-b",
      initialResourcesByActorId: {
        "actor-a": { meter: 1 },
        "actor-b": { meter: 2 },
        orphan: { meter: 9 },
      },
    });
    const result = sanitizeTeamRotationDraft(input, ["keep-a", "keep-b"]);

    expect(result.selectedBuildIds).toEqual(["keep-a", "keep-b"]);
    expect(result.actorIds).toEqual(["actor-a", "actor-b"]);
    expect(result.startingActorId).toBe("actor-b");
    expect(result.steps).toEqual(input.steps);
    expect(result.initialResourcesByActorId).toEqual({
      "actor-a": { meter: 1 },
      "actor-b": { meter: 2 },
    });
  });

  it("deduplicates malformed persisted selections before enforcing the three-build cap", () => {
    const result = sanitizeTeamRotationDraft(
      draft({
        selectedBuildIds: ["a", "a", "b", "c", "d"],
        actorIds: ["actor-a", "duplicate-a", "actor-b", "actor-c", "actor-d"],
      }),
      ["a", "b", "c", "d"],
    );

    expect(result.selectedBuildIds).toEqual(["a", "b", "c"]);
    expect(result.actorIds).toEqual(["actor-a", "actor-b", "actor-c"]);
    expect(result.steps).toEqual([]);
  });
});
