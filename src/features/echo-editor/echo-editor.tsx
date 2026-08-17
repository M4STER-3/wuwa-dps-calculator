"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { resonators } from "@/data/catalog";
import { emptyCharacterBox } from "@/domain/character-box";
import type { UserBuild } from "@/domain/models";
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
import {
  createBrowserCharacterBoxStorage,
  getBrowserCharacterBoxSnapshot,
  subscribeToBrowserCharacterBox,
} from "@/storage/character-box-storage";
import {
  clearBuildEchoLoadout,
  draftSlotsFromLoadout,
  emptyEchoDraftSlot,
  emptyEchoDraftSlots,
  loadoutFromDraftSlots,
  replaceBuildEchoLoadout,
  type DraftEchoSlot,
  type DraftSubstat,
} from "./echo-editor-state";

type LoadState = "loading" | "ready" | "error";
type SaveState = "idle" | "saved" | "error";

const SLOT_LABELS = ["Main Echo", "Echo 2", "Echo 3", "Echo 4", "Echo 5"] as const;
const ELEMENT_LABELS: Record<string, string> = {
  aero: "Aero",
  glacio: "Glacio",
  electro: "Electro",
  fusion: "Fusion",
  havoc: "Havoc",
  spectro: "Spectro",
};
const serverBox = emptyCharacterBox();

function isProjection(value: unknown): value is EchoCatalogProjectionV1 {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === 1 && Array.isArray(record.echoes) && Array.isArray(record.sonataSets);
}

function statLabel(target: EchoStatTarget): string {
  if (target === "hp") return "PV";
  if (target === "attack") return "ATK";
  if (target === "defense") return "DEF";
  if (target === "critRate") return "Taux CRIT";
  if (target === "critDamage") return "DGT CRIT";
  if (target === "energyRegen") return "Régén. d’énergie";
  if (target === "healingBonus") return "Bonus de soins";
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
    ? `${statLabel(definition.stat)} — valeur indisponible`
    : `${statLabel(definition.stat)} ${formatValue(definition.application, value)}`;
}

function substatLabel(definition: EchoStatRollDefinition): string {
  return statLabel(definition.stat);
}

function echoById(
  catalog: EchoCatalogProjectionV1 | null,
  id: string,
): EchoCatalogItemV1 | undefined {
  return catalog?.echoes.find((echo) => echo.id === id);
}

function buildLabel(build: UserBuild): string {
  return resonators.find((resonator) => resonator.id === build.resonatorId)?.name ?? build.resonatorId;
}

export function EchoEditor() {
  const box = useSyncExternalStore(
    subscribeToBrowserCharacterBox,
    getBrowserCharacterBoxSnapshot,
    () => serverBox,
  );
  const [catalog, setCatalog] = useState<EchoCatalogProjectionV1 | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [slots, setSlots] = useState<DraftEchoSlot[]>(() => emptyEchoDraftSlots());
  const [activeSlot, setActiveSlot] = useState(0);
  const [selectedBuildId, setSelectedBuildId] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const initialBuildResolved = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      try {
        const response = await fetch("/api/wuwa/echo-catalog", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`catalog request failed with ${response.status}`);
        const payload: unknown = await response.json();
        if (!isProjection(payload)) throw new Error("catalog response has an invalid shape");
        setCatalog(payload);
        setLoadState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error(
          "Unable to load Echo catalog",
          error instanceof Error ? error.message : "unknown error",
        );
        setLoadState("error");
      }
    }

    void loadCatalog();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (initialBuildResolved.current) return;
    initialBuildResolved.current = true;
    const currentBox = getBrowserCharacterBoxSnapshot();
    const requestedId = new URLSearchParams(window.location.search).get("build") ?? "";
    const requestedBuild = currentBox.builds.find((build) => build.id === requestedId);
    if (!requestedBuild) return;
    setSelectedBuildId(requestedBuild.id);
    setSlots(draftSlotsFromLoadout(requestedBuild.echoLoadout));
  }, []);

  useEffect(() => {
    if (!selectedBuildId) return;
    if (box.builds.some((build) => build.id === selectedBuildId)) return;
    setSelectedBuildId("");
    setSlots(emptyEchoDraftSlots());
    setActiveSlot(0);
    setSaveState("idle");
    setSaveMessage("");
    updateBuildQuery("");
  }, [box.builds, selectedBuildId]);

  const sortedEchoes = useMemo(
    () =>
      catalog
        ? [...catalog.echoes].sort((left, right) => left.name.localeCompare(right.name, "fr"))
        : [],
    [catalog],
  );
  const sonataNames = useMemo(
    () => new Map(catalog?.sonataSets.map((set) => [set.id, set.name]) ?? []),
    [catalog],
  );
  const selectedEchoes = slots.map((slot) => echoById(catalog, slot.echoId));
  const totalCost = selectedEchoes.reduce((sum, echo) => sum + (echo?.cost ?? 0), 0);
  const selectedCount = selectedEchoes.filter(Boolean).length;
  const activeDraft = slots[activeSlot]!;
  const activeEcho = selectedEchoes[activeSlot];
  const selectedBuild = box.builds.find((build) => build.id === selectedBuildId);

  const sonataCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const slot of slots) {
      if (!slot.sonataSetId) continue;
      counts.set(slot.sonataSetId, (counts.get(slot.sonataSetId) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]);
  }, [slots]);

  const selectionsComplete =
    selectedCount > 0 &&
    slots.every(
      (slot) =>
        !slot.echoId ||
        (slot.sonataSetId.length > 0 &&
          slot.primaryMainStatId.length > 0 &&
          slot.substats.every((substat) => substat.statId.length > 0 && substat.value.length > 0)),
    );

  const canSave = Boolean(selectedBuildId && catalog && selectionsComplete && totalCost <= 12);

  function updateBuildQuery(buildId: string) {
    const url = new URL(window.location.href);
    if (buildId) url.searchParams.set("build", buildId);
    else url.searchParams.delete("build");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function chooseBuild(buildId: string) {
    setSelectedBuildId(buildId);
    setActiveSlot(0);
    setSaveState("idle");
    setSaveMessage("");
    updateBuildQuery(buildId);
    if (!buildId) {
      setSlots(emptyEchoDraftSlots());
      return;
    }
    const build = getBrowserCharacterBoxSnapshot().builds.find((candidate) => candidate.id === buildId);
    setSlots(draftSlotsFromLoadout(build?.echoLoadout));
  }

  function markDraftChanged() {
    setSaveState("idle");
    setSaveMessage("");
  }

  function updateSlot(index: number, update: (slot: DraftEchoSlot) => DraftEchoSlot) {
    markDraftChanged();
    setSlots((current) => current.map((slot, slotIndex) => (slotIndex === index ? update(slot) : slot)));
  }

  function selectEcho(index: number, id: string) {
    updateSlot(index, () => (id ? { ...emptyEchoDraftSlot(), echoId: id } : emptyEchoDraftSlot()));
    setActiveSlot(index);
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
      substats: slot.substats.map((substat, subIndex) => (subIndex === index ? next : substat)),
    }));
  }

  function removeSubstat(index: number) {
    updateSlot(activeSlot, (slot) => ({
      ...slot,
      substats: slot.substats.filter((_, subIndex) => subIndex !== index),
    }));
  }

  function saveLoadout() {
    if (!catalog || !selectedBuildId || !canSave) return;
    try {
      const loadout = loadoutFromDraftSlots(slots);
      const resolved = resolveEchoLoadoutV1(catalog, loadout);
      const currentBox = getBrowserCharacterBoxSnapshot();
      const nextBox = replaceBuildEchoLoadout(
        currentBox,
        selectedBuildId,
        loadout,
        new Date().toISOString(),
      );
      createBrowserCharacterBoxStorage().save(nextBox);
      setSaveState("saved");
      setSaveMessage(`Validé par le resolver · coût ${resolved.totalCost}/12 · sauvegardé dans la Character Box.`);
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Le loadout a été refusé.");
    }
  }

  function clearSavedLoadout() {
    if (!selectedBuildId || !selectedBuild?.echoLoadout) return;
    if (!window.confirm("Effacer uniquement le loadout Echo détaillé de ce build ? Les finalStats resteront inchangées.")) {
      return;
    }
    try {
      const currentBox = getBrowserCharacterBoxSnapshot();
      const nextBox = clearBuildEchoLoadout(
        currentBox,
        selectedBuildId,
        new Date().toISOString(),
      );
      createBrowserCharacterBoxStorage().save(nextBox);
      setSlots(emptyEchoDraftSlots());
      setActiveSlot(0);
      setSaveState("saved");
      setSaveMessage("Loadout Echo détaillé supprimé. finalStats n’a pas été modifié.");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Impossible d’effacer le loadout.");
    }
  }

  return (
    <main className="mx-auto max-w-[1800px] px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
      <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Echo Loadout · V1</p>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-100">
              Catalogue réel
            </span>
            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-100">
              Character Box
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Échos</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Configurez jusqu’à cinq Échos puis sauvegardez le loadout détaillé sur un build de votre Character Box. La sauvegarde passe par le resolver exact et ne recalcule jamais <code>finalStats</code>.
          </p>
        </div>
        <Link
          href="/character-box"
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white no-underline hover:border-[var(--accent-strong)]"
        >
          Retour à la Character Box
        </Link>
      </header>

      <section className="mb-5 rounded-2xl border border-white/10 bg-[#11151d]/85 p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="grid gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">
            Build Character Box
            <select
              value={selectedBuildId}
              onChange={(event) => chooseBuild(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#090c12] px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white"
            >
              <option value="">Choisir un build…</option>
              {box.builds.map((build) => (
                <option key={build.id} value={build.id}>
                  {buildLabel(build)} · niv. {build.characterLevel}{build.echoLoadout ? " · loadout Echo enregistré" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm text-[var(--muted)] lg:max-w-md">
            {box.builds.length === 0 ? (
              <span>Votre Character Box est vide. Ajoutez d’abord un Resonator.</span>
            ) : selectedBuild ? (
              <span>
                Édition de <strong className="text-white">{buildLabel(selectedBuild)}</strong>. Seul <code>echoLoadout</code> sera modifié ici.
              </span>
            ) : (
              <span>Sélectionnez le build qui recevra ce loadout.</span>
            )}
          </div>
        </div>
      </section>

      {loadState === "loading" ? (
        <section className="rounded-2xl border border-white/10 bg-[#11151d]/85 p-8 text-sm text-[var(--muted)]">
          Chargement du catalogue léger des Échos…
        </section>
      ) : loadState === "error" || !catalog ? (
        <section className="rounded-2xl border border-red-400/20 bg-red-400/5 p-8">
          <h2 className="font-bold text-red-100">Catalogue indisponible</h2>
          <p className="mt-2 text-sm leading-6 text-red-50/70">
            L’éditeur refuse de proposer des données non validées. Rechargez la page lorsque le catalogue promu est disponible.
          </p>
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.6fr)]">
          <section className="rounded-2xl border border-white/10 bg-[#11151d]/85 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Loadout</p>
                <h2 className="mt-1 text-xl font-bold text-white">5 emplacements · {catalog.echoes.length} Échos</h2>
              </div>
              <span className={`rounded-lg border px-3 py-2 text-xs font-bold ${totalCost <= 12 ? "border-white/10 bg-black/20 text-[var(--muted)]" : "border-red-400/30 bg-red-400/10 text-red-100"}`}>
                Coût actuel : {totalCost} / 12 max
              </span>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
              {slots.map((slot, index) => {
                const selected = selectedEchoes[index];
                const mainStats = selected
                  ? reviewedEchoStatTableV1.primaryMainStatsByCost[selected.cost]
                  : [];
                const fixedSecondary = selected
                  ? reviewedEchoStatTableV1.fixedSecondaryMainStatByCost[selected.cost]
                  : undefined;
                const fixedValue = fixedSecondary ? exactLevel25(fixedSecondary) : undefined;

                return (
                  <article
                    key={SLOT_LABELS[index]}
                    onClick={() => setActiveSlot(index)}
                    className={`rounded-2xl border p-4 transition ${activeSlot === index ? "border-[var(--accent-strong)]/70 bg-[var(--accent)]/7" : "border-white/10 bg-black/15 hover:border-white/20"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[var(--accent)]">0{index + 1}</span>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-[var(--muted)]">
                        {selected ? `Coût ${selected.cost}` : "Coût —"}
                      </span>
                    </div>
                    <div className="mt-4 grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20 text-xl text-[var(--muted)]">✦</div>
                    <h3 className="mt-4 font-bold text-white">{SLOT_LABELS[index]}</h3>
                    <p className="mt-1 min-h-5 truncate text-xs text-[var(--muted)]">
                      {selected?.name ?? (slot.echoId ? "Echo enregistré absent du catalogue courant" : index === 0 ? "Slot Echo Skill principal" : "Emplacement libre")}
                    </p>

                    <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Echo
                      <select
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#090c12] px-2.5 py-2 text-xs normal-case tracking-normal text-white"
                        value={selected ? slot.echoId : ""}
                        onChange={(event) => selectEcho(index, event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <option value="">Aucun</option>
                        {sortedEchoes.map((echo) => {
                          const usedElsewhere = slots.some(
                            (candidate, candidateIndex) => candidateIndex !== index && candidate.echoId === echo.id,
                          );
                          const currentCost = selected?.cost ?? 0;
                          const exceedsCost = totalCost - currentCost + echo.cost > 12;
                          return (
                            <option key={echo.id} value={echo.id} disabled={usedElsewhere || exceedsCost}>
                              {echo.name} · C{echo.cost}
                            </option>
                          );
                        })}
                      </select>
                    </label>

                    {selected ? (
                      <>
                        <label className="mt-3 block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          Sonata
                          <select
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#090c12] px-2.5 py-2 text-xs normal-case tracking-normal text-white"
                            value={slot.sonataSetId}
                            onChange={(event) => updateSlot(index, (current) => ({ ...current, sonataSetId: event.target.value }))}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <option value="">Choisir…</option>
                            {selected.sonataSetIds.map((id) => (
                              <option key={id} value={id}>{sonataNames.get(id) ?? id}</option>
                            ))}
                          </select>
                        </label>

                        <label className="mt-3 block text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          Main stat
                          <select
                            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#090c12] px-2.5 py-2 text-xs normal-case tracking-normal text-white"
                            value={slot.primaryMainStatId}
                            onChange={(event) => updateSlot(index, (current) => ({ ...current, primaryMainStatId: event.target.value }))}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <option value="">Choisir…</option>
                            {mainStats.map((definition) => (
                              <option key={definition.id} value={definition.id}>{mainStatLabel(definition)}</option>
                            ))}
                          </select>
                        </label>

                        <div className="mt-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-[var(--muted)]">
                          Secondaire fixe : {fixedSecondary && fixedValue !== undefined ? `${statLabel(fixedSecondary.stat)} ${formatValue(fixedSecondary.application, fixedValue)}` : "—"}
                        </div>
                      </>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="grid content-start gap-5">
            <section className="rounded-2xl border border-white/10 bg-[#11151d]/85 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Slot actif</p>
                  <h2 className="mt-2 text-lg font-bold text-white">{SLOT_LABELS[activeSlot]}</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">{activeEcho?.name ?? "Aucun Echo sélectionné"}</p>
                </div>
                {activeEcho ? <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-white">C{activeEcho.cost}</span> : null}
              </div>

              {activeEcho ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-white">Substats exactes</h3>
                    <button
                      type="button"
                      onClick={addSubstat}
                      disabled={activeDraft.substats.length >= 5}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                    >
                      + Ajouter
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                    Maximum 5. Chaque valeur proposée correspond à un roll 5★ revu ; aucun nombre libre n’est accepté.
                  </p>

                  <div className="mt-4 grid gap-3">
                    {activeDraft.substats.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-[var(--muted)]">Aucune substat renseignée.</div>
                    ) : activeDraft.substats.map((substat, subIndex) => {
                      const definition = reviewedEchoStatTableV1.substatRolls.find((candidate) => candidate.statId === substat.statId);
                      const usedIds = new Set(activeDraft.substats.map((candidate, candidateIndex) => candidateIndex === subIndex ? "" : candidate.statId));
                      return (
                        <div key={subIndex} className="grid grid-cols-[1fr_100px_auto] gap-2">
                          <select
                            aria-label={`Substat ${subIndex + 1}`}
                            className="min-w-0 rounded-lg border border-white/10 bg-[#090c12] px-2 py-2 text-xs text-white"
                            value={substat.statId}
                            onChange={(event) => updateSubstat(subIndex, { statId: event.target.value, value: "" })}
                          >
                            <option value="">Stat…</option>
                            {reviewedEchoStatTableV1.substatRolls.map((candidate) => (
                              <option key={candidate.statId} value={candidate.statId} disabled={usedIds.has(candidate.statId)}>{substatLabel(candidate)}</option>
                            ))}
                          </select>
                          <select
                            aria-label={`Valeur substat ${subIndex + 1}`}
                            className="rounded-lg border border-white/10 bg-[#090c12] px-2 py-2 text-xs text-white"
                            value={substat.value}
                            disabled={!definition}
                            onChange={(event) => updateSubstat(subIndex, { ...substat, value: event.target.value })}
                          >
                            <option value="">Roll…</option>
                            {definition?.values.map((value) => (
                              <option key={value} value={String(value)}>{formatValue(definition.application, value)}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            aria-label={`Supprimer substat ${subIndex + 1}`}
                            onClick={() => removeSubstat(subIndex)}
                            className="rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-[var(--muted)] hover:text-white"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-dashed border-white/10 p-5 text-center text-xs leading-5 text-[var(--muted)]">
                  Sélectionnez un Echo dans ce slot pour configurer ses substats.
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#11151d]/85 p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Résumé</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-xs text-[var(--muted)]">Échos</span><strong className="mt-1 block text-xl text-white">{selectedCount} / 5</strong></div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-xs text-[var(--muted)]">Coût</span><strong className="mt-1 block text-xl text-white">{totalCost} / 12</strong></div>
              </div>
              <div className="mt-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Main Echo</span>
                <p className="mt-1 text-sm font-bold text-white">{selectedEchoes[0]?.name ?? "Non défini"}</p>
              </div>

              <div className="mt-5 border-t border-white/10 pt-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Pièces Sonata sélectionnées</span>
                {sonataCounts.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sonataCounts.map(([id, count]) => (
                      <span key={id} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-white">{sonataNames.get(id) ?? id} · {count}</span>
                    ))}
                  </div>
                ) : <p className="mt-2 text-xs text-[var(--muted)]">Aucune Sonata choisie.</p>}
              </div>
            </section>

            <section className={`rounded-2xl border p-5 ${canSave ? "border-emerald-400/20 bg-emerald-400/5" : "border-amber-400/20 bg-amber-400/5"}`}>
              <h2 className={`font-bold ${canSave ? "text-emerald-100" : "text-amber-100"}`}>
                {canSave ? "Prêt à sauvegarder" : "Configuration incomplète"}
              </h2>
              <p className={`mt-2 text-sm leading-6 ${canSave ? "text-emerald-50/75" : "text-amber-50/75"}`}>
                {!selectedBuildId
                  ? "Choisissez d’abord un build de la Character Box."
                  : selectionsComplete
                    ? "La sauvegarde sera revalidée par resolveEchoLoadoutV1 avant toute écriture locale. finalStats restera inchangé."
                    : "Choisissez une Sonata et une main stat pour chaque Echo équipé. Les substats ajoutées doivent aussi avoir un roll exact."}
              </p>
              <button
                type="button"
                onClick={saveLoadout}
                disabled={!canSave}
                className="mt-4 w-full rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-bold text-emerald-50 disabled:border-white/10 disabled:bg-black/20 disabled:text-white/35"
              >
                Valider et enregistrer dans la Character Box
              </button>
              {selectedBuild?.echoLoadout ? (
                <button
                  type="button"
                  onClick={clearSavedLoadout}
                  className="mt-2 w-full rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-2.5 text-xs font-bold text-red-100"
                >
                  Effacer le loadout Echo enregistré
                </button>
              ) : null}
              {saveMessage ? (
                <p className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-5 ${saveState === "error" ? "border-red-400/20 bg-red-400/5 text-red-100" : "border-emerald-400/20 bg-emerald-400/5 text-emerald-100"}`}>
                  {saveMessage}
                </p>
              ) : null}
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}
