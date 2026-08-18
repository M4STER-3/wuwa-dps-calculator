"use client";

import { useEffect, useMemo, useState } from "react";

import {
  findWuwaUiAssetPathV1,
  isWuwaUiAssetProjectionV1,
  type WuwaUiAssetProjectionV1,
} from "@/game-data/ui-asset-projection";

import {
  WUWA_RESONATOR_CARD_ROLES,
  WuwaAssetMedia,
} from "./wuwa-asset-media";
import styles from "./wuwa-resonator-selector.module.css";

export type ResonatorSelectorEntry = {
  id: string;
  name: string;
  element: string;
  weaponType: string;
  rarity: number;
};

const elementLabels: Record<string, string> = {
  aero: "Aero",
  glacio: "Glacio",
  electro: "Electro",
  fusion: "Fusion",
  havoc: "Havoc",
  spectro: "Spectro",
};

function sourceRoleFor(
  projection: WuwaUiAssetProjectionV1,
  id: string,
) {
  const entry = projection.entries.find(
    (candidate) => candidate.category === "characters" && candidate.id === id,
  );
  return WUWA_RESONATOR_CARD_ROLES.find((role) =>
    entry?.assets.some((asset) => asset.role === role),
  );
}

function portraitPathFor(
  projection: WuwaUiAssetProjectionV1,
  id: string,
) {
  return findWuwaUiAssetPathV1(
    projection,
    "characters",
    id,
    WUWA_RESONATOR_CARD_ROLES,
  );
}

export function WuwaResonatorSelector({
  entries,
  initialSelectedId,
}: {
  entries: readonly ResonatorSelectorEntry[];
  initialSelectedId?: string;
}) {
  const [projection, setProjection] = useState<WuwaUiAssetProjectionV1 | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [elementFilter, setElementFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState<"all" | "4" | "5">("all");
  const [selectedId, setSelectedId] = useState(
    initialSelectedId ?? entries[0]?.id ?? "",
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProjection() {
      try {
        const response = await fetch("/api/wuwa/ui-assets", { cache: "force-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: unknown = await response.json();
        if (!isWuwaUiAssetProjectionV1(payload)) {
          throw new Error("projection d’assets rejetée");
        }
        if (!cancelled) setProjection(payload);
      } catch (reason) {
        if (!cancelled) {
          setAssetError(reason instanceof Error ? reason.message : "erreur inconnue");
        }
      }
    }

    void loadProjection();
    return () => {
      cancelled = true;
    };
  }, []);

  const elements = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.element))).sort(),
    [entries],
  );

  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return entries.filter((entry) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        entry.name.toLocaleLowerCase("fr").includes(normalizedQuery) ||
        entry.id.toLocaleLowerCase("fr").includes(normalizedQuery);
      const matchesElement = elementFilter === "all" || entry.element === elementFilter;
      const matchesRarity = rarityFilter === "all" || entry.rarity === Number(rarityFilter);
      return matchesQuery && matchesElement && matchesRarity;
    });
  }, [entries, elementFilter, query, rarityFilter]);

  const selected =
    entries.find((entry) => entry.id === selectedId) ?? entries[0];
  const selectedSourceRole =
    projection && selected ? sourceRoleFor(projection, selected.id) : undefined;
  const selectedPortrait =
    projection && selected ? portraitPathFor(projection, selected.id) : undefined;

  return (
    <section className={styles.selector} aria-label="Sélecteur visuel de Resonator">
      {selected ? (
        <div className={styles.selectionRail} data-element={selected.element}>
          <div className={styles.selectionMedia}>
            <WuwaAssetMedia
              src={selectedPortrait}
              alt={`Portrait de ${selected.name}`}
              role="portrait"
              sourceRole={selectedSourceRole}
              fallbackLabel={`Portrait de ${selected.name} indisponible`}
              sizes="88px"
            />
          </div>
          <div className={styles.selectionCopy}>
            <span className={styles.selectionEyebrow}>Sélection active</span>
            <strong className={styles.selectionName}>{selected.name}</strong>
            <span className={styles.selectionMeta}>
              {elementLabels[selected.element] ?? selected.element} · {selected.weaponType} · {selected.rarity}★
            </span>
          </div>
          <div className={styles.selectionStatus} aria-hidden="true">
            <span className={styles.selectionPulse} />
            Prêt pour le build
          </div>
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span className={styles.fieldLabel}>Rechercher</span>
          <span className={styles.searchControl}>
            <span className={styles.searchIcon} aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom ou ID du Resonator"
              className={styles.searchInput}
              type="search"
            />
          </span>
        </label>

        <div className={styles.filterGroup} aria-label="Filtrer par rareté">
          <span className={styles.fieldLabel}>Rareté</span>
          <div className={styles.segmented}>
            {(["all", "5", "4"] as const).map((rarity) => (
              <button
                key={rarity}
                type="button"
                className={styles.segmentButton}
                aria-pressed={rarityFilter === rarity}
                onClick={() => setRarityFilter(rarity)}
              >
                {rarity === "all" ? "Toutes" : `${rarity}★`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.elementFilters} aria-label="Filtrer par élément">
        <button
          type="button"
          className={styles.elementButton}
          aria-pressed={elementFilter === "all"}
          onClick={() => setElementFilter("all")}
        >
          Tous
          <span>{entries.length}</span>
        </button>
        {elements.map((element) => {
          const count = entries.filter((entry) => entry.element === element).length;
          return (
            <button
              key={element}
              type="button"
              className={styles.elementButton}
              data-element={element}
              aria-pressed={elementFilter === element}
              onClick={() => setElementFilter(element)}
            >
              <i className={styles.elementDot} aria-hidden="true" />
              {elementLabels[element] ?? element}
              <span>{count}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.resultsBar}>
        <span><strong>{visibleEntries.length}</strong> Resonator{visibleEntries.length > 1 ? "s" : ""}</span>
        <span>Appuie sur un portrait pour le sélectionner</span>
      </div>

      {assetError ? (
        <div className={styles.assetNotice} role="status">
          Les données du sélecteur restent disponibles, mais les portraits locaux n’ont pas pu être chargés : {assetError}.
        </div>
      ) : null}

      {visibleEntries.length > 0 ? (
        <div className={styles.grid}>
          {visibleEntries.map((entry) => {
            const isSelected = entry.id === selected?.id;
            const sourceRole = projection ? sourceRoleFor(projection, entry.id) : undefined;
            const portraitPath = projection ? portraitPathFor(projection, entry.id) : undefined;

            return (
              <button
                key={entry.id}
                type="button"
                className={styles.card}
                data-element={entry.element}
                data-selected={isSelected || undefined}
                aria-pressed={isSelected}
                aria-label={`Sélectionner ${entry.name}, ${elementLabels[entry.element] ?? entry.element}, ${entry.rarity} étoiles`}
                onClick={() => setSelectedId(entry.id)}
              >
                <div className={styles.cardMedia}>
                  <WuwaAssetMedia
                    src={portraitPath}
                    alt={`Portrait de ${entry.name}`}
                    role="portrait"
                    sourceRole={sourceRole}
                    fallbackLabel={`Portrait de ${entry.name} indisponible`}
                    sizes="(max-width: 640px) 46vw, (max-width: 980px) 28vw, 190px"
                  />
                  <span className={styles.rarity}>{entry.rarity}★</span>
                  {isSelected ? (
                    <span className={styles.selectedMark} aria-hidden="true">✓</span>
                  ) : null}
                </div>
                <span className={styles.cardCopy}>
                  <span className={styles.cardName}>{entry.name}</span>
                  <span className={styles.cardMeta}>
                    <i className={styles.elementDot} aria-hidden="true" />
                    {elementLabels[entry.element] ?? entry.element}
                    <span aria-hidden="true">·</span>
                    {entry.weaponType}
                  </span>
                  <span className={styles.cardId}>ID {entry.id}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <strong>Aucun Resonator trouvé</strong>
          <span>Modifie la recherche ou les filtres pour afficher d’autres personnages.</span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setElementFilter("all");
              setRarityFilter("all");
            }}
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </section>
  );
}
