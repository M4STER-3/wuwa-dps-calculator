import Image from "next/image";

import styles from "./global-artwork-background.module.css";

export const WUWA_GLOBAL_BACKGROUND_SRC = "/assets/ui/wuwa-lab-global-background-4k.png";

export function GlobalArtworkBackground() {
  return (
    <div className={styles.root} aria-hidden="true">
      <Image
        src={WUWA_GLOBAL_BACKGROUND_SRC}
        alt=""
        fill
        priority
        unoptimized
        sizes="100vw"
        className={styles.image}
      />
    </div>
  );
}
