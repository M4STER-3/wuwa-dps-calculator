import type { ReactNode } from "react";

import styles from "./global-background-stage.module.css";

export function GlobalBackgroundStage({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.viewport} data-wuwa-background-stage>
      <div className={styles.canvas}>
        {children ? <div className={styles.content}>{children}</div> : null}
      </div>
    </div>
  );
}
