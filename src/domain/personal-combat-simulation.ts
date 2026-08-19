import {
  buildEffectiveCombatStats,
  evaluatePredicate,
  evaluateValueExpression,
  type CombatContext,
  type RuntimeBaseStatBasis,
} from "./combat-context";
import {
  calculateActionDamage,
  calculateTuneBreakDamage,
  calculateTuneRuptureDamage,
  type DamageAmounts,
  type DamageTarget,
  type DamageType,
  type PersonalDamageResult,
  type ScalingAttribute,
} from "./damage-engine";
import {
  calculateNegativeStatusDamage,
  type NegativeStatusDamageResult,
} from "./negative-status-damage";
import {
  resolveActiveEffects,
  type EffectAuditEntry,
} from "./effect-engine";
import type {
  ActionDefinitionV02,
  EffectDefinition,
  EffectModifier,
  EffectRuleDefinition,
  EffectSelector,
  FixedCritOverrideModifier,
  RuntimeStatModifier,
} from "./effect-models";
import { resolveActionTalentLevel } from "./talent-engine";
import { applyMotionValueModifiers } from "./motion-value-engine";
import { resolveActionResourceTransaction } from "./action-resource-transactions";
import { CombatEventQueue } from "./event-engine";
import type {
  CombatAction,
  FinalStats,
  MainEcho,
  Resonator,
  Sonata,
  UserBuild,
  Weapon,
} from "./models";
import {
  emptyCombatState,
  processEvent,
  timelineEvents,
  type ActiveRuntimeEffect,
  type CombatEvent,
  type CombatState,
  type StateDiagnostic,
  type StateTransition,
} from "./state-engine";
import type { TemporalTimeline } from "./temporal-engine";

export type DamageAttribution =
  | "direct"
  | "echo"
  | "follow-up"
  | "coordinated"
  | "summon"
  | "status"
  | "tune";

export type PersonalComputedDamage =
  | PersonalDamageResult
  | NegativeStatusDamageResult;

export interface PersonalDiagnostic {
  code: string;
  message: string;
  eventId?: string;
  actionId?: string;
  relevance?:
    | "relevant-unsupported"
    | "modeled-unused"
    | "not-emitted-due-to-missing-context";
}

export interface PersonalDamageAudit {
  timestamp: number;
  eventId: string;
  baseActionId: string;
  actionId: string;
  baseDamageType?: string;
  effectiveDamageType?: string;
  damageOwnerId: string;
  scalingOwnerId: string;
  actorId: string;
  triggeringActorId?: string;
  sourceEntityId?: string;
  targetId: string;
  attribution: DamageAttribution;
  panelStats: FinalStats;
  baseStatBasis: RuntimeBaseStatBasis;
  effectiveStats: FinalStats;
  runtimeStatAudit: ReturnType<typeof buildEffectiveCombatStats>["audit"];
  originalMotionValue: number;
  motionValueContributions: readonly {
    mode: string;
    value: number;
    effectId: string;
  }[];
  effectiveMotionValue: number;
  activeEffectIds: readonly string[];
  effectAudit: readonly EffectAuditEntry[];
  damage: PersonalComputedDamage;
  sourceEffectId?: string;
}

export interface Coverage {
  timelineSteps: number;
  relevantSupported: number;
  relevantUnsupported: number;
  modeledUnused: number;
  notEmittedDueToMissingContext: number;
  directDamageActions: number;
  derivedActions: number;
  activeEffects: number;
  triggeredEffects: number;
}

export interface PersonalCombatResult {
  rotationDurationSeconds: number;
  personalDamage: DamageAmounts;
  personalDps: DamageAmounts;
  breakdown: Readonly<Record<DamageAttribution, DamageAmounts>>;
  perAction: Readonly<Record<string, DamageAmounts>>;
  perSource: Readonly<Record<string, DamageAmounts>>;
  audits: readonly PersonalDamageAudit[];
  eventLog: readonly CombatEvent[];
  stateTransitions: readonly StateTransition[];
  stateDiagnostics: readonly StateDiagnostic[];
  diagnostics: readonly PersonalDiagnostic[];
  unsupportedMechanics: readonly PersonalDiagnostic[];
  coverage: Coverage;
  partial: boolean;
  finalState: CombatState;
}

export interface PersonalEffectLoadout {
  resonatorEffects?: readonly EffectDefinition[];
  sequenceEffects?: readonly EffectDefinition[];
  weapon?: Weapon;
  sonata?: Sonata;
  mainEcho?: MainEcho;
  extraEffects?: readonly EffectDefinition[];
  ownedEntityIds?: readonly string[];
}

export interface PersonalCombatRequest {
  resonator: Resonator;
  build: UserBuild;
  timeline: TemporalTimeline;
  target: DamageTarget & {
    id?: string;
    tuneEnemyClass?: "1C" | "3C" | "4C";
  };
  resonanceMode?: string;
  scalingAttribute?: ScalingAttribute;
  baseStatBasis?: RuntimeBaseStatBasis;
  actions?: readonly (ActionDefinitionV02 | CombatAction)[];
  loadout?: PersonalEffectLoadout;
  initialState?: CombatState;
  externalEvents?: readonly CombatEvent[];
}

export function loadPersonalEffects(
  resonator: Resonator,
  sequence: number,
  loadout: PersonalEffectLoadout = {},
): {
  definitions: EffectDefinition[];
  audit: { effectId: string; source: string; accounting: string }[];
  diagnostics: PersonalDiagnostic[];
} {
  const automatic = (resonator.combat?.effects ?? []).flatMap((effect) =>
    effect.structuredEffect ? [effect.structuredEffect] : [],
  );
  const equipment = [
    ...(loadout.weapon?.effects ?? []),
    ...(loadout.sonata?.effects ?? []),
    ...(loadout.mainEcho?.effects ?? []),
  ];
  const candidates = [
    ...automatic,
    ...(loadout.resonatorEffects ?? []),
    ...(loadout.sequenceEffects ?? []),
    ...equipment.flatMap((effect) =>
      effect.structuredEffect ? [effect.structuredEffect] : [],
    ),
    ...(loadout.extraEffects ?? []),
  ];
  const definitions: EffectDefinition[] = [];
  const audit: { effectId: string; source: string; accounting: string }[] = [];
  const diagnostics: PersonalDiagnostic[] = [];
  const seen = new Set<string>();

  for (const definition of candidates) {
    if (seen.has(definition.id)) continue;
    seen.add(definition.id);
    const rules = definition.rules.filter(
      (rule) => (rule.requiredSequence ?? 0) <= sequence,
    );
    if (!rules.length && !definition.triggers?.length && !definition.statuses?.length) {
      continue;
    }
    if (definition.teamContextRequired) {
      diagnostics.push({
        code: "team-context-required",
        message: `${definition.id} is stored but not executed by Personal Combat.`,
        relevance: "modeled-unused",
      });
    }
    const triggers = definition.triggers?.map((trigger) => {
      const exact = trigger.cooldownSecondsBySequence?.[sequence];
      return exact === undefined
        ? trigger
        : {
            ...trigger,
            cooldown: trigger.cooldown
              ? { ...trigger.cooldown, seconds: exact }
              : { seconds: exact, scope: "target" as const },
          };
    });
    const legacyInitiallyActive =
      !definition.activationPolicy &&
      !definition.triggers?.length &&
      rules.some((rule) => rule.accounting === "runtime");
    const materialized: EffectDefinition = {
      ...definition,
      rules,
      triggers,
      activationPolicy:
        definition.activationPolicy ??
        (legacyInitiallyActive
          ? "initially-active"
          : definition.triggers?.length
            ? "triggered"
            : undefined),
    };
    if (legacyInitiallyActive) {
      diagnostics.push({
        code: "legacy-implicit-activation",
        message: `${definition.id} uses the deprecated implicit activation convention; declare activationPolicy.`,
        relevance: "modeled-unused",
      });
    }
    definitions.push(materialized);
    for (const rule of rules) {
      audit.push({
        effectId: materialized.id,
        source: materialized.source.type,
        accounting: rule.accounting,
      });
    }
  }
  return { definitions, audit, diagnostics };
}

const zero = (): DamageAmounts => ({ nonCrit: 0, crit: 0, expected: 0 });
const add = (a: DamageAmounts, b: DamageAmounts): DamageAmounts => ({
  nonCrit: a.nonCrit + b.nonCrit,
  crit: a.crit + b.crit,
  expected: a.expected + b.expected,
});

type RuleMatch = "matched" | "ignored" | "unsupported";

function matchSelector(
  selector: EffectSelector,
  instance: ActiveRuntimeEffect,
  context: CombatContext,
): RuleMatch {
  let actual: string | readonly string[] | undefined;
  switch (selector.kind) {
    case "element":
      actual = context.element;
      break;
    case "damage-type":
      actual = context.damageType;
      break;
    case "resonance-mode":
      actual = context.resonanceMode;
      break;
    case "action-id":
      actual = context.actionId;
      break;
    case "action-category":
      actual = context.actionCategories;
      break;
    case "owner-id":
      actual = instance.ownerId;
      break;
    case "source-id":
      actual = instance.sourceId ?? instance.definition.source.id;
      break;
    case "target-id":
      actual = context.targetId;
      break;
  }
  if (actual === undefined) return "unsupported";
  const values = selector.anyOf as readonly string[];
  const matched = Array.isArray(actual)
    ? actual.some((value) => values.includes(value))
    : values.includes(actual as string);
  return matched ? "matched" : "ignored";
}

function matchRuntimeRule(
  rule: EffectRuleDefinition,
  instance: ActiveRuntimeEffect,
  context: CombatContext,
): RuleMatch {
  if (rule.accounting !== "runtime") return "ignored";
  for (const selector of rule.selectors ?? []) {
    const result = matchSelector(selector, instance, context);
    if (result !== "matched") return result;
  }
  for (const predicate of rule.predicates ?? []) {
    const result = evaluatePredicate(predicate, context);
    if (result.status !== "matched") return result.status;
  }
  return "matched";
}

export function simulatePersonalCombat(
  req: PersonalCombatRequest,
): PersonalCombatResult {
  const targetId = req.target.id ?? "target";
  const actions = new Map<string, ActionDefinitionV02>();
  for (const item of req.actions ?? req.resonator.combat?.actions ?? []) {
    const definition = "action" in item ? item : { action: item };
    actions.set(definition.action.id, definition);
  }
  if (req.loadout?.mainEcho?.action) {
    actions.set(req.loadout.mainEcho.action.id, {
      action: req.loadout.mainEcho.action,
    });
  }
  const loaded = loadPersonalEffects(
    req.resonator,
    req.build.sequence,
    req.loadout,
  );
  const initial =
    req.initialState ??
    emptyCombatState(
      {
        [req.resonator.id]: {
          hp: req.build.finalStats.hp,
          maxHp: req.build.finalStats.hp,
          onField: true,
          resources: Object.fromEntries(
            (req.resonator.combat?.resources ?? []).map((resource) => [
              resource.id,
              { current: 0, max: resource.cap },
            ]),
          ),
        },
      },
      [targetId],
    );
  let state: CombatState = {
    ...initial,
    activeEffects: [
      ...initial.activeEffects,
      ...loaded.definitions
        .filter(
          (definition) =>
            definition.activationPolicy === "initially-active" &&
            definition.rules.some((rule) => rule.accounting === "runtime"),
        )
        .map((definition) => ({
          id: `initial:${definition.id}:${req.resonator.id}`,
          definition,
          ownerId: req.resonator.id,
          activatedAt: 0,
          stacks: definition.lifecycle?.stacks?.initial ?? 0,
          expiresAt:
            definition.lifecycle?.duration.kind === "fixed"
              ? definition.lifecycle.duration.seconds
              : undefined,
        })),
    ],
  };

  const timeline = timelineEvents(
    req.timeline.entries,
    req.resonator.id,
    targetId,
  );
  const queue = new CombatEventQueue();
  const diagnostics: PersonalDiagnostic[] = [...loaded.diagnostics];
  for (const event of [...timeline.events, ...(req.externalEvents ?? [])]) {
    queue.enqueue(event);
  }
  const hitDependent = loaded.definitions.some((definition) =>
    (definition.triggers ?? []).some(
      (trigger) =>
        !trigger.externalContextRequired &&
        ["action-hit", "damage-dealt", "critical-hit"].includes(trigger.event),
    ),
  );
  if (hitDependent && timeline.missingHitTimings.length) {
    diagnostics.push({
      code: "hit-timing-required",
      message: `Real hit timings are required by active triggers for: ${timeline.missingHitTimings.join(", ")}.`,
      relevance: "relevant-unsupported",
    });
  }
  const criticalDependent = loaded.definitions.some((definition) =>
    (definition.triggers ?? []).some(
      (trigger) => trigger.event === "critical-hit",
    ),
  );
  if (
    criticalDependent &&
    !(req.externalEvents ?? []).some((event) => event.kind === "critical-hit")
  ) {
    diagnostics.push({
      code: "critical-hit-context-required",
      message: "Expected Crit does not generate probabilistic critical-hit events.",
      relevance: "not-emitted-due-to-missing-context",
    });
  }
  for (const definition of loaded.definitions) {
    for (const trigger of definition.triggers ?? []) {
      if (
        trigger.externalContextRequired &&
        !(req.externalEvents ?? []).some(
          (event) => event.kind === trigger.event && event.external,
        )
      ) {
        diagnostics.push({
          code: "external-trigger-context-required",
          message: `${trigger.id} has no external trigger event.`,
          relevance: "not-emitted-due-to-missing-context",
        });
      }
    }
  }

  const audits: PersonalDamageAudit[] = [];
  const transitions: StateTransition[] = [];
  const stateDiagnostics: StateDiagnostic[] = [];
  const breakdown = Object.fromEntries(
    (
      [
        "direct",
        "echo",
        "follow-up",
        "coordinated",
        "summon",
        "status",
        "tune",
      ] as const
    ).map((key) => [key, zero()]),
  ) as Record<DamageAttribution, DamageAmounts>;
  const perAction: Record<string, DamageAmounts> = {};
  const perSource: Record<string, DamageAmounts> = {};
  let triggered = 0;
  const failedOccurrences = new Set<string>();

  const queueResult = queue.drain((event) => {
    const derived: CombatEvent[] = [];
    const occurrence = (event.occurrence ?? event.id)
      .split(":")
      .slice(0, 2)
      .join(":");
    const transactionAction = event.actionId
      ? actions.get(event.actionId)?.action
      : undefined;
    if (failedOccurrences.has(occurrence)) return derived;

    if (
      transactionAction?.resourceOperations &&
      event.kind === "action-start" &&
      !event.originEventId
    ) {
      const actor = state.actors[event.ownerId];
      const result =
        actor &&
        resolveActionResourceTransaction(
          actor.resources,
          transactionAction.resourceOperations,
          "before-action",
          req.build.sequence,
        );
      if (!result || result.status === "rejected") {
        failedOccurrences.add(occurrence);
        diagnostics.push({
          code: result?.diagnostic ?? "missing-action-resource",
          message: `Action resource transaction rejected for ${transactionAction.id}${result?.resourceId ? `: ${result.resourceId}` : ""}.`,
          eventId: event.id,
          actionId: transactionAction.id,
          relevance: "relevant-unsupported",
        });
        return derived;
      }
      state = {
        ...state,
        actors: {
          ...state.actors,
          [event.ownerId]: { ...actor, resources: result.resources },
        },
      };
      for (const entry of result.audit) {
        transitions.push({
          timestamp: event.timestamp,
          kind: `action-resource-${entry.operation}`,
          detail: `${entry.resourceId}:${entry.before}->${entry.after}`,
          eventId: event.id,
          ownerId: event.ownerId,
        });
      }
    }

    const stateResult = processEvent(state, event, loaded.definitions, {
      panelStats: req.build.finalStats,
      resonanceMode: req.resonanceMode,
      element: req.resonator.element,
    });
    state = stateResult.state;

    if (
      transactionAction?.resourceOperations &&
      event.kind === "action-end" &&
      !event.originEventId
    ) {
      const actor = state.actors[event.ownerId];
      const result =
        actor &&
        resolveActionResourceTransaction(
          actor.resources,
          transactionAction.resourceOperations,
          "after-action",
          req.build.sequence,
        );
      if (result?.status === "applied") {
        state = {
          ...state,
          actors: {
            ...state.actors,
            [event.ownerId]: { ...actor, resources: result.resources },
          },
        };
        for (const entry of result.audit) {
          transitions.push({
            timestamp: event.timestamp,
            kind: `action-resource-${entry.operation}`,
            detail: `${entry.resourceId}:${entry.before}->${entry.after}`,
            eventId: event.id,
            ownerId: event.ownerId,
          });
        }
      } else if (result?.status === "rejected") {
        diagnostics.push({
          code: result.diagnostic,
          message: `After-action resource transaction rejected for ${transactionAction.id}.`,
          eventId: event.id,
          actionId: transactionAction.id,
          relevance: "relevant-unsupported",
        });
      }
    }

    for (const emitted of stateResult.emittedEvents) {
      const snapshot = emitted.payload?.snapshot as
        | { stats?: string; stacks?: string }
        | undefined;
      let payload: Record<string, unknown> = {
        ...emitted.payload,
        damageOwnerId:
          emitted.payload?.damageOwnerId ?? req.resonator.id,
        scalingOwnerId:
          emitted.payload?.scalingOwnerId ?? req.resonator.id,
      };
      if (snapshot?.stats === "trigger" || snapshot?.stacks === "trigger") {
        payload = {
          ...payload,
          snapshotEffects: state.activeEffects
            .filter((effect) => effect.ownerId === req.resonator.id)
            .map(cloneEffect),
        };
      }
      derived.push({ ...emitted, ownerId: req.resonator.id, payload });
    }
    transitions.push(...stateResult.transitions);
    stateDiagnostics.push(...stateResult.diagnostics);
    diagnostics.push(
      ...stateResult.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        eventId: diagnostic.eventId,
        relevance: "relevant-unsupported" as const,
      })),
    );
    triggered += stateResult.transitions.filter(
      (transition) => transition.kind === "effect-activated",
    ).length;

    const aggregate =
      event.kind === "action-start" &&
      !event.originEventId &&
      event.payload?.aggregateDamage === true;
    const realHit = event.kind === "action-hit" && !event.external;
    const special = ["tune-break", "tune-rupture", "fusion-burst"].includes(
      event.kind,
    );
    if (
      (!aggregate && !realHit && !special) ||
      !event.actionId ||
      event.external
    ) {
      return derived;
    }
    if (
      event.payload?.statusId &&
      !state.targets[event.targetId]?.statuses[event.payload.statusId as string]
    ) {
      return derived;
    }
    const baseDefinition = actions.get(event.actionId);
    if (!baseDefinition) {
      diagnostics.push({
        code: "action-not-found",
        message: `Action ${event.actionId} is not available.`,
        eventId: event.id,
        actionId: event.actionId,
        relevance: "relevant-unsupported",
      });
      return derived;
    }

    const live = state.activeEffects.filter(
      (effect) => effect.ownerId === req.resonator.id,
    );
    const snapshotEffects = event.payload?.snapshotEffects as
      | ActiveRuntimeEffect[]
      | undefined;
    const snapshot = event.payload?.snapshot as
      | { stats?: "trigger" | "hit"; stacks?: "trigger" | "tick" }
      | undefined;
    const statSource =
      snapshot?.stats === "trigger" ? snapshotEffects ?? live : live;
    const stackSource =
      snapshot?.stacks === "trigger" ? snapshotEffects ?? live : live;
    const active = statSource.map((effect) => {
      const stacks = stackSource.find(
        (candidate) => candidate.id === effect.id,
      );
      return stacks
        ? {
            ...effect,
            stacks: stacks.stacks,
            stackExpirations: stacks.stackExpirations,
          }
        : effect;
    });

    let definition = baseDefinition;
    let action = definition.action;
    const preContext = contextFor(
      event,
      req,
      state,
      targetId,
      req.build.finalStats,
    );

    for (const instance of active) {
      for (const rule of instance.definition.rules) {
        for (const modifier of rule.modifiers) {
          if (
            modifier.kind === "action-replacement" &&
            modifier.actionId === action.id &&
            evaluatePredicate(modifier.condition, preContext).status === "matched"
          ) {
            const replacement = actions.get(modifier.replacementActionId);
            if (replacement) {
              definition = replacement;
              action = replacement.action;
            } else {
              diagnostics.push({
                code: "replacement-action-not-found",
                message: modifier.replacementActionId,
                eventId: event.id,
                relevance: "relevant-unsupported",
              });
            }
          }
        }
      }
    }

    const structuredKinds = new Set(
      action.resourceOperations?.map((operation) => operation.operation),
    );
    if (
      (action.costs?.length && !structuredKinds.has("consume")) ||
      (action.gains?.length && !structuredKinds.has("gain"))
    ) {
      diagnostics.push({
        code: "unstructured-action-resource-change",
        message: `${action.id} has a verified resource quantity without an exact executable stage.`,
        eventId: event.id,
        actionId: action.id,
        relevance: "relevant-unsupported",
      });
    }

    const talentLevel =
      req.build.skillLevels[
        action.talent as keyof typeof req.build.skillLevels
      ];
    if (talentLevel !== undefined && talentLevel !== action.level) {
      const wrapped =
        definition.multipliersByTalentLevel?.[
          talentLevel as keyof typeof definition.multipliersByTalentLevel
        ];
      const resolution = wrapped
        ? {
            status: "supported" as const,
            action: {
              ...action,
              level: talentLevel as typeof action.level,
              multipliers: wrapped,
            },
          }
        : resolveActionTalentLevel(action, talentLevel);
      if (resolution.status === "unsupported") {
        diagnostics.push({
          code: "missing-exact-talent-multiplier",
          message: resolution.message,
          eventId: event.id,
          actionId: action.id,
          relevance: "relevant-unsupported",
        });
        return derived;
      }
      action = resolution.action;
    }

    if (definition.requirements) {
      const predicateResults = definition.requirements.map((predicate) =>
        evaluatePredicate(predicate, preContext),
      );
      if (predicateResults.some((result) => result.status === "unsupported")) {
        diagnostics.push({
          code: "unresolved-condition",
          message: `Requirement unresolved for ${action.id}.`,
          eventId: event.id,
          actionId: action.id,
          relevance: "relevant-unsupported",
        });
        return derived;
      }
      if (predicateResults.some((result) => result.status === "ignored")) {
        return derived;
      }
    } else if (action.requiredState?.length) {
      diagnostics.push({
        code: "unstructured-requirement",
        message: `Legacy requirements are not executable for ${action.id}.`,
        eventId: event.id,
        actionId: action.id,
        relevance: "relevant-unsupported",
      });
      return derived;
    }

    let effectiveDamageType =
      action.damageType && action.damageType !== "tuneRupture"
        ? action.damageType
        : undefined;
    for (const instance of active) {
      for (const rule of instance.definition.rules) {
        for (const modifier of rule.modifiers) {
          if (
            modifier.kind === "damage-type-replacement" &&
            evaluatePredicate(modifier.condition, preContext).status === "matched"
          ) {
            effectiveDamageType = modifier.damageType;
          }
        }
      }
    }

    const context: CombatContext = {
      ...preContext,
      actionId: action.id,
      damageType: effectiveDamageType,
    };
    const runtime: {
      stat: RuntimeStatModifier["stat"];
      mode: RuntimeStatModifier["mode"];
      value: number;
    }[] = [];
    const motionValues: {
      mode: "additive-percent" | "relative-additive" | "multiplier";
      value: number;
      effectId: string;
      groupDistribution?: readonly { groupIndex: number; weight: number }[];
    }[] = [];

    for (const instance of active) {
      for (const rule of instance.definition.rules) {
        const match = matchRuntimeRule(rule, instance, context);
        if (match === "unsupported") {
          diagnostics.push({
            code: "runtime-rule-context-required",
            message: `${instance.definition.id}:${rule.id} could not resolve its selector/predicate context.`,
            eventId: event.id,
            actionId: action.id,
            relevance: "relevant-unsupported",
          });
          continue;
        }
        if (match !== "matched") continue;
        for (const modifier of rule.modifiers) {
          if (modifier.kind === "runtime-stat") {
            if (
              modifier.value.kind === "stat" &&
              modifier.value.view === "effective"
            ) {
              diagnostics.push({
                code: "runtime-stat-dependency-unsupported",
                message: `${instance.definition.id} depends on effective ${modifier.value.stat}.`,
                eventId: event.id,
                relevance: "relevant-unsupported",
              });
              continue;
            }
            const result = evaluateValueExpression(modifier.value, context, {
              stacks: instance.stacks,
              rank: instance.rank ?? req.build.weapon.rank,
            });
            if (result.status === "supported") {
              runtime.push({
                stat: modifier.stat,
                mode: modifier.mode,
                value: result.value!,
              });
            } else {
              diagnostics.push({
                code: result.diagnostics[0]?.code ?? "invalid-expression",
                message:
                  result.diagnostics[0]?.message ??
                  "Runtime expression unsupported.",
                eventId: event.id,
                relevance: "relevant-unsupported",
              });
            }
          } else if (modifier.kind === "motion-value") {
            const result = evaluateValueExpression(modifier.value, context, {
              stacks: instance.stacks,
              rank: instance.rank ?? req.build.weapon.rank,
            });
            if (result.status === "supported") {
              motionValues.push({
                mode: modifier.mode,
                value: result.value!,
                effectId: instance.definition.id,
                groupDistribution: modifier.groupDistribution,
              });
            } else {
              diagnostics.push({
                code: result.diagnostics[0]?.code ?? "invalid-expression",
                message:
                  result.diagnostics[0]?.message ??
                  "Motion Value expression unsupported.",
                eventId: event.id,
                actionId: action.id,
                relevance: "relevant-unsupported",
              });
            }
          }
        }
      }
    }

    const effective = buildEffectiveCombatStats(
      req.build.finalStats,
      req.baseStatBasis ?? {},
      runtime,
    );
    if (effective.status === "unsupported") {
      for (const diagnostic of effective.diagnostics) {
        diagnostics.push({
          code: diagnostic.split(":")[0],
          message: diagnostic,
          eventId: event.id,
          actionId: action.id,
          relevance: "relevant-unsupported",
        });
      }
      return derived;
    }

    /*
     * MV layers are applied to the original grouped action before a theoretical
     * hit is split out. This preserves data-owned group distributions (for
     * example 20/80 additive totals) while still allowing hit-triggered runtime
     * effects to operate on individual theoretical hit events.
     */
    const fullMotionValueResolution = applyMotionValueModifiers(
      action.multipliers,
      motionValues,
    );
    if (fullMotionValueResolution.status === "unsupported") {
      diagnostics.push({
        code: fullMotionValueResolution.reason,
        message: action.id,
        eventId: event.id,
        actionId: action.id,
        relevance: "relevant-unsupported",
      });
      return derived;
    }

    let originalMotionValue = action.multipliers.reduce(
      (sum, group) => sum + group.percent * group.hits,
      0,
    );
    let damageAction: CombatAction = {
      ...action,
      multipliers: fullMotionValueResolution.groups,
    };

    if (realHit && event.hitIndex !== undefined && !event.originEventId) {
      const originalHits = action.multipliers.flatMap((group) =>
        Array.from({ length: group.hits }, () => group.percent),
      );
      const effectiveHits = fullMotionValueResolution.groups.flatMap((group) =>
        Array.from({ length: group.hits }, () => group.percent),
      );
      const originalPercent = originalHits[event.hitIndex];
      const effectivePercent = effectiveHits[event.hitIndex];
      if (originalPercent === undefined || effectivePercent === undefined) {
        diagnostics.push({
          code: "hit-count-mismatch",
          message: action.id,
          eventId: event.id,
          actionId: action.id,
          relevance: "relevant-unsupported",
        });
        return derived;
      }
      originalMotionValue = originalPercent;
      damageAction = {
        ...action,
        multipliers: [{ percent: effectivePercent, hits: 1 }],
      };
    }

    const legacyInstances = active.map((instance) => ({
      ...instance,
      definition: {
        ...instance.definition,
        rules: instance.definition.rules.map((rule) => ({
          ...rule,
          modifiers: rule.modifiers.filter(
            (modifier) =>
              ![
                "runtime-stat",
                "motion-value",
                "action-replacement",
                "damage-type-replacement",
              ].includes(modifier.kind),
          ) as readonly (EffectModifier | FixedCritOverrideModifier)[],
        })),
      },
    }));
    const targetStatusInstances = Object.values(
      state.targets[targetId]?.statuses ?? {},
    )
      .filter((status) => status.definition.modifiers?.length)
      .map((status) => ({
        id: `status:${targetId}:${status.definition.id}`,
        ownerId: status.sourceOwnerId,
        affectedEntityIds: [targetId],
        stacks: status.stacks,
        definition: {
          id: `status:${targetId}:${status.definition.id}`,
          label: status.definition.label,
          source: {
            id: status.sourceOwnerId,
            type: "system" as const,
            label: status.definition.label,
          },
          target: "enemy" as const,
          activationPolicy: "triggered" as const,
          rules: [
            {
              id: `status-rule:${status.definition.id}`,
              label: status.definition.label,
              accounting: "runtime" as const,
              modifiers: status.definition.modifiers!,
            },
          ],
        },
      }));
    const resolved = resolveActiveEffects(
      [...legacyInstances, ...targetStatusInstances],
      {
        actorId: event.actorId,
        targetId,
        teamMemberIds: [req.resonator.id],
        element: req.resonator.element,
        damageType: effectiveDamageType as DamageType | undefined,
        resonanceMode: req.resonanceMode,
        actionId: action.id,
        combatContext: context,
      },
    );

    let damage: PersonalComputedDamage;
    if (event.kind === "tune-break" && req.target.tuneEnemyClass) {
      damage = calculateTuneBreakDamage({
        finalStats: effective.stats,
        attackerLevel: req.build.characterLevel,
        enemyClass: req.target.tuneEnemyClass,
        target: req.target,
        modifiers: resolved.tuneDamageModifiers,
      });
    } else if (
      (event.kind === "tune-rupture" ||
        action.damageType === "tuneRupture") &&
      req.target.tuneEnemyClass
    ) {
      damage = calculateTuneRuptureDamage({
        action: damageAction,
        finalStats: effective.stats,
        attackerLevel: req.build.characterLevel,
        enemyClass: req.target.tuneEnemyClass,
        element: req.resonator.element,
        target: req.target,
        modifiers: resolved.tuneDamageModifiers,
        critOverride: resolved.overrides.fixedCrit,
      });
    } else if (event.kind === "fusion-burst") {
      damage = calculateNegativeStatusDamage({
        kind: "fusionBurst",
        attackerLevel: req.build.characterLevel,
        target: req.target,
        stacks: Number(event.payload?.stacks ?? 10),
        multiplierIncreasePercent: Number(
          event.payload?.multiplierIncreasePercent ?? 0,
        ),
        damageAmplificationPercent:
          resolved.damageModifiers.damageAmplificationPercent ?? 0,
        defenseReduction: resolved.damageModifiers.defenseReduction ?? 0,
        resistanceReduction:
          resolved.damageModifiers.resistanceReduction ?? 0,
        critOverride: resolved.overrides.fixedCrit,
      });
    } else {
      damage = calculateActionDamage({
        action: damageAction,
        finalStats: effective.stats,
        attackerLevel: req.build.characterLevel,
        scalingAttribute:
          action.scalingAttribute ?? req.scalingAttribute ?? "attack",
        element: req.resonator.element,
        target: req.target,
        effectiveDamageType: effectiveDamageType as DamageType | undefined,
        modifiers: resolved.damageModifiers,
      });
    }
    if (damage.status === "unsupported") {
      diagnostics.push({
        code: damage.reason,
        message: damage.message,
        eventId: event.id,
        actionId: action.id,
        relevance: "relevant-unsupported",
      });
      return derived;
    }

    const payload = event.payload ?? {};
    const defaultAttribution: DamageAttribution =
      event.kind === "fusion-burst"
        ? "status"
        : event.kind === "tune-break" ||
            event.kind === "tune-rupture" ||
            action.damageType === "tuneRupture"
          ? "tune"
          : action.talent === "echoSkill"
            ? "echo"
            : "direct";
    const attribution =
      (payload.attribution as DamageAttribution | undefined) ??
      defaultAttribution;
    const damageOwner =
      (payload.damageOwnerId as string | undefined) ?? event.ownerId;
    const scalingOwner =
      (payload.scalingOwnerId as string | undefined) ?? req.resonator.id;
    if (
      damageOwner !== req.resonator.id &&
      !(req.loadout?.ownedEntityIds ?? []).includes(damageOwner)
    ) {
      return derived;
    }
    if (scalingOwner !== req.resonator.id) {
      diagnostics.push({
        code: "foreign-scaling-owner-unsupported",
        message: scalingOwner,
        eventId: event.id,
        relevance: "relevant-unsupported",
      });
      return derived;
    }

    breakdown[attribution] = add(breakdown[attribution], damage.total);
    perAction[action.id] = add(perAction[action.id] ?? zero(), damage.total);
    const source =
      (payload.sourceEffectId as string | undefined) ??
      (attribution === "direct" ? req.resonator.id : attribution);
    perSource[source] = add(perSource[source] ?? zero(), damage.total);
    audits.push({
      timestamp: event.timestamp,
      eventId: event.id,
      baseActionId: baseDefinition.action.id,
      actionId: action.id,
      baseDamageType: baseDefinition.action.damageType,
      effectiveDamageType,
      damageOwnerId: damageOwner,
      scalingOwnerId: scalingOwner,
      actorId: event.actorId,
      triggeringActorId: event.triggeringActorId,
      sourceEntityId: event.sourceEntityId,
      targetId,
      attribution,
      panelStats: req.build.finalStats,
      baseStatBasis: req.baseStatBasis ?? {},
      effectiveStats: effective.stats,
      runtimeStatAudit: effective.audit,
      originalMotionValue,
      motionValueContributions: motionValues,
      effectiveMotionValue: damageAction.multipliers.reduce(
        (sum, group) => sum + group.percent * group.hits,
        0,
      ),
      activeEffectIds: active.map((effect) => effect.definition.id),
      effectAudit: resolved.audit,
      damage,
      sourceEffectId: payload.sourceEffectId as string | undefined,
    });

    if (!aggregate) {
      derived.push({
        id: `${event.id}:damage`,
        timestamp: event.timestamp,
        kind: "damage-dealt",
        ownerId: req.resonator.id,
        actorId: event.actorId,
        targetId: event.targetId,
        sourceId: action.id,
        actionId: action.id,
        originEventId: event.id,
        depth: (event.depth ?? 0) + 1,
        occurrence: `${event.occurrence ?? event.id}:damage`,
        payload: {
          damageOwnerId: damageOwner,
          scalingOwnerId: scalingOwner,
          triggerTimestamp: event.timestamp,
        },
      });
    }

    if (payload.statusId && payload.consumeStacks) {
      const status =
        state.targets[event.targetId]?.statuses[payload.statusId as string];
      if (status) {
        const amount =
          payload.consumeStacks === "all"
            ? status.stacks
            : Number(payload.consumeStacks);
        const statuses = { ...state.targets[event.targetId].statuses };
        const stacks = Math.max(0, status.stacks - amount);
        if (stacks === 0) delete statuses[payload.statusId as string];
        else {
          statuses[payload.statusId as string] = { ...status, stacks };
        }
        state = {
          ...state,
          targets: {
            ...state.targets,
            [event.targetId]: {
              ...state.targets[event.targetId],
              statuses,
            },
          },
        };
      }
    }
    return derived;
  });

  diagnostics.push(
    ...queueResult.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      message: diagnostic.message,
      eventId: diagnostic.eventId,
      relevance: "relevant-unsupported" as const,
    })),
  );
  const personalDamage = Object.values(breakdown).reduce(add, zero());
  const duration = req.timeline.finalDurationSeconds;
  const personalDps =
    duration > 0
      ? {
          nonCrit: personalDamage.nonCrit / duration,
          crit: personalDamage.crit / duration,
          expected: personalDamage.expected / duration,
        }
      : zero();
  const unsupported = diagnostics.filter(
    (diagnostic) =>
      diagnostic.relevance === "relevant-unsupported" ||
      diagnostic.relevance === "not-emitted-due-to-missing-context",
  );
  const coverage: Coverage = {
    timelineSteps: req.timeline.entries.length,
    relevantSupported: audits.length,
    relevantUnsupported: diagnostics.filter(
      (diagnostic) => diagnostic.relevance === "relevant-unsupported",
    ).length,
    modeledUnused: diagnostics.filter(
      (diagnostic) => diagnostic.relevance === "modeled-unused",
    ).length,
    notEmittedDueToMissingContext: diagnostics.filter(
      (diagnostic) =>
        diagnostic.relevance === "not-emitted-due-to-missing-context",
    ).length,
    directDamageActions: audits.filter(
      (audit) => audit.attribution === "direct",
    ).length,
    derivedActions: audits.filter(
      (audit) => audit.attribution !== "direct",
    ).length,
    activeEffects: state.activeEffects.length,
    triggeredEffects: triggered,
  };
  return {
    rotationDurationSeconds: duration,
    personalDamage,
    personalDps,
    breakdown,
    perAction,
    perSource,
    audits,
    eventLog: queueResult.processed,
    stateTransitions: transitions,
    stateDiagnostics,
    diagnostics,
    unsupportedMechanics: unsupported,
    coverage,
    partial: unsupported.length > 0 || queueResult.partial,
    finalState: state,
  };
}

function cloneEffect(effect: ActiveRuntimeEffect): ActiveRuntimeEffect {
  return {
    ...effect,
    stackExpirations: effect.stackExpirations
      ? [...effect.stackExpirations]
      : undefined,
  };
}

function contextFor(
  event: CombatEvent,
  req: PersonalCombatRequest,
  state: CombatState,
  targetId: string,
  panel: FinalStats,
): CombatContext {
  const actor = state.actors[event.actorId];
  const owner = state.actors[event.ownerId];
  const target = state.targets[targetId];
  return {
    timestamp: event.timestamp,
    actorId: event.actorId,
    ownerId: event.ownerId,
    targetId,
    sourceId: event.sourceId,
    sourceEntityId: event.sourceEntityId,
    triggeringActorId: event.triggeringActorId,
    damageOwnerId: event.payload?.damageOwnerId as string | undefined,
    scalingOwnerId: event.payload?.scalingOwnerId as string | undefined,
    actionId: event.actionId,
    eventKind: event.kind,
    eventSourceId: event.sourceId,
    eventTargetId: targetId,
    element: req.resonator.element,
    resonanceMode: req.resonanceMode,
    panelStats: panel,
    resources: owner?.resources,
    states: actor?.namedStates,
    form: actor?.form,
    onField: actor?.onField,
    actorHpRatio:
      actor?.hp !== undefined && actor.maxHp ? actor.hp / actor.maxHp : undefined,
    targetHpRatio:
      target?.hp !== undefined && target.maxHp
        ? target.hp / target.maxHp
        : undefined,
    targetStatuses: Object.fromEntries(
      Object.entries(target?.statuses ?? {}).map(([key, value]) => [
        key,
        value.stacks,
      ]),
    ),
    activeEffectIds: state.activeEffects
      .filter((effect) => effect.ownerId === event.ownerId)
      .map((effect) => effect.definition.id),
  };
}
