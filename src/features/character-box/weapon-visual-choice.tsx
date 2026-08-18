"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Weapon } from "@/domain/models";
import { getWeaponUiIconPath } from "@/game-data/weapon-ui-asset-ids";

import styles from "./weapon-visual-choice.module.css";

type RarityFilter = number | "all";

function WeaponIcon({ weapon, size }: { weapon: Weapon; size: "summary" | "card" }) {
  const iconPath = getWeaponUiIconPath(weapon.id);
  return (
    <span className={styles.media} data-size={size}>
      {iconPath ? (
        <Image
          src={iconPath}
          alt=""
          fill
          sizes={size === "summary" ? "88px" : "68px"}
          unoptimized
          className={styles.image}
        />
      ) : (
        <span className={styles.fallback}>WU</span>
      )}
    </span>
  );
}

export function WeaponVisualChoice({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly Weapon[];
  onChange: (weaponId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");

  const rarities = useMemo(
    () => [...new Set(options.map((weapon) => weapon.rarity))].sort((a, b) => b - a),
    [options],
  );
  const activeRarity =
    rarityFilter === "all" || rarities.includes(rarityFilter) ? rarityFilter : "all";
  const selectedWeapon = options.find((weapon) => weapon.id === value);
  const normalizedQuery = query.trim().toLocaleLowerCase("fr");
  const visibleWeapons = useMemo(
    () =>
      options
        .filter((weapon) => {
          const matchesQuery =
            normalizedQuery.length === 0 ||
            weapon.name.toLocaleLowerCase("fr").includes(normalizedQuery) ||
            weapon.id.toLocaleLowerCase("fr").includes(normalizedQuery);
          const matchesRarity = activeRarity === "all" || weapon.rarity === activeRarity;
          return matchesQuery && matchesRarity;
        })
        .sort((left, right) => {
          if (left.id === value) return -1;
          if (right.id === value) return 1;
          if (left.rarity !== right.rarity) return right.rarity - left.rarity;
          return left.name.localeCompare(right.name, "fr");
        }),
    [activeRarity, normalizedQuery, options, value],
  );

  if (options.length === 0) {
    return <span className={styles.empty}>Aucune arme compatible configurée</span>;
  }

  return (
    <div className={styles.selector}>
      {selectedWeapon ? (
        <div className={styles.selectedSummary} aria-label={`Arme équipée : ${selectedWeapon.name}`}>
          <WeaponIcon weapon={selectedWeapon} size="summary" />
          <div className={styles.selectedCopy}>
            <span className={styles.eyebrow}>Arme équipée</span>
            <strong>{selectedWeapon.name}</strong>
            <span>
              {selectedWeapon.type} · {selectedWeapon.rarity}★
            </span>
          </div>
          <span className={styles.equippedBadge}>Équipée</span>
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span className={styles.srOnly}>Rechercher une arme</span>
          <span className={styles.searchIcon} aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une arme ou un ID…"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              className={styles.clearSearch}
              onClick={() => setQuery("")}
              aria-label="Effacer la recherche"
            >
              ×
            </button>
          ) : null}
        </label>

        <div className={styles.rarityFilters} aria-label="Filtrer par rareté">
          <button
            type="button"
            data-active={activeRarity === "all" || undefined}
            aria-pressed={activeRarity === "all"}
            onClick={() => setRarityFilter("all")}
          >
            Toutes
          </button>
          {rarities.map((rarity) => (
            <button
              key={rarity}
              type="button"
              data-active={activeRarity === rarity || undefined}
              aria-pressed={activeRarity === rarity}
              onClick={() => setRarityFilter(rarity)}
            >
              {rarity}★
            </button>
          ))}
        </div>
      </div>

      <div className={styles.resultBar} aria-live="polite">
        <span>
          <strong>{visibleWeapons.length}</strong> arme{visibleWeapons.length > 1 ? "s" : ""}
        </span>
        <span>Seulement les armes compatibles avec ce Resonator</span>
      </div>

      {visibleWeapons.length ? (
        <div className={styles.scrollArea}>
          <div className={styles.grid} role="radiogroup" aria-label="Arme compatible">
            {visibleWeapons.map((weapon) => {
              const selected = weapon.id === value;
              return (
                <button
                  key={weapon.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Sélectionner ${weapon.name}`}
                  data-selected={selected || undefined}
                  className={styles.card}
                  onClick={() => onChange(weapon.id)}
                >
                  <WeaponIcon weapon={weapon} size="card" />
                  <span className={styles.copy}>
                    <strong>{weapon.name}</strong>
                    <span>
                      {weapon.rarity}★ · ID {weapon.id}
                    </span>
                  </span>
                  <span className={styles.check} aria-hidden="true">
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.noResults}>
          <strong>Aucune arme trouvée</strong>
          <span>Modifie la recherche ou la rareté pour élargir les résultats.</span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setRarityFilter("all");
            }}
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}
    </div>
  );
}
