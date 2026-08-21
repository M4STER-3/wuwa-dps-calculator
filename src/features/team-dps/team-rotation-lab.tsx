"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import { mainEchoes, resonators, sonatas, weapons } from "@/data/catalog";
import { emptyCharacterBox } from "@/domain/character-box";
import {
  actorIdForBuild,
  buildTeamActorInputs,
  deriveRotationActionOptions,
  TEAM_ROTATION_STORAGE_VERSION,
  walkRotationActiveActors,
} from "@/domain/team-rotation-builder";
import type { TeamRotationStep } from "@/domain/team-engine";
import {
  validateTeamCycle,
  type TeamCycleValidation,
} from "@/domain/team-dps-cycle";
import {
  getBrowserCharacterBoxSnapshot,
  subscribeToBrowserCharacterBox,
} from "@/storage/character-box-storage";
import {
  loadTeamRotationDraft,
  saveTeamRotationDraft,
} from "@/storage/team-rotation-storage";

import styles from "./team-rotation-lab.module.css";

const target = {
  level: 90,
  elementalResistance: {
    aero: 0,
    glacio: 0,
    electro: 0,
    fusion: 0,
    havoc: 0,
    spectro: 0,
  },
  physicalResistance: 0,
};

const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

function rotationActorOrder(
  startingActorId: string,
  steps: readonly TeamRotationStep[],
): readonly string[] {
  if (!startingActorId) return [];
  const order = [startingActorId];
  for (const step of steps) {
    if (step.kind === "switch" && order.at(-1) !== step.toActorId) {
      order.push(step.toActorId);
    }
  }
  return order;
}

export function TeamRotationLab() {
  const box = useSyncExternalStore(
    subscribeToBrowserCharacterBox,
    getBrowserCharacterBoxSnapshot,
    emptyCharacterBox,
  );
  const [buildIds, setBuildIds] = useState<string[]>([]);
  const [actorIdsByBuildId, setActorIdsByBuildId] = useState<
    Record<string, string>
  >({});
  const [starting, setStarting] = useState("");
  const [steps, setSteps] = useState<TeamRotationStep[]>([]);
  const [result, setResult] = useState<TeamCycleValidation>();
  const [initialResources, setInitialResources] = useState<
    Record<string, Record<string, number>>
  >({});
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = loadTeamRotationDraft();
      if (saved) {
        const restoredIds = Object.fromEntries(
          saved.selectedBuildIds.map((id, index) => [
            id,
            saved.actorIds[index] ?? actorIdForBuild(id),
          ]),
        );
        setBuildIds([...saved.selectedBuildIds]);
        setActorIdsByBuildId(restoredIds);
        setStarting(saved.startingActorId);
        setSteps([...saved.steps]);
        setInitialResources(
          Object.fromEntries(
            Object.entries(saved.initialResourcesByActorId ?? {}).map(
              ([id, values]) => [id, { ...values }],
            ),
          ),
        );
      }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    saveTeamRotationDraft({
      version: TEAM_ROTATION_STORAGE_VERSION,
      selectedBuildIds: buildIds,
      actorIds: buildIds.map(
        (id) => actorIdsByBuildId[id] ?? actorIdForBuild(id),
      ),
      startingActorId: starting,
      steps,
      initialResourcesByActorId: initialResources,
    });
  }, [
    buildIds,
    actorIdsByBuildId,
    starting,
    steps,
    initialResources,
    storageReady,
  ]);

  const staleBuildDiagnostics = buildIds
    .filter((id) => !box.builds.some((build) => build.id === id))
    .map((id) => `stale-build:${id}`);
  const selected = buildIds
    .map((id) => box.builds.find((build) => build.id === id))
    .filter((build): build is NonNullable<typeof build> => Boolean(build));
  const prepared = buildTeamActorInputs(
    selected,
    { resonators, weapons, sonatas, mainEchoes },
    initialResources,
    actorIdsByBuildId,
  );
  const expected = walkRotationActiveActors(starting, steps);
  const authoredActive = steps.reduce(
    (active, step) => (step.kind === "switch" ? step.toActorId : active),
    starting,
  );
  const activeActor = prepared.actors.find(
    (actor) => actor.actorId === authoredActive,
  );
  const actionOptions = activeActor
    ? deriveRotationActionOptions(activeActor.resonator, activeActor.build)
    : [];
  const actorLabels = Object.fromEntries(
    prepared.actors.map((actor) => [actor.actorId, actor.resonator.name]),
  );
  const canRun =
    prepared.actors.length > 0 && Boolean(starting) && steps.length > 0;

  function toggleBuild(id: string) {
    if (buildIds.includes(id)) {
      const remaining = buildIds.filter((item) => item !== id);
      setBuildIds(remaining);
      if (actorIdsByBuildId[id] === starting) {
        const firstRemaining = remaining[0];
        setStarting(
          firstRemaining
            ? actorIdsByBuildId[firstRemaining] ?? actorIdForBuild(firstRemaining)
            : "",
        );
        setSteps([]);
      }
      setResult(undefined);
      return;
    }
    if (buildIds.length >= 3) return;
    const actorId = actorIdsByBuildId[id] ?? actorIdForBuild(id);
    if (!actorIdsByBuildId[id]) {
      setActorIdsByBuildId((current) => ({ ...current, [id]: actorId }));
    }
    if (buildIds.length === 0 && !starting) setStarting(actorId);
    setBuildIds([...buildIds, id]);
    setResult(undefined);
  }

  function addAction(id: string) {
    if (!activeActor) return;
    setSteps((items) => [
      ...items,
      { kind: "action", actorId: activeActor.actorId, actionId: id },
    ]);
    setResult(undefined);
  }

  function move(index: number, delta: number) {
    setSteps((items) => {
      const next = [...items];
      const to = index + delta;
      if (to < 0 || to >= next.length) return items;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    setResult(undefined);
  }

  function run() {
    if (!canRun) return;
    setResult(
      validateTeamCycle({
        actors: prepared.actors,
        activeActorId: starting,
        target,
        steps,
      }),
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Theorycraft · équipe</p>
            <h1 className={styles.title}>DPS équipe</h1>
            <p className={styles.lead}>
              Composez votre équipe à partir de la Character Box, puis retrouvez
              directement le DPS de la rotation complète et la répartition des
              dégâts.
            </p>
          </div>
          <Link className={styles.heroLink} href="/character-box">
            Ouvrir Character Box
          </Link>
        </header>

        <section className={styles.section} aria-labelledby="team-composition-title">
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle} id="team-composition-title">
                Équipe
              </h2>
              <p className={styles.sectionDescription}>
                Sélectionnez jusqu’à trois builds enregistrés.
              </p>
            </div>
            <span className={styles.counter}>{buildIds.length}/3</span>
          </div>

          <div className={styles.slots}>
            {Array.from({ length: 3 }, (_, index) => {
              const build = selected[index];
              const resonator = build
                ? resonators.find((item) => item.id === build.resonatorId)
                : undefined;
              return (
                <div
                  className={styles.slot}
                  data-filled={Boolean(build)}
                  key={`team-slot-${index}`}
                >
                  <span className={styles.slotLabel}>P{index + 1}</span>
                  <span className={styles.slotName}>
                    {build ? resonator?.name ?? build.resonatorId : "Emplacement libre"}
                  </span>
                  <span className={styles.slotMeta}>
                    {build
                      ? `S${build.sequence} · niveau ${build.characterLevel}`
                      : "Choisissez un build ci-dessous"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.buildPicker}>
            {box.builds.map((build) => {
              const resonator = resonators.find(
                (item) => item.id === build.resonatorId,
              );
              const selectedIndex = buildIds.indexOf(build.id);
              const isSelected = selectedIndex >= 0;
              return (
                <button
                  className={styles.buildButton}
                  data-selected={isSelected}
                  disabled={!isSelected && buildIds.length >= 3}
                  key={build.id}
                  onClick={() => toggleBuild(build.id)}
                  type="button"
                >
                  <span className={styles.buildName}>
                    {resonator?.name ?? build.resonatorId}
                  </span>
                  <span className={styles.buildState}>
                    {isSelected ? `P${selectedIndex + 1} · sélectionné` : "Ajouter à l’équipe"}
                  </span>
                </button>
              );
            })}
            {box.builds.length === 0 && (
              <p className={styles.emptyBuilds}>
                Créez d’abord vos builds dans Character Box.
              </p>
            )}
          </div>

          <div className={styles.runRow}>
            <span className={styles.runHint}>
              {!steps.length && buildIds.length > 0
                ? "Pour cette première version, la rotation se configure dans Avancé."
                : `${steps.length} étape${steps.length > 1 ? "s" : ""} dans la rotation.`}
            </span>
            <button
              className={styles.primaryButton}
              disabled={!canRun}
              onClick={run}
              type="button"
            >
              Calculer le DPS équipe
            </button>
          </div>
        </section>

        {result ? (
          <ResultSummary
            actorLabels={actorLabels}
            preDiagnostics={[...staleBuildDiagnostics, ...prepared.diagnostics]}
            startingActorId={starting}
            steps={steps}
            validation={result}
          />
        ) : (
          <ResultPlaceholder />
        )}

        <details className={styles.advanced}>
          <summary className={styles.advancedSummary}>
            Avancé
            <span className={styles.advancedHint}>
              Rotation manuelle, ressources et détails du calcul
            </span>
          </summary>
          <div className={styles.advancedBody}>
            <section className={styles.advancedSection}>
              <h2 className={styles.advancedTitle}>Paramètres de rotation</h2>
              <p className={styles.advancedCopy}>
                Ces contrôles restent disponibles pendant que la rotation automatique
                issue du DPS personnel est raccordée au moteur Team.
              </p>

              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel} htmlFor="team-starting-actor">
                  Personnage de départ
                </label>
                <select
                  className={styles.select}
                  id="team-starting-actor"
                  onChange={(event) => {
                    setStarting(event.target.value);
                    setSteps([]);
                    setResult(undefined);
                  }}
                  value={starting}
                >
                  <option value="">Sélectionner</option>
                  {prepared.actors.map((actor) => (
                    <option key={actor.actorId} value={actor.actorId}>
                      {actor.resonator.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.resourcesGrid}>
                {prepared.actors.map((actor) => (
                  <div className={styles.resourceCard} key={actor.actorId}>
                    <h3 className={styles.resourceTitle}>
                      {actor.resonator.name} · ressources initiales
                    </h3>
                    {(actor.resonator.combat?.resources ?? []).map((resource) => (
                      <label className={styles.resourceLine} key={resource.id}>
                        <span>{resource.name}</span>
                        <input
                          className={styles.input}
                          max={resource.cap}
                          min="0"
                          onChange={(event) => {
                            setInitialResources((current) => ({
                              ...current,
                              [actor.actorId]: {
                                ...current[actor.actorId],
                                [resource.id]: Math.min(
                                  resource.cap,
                                  Math.max(0, Number(event.target.value)),
                                ),
                              },
                            }));
                            setResult(undefined);
                          }}
                          type="number"
                          value={initialResources[actor.actorId]?.[resource.id] ?? 0}
                        />
                        <span>/ {resource.cap}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.advancedSection}>
              <h2 className={styles.advancedTitle}>Rotation manuelle</h2>
              <p className={styles.advancedCopy}>
                La durée manuelle ne remplace pas les timings de hit, cancel ou frame.
              </p>

              <div className={styles.fieldRow}>
                <select className={styles.select} id="team-action">
                  {actionOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} · {option.timing === "verified" ? "timing vérifié" : "timing manquant"}
                    </option>
                  ))}
                </select>
                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    const element = document.getElementById(
                      "team-action",
                    ) as HTMLSelectElement | null;
                    if (element?.value) addAction(element.value);
                  }}
                  type="button"
                >
                  + Action
                </button>
                <select className={styles.select} id="team-switch">
                  {prepared.actors
                    .filter((actor) => actor.actorId !== authoredActive)
                    .map((actor) => (
                      <option key={actor.actorId} value={actor.actorId}>
                        {actor.resonator.name}
                      </option>
                    ))}
                </select>
                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    const element = document.getElementById(
                      "team-switch",
                    ) as HTMLSelectElement | null;
                    if (element?.value) {
                      setSteps((items) => [
                        ...items,
                        { kind: "switch", toActorId: element.value },
                      ]);
                      setResult(undefined);
                    }
                  }}
                  type="button"
                >
                  + Switch
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={() => {
                    setSteps((items) => [...items, { kind: "wait", seconds: 1 }]);
                    setResult(undefined);
                  }}
                  type="button"
                >
                  + Attente
                </button>
              </div>

              <ol className={styles.rotationList}>
                {steps.map((step, index) => (
                  <li className={styles.rotationItem} key={`${index}-${step.kind}`}>
                    <span className={styles.rotationIndex}>{index + 1}</span>
                    <span className={styles.rotationKind}>{step.kind}</span>
                    <span className={styles.rotationMeta}>
                      {step.kind === "action"
                        ? `${actorLabels[step.actorId] ?? step.actorId} · ${step.actionId}`
                        : step.kind === "switch"
                          ? `→ ${actorLabels[step.toActorId] ?? step.toActorId}`
                          : `${step.seconds}s`}
                      {expected[index]
                        ? ` · actif: ${actorLabels[expected[index]] ?? expected[index]}`
                        : ""}
                    </span>
                    <span className={styles.rotationActions}>
                      {step.kind === "action" && (
                        <input
                          aria-label="Durée manuelle"
                          className={styles.input}
                          min="0"
                          onChange={(event) => {
                            setSteps((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index && item.kind === "action"
                                  ? {
                                      ...item,
                                      durationOverrideSeconds:
                                        event.target.value === ""
                                          ? undefined
                                          : Number(event.target.value),
                                    }
                                  : item,
                              ),
                            );
                            setResult(undefined);
                          }}
                          placeholder="sec"
                          step="0.1"
                          type="number"
                          value={step.durationOverrideSeconds ?? ""}
                        />
                      )}
                      <button
                        aria-label="Monter"
                        className={styles.iconButton}
                        onClick={() => move(index, -1)}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        aria-label="Descendre"
                        className={styles.iconButton}
                        onClick={() => move(index, 1)}
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        className={styles.iconButton}
                        onClick={() => {
                          setSteps((items) =>
                            items.filter((_, itemIndex) => itemIndex !== index),
                          );
                          setResult(undefined);
                        }}
                        type="button"
                      >
                        Supprimer
                      </button>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            {result && (
              <AdvancedResult
                preDiagnostics={[...staleBuildDiagnostics, ...prepared.diagnostics]}
                validation={result}
              />
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

function ResultPlaceholder() {
  return (
    <section className={`${styles.resultPanel} ${styles.placeholder}`}>
      <div className={styles.placeholderInner}>
        <span className={styles.placeholderValue}>—</span>
        <h2 className={styles.placeholderTitle}>Résultat de l’équipe</h2>
        <p className={styles.placeholderCopy}>
          Le DPS, la durée de la rotation complète et la répartition des dégâts
          apparaîtront ici après le calcul.
        </p>
      </div>
    </section>
  );
}

function ResultSummary({
  validation,
  preDiagnostics,
  actorLabels,
  startingActorId,
  steps,
}: {
  validation: TeamCycleValidation;
  preDiagnostics: readonly string[];
  actorLabels: Readonly<Record<string, string>>;
  startingActorId: string;
  steps: readonly TeamRotationStep[];
}) {
  const { cycle1: result, dps } = validation;
  const invalid =
    preDiagnostics.length > 0 ||
    result.diagnostics.some((item) =>
      [
        "unknown-team-actor",
        "unknown-action",
        "inactive-actor-action",
        "invalid-switch-target",
        "action-resource-rejected",
      ].includes(item.code),
    );
  const authoritative = dps.available && !invalid;
  const order = rotationActorOrder(startingActorId, steps);
  const uniqueOrder = [...new Set(order)];
  const orderRank = new Map(uniqueOrder.map((actorId, index) => [actorId, index]));
  const distribution = Object.entries(dps.byActor).sort(
    ([left], [right]) =>
      (orderRank.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (orderRank.get(right) ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <section className={styles.resultPanel} aria-labelledby="team-result-title">
      <div className={styles.resultHeader}>
        <h2 className={styles.resultTitle} id="team-result-title">
          Résultat de l’équipe
        </h2>
        {!authoritative && (
          <span className={styles.unavailable}>Calcul non définitif</span>
        )}
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>DPS équipe</span>
          <span className={styles.dpsValue}>
            {authoritative ? formatNumber(dps.teamDps ?? 0) : "—"}
            {authoritative && <span className={styles.metricUnit}>DPS</span>}
          </span>
          {!authoritative && (
            <p className={styles.resultReason}>
              {invalid
                ? "La rotation contient encore une donnée invalide ou non résolue."
                : dps.reason ?? "Le calcul est encore partiel."}
            </p>
          )}
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Rotation complète</span>
          <span className={styles.durationValue}>
            {dps.durationSeconds !== undefined
              ? `${formatNumber(dps.durationSeconds, 2)} s`
              : "—"}
          </span>
          <div className={styles.rotationTrace} aria-label="Ordre de rotation">
            {order.map((actorId, index) => (
              <span key={`${actorId}-${index}`}>
                {index > 0 && <span className={styles.rotationArrow}>→ </span>}
                <span className={styles.rotationChip}>
                  {actorLabels[actorId] ?? actorId}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.distribution}>
        <h3 className={styles.distributionTitle}>
          Répartition des dégâts{authoritative ? "" : " · provisoire"}
        </h3>
        <div className={styles.distributionList}>
          {distribution.map(([actorId, value]) => (
            <div className={styles.distributionRow} key={actorId}>
              <span className={styles.actorName}>
                {actorLabels[actorId] ?? actorId}
              </span>
              <div className={styles.barTrack} aria-hidden="true">
                <div
                  className={styles.barFill}
                  style={{ width: `${Math.max(0, Math.min(100, value.contributionPercent))}%` }}
                />
              </div>
              <span className={styles.distributionValue}>
                {formatNumber(value.expectedDamage)} · {formatNumber(value.contributionPercent, 1)}%
              </span>
            </div>
          ))}
          {distribution.length === 0 && (
            <p className={styles.resultReason}>Aucun dégât résolu pour cette rotation.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function AdvancedResult({
  validation,
  preDiagnostics,
}: {
  validation: TeamCycleValidation;
  preDiagnostics: readonly string[];
}) {
  const { cycle1: result } = validation;
  return (
    <section className={`${styles.advancedSection}`}>
      <h2 className={styles.advancedTitle}>Détails du calcul</h2>
      <p className={styles.advancedCopy}>
        Cycle, ressources, diagnostics et événements restent accessibles ici sans
        encombrer le résultat principal.
      </p>
      <div className={styles.reportsGrid}>
        <Report
          title="Ressources finales"
          value={Object.values(result.actorsById).flatMap((actor) =>
            Object.entries(actor.resources).map(
              ([id, value]) =>
                `${actor.actorId} · ${id}: ${value.current}/${value.max}`,
            ),
          )}
        />
        <Report
          title="Statuts de cible"
          value={Object.entries(result.targetsById).flatMap(([targetId, state]) =>
            Object.values(state.statuses).map(
              (status) =>
                `${targetId} · ${status.definition.label} · owner ${status.sourceOwnerId}`,
            ),
          )}
        />
        <Report title="Cycle 2" value={validation.diagnostics} />
        <Report
          title="Diagnostics"
          value={[
            ...preDiagnostics,
            ...result.diagnostics.map((item) => `${item.code}: ${item.message}`),
          ]}
        />
        <Report
          wide
          title="Événements chronologiques"
          value={result.eventLog.map(
            (event) =>
              `${event.timestamp.toFixed(2)} · ${event.kind} · owner ${event.ownerId}${
                event.triggeringActorId ? ` · trigger ${event.triggeringActorId}` : ""
              }`,
          )}
        />
      </div>
    </section>
  );
}

function Report({
  title,
  value,
  wide = false,
}: {
  title: string;
  value: readonly string[];
  wide?: boolean;
}) {
  return (
    <div className={`${styles.report} ${wide ? styles.reportWide : ""}`}>
      <h3 className={styles.reportTitle}>{title}</h3>
      <ul className={styles.reportList}>
        {value.length ? (
          value.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)
        ) : (
          <li>Aucun</li>
        )}
      </ul>
    </div>
  );
}
