import type {
  CombatPredicate,
  EffectDefinition,
  ValueExpression,
} from "@/domain/effect-models";
import type {
  CombatAction,
  CombatEffect,
  CombatResource,
  Resonator,
  SourceMetadata,
  Weapon,
} from "@/domain/models";

export const HIYUKI = {
  presentBasic1: "precise-hiyuki-attr-1108001",
  presentBasic2: "precise-hiyuki-attr-1108002",
  presentBasic3: "precise-hiyuki-attr-1108003",
  frostSplinter: "precise-hiyuki-attr-1108005",
  presentMidair: "precise-hiyuki-attr-1108006",
  presentDodge: "precise-hiyuki-attr-1108007",
  foreclaimedBasic1: "precise-hiyuki-attr-1108008",
  foreclaimedBasic2: "precise-hiyuki-attr-1108009",
  foreclaimedBasic3: "precise-hiyuki-attr-1108010",
  foreclaimedBasic4: "precise-hiyuki-attr-1108011",
  foreclaimedBasic5: "precise-hiyuki-attr-1108012",
  foreclaimedHeavy: "precise-hiyuki-attr-1108013",
  bitterfrost: "precise-hiyuki-attr-1108014",
  foreclaimedMidair1: "precise-hiyuki-attr-1108015",
  foreclaimedMidair2: "precise-hiyuki-attr-1108016",
  foreclaimedPlunge: "precise-hiyuki-attr-1108017",
  foreclaimedDodge: "precise-hiyuki-attr-1108018",
  presentSkill: "precise-hiyuki-attr-1108019",
  jadeCleave: "precise-hiyuki-attr-1108020",
  petalfall: "precise-hiyuki-attr-1108021",
  inwardVision: "precise-hiyuki-attr-1108022",
  bladeLiberation: "precise-hiyuki-attr-1108023",
  intro: "precise-hiyuki-attr-1108027",
  iai: "precise-hiyuki-attr-1108028",
  glacioBiteStatusAction: "precise-hiyuki-glacio-bite-status-damage",
  fineSnowBiteAction: "precise-hiyuki-fine-snow-glacio-bite",
  frostheartCheckpoint: "precise-hiyuki-reference-frostheart-checkpoint",
} as const;

export const HIYUKI_GLACIO_BITE_STATUS = "precise-hiyuki-glacio-bite-status";

const source: SourceMetadata = {
  kind: "multi-source-verified",
  source: "WUWA GameDatabase / Prydwen / WutheringTools · Hiyuki precise DPS",
  gameVersion: "3.5",
  verifiedAt: "2026-08-20",
  notes:
    "GameDatabase owns exact Lv1-10 motion values. Prydwen owns the reviewed standard rotation/kit contract; WutheringTools is used to cross-check Negative Status, Frostburn and Resonance Chain formula semantics.",
};

const constant = (value: number): ValueExpression => ({ kind: "constant", value });
const rank = (values: readonly number[]): ValueExpression => ({
  kind: "rank",
  values: Object.fromEntries(values.map((value, index) => [index + 1, value])),
});
const resource = (resourceId: string): ValueExpression => ({ kind: "resource", resourceId });
const actionPredicate = (...ids: string[]): CombatPredicate => ({
  kind: "identity",
  field: "actionId",
  anyOf: ids,
});
const sequenceAtLeast = (value: number): CombatPredicate => ({
  kind: "state-active",
  id: `sequence-at-least-${value}`,
});

const resources: readonly CombatResource[] = [
  {
    id: "dedication",
    name: "Dedication",
    cap: 300,
    semantic: "character-resource",
    notes: ["Intro +200; Present Basic 3 +100; Frost Splinter consumes 300."],
  },
  {
    id: "frostheart",
    name: "Frostheart",
    cap: 300,
    semantic: "character-resource",
    notes: [
      "Inward Vision resets then restores exactly 50.",
      "Public kit text identifies the Foreclaimed attacks that restore Frostheart but does not expose a trustworthy per-action numeric split. The reviewed personal scenario therefore owns the exact full-Frostheart checkpoint after its verified preparation sequence instead of inventing per-hit values.",
    ],
  },
  {
    id: "frostharden-iai",
    name: "Frostharden Iai",
    cap: 3,
    semantic: "character-resource",
    notes: ["Inward Vision grants 3; each Iai consumes 1."],
  },
  {
    id: "whiteout-bitterfrost",
    name: "Whiteout Bitterfrost",
    cap: 3,
    semantic: "character-resource",
    notes: ["Each Iai that consumes Frostharden grants 1; Bitterfrost consumes all 3."],
  },
  {
    id: "snowforged-blade",
    name: "Snowforged Blade",
    cap: 3,
    semantic: "character-resource",
    notes: [
      "Bitterfrost grants 1. Ephemeral Realm supplies the opener/banked scenario bootstrap; Blade Liberation consumes the available stack bank.",
    ],
  },
];

type PreciseAction = CombatAction & { readonly sourceAttributeId?: string };

const liberationIds = new Set([
  "1108005",
  "1108008",
  "1108009",
  "1108010",
  "1108011",
  "1108012",
  "1108013",
  "1108014",
  "1108015",
  "1108016",
  "1108017",
  "1108018",
  "1108022",
  "1108023",
  "1108027",
  "1108028",
]);

const foreclaimedS1Ids = [
  HIYUKI.foreclaimedBasic1,
  HIYUKI.foreclaimedBasic2,
  HIYUKI.foreclaimedBasic3,
  HIYUKI.foreclaimedBasic4,
  HIYUKI.foreclaimedBasic5,
  HIYUKI.foreclaimedHeavy,
  HIYUKI.foreclaimedMidair1,
  HIYUKI.foreclaimedMidair2,
  HIYUKI.foreclaimedPlunge,
  HIYUKI.foreclaimedDodge,
] as const;

export function applyPreciseHiyukiActionPatches(
  actions: readonly PreciseAction[],
): readonly PreciseAction[] {
  return actions.map((action) => {
    const attributeId = action.sourceAttributeId;
    const damageType = attributeId && liberationIds.has(attributeId)
      ? "resonanceLiberation" as const
      : action.damageType;
    let resourceOperations = action.resourceOperations;
    if (action.id === HIYUKI.intro) {
      resourceOperations = [
        { resourceId: "dedication", operation: "gain", amount: 200, stage: "after-action" },
      ];
    } else if (action.id === HIYUKI.presentBasic3) {
      resourceOperations = [
        { resourceId: "dedication", operation: "gain", amount: 100, stage: "after-action" },
      ];
    } else if (action.id === HIYUKI.frostSplinter) {
      resourceOperations = [
        { resourceId: "dedication", operation: "consume", amount: 300, stage: "before-action" },
      ];
    } else if (action.id === HIYUKI.iai) {
      resourceOperations = [
        { resourceId: "frostheart", operation: "consume", amount: 100, stage: "before-action" },
      ];
    } else if (action.id === HIYUKI.bitterfrost) {
      resourceOperations = [
        { resourceId: "whiteout-bitterfrost", operation: "consume", amount: 3, stage: "before-action" },
      ];
    }
    return {
      ...action,
      ...(damageType ? { damageType } : {}),
      ...(resourceOperations ? { resourceOperations } : {}),
      notes: [
        ...(action.notes ?? []),
        ...(attributeId && liberationIds.has(attributeId)
          ? ["Hiyuki kit classifies this action as Resonance Liberation DMG."]
          : []),
      ],
    };
  });
}

const stateMachine: EffectDefinition = {
  id: "precise-hiyuki-state-machine",
  label: "Hiyuki Forte resource state machine",
  source: { id: "hiyuki-forte", type: "resonator", label: "Everfrost Dominion" },
  target: "self",
  rules: [],
  triggers: [
    {
      id: "hiyuki-inward-enter-foreclaimed",
      event: "action-end",
      predicates: [actionPredicate(HIYUKI.inwardVision)],
      operations: [
        { kind: "resource", operation: "consume-all", resourceId: "dedication" },
        { kind: "resource", operation: "consume-all", resourceId: "frostheart" },
        { kind: "resource", operation: "gain", resourceId: "frostheart", amount: constant(50) },
        { kind: "resource", operation: "set-max", resourceId: "frostharden-iai" },
        { kind: "change-form", stateId: "Foreclaimed Self" },
      ],
    },
    {
      id: "hiyuki-reviewed-frostheart-checkpoint",
      event: "custom",
      predicates: [actionPredicate(HIYUKI.frostheartCheckpoint)],
      operations: [{ kind: "resource", operation: "set-max", resourceId: "frostheart" }],
    },
    {
      id: "hiyuki-iai-convert-frostharden",
      event: "action-end",
      predicates: [actionPredicate(HIYUKI.iai)],
      operations: [
        { kind: "resource", operation: "consume", resourceId: "frostharden-iai", amount: constant(1) },
        { kind: "resource", operation: "gain", resourceId: "whiteout-bitterfrost", amount: constant(1) },
      ],
    },
    {
      id: "hiyuki-bitterfrost-snowforged",
      event: "action-end",
      predicates: [actionPredicate(HIYUKI.bitterfrost)],
      operations: [{ kind: "resource", operation: "gain", resourceId: "snowforged-blade", amount: constant(1) }],
    },
    {
      id: "hiyuki-blade-liberation-reset",
      event: "action-end",
      predicates: [actionPredicate(HIYUKI.bladeLiberation)],
      operations: [
        { kind: "resource", operation: "consume-all", resourceId: "snowforged-blade" },
        { kind: "resource", operation: "consume-all", resourceId: "dedication" },
        { kind: "resource", operation: "consume-all", resourceId: "frostheart" },
        { kind: "change-form", stateId: "Present Self" },
      ],
    },
    {
      id: "hiyuki-s2-ephemeral-bootstrap",
      event: "rotation-step-start",
      predicates: [sequenceAtLeast(2), actionPredicate(HIYUKI.intro)],
      maxTriggers: 1,
      operations: [
        { kind: "resource", operation: "set-max", resourceId: "snowforged-blade" },
        { kind: "resource", operation: "set-max", resourceId: "frostharden-iai" },
      ],
    },
    {
      id: "hiyuki-s2-extra-frostheart",
      event: "action-end",
      predicates: [sequenceAtLeast(2), actionPredicate(HIYUKI.jadeCleave, HIYUKI.petalfall)],
      maxTriggers: 2,
      operations: [{ kind: "resource", operation: "gain", resourceId: "frostheart", amount: constant(50) }],
    },
  ],
};

const glacioBiteStatus: EffectDefinition = {
  id: "precise-hiyuki-glacio-bite-runtime",
  label: "Glacio Chafe → Glacio Bite runtime",
  source: { id: "hiyuki-forte", type: "resonator", label: "Glacio Bite" },
  target: "enemy",
  rules: [],
  statuses: [{
    id: HIYUKI_GLACIO_BITE_STATUS,
    label: "Glacio Bite",
    maxStacks: 10,
  }],
  triggers: [
    {
      id: "hiyuki-frostbind-consume-before-inward-or-iai",
      event: "action-start",
      predicates: [
        actionPredicate(HIYUKI.inwardVision, HIYUKI.iai),
        { kind: "target-has-status", id: HIYUKI_GLACIO_BITE_STATUS, minStacks: 10 },
      ],
      operations: [{ kind: "remove-status", statusId: HIYUKI_GLACIO_BITE_STATUS }],
    },
    {
      id: "hiyuki-apply-one-glacio-bite-stack",
      event: "status-applied",
      predicates: [
        actionPredicate(HIYUKI.glacioBiteStatusAction),
        {
          kind: "not",
          predicate: { kind: "target-has-status", id: HIYUKI_GLACIO_BITE_STATUS, minStacks: 10 },
        },
      ],
      operations: [
        {
          kind: "apply-status",
          statusId: HIYUKI_GLACIO_BITE_STATUS,
          stacks: constant(1),
        },
        { kind: "emit-event", eventKind: "custom", delaySeconds: 0 },
      ],
    },
  ],
};

const fineSnow: EffectDefinition = {
  id: "precise-hiyuki-fine-snow",
  label: "Fine Snow · Snow Rust",
  source: { id: "hiyuki-fine-snow", type: "resonator", label: "Fine Snow" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: {
    duration: { kind: "indefinite" },
    uniqueness: "replace-existing",
    stacks: { kind: "shared", max: 3, initial: 0 },
  },
  rules: [
    {
      id: "hiyuki-snow-rust-crit-dmg",
      label: "1 Snow Rust · +40% Crit DMG",
      accounting: "runtime",
      modifiers: [{
        kind: "runtime-stat",
        stat: "critDamage",
        mode: "flat",
        stacking: "additive",
        value: { kind: "stack-threshold", threshold: 1, then: constant(40) },
      }],
    },
    {
      id: "hiyuki-snow-rust-bite-amplification-1",
      label: "1 Snow Rust · +30% Glacio Bite DMG Amplification",
      accounting: "runtime",
      selectors: [{ kind: "action-id", anyOf: [HIYUKI.glacioBiteStatusAction, HIYUKI.fineSnowBiteAction] }],
      modifiers: [{
        kind: "damage-amplification",
        stacking: "additive",
        valueExpression: { kind: "stack-threshold", threshold: 1, then: constant(30) },
      }],
    },
    {
      id: "hiyuki-snow-rust-bite-amplification-3",
      label: "3 Snow Rust · additional +30% Glacio Bite DMG Amplification",
      accounting: "runtime",
      selectors: [{ kind: "action-id", anyOf: [HIYUKI.glacioBiteStatusAction, HIYUKI.fineSnowBiteAction] }],
      modifiers: [{
        kind: "damage-amplification",
        stacking: "additive",
        valueExpression: { kind: "stack-threshold", threshold: 3, then: constant(30) },
      }],
    },
    {
      id: "hiyuki-s6-two-rust-crit-dmg",
      label: "S6 + 2 Snow Rust · +40% Crit DMG",
      accounting: "runtime",
      requiredSequence: 6,
      modifiers: [{
        kind: "runtime-stat",
        stat: "critDamage",
        mode: "flat",
        stacking: "additive",
        value: { kind: "stack-threshold", threshold: 2, then: constant(40) },
      }],
    },
  ],
  triggers: [
    {
      id: "hiyuki-self-application-snow-rust",
      event: "custom",
      predicates: [actionPredicate(HIYUKI.glacioBiteStatusAction)],
      maxTriggers: 1,
      triggerCountScope: "owner",
      operations: [{ kind: "gain-stacks", effectId: "precise-hiyuki-fine-snow", amount: constant(1) }],
    },
    {
      id: "hiyuki-s3-precombat-snow-rust",
      event: "rotation-step-start",
      predicates: [sequenceAtLeast(3), actionPredicate(HIYUKI.intro)],
      maxTriggers: 1,
      triggerCountScope: "owner",
      operations: [{ kind: "gain-stacks", effectId: "precise-hiyuki-fine-snow", amount: constant(1) }],
    },
  ],
};

const snowforgedBlade: EffectDefinition = {
  id: "precise-hiyuki-snowforged-blade-mv",
  label: "Snowforged Blade · Blade Liberation additive MV",
  source: { id: "hiyuki-forte", type: "resonator", label: "Snowforged Blade" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "hiyuki-snowforged-blade-additive-mv",
    label: "Talent 10 · +795.24% total MV per consumed Snowforged Blade",
    accounting: "runtime",
    selectors: [{ kind: "action-id", anyOf: [HIYUKI.bladeLiberation] }],
    modifiers: [{
      kind: "motion-value",
      mode: "additive-percent",
      stacking: "additive",
      value: { kind: "multiply", values: [resource("snowforged-blade"), constant(795.24)] },
      groupDistribution: [
        { groupIndex: 0, weight: 0.2 },
        { groupIndex: 1, weight: 0.8 },
      ],
    }],
  }],
};

const sequences: EffectDefinition = {
  id: "precise-hiyuki-sequences",
  label: "Hiyuki Resonance Chain · personal damage",
  source: { id: "hiyuki-chain", type: "resonance-chain", label: "Hiyuki Resonance Chain" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [
    {
      id: "hiyuki-s1-foreclaimed-mv",
      label: "S1 · Foreclaimed normal attacks +120% DMG Multiplier",
      accounting: "runtime",
      requiredSequence: 1,
      selectors: [{ kind: "action-id", anyOf: foreclaimedS1Ids }],
      modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(120) }],
    },
    {
      id: "hiyuki-s2-iai-mv",
      label: "S2 · Iai +125% DMG Multiplier",
      accounting: "runtime",
      requiredSequence: 2,
      selectors: [{ kind: "action-id", anyOf: [HIYUKI.iai] }],
      modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(125) }],
    },
    {
      id: "hiyuki-s3-heavy-mv",
      label: "S3 · Frost Splinter / Bitterfrost +160% DMG Multiplier",
      accounting: "runtime",
      requiredSequence: 3,
      selectors: [{ kind: "action-id", anyOf: [HIYUKI.frostSplinter, HIYUKI.bitterfrost] }],
      modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(160) }],
    },
    {
      id: "hiyuki-s5-skills-mv",
      label: "S5 · Present Skill / Jade / Petalfall +80% DMG Multiplier",
      accounting: "runtime",
      requiredSequence: 5,
      selectors: [{ kind: "action-id", anyOf: [HIYUKI.presentSkill, HIYUKI.jadeCleave, HIYUKI.petalfall] }],
      modifiers: [{ kind: "motion-value", mode: "relative-additive", stacking: "additive", value: constant(80) }],
    },
    {
      id: "hiyuki-s6-inward-blade-crit-dmg",
      label: "S6 · Inward Vision / Blade Liberation +500% Crit DMG",
      accounting: "runtime",
      requiredSequence: 6,
      selectors: [{ kind: "action-id", anyOf: [HIYUKI.inwardVision, HIYUKI.bladeLiberation] }],
      modifiers: [{ kind: "crit-damage-bonus", stacking: "additive", value: 500 }],
    },
  ],
};

const s4TeamDamage: EffectDefinition = {
  id: "precise-hiyuki-s4-team-damage",
  label: "S4 · nearby Resonators damage window",
  source: { id: "hiyuki-s4", type: "resonance-chain", label: "Like Reeds on Tides" },
  target: "team",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 30 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
  rules: [{
    id: "hiyuki-s4-all-damage",
    label: "S4 · +20% damage dealt to nearby Resonators, Hiyuki included",
    accounting: "runtime",
    requiredSequence: 4,
    modifiers: [{ kind: "all-damage-bonus", stacking: "additive", value: 20 }],
  }],
  triggers: [{
    id: "hiyuki-s4-cast-trigger",
    event: "action-start",
    predicates: [sequenceAtLeast(4), actionPredicate(HIYUKI.presentSkill, HIYUKI.jadeCleave, HIYUKI.petalfall)],
    operations: [{ kind: "activate-effect", effectId: "precise-hiyuki-s4-team-damage" }],
  }],
};

const outgoingOutro: EffectDefinition = {
  id: "precise-hiyuki-outro-other-glacio",
  label: "Snowlight Blessing · other Resonators Glacio amplification",
  source: { id: "hiyuki-outro", type: "resonator", label: "Snowlight Blessing" },
  target: "other-team-members",
  teamContextRequired: true,
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 20 }, uniqueness: "refresh-existing" },
  rules: [{
    id: "hiyuki-outro-other-glacio-amplification",
    label: "Other nearby Resonators · +20% Glacio DMG Amplification vs Glacio Chafe target",
    accounting: "runtime",
    selectors: [{ kind: "element", anyOf: ["glacio"] }],
    predicates: [{ kind: "target-has-status", id: HIYUKI_GLACIO_BITE_STATUS, minStacks: 1 }],
    modifiers: [{ kind: "damage-amplification", stacking: "additive", value: 20 }],
  }],
};

const combatEffect = (definition: EffectDefinition): CombatEffect => ({
  id: definition.id,
  name: definition.label,
  sourceId: definition.source.id,
  trigger: definition.triggers?.map((trigger) => trigger.event).join(" / ") ?? "passive",
  target: definition.target === "enemy" || definition.target === "team" || definition.target === "other-team-members"
    ? definition.target
    : "self",
  effect: definition.label,
  source,
  structuredEffect: definition,
});

export function applyPreciseHiyukiMechanics(resonator: Resonator): Resonator {
  if (resonator.id !== "hiyuki" || !resonator.combat) return resonator;
  return {
    ...resonator,
    combat: {
      ...resonator.combat,
      forms: ["Present Self", "Foreclaimed Self"],
      defaultForm: "Present Self",
      resources,
      actions: applyPreciseHiyukiActionPatches(resonator.combat.actions),
      effects: [
        ...resonator.combat.effects,
        combatEffect(stateMachine),
        combatEffect(glacioBiteStatus),
        combatEffect(fineSnow),
        combatEffect(snowforgedBlade),
        combatEffect(sequences),
        combatEffect(s4TeamDamage),
        combatEffect(outgoingOutro),
      ],
      unknowns: [
        ...resonator.combat.unknowns,
        "Per-action Frostheart gains are intentionally not fabricated: the exact reviewed standard-rotation checkpoint is scenario-owned.",
        "Fine Snow stacks supplied by other team members and S6 teammate-triggered Bite instances are Team Cycle-owned; Personal DPS only executes self-earned stacks unless the scenario explicitly provides team context.",
        "Exact per-hit animation frames remain theoretical; only the reviewed whole-rotation duration is calibrated precisely.",
      ],
    },
  };
}

const frostburnPermanent: EffectDefinition = {
  id: "precise-frostburn-permanent",
  label: "Frostburn · permanent ATK",
  source: { id: "precise-hiyuki-signature", type: "weapon", label: "Frostburn" },
  target: "self",
  activationPolicy: "initially-active",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "replace-existing" },
  rules: [{
    id: "frostburn-atk",
    label: "R1-R5 · +12/15/18/21/24% ATK",
    accounting: "already-in-final-stats",
    modifiers: [{ kind: "runtime-stat", stat: "attack", mode: "percent", stacking: "additive", value: rank([12, 15, 18, 21, 24]) }],
  }],
};

const frostburnGlacioWindow: EffectDefinition = {
  id: "precise-frostburn-glacio-window",
  label: "Frostburn · Glacio / Liberation window",
  source: { id: "precise-hiyuki-signature", type: "weapon", label: "Frostburn" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "indefinite" }, uniqueness: "refresh-existing" },
  rules: [
    {
      id: "frostburn-glacio-amplification",
      label: "Apply Glacio Chafe · +28/35/42/49/56% Glacio DMG Amplification",
      accounting: "runtime",
      selectors: [{ kind: "element", anyOf: ["glacio"] }],
      modifiers: [{ kind: "damage-amplification", stacking: "additive", valueExpression: rank([28, 35, 42, 49, 56]) }],
    },
    {
      id: "frostburn-liberation-defense-ignore",
      label: "Apply Glacio Chafe · Liberation ignores 10/12.5/15/17.5/20% DEF",
      accounting: "runtime",
      selectors: [{ kind: "damage-type", anyOf: ["resonanceLiberation"] }],
      modifiers: [{ kind: "defense-ignore", stacking: "additive", valueExpression: rank([0.10, 0.125, 0.15, 0.175, 0.20]) }],
    },
  ],
  triggers: [{
    id: "frostburn-on-chafe",
    event: "custom",
    predicates: [actionPredicate(HIYUKI.glacioBiteStatusAction)],
    operations: [{ kind: "activate-effect", effectId: "precise-frostburn-glacio-window" }],
  }],
};

const frostburnChafeWindow: EffectDefinition = {
  id: "precise-frostburn-chafe-window",
  label: "Frostburn · active-wielder Chafe amplification",
  source: { id: "precise-hiyuki-signature", type: "weapon", label: "Frostburn" },
  target: "self",
  activationPolicy: "triggered",
  lifecycle: { duration: { kind: "fixed", seconds: 6 }, refresh: "reset-duration", uniqueness: "refresh-existing" },
  rules: [{
    id: "frostburn-chafe-amplification",
    label: "Active wielder · +20/25/30/35/40% Glacio Chafe/Bite DMG Amplification",
    accounting: "runtime",
    selectors: [{ kind: "action-id", anyOf: [HIYUKI.glacioBiteStatusAction, HIYUKI.fineSnowBiteAction] }],
    modifiers: [{ kind: "damage-amplification", stacking: "additive", valueExpression: rank([20, 25, 30, 35, 40]) }],
  }],
  triggers: [{
    id: "frostburn-chafe-window-trigger",
    event: "custom",
    predicates: [actionPredicate(HIYUKI.glacioBiteStatusAction), { kind: "on-field", value: true }],
    cooldown: { seconds: 0.1, scope: "owner" },
    operations: [{ kind: "activate-effect", effectId: "precise-frostburn-chafe-window" }],
  }],
};

const weaponEffect = (definition: EffectDefinition): CombatEffect => ({
  id: definition.id,
  name: definition.label,
  sourceId: definition.source.id,
  trigger: definition.triggers?.map((trigger) => trigger.event).join(" / ") ?? "permanent",
  target: "self",
  effect: definition.label,
  source,
  structuredEffect: definition,
});

export function applyPreciseHiyukiWeaponMechanics(resonatorId: string, weapon: Weapon): Weapon {
  if (resonatorId !== "hiyuki") return weapon;
  return {
    ...weapon,
    level90Stats: {
      ...weapon.level90Stats!,
      baseAttack: 587.5,
      displayBaseAttack: 588,
      critRate: 24.3,
    },
    effects: [
      ...(weapon.effects ?? []),
      weaponEffect(frostburnPermanent),
      weaponEffect(frostburnGlacioWindow),
      weaponEffect(frostburnChafeWindow),
    ],
    passiveDescription:
      "R1-R5 structuré: ATK permanent reste upstream dans finalStats; appliquer Glacio Chafe active l'amplification Glacio et le DEF Ignore Liberation; lorsque Hiyuki est active, le bonus Glacio Chafe/Bite de 6s est rafraîchi avec ICD 0.1s. Negative Status n'utilise jamais le DEF Ignore.",
  };
}
