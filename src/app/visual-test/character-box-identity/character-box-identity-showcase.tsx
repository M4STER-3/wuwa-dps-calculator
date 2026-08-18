"use client";

import { useEffect, useMemo, useState } from "react";

import {
  findWuwaUiAssetPathV1,
  isWuwaUiAssetProjectionV1,
  type WuwaUiAssetProjectionV1,
} from "@/game-data/ui-asset-projection";
import { WuwaAssetMedia } from "@/components/ui/wuwa-asset-media";

import styles from "./character-box-identity.module.css";

type IdentityEntry = {
  id: string;
  assetId: string;
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

function heroPath(
  projection: WuwaUiAssetProjectionV1,
  assetId: string,
): string | undefined {
  return findWuwaUiAssetPathV1(
    projection,
    "characters",
    assetId,
    ["detail-roleportrait"],
  );
}

export function CharacterBoxIdentityShowcase({
  entries,
}: {
  entries: readonly IdentityEntry[];
}) {
  const [projection, setProjection] = useState<WuwaUiAssetProjectionV1 | null>(null);
  const [selectedId, setSelectedId] = useState(entries[0]?.id ?? "");
  const [assetError, setAssetError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjection() {
      try {
        const response = await fetch("/api/wuwa/ui-assets", {
          cache: "force-cache",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: unknown = await response.json();
        if (!isWuwaUiAssetProjectionV1(payload)) {
          throw new Error("projection d’assets rejetée");
        }
        if (!cancelled) setProjection(payload);
      } catch (error) {
        if (!cancelled) {
          setAssetError(error instanceof Error ? error.message : "erreur inconnue");
        }
      }
    }

    void loadProjection();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected =
    entries.find((entry) => entry.id === selectedId) ?? entries[0];
  const selectedHero = useMemo(
    () =>
      projection && selected
        ? heroPath(projection, selected.assetId)
        : undefined,
    [projection, selected],
  );

  return (
    <main className={`v4-theme ${styles.page}`}>
      <div className={styles.shell}>
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>V4 · Étape 8B</p>
            <h1>Identité Resonator dans Character Box</h1>
            <p>
              Validation du grand artwork, de la hiérarchie d’identité et du cadrage avant intégration dans l’éditeur réel.
            </p>
          </div>
          <span className={styles.status}>Artwork local sécurisé</span>
        </header>

        {selected ? (
          <section className={styles.identityPanel} data-element={selected.element}>
            <div className={styles.identityCopy}>
              <p className={styles.eyebrow}>Build identity</p>
              <h2>{selected.name}</h2>
              <p className={styles.meta}>
                {elementLabels[selected.element] ?? selected.element} · {selected.weaponType} · {selected.rarity}★
              </p>
              <div className={styles.identityFacts}>
                <span><small>ID Wuwa</small><strong>{selected.assetId}</strong></span>
                <span><small>Artwork</small><strong>detail-roleportrait</strong></span>
                <span><small>Usage</small><strong>Character Box hero</strong></span>
              </div>
              <p className={styles.note}>
                La taille finale sera liée au vrai panneau de build. Ici on valide surtout la source, le centrage et la présence visuelle.
              </p>
            </div>

            <div className={styles.heroStage}>
              <WuwaAssetMedia
                src={selectedHero}
                alt={`Artwork de ${selected.name}`}
                role="hero"
                sourceRole={selectedHero ? "detail-roleportrait" : undefined}
                fallbackLabel={`Artwork de ${selected.name} indisponible`}
                sizes="(max-width: 760px) 88vw, 520px"
              />
            </div>
          </section>
        ) : null}

        <section className={styles.rosterSection}>
          <div className={styles.rosterHeader}>
            <div>
              <p className={styles.eyebrow}>Identités promues</p>
              <h2>Changer de Resonator</h2>
            </div>
            <span>{entries.length} disponibles</span>
          </div>
          <div className={styles.rosterGrid}>
            {entries.map((entry) => {
              const active = entry.id === selected?.id;
              const portrait = projection
                ? findWuwaUiAssetPathV1(
                    projection,
                    "characters",
                    entry.assetId,
                    ["list-roleheadicon"],
                  )
                : undefined;

              return (
                <button
                  key={entry.id}
                  type="button"
                  className={styles.rosterCard}
                  data-active={active || undefined}
                  data-element={entry.element}
                  aria-pressed={active}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <WuwaAssetMedia
                    src={portrait}
                    alt={`Portrait de ${entry.name}`}
                    role="chip"
                    sourceRole={portrait ? "list-roleheadicon" : undefined}
                    fallbackLabel={`Portrait de ${entry.name} indisponible`}
                    sizes="64px"
                  />
                  <span>
                    <strong>{entry.name}</strong>
                    <small>{elementLabels[entry.element] ?? entry.element} · {entry.rarity}★</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {assetError ? (
          <p className={styles.errorNotice} role="status">
            Les assets n’ont pas pu être chargés : {assetError}.
          </p>
        ) : null}
      </div>
    </main>
  );
}
