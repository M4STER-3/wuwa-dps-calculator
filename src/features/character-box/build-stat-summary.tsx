import type { FinalStats } from "@/domain/models";

import styles from "./build-stat-summary.module.css";

type StatItem = {
  label: string;
  value: string;
  emphasis?: boolean;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
}

export function BuildStatSummary({ stats }: { stats: FinalStats }) {
  const items: StatItem[] = [
    { label: "HP", value: formatNumber(stats.hp) },
    { label: "ATK", value: formatNumber(stats.attack), emphasis: true },
    { label: "DEF", value: formatNumber(stats.defense) },
    { label: "Crit Rate", value: `${formatNumber(stats.critRate)}%`, emphasis: true },
    { label: "Crit DMG", value: `${formatNumber(stats.critDamage)}%`, emphasis: true },
    { label: "Energy Regen", value: `${formatNumber(stats.energyRegen)}%` },
  ];

  return (
    <section className={styles.summary} aria-label="Résumé des statistiques finales">
      <div className={styles.heading}>
        <div>
          <p>Snapshot du build</p>
          <h3>Statistiques finales</h3>
        </div>
        <span>UserBuild.finalStats</span>
      </div>

      <div className={styles.grid}>
        {items.map((item) => (
          <div
            key={item.label}
            className={styles.stat}
            data-emphasis={item.emphasis || undefined}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
