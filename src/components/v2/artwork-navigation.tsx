import Link from "next/link";

import styles from "./artwork-navigation.module.css";

const ITEMS = [
  { href: "/", label: "Accueil" },
  { href: "/character-box", label: "Character Box" },
  { href: "/personal-dps", label: "DPS personnel" },
  { href: "/team-dps", label: "DPS équipe" },
  { href: "/data", label: "Données" },
] as const;

export function ArtworkNavigation() {
  return (
    <nav className={styles.navigation} aria-label="Navigation principale WUWA LAB">
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className={styles.link} aria-label={item.label}>
          <span className={styles.srOnly}>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
