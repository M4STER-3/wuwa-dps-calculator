import Image from "next/image";

import styles from "./background-preview.module.css";

const BACKGROUND_SRC = "/assets/ui/wuwa-lab-global-background.png";

export default function BackgroundVisualTestPage() {
  return (
    <section className={styles.stage} aria-label="Aperçu du fond global WUWA LAB">
      <div className={styles.imageFrame}>
        <Image
          src={BACKGROUND_SRC}
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className={styles.image}
        />
      </div>
    </section>
  );
}
