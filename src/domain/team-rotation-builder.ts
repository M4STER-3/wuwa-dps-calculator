import type {
  CombatAction,
  MainEcho,
  Resonator,
  Sonata,
  UserBuild,
  Weapon,
} from "./models";
import type { TeamActorInput, TeamRotationStep } from "./team-engine";
import { selectPersonalRotationScenario } from "./personal-rotation-selection";
import { resolvePersonalSonataLoadout } from "./personal-sonata-loadout";
import { resolveActionTalentLevel } from "./talent-engine";

export const TEAM_ROTATION_STORAGE_VERSION = 1;
export const SEQUENTIAL_TEAM_POLICY = "no-quickswap" as const;

export interface TeamRotationDraft {
  version: 1;
  selectedBuildIds: readonly string[];
  actorIds: readonly string[];
  startingActorId: string;
  steps: readonly TeamRotationStep[];
  initialResourcesByActorId?: Readonly<
    Record<string, Readonly<Record<string, number>>>
  >;
}

export interface RotationActionOption {
  id: string;
  name: string;
  timing: "verified" | "missing";
  talentStatus: "exact" | "missing-exact-talent-data";
}

/**
 * A local block deliberately cannot contain a switch. The only switches in a
 * sequential Team cycle are the boundaries inserted by
 * `buildSequentialTeamCycle`, which makes the current no-quickswap policy
 * structural rather than a UI convention.
 */
export type SequentialTeamLocalStep =
  | {
      kind: "action";
      actionId: string;
      targetId?: string;
      durationOverrideSeconds?: number;
      repeat?: number;
    }
  | { kind: "wait"; seconds: number };

export interface SequentialTeamActorRotation {
  actorId: string;
  steps: readonly SequentialTeamLocalStep[];
}

export interface SequentialTeamCycleBuild {
  policy: typeof SEQUENTIAL_TEAM_POLICY;
  startingActorId?: string;
  actorOrder: readonly string[];
  steps: readonly TeamRotationStep[];
  diagnostics: readonly string[];
}

export function actorIdForBuild(buildId: string): string {
  return `team-build-${buildId}`;
}

export function deriveRotationActionOptions(
  resonator: Resonator,
  build: UserBuild,
): readonly RotationActionOption[] {
  return (resonator.combat?.actions ?? [])
    .filter((action) => action.talent !== "introSkill")
    .map((action) => {
      const level = build.skillLevels[
        action.talent as keyof UserBuild["skillLevels"]
      ];
      return {
        id: action.id,
        name: action.name,
        timing: action.castDurationSeconds.value === null ? "missing" : "verified",
        talentStatus:
          resolveActionTalentLevel(action, level).status === "supported"
            ? "exact"
            : "missing-exact-talent-data",
      };
    });
}

/**
 * Compile one full on-field block per selected slot:
 * P1 rotation -> P2 rotation -> P3 rotation -> back to P1.
 *
 * Actor ids, not resonator ids or slot-specific character branches, own the
 * ordering. Reordering the input rotations is therefore sufficient to support
 * the same character build in any Team position.
 */
export function buildSequentialTeamCycle(
  rotations: readonly SequentialTeamActorRotation[],
  options: { closeCycle?: boolean } = {},
): SequentialTeamCycleBuild {
  const diagnostics: string[] = [];
  const actorOrder = rotations.map((rotation) => rotation.actorId);
  const startingActorId = actorOrder[0];
  const closeCycle = options.closeCycle ?? true;

  if (rotations.length < 1 || rotations.length > 3) {
    diagnostics.push(`invalid-team-size:${rotations.length}`);
  }

  const seen = new Set<string>();
  for (const rotation of rotations) {
    if (!rotation.actorId) diagnostics.push("missing-actor-id");
    if (seen.has(rotation.actorId)) {
      diagnostics.push(`duplicate-actor-id:${rotation.actorId}`);
    }
    seen.add(rotation.actorId);
    if (!rotation.steps.length) {
      diagnostics.push(`empty-rotation:${rotation.actorId}`);
    }

    for (const step of rotation.steps) {
      if (step.kind === "wait") {
        if (!Number.isFinite(step.seconds) || step.seconds < 0) {
          diagnostics.push(`invalid-wait:${rotation.actorId}`);
        }
        continue;
      }
      if (!step.actionId) diagnostics.push(`missing-action-id:${rotation.actorId}`);
      if (
        step.durationOverrideSeconds !== undefined &&
        (!Number.isFinite(step.durationOverrideSeconds) ||
          step.durationOverrideSeconds < 0)
      ) {
        diagnostics.push(`invalid-action-duration:${rotation.actorId}:${step.actionId}`);
      }
      if (
        step.repeat !== undefined &&
        (!Number.isInteger(step.repeat) || step.repeat < 1 || step.repeat > 30)
      ) {
        diagnostics.push(`invalid-repeat:${rotation.actorId}:${step.actionId}`);
      }
    }
  }

  if (diagnostics.length) {
    return {
      policy: SEQUENTIAL_TEAM_POLICY,
      startingActorId,
      actorOrder,
      steps: [],
      diagnostics,
    };
  }

  const steps: TeamRotationStep[] = [];
  for (const [rotationIndex, rotation] of rotations.entries()) {
    for (const step of rotation.steps) {
      if (step.kind === "wait") {
        steps.push({ kind: "wait", seconds: step.seconds });
        continue;
      }
      const repeat = step.repeat ?? 1;
      for (let count = 0; count < repeat; count += 1) {
        steps.push({
          kind: "action",
          actorId: rotation.actorId,
          actionId: step.actionId,
          ...(step.targetId ? { targetId: step.targetId } : {}),
          ...(step.durationOverrideSeconds !== undefined
            ? { durationOverrideSeconds: step.durationOverrideSeconds }
            : {}),
        });
      }
    }

    const nextActorId =
      rotationIndex < rotations.length - 1
        ? rotations[rotationIndex + 1]?.actorId
        : closeCycle && rotations.length > 1
          ? startingActorId
          : undefined;
    if (nextActorId) steps.push({ kind: "switch", toActorId: nextActorId });
  }

  return {
    policy: SEQUENTIAL_TEAM_POLICY,
    startingActorId,
    actorOrder,
    steps,
    diagnostics,
  };
}

export function walkRotationActiveActors(
  startingActorId: string,
  steps: readonly TeamRotationStep[],
): readonly string[] {
  let active = startingActorId;
  return steps.map((step) => {
    const expected = active;
    if (step.kind === "switch") active = step.toActorId;
    return expected;
  });
}

function personalScenarioRuntimeActions(
  baseActions: readonly CombatAction[],
  extraActions: readonly CombatAction[],
  assumeLegacyRequirementsSatisfied: boolean,
): readonly CombatAction[] {
  if (!assumeLegacyRequirementsSatisfied) return extraActions;
  return [...baseActions, ...extraActions].map((action) => ({
    ...action,
    requiredForm: undefined,
    requiredState: undefined,
    costs: undefined,
    gains: undefined,
  }));
}

export function buildTeamActorInputs(
  builds: readonly UserBuild[],
  catalog: {
    resonators: readonly Resonator[];
    weapons: readonly Weapon[];
    sonatas: readonly Sonata[];
    mainEchoes: readonly MainEcho[];
  },
  initialResourcesByActorId: Readonly<
    Record<string, Readonly<Record<string, number>>>
  > = {},
  actorIdsByBuildId: Readonly<Record<string, string>> = {},
  resonanceModesByBuildId: Readonly<Record<string, string>> = {},
): { actors: TeamActorInput[]; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const actors: TeamActorInput[] = [];

  for (const build of builds) {
    const resonator = catalog.resonators.find(
      (item) => item.id === build.resonatorId,
    );
    if (!resonator) {
      diagnostics.push(`stale-resonator:${build.resonatorId}`);
      continue;
    }

    const weapon = catalog.weapons.find(
      (item) => item.id === build.weapon.weaponId,
    );
    const hasEchoDerivedSonatas = Boolean(build.echoLoadout?.echoes.length);
    const sonata =
      !hasEchoDerivedSonatas && build.sonataId
        ? catalog.sonatas.find((item) => item.id === build.sonataId)
        : undefined;
    const mainEcho = catalog.mainEchoes.find(
      (item) => item.id === build.mainEchoId,
    );
    const modes = resonator.combat?.modes ?? [];
    const requestedMode = resonanceModesByBuildId[build.id];
    const explicitMode =
      requestedMode && modes.includes(requestedMode) ? requestedMode : undefined;
    const scenario = selectPersonalRotationScenario(resonator.id, explicitMode);
    const resonanceMode = scenario?.resonanceMode ?? explicitMode ?? modes[0];

    if (!weapon) diagnostics.push(`stale-weapon:${build.weapon.weaponId}`);
    if (!hasEchoDerivedSonatas && build.sonataId && !sonata) {
      diagnostics.push(`stale-sonata:${build.sonataId}`);
    }
    if (build.mainEchoId && !mainEcho) {
      diagnostics.push(`stale-echo:${build.mainEchoId}`);
    }

    const resolvedSonatas = hasEchoDerivedSonatas
      ? resolvePersonalSonataLoadout(build, catalog.sonatas)
      : undefined;
    for (const item of resolvedSonatas?.diagnostics ?? []) {
      diagnostics.push(`${item.code}:${item.message}`);
    }

    const actorId = actorIdsByBuildId[build.id] ?? actorIdForBuild(build.id);
    const explicitInitialResources = initialResourcesByActorId[actorId];
    const initialResources = Object.fromEntries(
      (resonator.combat?.resources ?? []).map((resource) => [
        resource.id,
        Math.min(
          resource.cap,
          Math.max(
            0,
            explicitInitialResources?.[resource.id] ??
              scenario?.initialResources?.[resource.id] ??
              0,
          ),
        ),
      ]),
    );

    const characterBase = resonator.baseStats?.find(
      (entry) => entry.level === build.characterLevel,
    );
    const exactWeapon =
      build.weapon.level === 90 ? weapon?.level90Stats : undefined;
    const baseStatBasis =
      characterBase && exactWeapon
        ? {
            attack: characterBase.attack + exactWeapon.baseAttack,
            hp: characterBase.hp,
            defense: characterBase.defense,
            provenance: `${resonator.id}@${build.characterLevel}+${weapon?.id ?? "missing-weapon"}@${build.weapon.level}`,
          }
        : undefined;

    const scenarioBaseActions = [
      ...(resonator.combat?.actions ?? []),
      ...(mainEcho?.action ? [mainEcho.action] : []),
    ];
    const scenarioActions = personalScenarioRuntimeActions(
      scenarioBaseActions,
      scenario?.extraActions ?? [],
      scenario?.assumeLegacyRequirementsSatisfied ?? false,
    );
    const scenarioEffects = [
      ...(resolvedSonatas?.effects ?? []),
      ...(scenario?.extraEffects ?? []),
    ];
    const uniqueEffects = [
      ...new Map(scenarioEffects.map((effect) => [effect.id, effect])).values(),
    ];

    actors.push({
      actorId,
      resonator,
      build,
      weapon,
      sonata,
      mainEcho,
      initialResources,
      ...(resonanceMode ? { resonanceMode } : {}),
      ...(scenarioActions.length ? { actions: scenarioActions } : {}),
      ...(uniqueEffects.length ? { effects: uniqueEffects } : {}),
      ...(baseStatBasis ? { baseStatBasis } : {}),
    });
  }

  return { actors, diagnostics };
}

export function parseTeamRotationDraft(
  value: string | null,
): TeamRotationDraft | undefined {
  if (!value) return;
  try {
    const parsed = JSON.parse(value) as Partial<TeamRotationDraft>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.selectedBuildIds) ||
      !Array.isArray(parsed.actorIds) ||
      typeof parsed.startingActorId !== "string" ||
      !Array.isArray(parsed.steps)
    ) {
      return;
    }
    return parsed as TeamRotationDraft;
  } catch {
    return;
  }
}
