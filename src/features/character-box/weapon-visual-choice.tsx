"use client";

import Image from "next/image";
import type { Weapon } from "@/domain/models";
import { getWeaponUiIconPath } from "@/game-data/weapon-ui-asset-ids";

import styles from "./weapon-visual-choice.module.css";

export function WeaponVisualChoice({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly Weapon[];
  onChange: (weaponId: string) => void;
}) {
  if (options.length === 0) {
    return <span className={styles.empty}>Aucune arme compatible configurée</span>;
  }

  return (
    <div className={styles.grid} role="radiogroup" aria-label="Arme compatible">
      {options.map((weapon) => {
        const selected = weapon.id === value;
        const iconPath = getWeaponUiIconPath(weapon.id);
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
            <span className={styles.media}>
              {iconPath ? (
                <Image
                  src={iconPath}
                  alt=""
                  fill
                  sizes="92px"
                  unoptimized
                  className={styles.image}
                />
              ) : (
                <span className={styles.fallback}>WU</span>
              )}
            </span>
            <span className={styles.copy}>
              <strong>{weapon.name}</strong>
              <span>
                {weapon.type} · {weapon.rarity}★
              </span>
            </span>
            <span className={styles.check} aria-hidden="true">
              {selected ? "✓" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
