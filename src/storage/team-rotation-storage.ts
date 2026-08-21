import { parseCharacterBox } from "@/domain/character-box";
import {
  actorIdForBuild,
  parseTeamRotationDraft,
  type TeamRotationDraft,
} from "@/domain/team-rotation-builder";
import { CHARACTER_BOX_STORAGE_KEY } from "./character-box-storage";

export const TEAM_ROTATION_STORAGE_KEY = "wuwa-team-rotation:v1";

export function sanitizeTeamRotationDraft(
  draft: TeamRotationDraft,
  availableBuildIds: readonly string[],
): TeamRotationDraft {
  const available = new Set(availableBuildIds);
  const seen = new Set<string>();
  const selectedBuildIds: string[] = [];
  const actorIds: string[] = [];

  draft.selectedBuildIds.forEach((buildId, index) => {
    if (
      selectedBuildIds.length >= 3 ||
      seen.has(buildId) ||
      !available.has(buildId)
    ) {
      return;
    }
    seen.add(buildId);
    selectedBuildIds.push(buildId);
    actorIds.push(draft.actorIds[index] ?? actorIdForBuild(buildId));
  });

  const validActorIds = new Set(actorIds);
  const changed =
    selectedBuildIds.length !== draft.selectedBuildIds.length ||
    selectedBuildIds.some((buildId, index) => buildId !== draft.selectedBuildIds[index]) ||
    actorIds.some((actorId, index) => actorId !== draft.actorIds[index]);
  const startingActorId = validActorIds.has(draft.startingActorId)
    ? draft.startingActorId
    : actorIds[0] ?? "";
  const initialResourcesByActorId = Object.fromEntries(
    Object.entries(draft.initialResourcesByActorId ?? {}).filter(([actorId]) =>
      validActorIds.has(actorId),
    ),
  );

  return {
    ...draft,
    selectedBuildIds,
    actorIds,
    startingActorId,
    steps: changed ? [] : draft.steps,
    initialResourcesByActorId,
  };
}

export function loadTeamRotationDraft(): TeamRotationDraft | undefined {
  if (typeof window === "undefined") return;
  const draft = parseTeamRotationDraft(
    window.localStorage.getItem(TEAM_ROTATION_STORAGE_KEY),
  );
  if (!draft) return;
  const box = parseCharacterBox(
    window.localStorage.getItem(CHARACTER_BOX_STORAGE_KEY),
  );
  return sanitizeTeamRotationDraft(
    draft,
    box.builds.map((build) => build.id),
  );
}

export function saveTeamRotationDraft(draft: TeamRotationDraft): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TEAM_ROTATION_STORAGE_KEY, JSON.stringify(draft));
  }
}
