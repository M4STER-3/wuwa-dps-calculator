"use client";

import { useEffect, useMemo, useState } from "react";

import { V4Badge, V4Panel, V4SectionHeader, V4Skeleton } from "@/components/ui/v4-ui";
import {
  WUWA_RESONATOR_DISPLAY_ROLES,
  WuwaAssetMedia,
} from "@/components/ui/wuwa-asset-media";
import {
  findWuwaUiAssetPathV1,
  isWuwaUiAssetProjectionV1,
  type WuwaUiAssetEntryV1,
  type WuwaUiAssetProjectionV1,
} from "@/game-data/ui-asset-projection";

import styles from "./multi-resonator.module.css";

function characterEntries(projection: WuwaUiAssetProjectionV1) {
  return projection.entries.filter((entry) => entry.category === "characters");
}

function evenlySample(entries: readonly WuwaUiAssetEntryV1[], count: number) {
  if (entries.length <= count) return [...entries];
  if (count <= 1) return entries.slice(0, 1);

  const selected: WuwaUiAssetEntryV1[] = [];
  const used = new Set<number>();

  for (let index = 0; index < count; index += 1) {
    const sourceIndex = Math.round((index * (entries.length - 1)) / (count - 1));
    if (!used.has(sourceIndex)) {
      used.add(sourceIndex);
      selected.push(entries[sourceIndex]);
    }
  }

  return selected;
}

function selectedRole(entry: WuwaUiAssetEntryV1) {
  return WUWA_RESONATOR_DISPLAY_ROLES.find((role) =>
    entry.assets.some((asset) => asset.role === role),
  );
}

function assetPath(projection: WuwaUiAssetProjectionV1, entry: WuwaUiAssetEntryV1) {
  return findWuwaUiAssetPathV1(
    projection,
    entry.category,
    entry.id,
    WUWA_RESONATOR_DISPLAY_ROLES,
  );
}

function LoadingState() {
  return (
    <div className={styles.loadingGrid} aria-label="Chargement de la validation multi-Resonators">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className={styles.loadingCard}>
          <V4Skeleton height={140} />
          <div style={{ height: 10 }} />
          <V4Skeleton width="62%" height={10} />
        </div>
      ))}
    </div>
  );
}

export function MultiResonatorShowcase() {
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

  const validation = useMemo(() => {
    if (!projection) return null;

    const characters = characterEntries(projection);
    const portraits = evenlySample(characters, 12);
    const heroes = evenlySample(characters, 4);
    const counts = new Map<string, number>();

    for (const entry of characters) {
      const role = selectedRole(entry) ?? "fallback absent";
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }

    return { characters, portraits, heroes, counts };
  }, [projection]);

  if (error) {
    return (
      <div className={styles.error} role="alert">
        Impossible de charger la validation multi-Resonators : {error}
      </div>
    );
  }

  if (!projection || !validation) return <LoadingState />;

  return (
    <div className={styles.stack}>
      <V4Panel>
        <V4SectionHeader
          eyebrow="Couverture globale"
          title="Une seule règle pour toute la liste"
          description="Les compteurs ci-dessous vérifient le rôle visuel retenu pour chaque Resonator mappé, pas seulement pour les exemples affichés."
          action={<V4Badge tone="success">{validation.characters.length} vérifiés</V4Badge>}
        />
        <div className={styles.summaryGrid}>
          {WUWA_RESONATOR_DISPLAY_ROLES.map((role) => (
            <div key={role} className={styles.summaryCard}>
              <span className={styles.summaryValue}>{validation.counts.get(role) ?? 0}</span>
              <span className={styles.summaryLabel}>{role}</span>
            </div>
          ))}
          <div className={styles.summaryCard}>
            <span className={styles.summaryValue}>{validation.counts.get("fallback absent") ?? 0}</span>
            <span className={styles.summaryLabel}>sans rôle compatible</span>
          </div>
        </div>
      </V4Panel>

      <V4Panel>
        <V4SectionHeader
          eyebrow="Échantillon réparti"
          title="12 portraits dans toute la liste"
          description="L’échantillon est pris à intervalles réguliers dans les IDs mappés afin de vérifier la même priorité d’assets sur des personnages éloignés dans la projection."
          action={<V4Badge tone="accent">Portraits</V4Badge>}
        />
        <div className={styles.portraitGrid}>
          {validation.portraits.map((entry) => {
            const role = selectedRole(entry);
            return (
              <article key={`portrait-${entry.id}`} className={styles.portraitCard}>
                <WuwaAssetMedia
                  src={assetPath(projection, entry)}
                  alt={`Portrait du Resonator ${entry.id}`}
                  role="portrait"
                  sourceRole={role}
                  fallbackLabel={`Portrait ${entry.id} indisponible`}
                  sizes="(max-width: 640px) 100vw, (max-width: 980px) 50vw, 22vw"
                />
                <div className={styles.cardCopy}>
                  <span className={styles.cardTitle}>Resonator #{entry.id}</span>
                  <span className={styles.cardMeta}>{role ?? "aucun rôle compatible"}</span>
                </div>
              </article>
            );
          })}
        </div>
      </V4Panel>

      <V4Panel>
        <V4SectionHeader
          eyebrow="Grand format"
          title="4 grands visuels avec le même cadrage"
          description="Aucun réglage par personnage : ces quatre visuels utilisent le même composant, la même priorité de source et le même centrage générique."
          action={<V4Badge tone="accent">Hero assets</V4Badge>}
        />
        <div className={styles.heroGrid}>
          {validation.heroes.map((entry) => {
            const role = selectedRole(entry);
            return (
              <article key={`hero-${entry.id}`} className={styles.heroCard}>
                <WuwaAssetMedia
                  src={assetPath(projection, entry)}
                  alt={`Grand visuel du Resonator ${entry.id}`}
                  role="artwork"
                  sourceRole={role}
                  className={styles.heroMedia}
                  fallbackLabel={`Artwork ${entry.id} indisponible`}
                  sizes="(max-width: 980px) 100vw, 45vw"
                />
                <div className={styles.cardCopy}>
                  <span className={styles.cardTitle}>Resonator #{entry.id}</span>
                  <span className={styles.cardMeta}>{role ?? "aucun rôle compatible"}</span>
                </div>
              </article>
            );
          })}
        </div>
        <p className={styles.note}>
          Ce checkpoint est uniquement destiné à valider la robustesse des composants de l’étape 5. La page principale d’assets reste inchangée visuellement.
        </p>
      </V4Panel>
    </div>
  );
}
