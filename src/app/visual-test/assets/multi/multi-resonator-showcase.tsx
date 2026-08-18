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

function selectedRole(entry: WuwaUiAssetEntryV1, preferredRoles: readonly string[]) {
  return preferredRoles.find((role) => entry.assets.some((asset) => asset.role === role));
}

function assetPath(
  projection: WuwaUiAssetProjectionV1,
  entry: WuwaUiAssetEntryV1,
  preferredRoles: readonly string[],
) {
  return findWuwaUiAssetPathV1(
    projection,
    entry.category,
    entry.id,
    preferredRoles,
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
    const cardCounts = new Map<string, number>();
    const heroCounts = new Map<string, number>();

    for (const entry of characters) {
      const cardRole = selectedRole(entry, WUWA_RESONATOR_CARD_ROLES) ?? "fallback absent";
      const heroRole = selectedRole(entry, WUWA_RESONATOR_HERO_ROLES) ?? "fallback absent";
      cardCounts.set(cardRole, (cardCounts.get(cardRole) ?? 0) + 1);
      heroCounts.set(heroRole, (heroCounts.get(heroRole) ?? 0) + 1);
    }

    return { characters, portraits, heroes, cardCounts, heroCounts };
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
          title="Deux règles selon le contexte"
          description="Les cartes gardent le rôle de formation validé, tandis que les grands visuels privilégient l’artwork propre au personnage. Les deux règles sont vérifiées sur toute la projection."
          action={<V4Badge tone="success">{validation.characters.length} vérifiés</V4Badge>}
        />
        <div className={styles.summaryGrid}>
          {WUWA_RESONATOR_CARD_ROLES.map((role) => (
            <div key={`card-${role}`} className={styles.summaryCard}>
              <span className={styles.summaryValue}>{validation.cardCounts.get(role) ?? 0}</span>
              <span className={styles.summaryLabel}>carte · {role}</span>
            </div>
          ))}
          {WUWA_RESONATOR_HERO_ROLES.slice(0, 2).map((role) => (
            <div key={`hero-${role}`} className={styles.summaryCard}>
              <span className={styles.summaryValue}>{validation.heroCounts.get(role) ?? 0}</span>
              <span className={styles.summaryLabel}>hero · {role}</span>
            </div>
          ))}
        </div>
      </V4Panel>

      <V4Panel>
        <V4SectionHeader
          eyebrow="Échantillon réparti"
          title="12 portraits dans toute la liste"
          description="Les portraits conservent exactement la règle déjà validée : formation card en priorité, puis fallbacks sûrs."
          action={<V4Badge tone="accent">Portraits</V4Badge>}
        />
        <div className={styles.portraitGrid}>
          {validation.portraits.map((entry) => {
            const role = selectedRole(entry, WUWA_RESONATOR_CARD_ROLES);
            return (
              <article key={`portrait-${entry.id}`} className={styles.portraitCard}>
                <WuwaAssetMedia
                  src={assetPath(projection, entry, WUWA_RESONATOR_CARD_ROLES)}
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
          title="4 grands visuels propres à leur Resonator"
          description="Ces quatre tests privilégient detail-roleportrait et utilisent tous le même centrage générique dans leur box. L’asset de formation ne sert que de fallback si l’artwork propre au personnage manque."
          action={<V4Badge tone="accent">Hero assets</V4Badge>}
        />
        <div className={styles.heroGrid}>
          {validation.heroes.map((entry) => {
            const role = selectedRole(entry, WUWA_RESONATOR_HERO_ROLES);
            return (
              <article key={`hero-${entry.id}`} className={styles.heroCard}>
                <WuwaAssetMedia
                  src={assetPath(projection, entry, WUWA_RESONATOR_HERO_ROLES)}
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
          Ce checkpoint est uniquement destiné à valider la robustesse des composants de l’étape 5. La page principale d’assets reste inchangée visuellement en dehors de la sélection correcte du grand artwork.
        </p>
      </V4Panel>
    </div>
  );
}
