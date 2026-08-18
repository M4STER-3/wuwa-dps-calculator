"use client";

import { useEffect, useMemo, useState } from "react";

import {
  findWuwaUiAssetPathV1,
  isWuwaUiAssetProjectionV1,
  type WuwaUiAssetProjectionV1,
} from "@/game-data/ui-asset-projection";
import {
  WUWA_RESONATOR_CARD_ROLES,
  WUWA_RESONATOR_HERO_ROLES,
  WuwaAssetMedia,
} from "@/components/ui/wuwa-asset-media";

import styles from "./character-box-structure.module.css";

export type CharacterBoxStructureResonator = {
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

function sourceRoleFor(
  projection: WuwaUiAssetProjectionV1,
  assetId: string,
  roles: readonly string[],
) {
  const entry = projection.entries.find(
    (candidate) => candidate.category === "characters" && candidate.id === assetId,
  );
  return roles.find((role) => entry?.assets.some((asset) => asset.role === role));
}

function pathFor(
  projection: WuwaUiAssetProjectionV1,
  assetId: string,
  roles: readonly string[],
) {
  return findWuwaUiAssetPathV1(
    projection,
    "characters",
    assetId,
    roles,
  );
}

export function CharacterBoxStructurePreview({
  entries,
}: {
  entries: readonly CharacterBoxStructureResonator[];
}) {
  const [projection, setProjection] = useState<WuwaUiAssetProjectionV1 | null>(null);
  const [selectedId, setSelectedId] = useState(entries[0]?.id ?? "");
  const [assetError, setAssetError] = useState<string | null>(null);

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

  const selected = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? entries[0],
    [entries, selectedId],
  );

  if (!selected) {
    return <div className={styles.empty}>Aucun Resonator disponible pour ce checkpoint.</div>;
  }

  const heroPath = projection
    ? pathFor(projection, selected.assetId, WUWA_RESONATOR_HERO_ROLES)
    : undefined;
  const heroRole = projection
    ? sourceRoleFor(projection, selected.assetId, WUWA_RESONATOR_HERO_ROLES)
    : undefined;

  return (
    <section className={styles.workspace} aria-label="Structure V4 de Character Box">
      <div className={styles.boxRail}>
        <div className={styles.boxRailHeading}>
          <div>
            <span className={styles.kicker}>Votre Box</span>
            <strong>{entries.length} Resonators prêts à configurer</strong>
          </div>
          <button type="button" className={styles.addButton} disabled>
            + Ajouter
          </button>
        </div>

        <div className={styles.boxRailList} role="list" aria-label="Resonators du checkpoint">
          {entries.map((entry) => {
            const selectedEntry = entry.id === selected.id;
            const portraitPath = projection
              ? pathFor(projection, entry.assetId, WUWA_RESONATOR_CARD_ROLES)
              : undefined;
            const portraitRole = projection
              ? sourceRoleFor(projection, entry.assetId, WUWA_RESONATOR_CARD_ROLES)
              : undefined;

            return (
              <button
                key={entry.id}
                type="button"
                className={styles.boxRailItem}
                data-selected={selectedEntry || undefined}
                data-element={entry.element}
                aria-pressed={selectedEntry}
                onClick={() => setSelectedId(entry.id)}
              >
                <span className={styles.boxRailMedia}>
                  <WuwaAssetMedia
                    src={portraitPath}
                    alt={`Portrait de ${entry.name}`}
                    role="portrait"
                    sourceRole={portraitRole}
                    fallbackLabel={`Portrait de ${entry.name} indisponible`}
                    sizes="62px"
                  />
                </span>
                <span className={styles.boxRailCopy}>
                  <strong>{entry.name}</strong>
                  <span>
                    {elementLabels[entry.element] ?? entry.element} · {entry.weaponType}
                  </span>
                </span>
                <span className={styles.boxRailSequence}>S0</span>
              </button>
            );
          })}
        </div>
      </div>

      {assetError ? (
        <div className={styles.assetNotice} role="status">
          Les assets locaux n’ont pas pu être chargés ({assetError}). La structure reste testable avec les fallbacks sécurisés.
        </div>
      ) : null}

      <div className={styles.workspaceGrid}>
        <article className={styles.identityPanel} data-element={selected.element}>
          <div className={styles.identityTopline}>
            <span className={styles.kicker}>Resonator actif</span>
            <span className={styles.rarity}>{selected.rarity}★</span>
          </div>

          <div className={styles.heroStage}>
            <WuwaAssetMedia
              src={heroPath}
              alt={`Artwork de ${selected.name}`}
              role="hero"
              sourceRole={heroRole}
              fallbackLabel={`Grand artwork de ${selected.name} indisponible`}
              sizes="(max-width: 920px) 92vw, 410px"
            />
          </div>

          <div className={styles.identityCopy}>
            <span className={styles.identityId}>ID {selected.assetId}</span>
            <h2>{selected.name}</h2>
            <p>
              {elementLabels[selected.element] ?? selected.element} · {selected.weaponType} · S0
            </p>
          </div>

          <div className={styles.identityFooter}>
            <span>Build local</span>
            <strong>Structure prête</strong>
          </div>
        </article>

        <div className={styles.coreColumn}>
          <nav className={styles.workspaceTabs} aria-label="Sections Character Box">
            <button type="button" aria-current="page">Aperçu</button>
            <button type="button" disabled>Stats</button>
            <button type="button" disabled>Compétences</button>
            <button type="button" disabled>Rotation</button>
          </nav>

          <section className={styles.modulePanel}>
            <div className={styles.moduleHeading}>
              <div>
                <span className={styles.kicker}>Étape 8</span>
                <h3>Stats principales</h3>
              </div>
              <span className={styles.moduleState}>Structure uniquement</span>
            </div>
            <div className={styles.statGrid}>
              {[
                ["HP", "Vie"],
                ["ATK", "Attaque"],
                ["DEF", "Défense"],
                ["CR", "Taux CRIT"],
                ["CD", "DGT CRIT"],
                ["ER", "Recharge"],
              ].map(([short, label]) => (
                <div key={short} className={styles.statCell}>
                  <span>{short}</span>
                  <strong>—</strong>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.analysisPanel}>
            <div className={styles.analysisHeader}>
              <div>
                <span className={styles.kicker}>Theorycraft</span>
                <h3>Lecture du build</h3>
              </div>
              <span className={styles.moduleState}>Données à venir</span>
            </div>
            <div className={styles.analysisGrid}>
              <div className={styles.analysisCard}>
                <span>Profil offensif</span>
                <strong>Répartition des dégâts</strong>
                <div className={styles.signalBars} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className={styles.analysisCard}>
                <span>Rotation</span>
                <strong>Timeline et séquence</strong>
                <div className={styles.timelineMock} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className={styles.loadoutColumn} aria-label="Modules de build à venir">
          <section className={styles.loadoutModule}>
            <div className={styles.loadoutHeading}>
              <span className={styles.kicker}>Étape 9</span>
              <span className={styles.loadoutIndex}>01</span>
            </div>
            <h3>Arme</h3>
            <div className={styles.weaponSlot}>
              <div className={styles.slotGlyph}>◇</div>
              <div>
                <strong>Slot principal</strong>
                <span>Arme, niveau, raffinement</span>
              </div>
            </div>
          </section>

          <section className={styles.loadoutModule}>
            <div className={styles.loadoutHeading}>
              <span className={styles.kicker}>Étape 10</span>
              <span className={styles.loadoutIndex}>02</span>
            </div>
            <h3>Echoes</h3>
            <div className={styles.echoSlots} aria-hidden="true">
              <span className={styles.echoMain}>4</span>
              <span>3</span>
              <span>3</span>
              <span>1</span>
              <span>1</span>
            </div>
            <p className={styles.loadoutCopy}>Main Echo, coûts, Sonata et sous-stats auront leur propre éditeur visuel.</p>
          </section>

          <section className={styles.buildStatus}>
            <span className={styles.statusDot} aria-hidden="true" />
            <div>
              <strong>Architecture isolée</strong>
              <p>Aucune modification de finalStats, du Build Resolver ou de la sauvegarde pendant ce checkpoint.</p>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
