"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  const effectiveSelectedBuildId = selectedBuild ? selectedBuildId : "";

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

  const canSave = Boolean(selectedBuild && catalog && selectionsComplete && totalCost <= 12);

  function chooseBuild(buildId: string) {
    setSelectedBuildId(buildId);
    setActiveSlot(0);
    setSaveState("idle");
    setSaveMessage("");
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
    if (!catalog || !selectedBuild || !canSave) return;
    try {
      const loadout = loadoutFromDraftSlots(slots);
      const resolved = resolveEchoLoadoutV1(catalog, loadout);
      const currentBox = getBrowserCharacterBoxSnapshot();
      const nextBox = replaceBuildEchoLoadout(
        currentBox,
        selectedBuild.id,
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
    if (!selectedBuild?.echoLoadout) return;
    if (!window.confirm("Effacer uniquement le loadout Echo détaillé de ce build ? Les finalStats resteront inchangées.")) {
      return;
    }
    try {
      const currentBox = getBrowserCharacterBoxSnapshot();
      const nextBox = clearBuildEchoLoadout(
        currentBox,
        selectedBuild.id,
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,rgba(91,247,235,.06),transparent_34%)] px-4 py-7 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1760px]">
        <header className="mb-6 border-b border-cyan-300/10 pb-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-200/70">Wuwa DPS Calculator</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">Echo Loadout</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Configurez jusqu’à cinq Échos avec les valeurs 5★ revues, puis enregistrez le loadout détaillé sur votre build. La validation passe par le resolver exact et ne recalcule jamais <code>finalStats</code>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">178 Échos réels</span>
              <span className="rounded-md border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">Resolver exact</span>
              <Link
                href="/character-box"
                className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-200 no-underline transition hover:border-cyan-300/30 hover:text-cyan-100"
              >
                Character Box
              </Link>
            </div>
          </div>
        </header>

        <section className="mb-4 border border-white/[0.07] bg-[#0a0e14]/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,.28)]">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="grid gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Build Character Box
              <select
                value={effectiveSelectedBuildId}
                onChange={(event) => chooseBuild(event.target.value)}
                className="rounded-md border border-white/10 bg-[#05080d] px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-white outline-none transition focus:border-cyan-300/40"
              >
                <option value="">Choisir un build…</option>
                {box.builds.map((build) => (
                  <option key={build.id} value={build.id}>
                    {buildLabel(build)} · niv. {build.characterLevel}{build.echoLoadout ? " · Echo loadout enregistré" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-xs leading-5 text-slate-500 lg:max-w-md">
              {box.builds.length === 0 ? (
                <span>Votre Character Box est vide. Ajoutez d’abord un Resonator.</span>
              ) : selectedBuild ? (
                <span>
                  Édition de <strong className="text-slate-200">{buildLabel(selectedBuild)}</strong>. Seul <code>echoLoadout</code> est modifié ici.
                </span>
              ) : (
                <span>Sélectionnez le build qui recevra ce loadout.</span>
              )}
            </div>
          </div>
        </section>

        {loadState === "loading" ? (
          <section className="border border-white/[0.07] bg-[#0a0e14]/90 p-8 text-sm text-slate-500">
            Chargement du catalogue léger des Échos…
          </section>
        ) : loadState === "error" || !catalog ? (
          <section className="border border-red-400/20 bg-red-400/5 p-8">
            <h2 className="font-bold text-red-100">Catalogue indisponible</h2>
            <p className="mt-2 text-sm leading-6 text-red-50/70">
              L’éditeur refuse de proposer des données non validées. Rechargez la page lorsque le catalogue promu est disponible.
            </p>
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,.55fr)]">
            <section className="border border-white/[0.07] bg-[#0a0e14]/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,.28)] sm:p-5">
              <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/60">Loadout</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-100">5 emplacements · {catalog.echoes.length} Échos</h2>
                </div>
                <span className={`rounded-md border px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${totalCost <= 12 ? "border-white/10 bg-black/20 text-slate-400" : "border-red-400/30 bg-red-400/10 text-red-100"}`}>
                  Coût {totalCost} / 12
                </span>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2 2xl:grid-cols-5">
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
                      className={`group border p-3 transition ${activeSlot === index ? "border-cyan-300/45 bg-cyan-300/[0.045] shadow-[inset_0_1px_0_rgba(120,255,245,.06)]" : "border-white/[0.07] bg-[#070a0f] hover:border-white/15"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black tracking-[0.18em] text-cyan-200/65">0{index + 1}</span>
                        <span className="rounded border border-white/[0.07] bg-black/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          {selected ? `C${selected.cost}` : "—"}
                        </span>
                      </div>
                      <div className="mt-3 grid h-12 w-12 place-items-center border border-cyan-200/10 bg-cyan-200/[0.025] text-lg text-cyan-100/35">✦</div>
                      <h3 className="mt-3 text-sm font-bold text-slate-100">{SLOT_LABELS[index]}</h3>
                      <p className="mt-1 min-h-8 text-[10px] leading-4 text-slate-500">
                        {selected?.name ?? (slot.echoId ? "Echo enregistré absent du catalogue courant" : index === 0 ? "Echo Skill principal" : "Emplacement libre")}
                      </p>

                      <label className="mt-3 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                        Echo
                        <select
                          className="mt-1.5 w-full rounded-sm border border-white/[0.07] bg-[#04070b] px-2 py-2 text-[11px] normal-case tracking-normal text-slate-200 outline-none focus:border-cyan-300/35"
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
                          <label className="mt-2.5 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                            Sonata
                            <select
                              className="mt-1.5 w-full rounded-sm border border-white/[0.07] bg-[#04070b] px-2 py-2 text-[11px] normal-case tracking-normal text-slate-200 outline-none focus:border-cyan-300/35"
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

                          <label className="mt-2.5 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                            Main stat
                            <select
                              className="mt-1.5 w-full rounded-sm border border-white/[0.07] bg-[#04070b] px-2 py-2 text-[11px] normal-case tracking-normal text-slate-200 outline-none focus:border-cyan-300/35"
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

                          <div className="mt-2.5 border border-white/[0.055] bg-black/20 px-2 py-1.5 text-[9px] leading-4 text-slate-600">
                            Secondaire fixe : {fixedSecondary && fixedValue !== undefined ? `${statLabel(fixedSecondary.stat)} ${formatValue(fixedSecondary.application, fixedValue)}` : "—"}
                          </div>
                        </>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="grid content-start gap-4">
              <section className="border border-white/[0.07] bg-[#0a0e14]/90 p-4 shadow-[0_24px_80px_rgba(0,0,0,.22)]">
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/60">Slot actif</p>
                    <h2 className="mt-1.5 text-base font-bold text-slate-100">{SLOT_LABELS[activeSlot]}</h2>
                    <p className="mt-1 text-[11px] text-slate-500">{activeEcho?.name ?? "Aucun Echo sélectionné"}</p>
                  </div>
                  {activeEcho ? <span className="rounded border border-cyan-200/15 bg-cyan-200/[0.03] px-2 py-1 text-[10px] font-black text-cyan-100/80">C{activeEcho.cost}</span> : null}
                </div>

                {activeEcho ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">Substats exactes</h3>
                      <button
                        type="button"
                        onClick={addSubstat}
                        disabled={activeDraft.substats.length >= 5}
                        className="rounded-sm border border-cyan-200/15 bg-cyan-200/[0.03] px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-100/80 transition hover:bg-cyan-200/[0.06] disabled:opacity-35"
                      >
                        + Ajouter
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-slate-600">
                      Maximum 5. Chaque valeur proposée correspond à un roll 5★ revu ; aucun nombre libre n’est accepté.
                    </p>

                    <div className="mt-3 grid gap-2">
                      {activeDraft.substats.length === 0 ? (
                        <div className="border border-dashed border-white/[0.08] p-4 text-center text-[10px] text-slate-600">Aucune substat renseignée.</div>
                      ) : activeDraft.substats.map((substat, subIndex) => {
                        const definition = reviewedEchoStatTableV1.substatRolls.find((candidate) => candidate.statId === substat.statId);
                        const usedIds = new Set(activeDraft.substats.map((candidate, candidateIndex) => candidateIndex === subIndex ? "" : candidate.statId));
                        return (
                          <div key={subIndex} className="grid grid-cols-[1fr_94px_auto] gap-1.5">
                            <select
                              aria-label={`Substat ${subIndex + 1}`}
                              className="min-w-0 rounded-sm border border-white/[0.07] bg-[#04070b] px-2 py-2 text-[10px] text-slate-200 outline-none focus:border-cyan-300/35"
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
                              className="rounded-sm border border-white/[0.07] bg-[#04070b] px-2 py-2 text-[10px] text-slate-200 outline-none focus:border-cyan-300/35"
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
                              className="rounded-sm border border-white/[0.07] bg-white/[0.02] px-2 text-xs text-slate-600 transition hover:border-red-300/20 hover:text-red-200"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 border border-dashed border-white/[0.08] p-5 text-center text-[10px] leading-5 text-slate-600">
                    Sélectionnez un Echo dans ce slot pour configurer ses substats.
                  </div>
                )}
              </section>

              <section className="border border-white/[0.07] bg-[#0a0e14]/90 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/60">Résumé</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="border border-white/[0.06] bg-black/20 p-3"><span className="text-[9px] uppercase tracking-wider text-slate-600">Échos</span><strong className="mt-1 block text-lg text-slate-100">{selectedCount} / 5</strong></div>
                  <div className="border border-white/[0.06] bg-black/20 p-3"><span className="text-[9px] uppercase tracking-wider text-slate-600">Coût</span><strong className="mt-1 block text-lg text-slate-100">{totalCost} / 12</strong></div>
                </div>
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">Main Echo</span>
                  <p className="mt-1 text-xs font-bold text-slate-200">{selectedEchoes[0]?.name ?? "Non défini"}</p>
                </div>
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">Sonata</span>
                  {sonataCounts.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {sonataCounts.map(([id, count]) => (
                        <span key={id} className="rounded-sm border border-white/[0.07] bg-black/20 px-2 py-1 text-[9px] text-slate-400">{sonataNames.get(id) ?? id} · {count}</span>
                      ))}
                    </div>
                  ) : <p className="mt-1.5 text-[10px] text-slate-600">Aucune Sonata choisie.</p>}
                </div>
              </section>

              <section className={`border p-4 ${canSave ? "border-cyan-300/18 bg-cyan-300/[0.025]" : "border-white/[0.07] bg-[#0a0e14]/90"}`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className={`text-xs font-black uppercase tracking-[0.14em] ${canSave ? "text-cyan-100" : "text-slate-400"}`}>
                    {canSave ? "Prêt à enregistrer" : "Configuration incomplète"}
                  </h2>
                  <span className={`h-1.5 w-1.5 rounded-full ${canSave ? "bg-cyan-200 shadow-[0_0_12px_rgba(120,255,245,.7)]" : "bg-slate-700"}`} />
                </div>
                <p className="mt-2 text-[10px] leading-5 text-slate-600">
                  {!selectedBuild
                    ? "Choisissez d’abord un build de la Character Box."
                    : selectionsComplete
                      ? "Le loadout sera revalidé par resolveEchoLoadoutV1 avant l’écriture locale. finalStats restera inchangé."
                      : "Choisissez une Sonata et une main stat pour chaque Echo équipé. Les substats ajoutées doivent aussi avoir un roll exact."}
                </p>
                <button
                  type="button"
                  onClick={saveLoadout}
                  disabled={!canSave}
                  className="mt-3 w-full rounded-sm border border-cyan-200/20 bg-cyan-200/[0.06] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-50 transition hover:bg-cyan-200/[0.1] disabled:border-white/[0.06] disabled:bg-black/20 disabled:text-slate-700"
                >
                  Valider & enregistrer
                </button>
                {selectedBuild?.echoLoadout ? (
                  <button
                    type="button"
                    onClick={clearSavedLoadout}
                    className="mt-2 w-full rounded-sm border border-red-300/10 bg-red-300/[0.02] px-4 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-red-200/65 transition hover:border-red-300/20 hover:text-red-100"
                  >
                    Effacer le loadout enregistré
                  </button>
                ) : null}
                {saveMessage ? (
                  <p className={`mt-3 border px-3 py-2 text-[10px] leading-4 ${saveState === "error" ? "border-red-400/20 bg-red-400/5 text-red-100" : "border-cyan-300/15 bg-cyan-300/[0.025] text-cyan-100"}`}>
                    {saveMessage}
                  </p>
                ) : null}
              </section>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
