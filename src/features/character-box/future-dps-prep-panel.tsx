"use client";

import { WuwaProjectedAssetMedia } from "@/components/ui/wuwa-projected-asset-media";
import { generatedCharacterBoxFutureDpsPrep } from "@/generated/character-box-future-dps-prep";

import styles from "./future-dps-prep-panel.module.css";

const HEAD_ROLES = [
  "list-roleheadicon",
  "list-roleportrait",
  "detail-roleportrait",
] as const;

export function FutureDpsPrepPanel() {
  return (
    <section className={styles.section} aria-labelledby="future-dps-prep-title">
      <div className={styles.inner}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>WUWA LAB · Prochaine couverture</p>
            <h2 id="future-dps-prep-title" className={styles.title}>
              DPS en préparation
            </h2>
            <p className={styles.description}>
              Ces Resonators sont enregistrés pour les prochaines étapes du calculateur.
              Leurs mécaniques complètes ne sont pas encore implémentées : leur statut
              reste donc volontairement <strong>Partiel</strong> et ils ne sont pas encore
              sélectionnables pour un calcul DPS final.
            </p>
          </div>
          <span className={styles.count}>
            {generatedCharacterBoxFutureDpsPrep.length} préparés
          </span>
        </div>

        <div className={styles.grid}>
          {generatedCharacterBoxFutureDpsPrep.map((entry) => {
            const hasGameData = entry.gameDataStatus === "available";
            return (
              <article
                key={entry.id}
                className={styles.card}
                data-ready={hasGameData ? "true" : "false"}
              >
                <div className={styles.visual}>
                  <WuwaProjectedAssetMedia
                    category="characters"
                    assetId={entry.sourceItemId ?? undefined}
                    preferredRoles={HEAD_ROLES}
                    alt={`Portrait tête de ${entry.displayName}`}
                    role="portrait"
                    fallbackLabel="Image en attente"
                    sizes="88px"
                  />
                </div>

                <div className={styles.identity}>
                  <div className={styles.statusRow}>
                    <span className={styles.partialBadge}>Partiel</span>
                    <span className={styles.futureBadge}>DPS à venir</span>
                  </div>
                  <h3 className={styles.name}>{entry.displayName}</h3>
                  <p className={styles.meta}>
                    {hasGameData
                      ? [
                          entry.element,
                          entry.weaponType,
                          entry.rarity ? `${entry.rarity}★` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "Données jeu en attente"}
                  </p>
                </div>

                <div className={styles.facts}>
                  <div className={styles.fact}>
                    <span>GameDatabase</span>
                    <strong>{hasGameData ? "Préparé" : "En attente"}</strong>
                  </div>
                  <div className={styles.fact}>
                    <span>Base Lv. 90</span>
                    <strong>{entry.baseStatsLv90 ? "Préparée" : "En attente"}</strong>
                  </div>
                  <div className={styles.fact}>
                    <span>Actions candidates</span>
                    <strong>{entry.actionCandidates.length}</strong>
                  </div>
                </div>

                <p className={styles.note}>
                  Mécaniques, rotation, timings et effets spéciaux : implémentation complète
                  prévue dans une future étape.
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
