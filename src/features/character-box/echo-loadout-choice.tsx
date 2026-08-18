"use client";

import { useEffect, useMemo, useState } from "react";

import { WuwaAssetMedia } from "@/components/ui/wuwa-asset-media";
import type { UserEchoLoadoutV1 } from "@/domain/user-echo-loadout";
import type {
  EchoCatalogItemV1,
  EchoCatalogProjectionV1,
} from "@/game-data/echo-catalog-projection";
import { resolveEchoLoadoutV1 } from "@/game-data/echo-loadout";
import { reviewedEchoStatTableV1 } from "@/game-data/echo-stats-v1";
import type {
  EchoMainStatDefinition,
  EchoStatApplication,
  EchoStatRollDefinition,
  EchoStatTarget,
} from "@/game-data/schema";
import { getEchoUiAssetPath } from "@/game-data/echo-ui-assets";
import {
  isWuwaUiAssetProjectionV1,
  type WuwaUiAssetProjectionV1,
} from "@/game-data/ui-asset-projection";
import {
  draftSlotsFromLoadout,
  emptyEchoDraftSlot,
  loadoutFromDraftSlots,
  type DraftEchoSlot,
  type DraftSubstat,
} from "@/features/echo-editor/echo-editor-state";

import styles from "./echo-loadout-choice.module.css";

type LoadState = "loading" | "ready" | "error";
type CostFilter = "all" | 1 | 3 | 4;

type EchoLoadoutChoiceProps = {
  value?: UserEchoLoadoutV1;
  onChange: (loadout: UserEchoLoadoutV1 | undefined) => void;
};

const SLOT_LABELS = ["Main Echo", "Echo 2", "Echo 3", "Echo 4", "Echo 5"] as const;
const COSTS = [4, 3, 1] as const;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const SAFE_ID = /^[a-z0-9:-]{1,200}$/;

const ELEMENT_LABELS: Record<string, string> = {
  aero: "Aero",
  glacio: "Glacio",
  electro: "Electro",
  fusion: "Fusion",
  havoc: "Havoc",
  spectro: "Spectro",
};

function isSafeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SAFE_ID.test(value) &&
    !CONTROL_CHARACTERS.test(value) &&
    value !== "__proto__" &&
    value !== "constructor" &&
    value !== "prototype"
  );
}

function isSafeName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 300 &&
    value.trim().length > 0 &&
    !CONTROL_CHARACTERS.test(value)
  );
}

function isEchoCatalogProjection(value: unknown): value is EchoCatalogProjectionV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || !Array.isArray(record.echoes) || !Array.isArray(record.sonataSets)) {
    return false;
  }
  if (record.echoes.length > 1_000 || record.sonataSets.length > 1_000) return false;

  const sonataIds = new Set<string>();
  for (const raw of record.sonataSets) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
    const set = raw as Record<string, unknown>;
    if (!isSafeId(set.id) || !isSafeName(set.name) || sonataIds.has(set.id)) return false;
    sonataIds.add(set.id);
  }

  const echoIds = new Set<string>();
  for (const raw of record.echoes) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
    const echo = raw as Record<string, unknown>;
    if (
      !isSafeId(echo.id) ||
      !isSafeName(echo.name) ||
      (echo.cost !== 1 && echo.cost !== 3 && echo.cost !== 4) ||
      !Array.isArray(echo.sonataSetIds) ||
      echo.sonataSetIds.length === 0 ||
      echo.sonataSetIds.length > 16 ||
      echoIds.has(echo.id)
    ) {
      return false;
    }
    const localSonatas = new Set<string>();
    for (const id of echo.sonataSetIds) {
      if (!isSafeId(id) || !sonataIds.has(id) || localSonatas.has(id)) return false;
      localSonatas.add(id);
    }
    echoIds.add(echo.id);
  }
  return true;
}

function statLabel(target: EchoStatTarget): string {
  if (target === "hp") return "PV";
  if (target === "attack") return "ATK";
  if (target === "defense") return "DEF";
  if (target === "critRate") return "Taux CRIT";
  if (target === "critDamage") return "DGT CRIT";
  if (target === "energyRegen") return "Régén. énergie";
  if (target === "healingBonus") return "Bonus soins";
  if (target.startsWith("elementalDamageBonus:")) {
    const element = target.slice("elementalDamageBonus:".length);
    return `DGT ${ELEMENT_LABELS[element] ?? element}`;
  }
  if (target === "damageTypeBonus:basicAttack") return "DGT Attaque normale";
  if (target === "damageTypeBonus:heavyAttack") return "DGT Attaque lourde";
  if (target === "damageTypeBonus:resonanceSkill") return "DGT Compétence Résonance";
  return "DGT Libération Résonance";
}

function formatValue(application: EchoStatApplication, value: number): string {
  return application === "flat" ? `+${value}` : `+${value}%`;
}

function exactLevel25(definition: EchoMainStatDefinition): number | undefined {
  const points = definition.progression.points.filter((point) => point.level === 25);
  return points.length === 1 ? points[0]!.value : undefined;
}

function mainStatLabel(definition: EchoMainStatDefinition): string {
  const value = exactLevel25(definition);
  return value === undefined
    ? `${statLabel(definition.stat)} · valeur indisponible`
    : `${statLabel(definition.stat)} ${formatValue(definition.application, value)}`;
}

function substatLabel(definition: EchoStatRollDefinition): string {
  return statLabel(definition.stat);
}

function EchoIcon({
  echo,
  projection,
  compact = false,
}: {
  echo?: EchoCatalogItemV1;
  projection: WuwaUiAssetProjectionV1 | null;
  compact?: boolean;
}) {
  const path = echo && projection ? getEchoUiAssetPath(projection, echo.id) : undefined;
  return (
    <WuwaAssetMedia
      src={path}
      alt={echo ? `Icône de ${echo.name}` : "Emplacement Echo vide"}
      role="echo"
      sourceRole={path ? "detail-icon/list-icon" : undefined}
      fallbackLabel={echo ? "Image indisponible" : "Echo libre"}
      className={compact ? styles.compactMedia : styles.catalogueMedia}
      sizes={compact ? "58px" : "72px"}
    />
  );
}

export function EchoLoadoutChoice(props: EchoLoadoutChoiceProps) {
  const persistedKey = JSON.stringify(props.value ?? null);
  return <EchoLoadoutWorkspace key={persistedKey} {...props} />;
}

function EchoLoadoutWorkspace({ value, onChange }: EchoLoadoutChoiceProps) {
  const [catalog, setCatalog] = useState<EchoCatalogProjectionV1 | null>(null);
  const [assetProjection, setAssetProjection] = useState<WuwaUiAssetProjectionV1 | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [expanded, setExpanded] = useState(false);
  const [slots, setSlots] = useState<DraftEchoSlot[]>(() => draftSlotsFromLoadout(value));
  const [activeSlot, setActiveSlot] = useState(0);
  const [query, setQuery] = useState("");
  const [costFilter, setCostFilter] = useState<CostFilter>("all");
  const [sonataFilter, setSonataFilter] = useState("all");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "success" | "error">("neutral");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [catalogResponse, assetResponse] = await Promise.all([
          fetch("/api/wuwa/echo-catalog", {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          }),
          fetch("/api/wuwa/ui-assets", {
            signal: controller.signal,
            headers: { Accept: "application/json" },
            cache: "force-cache",
          }),
        ]);
        if (!catalogResponse.ok || !assetResponse.ok) {
          throw new Error(`HTTP ${catalogResponse.status}/${assetResponse.status}`);
        }
        const [catalogPayload, assetPayload]: [unknown, unknown] = await Promise.all([
          catalogResponse.json(),
          assetResponse.json(),
        ]);
        if (!isEchoCatalogProjection(catalogPayload)) {
          throw new Error("catalogue Echo rejeté par le validateur runtime");
        }
        if (!isWuwaUiAssetProjectionV1(assetPayload)) {
          throw new Error("projection d’assets rejetée par le validateur runtime");
        }
        if (controller.signal.aborted) return;
        setCatalog(catalogPayload);
        setAssetProjection(assetPayload);
        setLoadState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(
          "Unable to load Character Box Echo data",
          error instanceof Error ? error.message : "unknown error",
        );
        setLoadState("error");
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const echoById = useMemo(
    () => new Map(catalog?.echoes.map((echo) => [echo.id, echo]) ?? []),
    [catalog],
  );
  const sonataNames = useMemo(
    () => new Map(catalog?.sonataSets.map((set) => [set.id, set.name]) ?? []),
    [catalog],
  );
  const selectedEchoes = slots.map((slot) => echoById.get(slot.echoId));
  const selectedCount = selectedEchoes.filter(Boolean).length;
  const totalCost = selectedEchoes.reduce((sum, echo) => sum + (echo?.cost ?? 0), 0);
  const activeDraft = slots[activeSlot]!;
  const activeEcho = selectedEchoes[activeSlot];

  const sonataCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slot of slots) {
      if (!slot.sonataSetId) continue;
      counts.set(slot.sonataSetId, (counts.get(slot.sonataSetId) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [slots]);

  const visibleEchoes = useMemo(() => {
    if (!catalog) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return [...catalog.echoes]
      .filter((echo) => {
        const matchesQuery =
          !normalizedQuery ||
          echo.name.toLocaleLowerCase("fr").includes(normalizedQuery) ||
          echo.id.toLocaleLowerCase("fr").includes(normalizedQuery);
        const matchesCost = costFilter === "all" || echo.cost === costFilter;
        const matchesSonata =
          sonataFilter === "all" || echo.sonataSetIds.includes(sonataFilter);
        return matchesQuery && matchesCost && matchesSonata;
      })
      .sort((left, right) => {
        if (left.cost !== right.cost) return right.cost - left.cost;
        return left.name.localeCompare(right.name, "fr");
      });
  }, [catalog, costFilter, query, sonataFilter]);

  function markChanged() {
    setStatus("Modifications non enregistrées");
    setStatusTone("neutral");
  }

  function updateSlot(index: number, update: (slot: DraftEchoSlot) => DraftEchoSlot) {
    markChanged();
    setSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? update(slot) : slot)),
    );
  }

  function chooseEcho(echo: EchoCatalogItemV1) {
    const defaultSonata = echo.sonataSetIds.length === 1 ? echo.sonataSetIds[0]! : "";
    updateSlot(activeSlot, () => ({
      ...emptyEchoDraftSlot(),
      echoId: echo.id,
      sonataSetId: defaultSonata,
    }));
  }

  function clearActiveSlot() {
    updateSlot(activeSlot, () => emptyEchoDraftSlot());
  }

  function addSubstat() {
    if (!activeEcho || activeDraft.substats.length >= 5) return;
    updateSlot(activeSlot, (slot) => ({
      ...slot,
      substats: [...slot.substats, { statId: "", value: "" }],
    }));
  }

  function updateSubstat(index: number, next: DraftSubstat) {
    updateSlot(activeSlot, (slot) => ({
      ...slot,
      substats: slot.substats.map((substat, subIndex) =>
        subIndex === index ? next : substat,
      ),
    }));
  }

  function removeSubstat(index: number) {
    updateSlot(activeSlot, (slot) => ({
      ...slot,
      substats: slot.substats.filter((_, subIndex) => subIndex !== index),
    }));
  }

  function saveLoadout() {
    if (!catalog) return;
    try {
      const loadout = loadoutFromDraftSlots(slots);
      const resolved = resolveEchoLoadoutV1(catalog, loadout);
      onChange(loadout);
      setStatus(`Loadout validé · coût ${resolved.totalCost}/12 · ${loadout.echoes.length}/5 Echoes`);
      setStatusTone("success");
      setExpanded(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Le loadout Echo a été refusé.");
      setStatusTone("error");
    }
  }

  function clearLoadout() {
    if (!value && selectedCount === 0) return;
    if (!window.confirm("Effacer le loadout Echo détaillé de ce personnage ?")) return;
    setSlots(draftSlotsFromLoadout(undefined));
    setActiveSlot(0);
    onChange(undefined);
    setStatus("Loadout Echo effacé");
    setStatusTone("success");
  }

  const mainStatDefinitions = activeEcho
    ? reviewedEchoStatTableV1.primaryMainStatsByCost[activeEcho.cost]
    : [];
  const fixedSecondary = activeEcho
    ? reviewedEchoStatTableV1.fixedSecondaryMainStatByCost[activeEcho.cost]
    : undefined;
  const fixedSecondaryValue = fixedSecondary ? exactLevel25(fixedSecondary) : undefined;

  return (
    <div className={styles.root}>
      <div className={styles.summaryTop}>
        <div>
          <span className={styles.eyebrow}>Echo Loadout · 5★ niv. 25</span>
          <strong className={styles.summaryTitle}>
            {selectedCount ? `${selectedCount}/5 Echoes configurés` : "Aucun Echo configuré"}
          </strong>
          <span className={styles.summaryMeta}>Coût {totalCost}/12 · le slot 1 devient le Main Echo</span>
        </div>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? "Fermer" : selectedCount ? "Modifier" : "Configurer les Echoes"}
        </button>
      </div>

      <div className={styles.slotStrip} aria-label="Loadout Echo">
        {slots.map((slot, index) => {
          const echo = selectedEchoes[index];
          return (
            <button
              key={SLOT_LABELS[index]}
              type="button"
              className={styles.slotCard}
              data-active={expanded && activeSlot === index ? "true" : undefined}
              onClick={() => {
                setActiveSlot(index);
                setExpanded(true);
              }}
              aria-label={`${SLOT_LABELS[index]}${echo ? ` : ${echo.name}` : " : libre"}`}
            >
              <EchoIcon echo={echo} projection={assetProjection} compact />
              <span className={styles.slotCopy}>
                <span>{index === 0 ? "MAIN" : `0${index + 1}`}</span>
                <strong>{echo?.name ?? "Libre"}</strong>
                <small>{echo ? `C${echo.cost}` : "—"}</small>
              </span>
            </button>
          );
        })}
      </div>

      {status ? (
        <div className={styles.status} data-tone={statusTone} aria-live="polite">
          {status}
        </div>
      ) : null}

      {expanded ? (
        <div className={styles.expanded}>
          {loadState === "loading" ? (
            <div className={styles.stateBox}>Chargement du catalogue sécurisé des Echoes…</div>
          ) : loadState === "error" || !catalog || !assetProjection ? (
            <div className={styles.stateBox} data-error="true" role="alert">
              Catalogue ou projection d’assets indisponible. Aucun Echo non validé n’est proposé.
            </div>
          ) : (
            <>
              <div className={styles.workspaceHeader}>
                <div>
                  <span className={styles.eyebrow}>Slot actif</span>
                  <strong>{SLOT_LABELS[activeSlot]}</strong>
                  <span>{activeEcho?.name ?? "Choisissez un Echo dans le catalogue"}</span>
                </div>
                <div className={styles.headerBadges}>
                  <span data-danger={totalCost > 12 || undefined}>Coût {totalCost}/12</span>
                  <span>{catalog.echoes.length} Echoes</span>
                </div>
              </div>

              <div className={styles.workspace}>
                <div className={styles.cataloguePane}>
                  <div className={styles.toolbar}>
                    <label className={styles.searchField}>
                      <span className={styles.srOnly}>Rechercher un Echo</span>
                      <span aria-hidden="true">⌕</span>
                      <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Rechercher un Echo ou un ID…"
                        autoComplete="off"
                      />
                    </label>
                    <select
                      aria-label="Filtrer les Echoes par Sonata"
                      value={sonataFilter}
                      onChange={(event) => setSonataFilter(event.target.value)}
                      className={styles.filterSelect}
                    >
                      <option value="all">Tous les Sonata</option>
                      {catalog.sonataSets.map((set) => (
                        <option key={set.id} value={set.id}>{set.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.costFilters} aria-label="Filtrer par coût">
                    <button
                      type="button"
                      data-active={costFilter === "all" || undefined}
                      onClick={() => setCostFilter("all")}
                    >
                      Tous
                    </button>
                    {COSTS.map((cost) => (
                      <button
                        key={cost}
                        type="button"
                        data-active={costFilter === cost || undefined}
                        onClick={() => setCostFilter(cost)}
                      >
                        C{cost}
                      </button>
                    ))}
                    <span className={styles.resultCount} aria-live="polite">
                      {visibleEchoes.length} résultat{visibleEchoes.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className={styles.catalogueScroll}>
                    <div className={styles.catalogueGrid} role="listbox" aria-label="Catalogue Echo">
                      {visibleEchoes.map((echo) => {
                        const usedElsewhere = slots.some(
                          (slot, index) => index !== activeSlot && slot.echoId === echo.id,
                        );
                        const currentCost = activeEcho?.cost ?? 0;
                        const exceedsCost = totalCost - currentCost + echo.cost > 12;
                        const disabled = usedElsewhere || exceedsCost;
                        return (
                          <button
                            key={echo.id}
                            type="button"
                            role="option"
                            aria-selected={activeDraft.echoId === echo.id}
                            disabled={disabled}
                            className={styles.echoCard}
                            data-selected={activeDraft.echoId === echo.id || undefined}
                            onClick={() => chooseEcho(echo)}
                            title={
                              usedElsewhere
                                ? "Cet Echo est déjà équipé dans un autre slot"
                                : exceedsCost
                                  ? "Ce choix dépasserait le coût total de 12"
                                  : echo.name
                            }
                          >
                            <EchoIcon echo={echo} projection={assetProjection} />
                            <span className={styles.echoCardCopy}>
                              <strong>{echo.name}</strong>
                              <span>C{echo.cost} · {echo.sonataSetIds.length} Sonata</span>
                            </span>
                            {activeDraft.echoId === echo.id ? (
                              <span className={styles.selectedMark} aria-hidden="true">✓</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <aside className={styles.configPane}>
                  {activeEcho ? (
                    <>
                      <div className={styles.activeIdentity}>
                        <EchoIcon echo={activeEcho} projection={assetProjection} />
                        <div>
                          <span className={styles.eyebrow}>{SLOT_LABELS[activeSlot]}</span>
                          <strong>{activeEcho.name}</strong>
                          <span>C{activeEcho.cost} · 5★ · niv. 25</span>
                        </div>
                        <button type="button" onClick={clearActiveSlot}>Retirer</button>
                      </div>

                      <label className={styles.configField}>
                        <span>Sonata</span>
                        <select
                          value={activeDraft.sonataSetId}
                          onChange={(event) =>
                            updateSlot(activeSlot, (slot) => ({ ...slot, sonataSetId: event.target.value }))
                          }
                        >
                          <option value="">Choisir…</option>
                          {activeEcho.sonataSetIds.map((id) => (
                            <option key={id} value={id}>{sonataNames.get(id) ?? id}</option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.configField}>
                        <span>Main stat</span>
                        <select
                          value={activeDraft.primaryMainStatId}
                          onChange={(event) =>
                            updateSlot(activeSlot, (slot) => ({
                              ...slot,
                              primaryMainStatId: event.target.value,
                            }))
                          }
                        >
                          <option value="">Choisir…</option>
                          {mainStatDefinitions.map((definition) => (
                            <option key={definition.id} value={definition.id}>
                              {mainStatLabel(definition)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className={styles.fixedStat}>
                        <span>Secondaire fixe</span>
                        <strong>
                          {fixedSecondary && fixedSecondaryValue !== undefined
                            ? `${statLabel(fixedSecondary.stat)} ${formatValue(
                                fixedSecondary.application,
                                fixedSecondaryValue,
                              )}`
                            : "—"}
                        </strong>
                      </div>

                      <div className={styles.substatHeader}>
                        <div>
                          <strong>Substats exactes</strong>
                          <span>{activeDraft.substats.length}/5</span>
                        </div>
                        <button
                          type="button"
                          onClick={addSubstat}
                          disabled={activeDraft.substats.length >= 5}
                        >
                          + Ajouter
                        </button>
                      </div>

                      <div className={styles.substatList}>
                        {activeDraft.substats.length === 0 ? (
                          <div className={styles.emptySubstats}>Aucune substat renseignée.</div>
                        ) : (
                          activeDraft.substats.map((substat, subIndex) => {
                            const definition = reviewedEchoStatTableV1.substatRolls.find(
                              (candidate) => candidate.statId === substat.statId,
                            );
                            const usedIds = new Set(
                              activeDraft.substats.map((candidate, candidateIndex) =>
                                candidateIndex === subIndex ? "" : candidate.statId,
                              ),
                            );
                            return (
                              <div key={subIndex} className={styles.substatRow}>
                                <select
                                  aria-label={`Substat ${subIndex + 1}`}
                                  value={substat.statId}
                                  onChange={(event) =>
                                    updateSubstat(subIndex, {
                                      statId: event.target.value,
                                      value: "",
                                    })
                                  }
                                >
                                  <option value="">Stat…</option>
                                  {reviewedEchoStatTableV1.substatRolls.map((candidate) => (
                                    <option
                                      key={candidate.statId}
                                      value={candidate.statId}
                                      disabled={usedIds.has(candidate.statId)}
                                    >
                                      {substatLabel(candidate)}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  aria-label={`Valeur substat ${subIndex + 1}`}
                                  value={substat.value}
                                  disabled={!definition}
                                  onChange={(event) =>
                                    updateSubstat(subIndex, {
                                      ...substat,
                                      value: event.target.value,
                                    })
                                  }
                                >
                                  <option value="">Roll…</option>
                                  {definition?.values.map((value) => (
                                    <option key={value} value={String(value)}>
                                      {formatValue(definition.application, value)}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => removeSubstat(subIndex)}
                                  aria-label={`Supprimer la substat ${subIndex + 1}`}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  ) : (
                    <div className={styles.emptyConfig}>
                      <strong>{SLOT_LABELS[activeSlot]}</strong>
                      <span>Sélectionnez un Echo dans le catalogue pour configurer ce slot.</span>
                    </div>
                  )}
                </aside>
              </div>

              <div className={styles.sonataBar}>
                <div>
                  <span className={styles.eyebrow}>Sonata détectés</span>
                  <div className={styles.sonataChips}>
                    {sonataCounts.length ? (
                      sonataCounts.map(([id, count]) => (
                        <span key={id}>{sonataNames.get(id) ?? id} · {count}p</span>
                      ))
                    ) : (
                      <span>Aucun set sélectionné</span>
                    )}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button type="button" className={styles.clearButton} onClick={clearLoadout}>
                    Effacer
                  </button>
                  <button type="button" className={styles.saveButton} onClick={saveLoadout}>
                    Valider le loadout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
