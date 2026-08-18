import Image from "next/image";

import styles from "./wuwa-asset-media.module.css";

const localAssetPattern = /^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/;

/**
 * Compact/card contexts intentionally prefer the validated formation card.
 * This keeps portrait selectors sharp and consistent across Resonators.
 */
export const WUWA_RESONATOR_CARD_ROLES = [
  "detail-formationrolecard",
  "detail-roleportrait",
  "detail-roleheadiconlarge",
] as const;

/**
 * Hero/large-artwork contexts must prefer actual large character artwork.
 * `detail-rolestand` is the first choice when promoted for that Resonator,
 * then the high-resolution role portrait, with card/head assets only as
 * graceful fallbacks.
 */
export const WUWA_RESONATOR_HERO_ROLES = [
  "detail-rolestand",
  "detail-roleportrait",
  "detail-formationrolecard",
  "detail-roleheadiconlarge",
] as const;

// Backward-compatible name for existing card/portrait call sites.
export const WUWA_RESONATOR_DISPLAY_ROLES = WUWA_RESONATOR_CARD_ROLES;

export type WuwaAssetMediaRole =
  | "portrait"
  | "artwork"
  | "weapon"
  | "echo"
  | "chip"
  | "catalogue";

function classes(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(" ");
}

export function isSafeWuwaAssetPath(path: string | undefined): path is string {
  return typeof path === "string" && localAssetPattern.test(path);
}

export function WuwaAssetMedia({
  src,
  alt,
  role,
  sourceRole,
  fallbackLabel = "Image indisponible",
  className,
  sizes,
}: {
  src?: string;
  alt: string;
  role: WuwaAssetMediaRole;
  sourceRole?: string;
  fallbackLabel?: string;
  className?: string;
  sizes?: string;
}) {
  const safeSrc = isSafeWuwaAssetPath(src) ? src : undefined;

  return (
    <div
      className={classes(styles.frame, styles[role], className)}
      data-asset-role={role}
      data-asset-source-role={sourceRole}
    >
      {safeSrc ? (
        <span className={styles.imageStage}>
          <Image
            src={safeSrc}
            alt={alt}
            fill
            sizes={sizes ?? (role === "chip" ? "44px" : "(max-width: 720px) 45vw, 280px")}
            className={styles.image}
            unoptimized
          />
        </span>
      ) : (
        <div className={styles.fallback} role="img" aria-label={fallbackLabel}>
          <span className={styles.fallbackMark} aria-hidden="true">
            WU
          </span>
          <span className={styles.fallbackText}>{fallbackLabel}</span>
        </div>
      )}
    </div>
  );
}
