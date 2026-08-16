import {
  buildTemporalEffectWindows,
  buildTemporalTimeline,
  type TemporalActionStep,
  type TemporalEffectDefinition,
  type TemporalProfileId,
  type TemporalRotationDefinition,
} from "@/domain/temporal-engine";
import {
  aemeath,
  everbrightPolestar,
  trailblazingStar,
} from "./aemeath";

const rotation = aemeath.combat!.rotations.find(
  (candidate) => candidate.id === "aemeath-s0-standard-no-quickswap",
)!;

const estimatedStep = (
  id: string,
  rotationStepIndex: number,
  profileId: TemporalProfileId,
  actionId?: string,
  notes: readonly string[] = [],
): TemporalActionStep => ({
  id,
  label: rotation.steps[rotationStepIndex],
  actionId,
  rotationStepIndex,
  duration: {
    confidence: "estimated-default",
    profileId,
    sourceNote:
      "Classification Aemeath V0.1 à remplacer par une mesure d'animation dès qu'elle sera disponible.",
  },
  recoverySeconds: null,
  cancelTimingSeconds: null,
  hitTimingsSeconds: null,
  notes,
});

export const aemeathTemporalRotationDefinition: TemporalRotationDefinition = {
  id: rotation.id,
  name: rotation.name,
  policy: rotation.policy,
  steps: [
    estimatedStep("intro-mech", 0, "intro", "intro-mech"),
    estimatedStep("mech-basic-3-first", 1, "basic-long", "mech-basic-3"),
    estimatedStep("mech-basic-4-first", 2, "basic-medium", "mech-basic-4"),
    estimatedStep("overdrive", 3, "liberation-long", "overdrive", [
      "Le texte de rotation décrit le cancel de Basic 4 par Overdrive; le timing exact du cancel reste inconnu.",
    ]),
    estimatedStep("mech-basic-2", 4, "basic-medium", "mech-basic-2"),
    estimatedStep("mech-basic-3-second", 5, "basic-long", "mech-basic-3"),
    estimatedStep("mech-basic-4-second", 6, "basic-medium", "mech-basic-4"),
    estimatedStep("skill-first", 7, "form-switch-short", "form-switch", [
      "Le Skill de cancel est traité comme la transition de forme courte décrite par Shared Voyage.",
    ]),
    estimatedStep("seraphic-encore", 8, "skill-medium", "seraphic-encore", [
      "Forte multi-hit classée temporellement comme Skill moyenne sans changer son talent ni son type de dégâts.",
    ]),
    estimatedStep("aemeath-basic-2", 9, "basic-medium", "aemeath-basic-2"),
    estimatedStep("aemeath-basic-3", 10, "basic-long", "aemeath-basic-3"),
    estimatedStep("aemeath-basic-4", 11, "basic-long", "aemeath-basic-4"),
    estimatedStep("skill-second", 12, "form-switch-short", "form-switch", [
      "Le Skill de cancel est traité comme une transition de forme courte; sa vraie fenêtre de cancel reste inconnue.",
    ]),
    estimatedStep(
      "seraphic-overture",
      13,
      "skill-medium",
      "seraphic-overture",
      [
        "Forte multi-hit classée temporellement comme Skill moyenne sans changer son talent ni son type de dégâts.",
      ],
    ),
    estimatedStep("mech-heavy-2", 14, "heavy", "mech-heavy-2"),
    estimatedStep("finale", 16, "liberation-long", "finale", [
      "L'étape 15 documente le cancel vers Finale et ne constitue pas une seconde action occupant du temps.",
    ]),
    estimatedStep(
      "form-switch-loop",
      17,
      "form-switch-short",
      "form-switch",
    ),
    estimatedStep("outro", 18, "outro", undefined, [
      "L'Outro est présent dans la rotation de référence mais ne possède pas encore de CombatAction dédiée.",
    ]),
  ],
  targetDuration: {
    seconds: rotation.totalDurationSeconds.value!,
    confidence: rotation.totalDurationSeconds.confidence,
    source:
      rotation.totalDurationSeconds.sourceNote ?? rotation.source.source,
  },
};

export const aemeathTemporalEffectDefinitions: readonly TemporalEffectDefinition[] = [
  {
    effectId: "starlume",
    sourceId: "intro-normal",
    label: "Starlume Acceleration",
    activation: { kind: "action-end", stepId: "intro-mech" },
    endRules: [
      { kind: "maximum-duration", seconds: 15 },
      { kind: "action-start", stepId: "overdrive" },
    ],
  },
  {
    effectId: "stardust-resonance",
    sourceId: "overdrive",
    label: "Stardust Resonance",
    activation: { kind: "action-end", stepId: "overdrive" },
    endRules: [
      { kind: "maximum-duration", seconds: 30 },
      {
        kind: "usage-count",
        stepIds: ["seraphic-encore", "seraphic-overture"],
        count: 2,
      },
    ],
  },
  {
    effectId: "unbound",
    sourceId: "overdrive",
    label: "Heavenfall Edict: Unbound",
    activation: { kind: "action-end", stepId: "overdrive" },
    endRules: [
      { kind: "maximum-duration", seconds: 60 },
      { kind: "action-start", stepId: "finale" },
      {
        kind: "declarative",
        description: "Autres conditions de fin documentées par le kit.",
      },
    ],
  },
  {
    effectId: "seraphic-duo",
    sourceId: "aemeath-basic-4",
    label: "Seraphic Duo",
    activation: { kind: "action-end", stepId: "aemeath-basic-4" },
    endRules: [
      { kind: "maximum-duration", seconds: 5 },
      { kind: "action-start", stepId: "finale" },
    ],
  },
  {
    effectId: "everbright-r1-liberation",
    sourceId: everbrightPolestar.id,
    label: "Everbright Polestar R1 — Polestar",
    activation: {
      kind: "external-trigger",
      description: "Tune Rupture - Shifting ou Fusion Burst",
    },
    endRules: [
      { kind: "maximum-duration", seconds: 8 },
      {
        kind: "refresh",
        description: "Nouveau déclenchement selon le passif de l'arme.",
      },
    ],
  },
  {
    effectId: "trailblazing-5pc",
    sourceId: trailblazingStar.id,
    label: "Trailblazing Star 5-piece",
    activation: {
      kind: "external-trigger",
      description: "Application de Fusion Burst ou Tune Rupture - Shifting",
    },
    endRules: [{ kind: "maximum-duration", seconds: 8 }],
  },
  {
    effectId: "starburst-icd",
    sourceId: "starburst",
    label: "Starburst target ICD",
    activation: {
      kind: "external-trigger",
      description: "Starburst touche une cible déterminée",
    },
    endRules: [
      { kind: "maximum-duration", seconds: 8 },
      {
        kind: "declarative",
        description: "La fenêtre est propre à chaque cible.",
      },
    ],
  },
  {
    effectId: "silent-protection",
    sourceId: "outro",
    label: "Silent Protection",
    activation: { kind: "action-end", stepId: "outro" },
    endRules: [
      { kind: "maximum-duration", seconds: 20 },
      {
        kind: "refresh",
        description: "Une nouvelle utilisation remplace et réinitialise l'effet.",
      },
    ],
  },
];

export const aemeathTemporalTimeline = buildTemporalTimeline(
  aemeathTemporalRotationDefinition,
);

export const aemeathTemporalEffectWindows = buildTemporalEffectWindows(
  aemeathTemporalTimeline,
  aemeathTemporalEffectDefinitions,
);
