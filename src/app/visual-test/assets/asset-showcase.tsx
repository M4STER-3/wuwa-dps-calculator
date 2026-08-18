"use client";

import { useEffect, useMemo, useState } from "react";

import { V4Badge, V4Panel, V4SectionHeader, V4Skeleton } from "@/components/ui/v4-ui";
import {
  WUWA_RESONATOR_CARD_ROLES,
  WUWA_RESONATOR_HERO_ROLES,
  WuwaAssetMedia,
} from "@/components/ui/wuwa-asset-media";
import {
  findWuwaUiAssetPathV1,
  isWuwaUiAssetProjectionV1,
  type WuwaUiAssetCategoryV1,
  type WuwaUiAssetEntryV1,
  type WuwaUiAssetProjectionV1,
} from "@/game-data/ui-asset-projection";

import styles from "./assets-preview.module.css";

function entriesFor(
  projection: WuwaUiAssetProjectionV1,
  category: WuwaUiAssetCategoryV1,
  count: number,
) {
  return projection.entries.filter((entry) => entry.category === category).slice(0, count);
}

function selectedRole(entry: WuwaUiAssetEntryV1, preferredRoles: readonly string[]) {
  for (const role of preferredRoles) {
    if (entry.assets.some((asset) => asset.role === role)) return role;
  }
  return entry.assets[0]?.role;
}

function pathFor(
  projection: WuwaUiAssetProjectionV1,
  entry: WuwaUiAssetEntryV1,
  preferredRoles: readonly string[],
) {
  return findWuwaUiAssetPathV1(projection, entry.category, entry.id, preferredRoles);
}

function LoadingState() {
  return (
    <div className={styles.loadingGrid} aria-label="Chargement des assets locaux">
      {[0, 1, 2].map((index) => (
        <div key={index} className={styles.loadingCard}>
          <V4Skeleton height={120} />
          <div style={{ height: 10 }} />
          <V4Skeleton width="58%" height={10} />
          <div style={{ height: 7 }} />
          <V4Skeleton width="38%" height={8} />
        </div>
      ))}
    </div>
  );
}

function AssetCard({
  projection,
  entry,
  mediaRole,
  preferredRoles,
}: {
  projection: WuwaUiAssetProjectionV1;
  entry: WuwaUiAssetEntryV1;
  mediaRole: "portrait" | "weapon" | "echo" | "catalogue";
  preferredRoles: readonly string[];
}) {
  const role = selectedRole(entry, preferredRoles);
  const path = pathFor(projection, entry, preferredRoles);

  return (
    <article className={styles.assetCard}>
      <WuwaAssetMedia
        src={path}
        alt={`${entry.category} ${entry.id}`}
        role={mediaRole}
        sourceRole={role}
        fallbackLabel={`Asset ${entry.id} indisponible`}
      />
      <div className={styles.assetCardCopy}>
        <span className={styles.assetCardTitle}>
          {entry.category === "characters"
            ? `Resonator #${entry.id}`
            : entry.category === "weapons"
              ? `Arme #${entry.id}`
              : `Echo #${entry.id}`}
        </span>
        <span className={styles.assetCardMeta}>{role ?? "aucun rôle compatible"}</span>
      </div>
    </article>
  );
}

export function AssetShowcase() {
  const [projection, setProjection] = useState<WuwaUiAssetProjectionV1 | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjection() {
      try {
        const response = await fetch("/api/wuwa/ui-assets", { cache: "force-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload: unknown = await response.json();
        if (!isWuwaUiAssetProjectionV1(payload)) {
          throw new Error("projection rejetée par le validateur runtime");
        }
        if (!cancelled) setProjection(payload);
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "erreur inconnue");
        }
      }
    }

    void loadProjection();
    return () => {
      cancelled = true;
    };
  }, []);

  const samples = useMemo(() => {
    if (!projection) return null;
    return {
      characters: entriesFor(projection, "characters", 3),
      weapons: entriesFor(projection, "weapons", 3),
      echoes: entriesFor(projection, "echoes", 4),
    };
  }, [projection]);

  if (error) {
    return (
      <div className={styles.error} role="alert">
        Impossible de charger la projection d’assets : {error}
      </div>
    );
  }

  if (!projection || !samples) return <LoadingState />;

  const leadCharacter = samples.characters[0];
  const leadChipRoles = ["list-roleheadicon", "detail-roleheadiconlarge", "detail-roleportrait"] as const;
  const leadArtworkPath = leadCharacter
    ? pathFor(projection, leadCharacter, WUWA_RESONATOR_HERO_ROLES)
    : undefined;
  const leadArtworkRole = leadCharacter
    ? selectedRole(leadCharacter, WUWA_RESONATOR_HERO_ROLES)
    : undefined;
  const leadChipPath = leadCharacter
    ? pathFor(projection, leadCharacter, leadChipRoles)
    : undefined;
  const leadChipRole = leadCharacter
    ? selectedRole(leadCharacter, leadChipRoles)
    : undefined;

  return (
    <div className={styles.stack}>
      <V4Panel>
        <V4SectionHeader
          eyebrow="Asset identity"
          title="Les images font partie du layout"
          description="Test d’un Resonator dans une grande zone d’identité claire, sans panneau sombre derrière l’asset."
          action={<V4Badge tone="success">Projection validée</V4Badge>}
        />

        <div className={styles.identity}>
          <div className={styles.identityCopy}>
            <p className="v4-eyebrow">Resonator · ID stable</p>
            <h2 className={styles.identityTitle}>
              {leadCharacter ? `Resonator #${leadCharacter.id}` : "Asset indisponible"}
            </h2>
            <p className={styles.identityMeta}>
              Le nom du personnage viendra de la base de données promue. La projection d’assets reste volontairement limitée à l’ID, au rôle et au chemin local.
            </p>
            <div className={styles.chipRow} style={{ marginTop: 18 }}>
              <div className={styles.chipCard}>
                <WuwaAssetMedia
                  src={leadChipPath}
                  alt={leadCharacter ? `Portrait du Resonator ${leadCharacter.id}` : "Portrait indisponible"}
                  role="chip"
                  sourceRole={leadChipRole}
                />
                <span className={styles.chipCopy}>
                  <span className={styles.chipTitle}>Identity chip</span>
                  <span className={styles.chipMeta}>DPS · timeline · équipe</span>
                </span>
              </div>
            </div>
          </div>
          <div className={styles.identityMedia}>
            <WuwaAssetMedia
              src={leadArtworkPath}
              alt={leadCharacter ? `Artwork du Resonator ${leadCharacter.id}` : "Artwork indisponible"}
              role="artwork"
              sourceRole={leadArtworkRole}
              className={styles.identityArtwork}
              sizes="(max-width: 980px) 100vw, 52vw"
            />
          </div>
        </div>
      </V4Panel>

      <V4Panel>
        <V4SectionHeader
          eyebrow="Resonators"
          title="Portraits et sélection"
          description="Les portraits restent lisibles sur des cartes légères et compactes."
          action={<V4Badge tone="accent">{projection.counts.characters} mappés</V4Badge>}
        />
        <div className={styles.sectionGrid}>
          {samples.characters.map((entry) => (
            <AssetCard
              key={`character-${entry.id}`}
              projection={projection}
              entry={entry}
              mediaRole="portrait"
              preferredRoles={WUWA_RESONATOR_CARD_ROLES}
            />
          ))}
        </div>
      </V4Panel>

      <V4Panel>
        <V4SectionHeader
          eyebrow="Équipement"
          title="Armes et Echoes"
          description="Les objets utilisent d’abord leur asset de détail lorsqu’il existe, puis reviennent à l’icône catalogue sans l’agrandir excessivement."
        />
        <div className={styles.sectionGrid}>
          {samples.weapons.map((entry) => (
            <AssetCard
              key={`weapon-${entry.id}`}
              projection={projection}
              entry={entry}
              mediaRole="weapon"
              preferredRoles={["detail-icon", "list-icon"]}
            />
          ))}
        </div>
        <div style={{ height: 16 }} />
        <div className={`${styles.sectionGrid} ${styles.echoGrid}`}>
          {samples.echoes.map((entry) => (
            <AssetCard
              key={`echo-${entry.id}`}
              projection={projection}
              entry={entry}
              mediaRole="echo"
              preferredRoles={["detail-icon", "list-icon"]}
            />
          ))}
        </div>
      </V4Panel>

      <V4Panel>
        <V4SectionHeader
          eyebrow="Fallback"
          title="Une image manquante reste claire et explicite"
          description="Ce cas est volontaire : aucune surface noire/grise massive n’est utilisée pour masquer l’absence d’un asset."
        />
        <div className={styles.sectionGrid}>
          <article className={styles.assetCard}>
            <WuwaAssetMedia
              alt="Exemple d’asset absent"
              role="catalogue"
              fallbackLabel="Image locale indisponible"
            />
            <div className={styles.assetCardCopy}>
              <span className={styles.assetCardTitle}>Fallback contrôlé</span>
              <span className={styles.assetCardMeta}>surface claire · état explicite</span>
            </div>
          </article>
        </div>
        <p className={styles.note} style={{ marginTop: 14 }}>
          Cette page teste uniquement la présentation des assets. Elle ne remplace pas encore les anciens panels de Character Box, DPS ou Accueil.
        </p>
      </V4Panel>
    </div>
  );
}
