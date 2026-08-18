"use client";

import { useMemo, useState } from "react";
import { weapons } from "@/data/catalog";
import { WeaponVisualChoice } from "@/features/character-box/weapon-visual-choice";

import styles from "./weapon-selector-preview.module.css";

const promotedWeapons = weapons.filter(
  (weapon) => weapon.source.kind !== "technical-fixture",
);

export default function WeaponSelectorPreview() {
  const [weaponId, setWeaponId] = useState(promotedWeapons[0]?.id ?? "");
  const [level, setLevel] = useState(90);
  const [rank, setRank] = useState(1);
  const selected = useMemo(
    () => promotedWeapons.find((weapon) => weapon.id === weaponId),
    [weaponId],
  );

  return (
    <main className={`v4-theme ${styles.page}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>V4 · Étape 9A</p>
          <h1>Armes visuelles</h1>
          <p>
            Checkpoint du sélecteur réutilisable. Les images viennent uniquement
            des objets Wuwa locaux vérifiés par ID stable.
          </p>
        </header>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span>Arme équipée</span>
              <h2>{selected?.name ?? "Aucune arme"}</h2>
            </div>
            <strong>{selected ? `${selected.rarity}★ · ${selected.type}` : "—"}</strong>
          </div>

          <WeaponVisualChoice
            value={weaponId}
            options={promotedWeapons}
            onChange={setWeaponId}
          />

          <div className={styles.controls}>
            <label>
              <span>Niveau</span>
              <input
                type="number"
                min={1}
                max={90}
                value={level}
                onChange={(event) =>
                  setLevel(Math.min(90, Math.max(1, Number(event.target.value) || 1)))
                }
              />
            </label>
            <label>
              <span>Rang</span>
              <select value={rank} onChange={(event) => setRank(Number(event.target.value))}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>R{value}</option>
                ))}
              </select>
            </label>
            <div className={styles.snapshot}>
              <span>Configuration test</span>
              <strong>Niv. {level} · R{rank}</strong>
            </div>
          </div>
        </section>

        <p className={styles.note}>
          Ce checkpoint ne modifie aucune statistique permanente : il valide
          uniquement l’identité, l’image, la sélection, le niveau et le rang de l’arme.
        </p>
      </div>
    </main>
  );
}
