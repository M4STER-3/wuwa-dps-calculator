import Image from "next/image";

import styles from "./wuwa-asset-media.module.css";

const localAssetPattern = /^\/assets\/wuwa\/objects\/[a-f0-9]{64}\.(?:png|jpg|webp)$/;

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
  fallbackLabel = "Image indisponible",
  className,
  sizes,
}: {
  src?: string;
  alt: string;
  role: WuwaAssetMediaRole;
  fallbackLabel?: string;
  className?: string;
  sizes?: string;
}) {
  const safeSrc = isSafeWuwaAssetPath(src) ? src : undefined;

  return (
    <div className={classes(styles.frame, styles[role], className)} data-asset-role={role}>
      {safeSrc ? (
        <Image
          src={safeSrc}
          alt={alt}
          fill
          sizes={sizes ?? (role === "chip" ? "44px" : "(max-width: 720px) 45vw, 280px")}
          className={styles.image}
          unoptimized
        />
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
