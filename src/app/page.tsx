import Image from "next/image";
import Link from "next/link";

import { LabBadge, LabLinkButton, LabMetric, LabSectionHeading, LabStatRow } from "@/components/ui";
import { presets, resonators, weapons } from "@/data/catalog";

const databaseMetrics = [
  ["60", "Resonators", "Builds et compétences"],
  ["120", "Armes", "Types et passifs"],
  ["178", "Échos", "Catalogue de sélection"],
  ["34", "Sonata Sets", "Effets structurés"],
] as const;

const modules = [
  {
    key: "character",
    index: "01",
    title: "Character Box",
    description:
      "Construisez un Resonator complet : progression, arme, statistiques permanentes et cinq Échos dans un même espace de travail visuel.",
    href: "/character-box",
    features: ["Portraits", "Arme", "5 Échos", "finalStats"],
  },
  {
    key: "personal",
    index: "02",
    title: "DPS personnel",
    description:
      "Lisez d’abord le résultat : DPS, dégâts de rotation, contributions et timeline, puis seulement les paramètres avancés.",
    href: "/personal-dps",
    features: ["Rotation", "Timeline", "Breakdown"],
  },
  {
    key: "team",
    index: "03",
    title: "DPS équipe",
    description:
      "Composez trois personnages, visualisez les fenêtres de buffs et comprenez la contribution de chacun à la rotation commune.",
    href: "/team-dps",
    features: ["3 Resonators", "Buffs", "Swaps"],
  },
  {
    key: "data",
    index: "04",
    title: "Données",
    description:
      "Un compendium visuel et filtrable pour les Resonators, armes, Échos et Sonata, connecté aux données structurées du calculateur.",
    href: "/data",
    features: ["Recherche", "Filtres", "Fiches détaillées", "Images locales"],
  },
] as const;

const featuredResonator = resonators.find(
  (resonator) => resonator.source.kind !== "technical-fixture" && resonator.portrait,
);
const featuredPreset = featuredResonator
  ? presets.find((preset) => preset.resonatorId === featuredResonator.id)
  : undefined;
const featuredWeapon = featuredPreset
  ? weapons.find((weapon) => weapon.id === featuredPreset.weapon.weaponId)
  : undefined;

function number(value: number | undefined) {
  return value === undefined ? "—" : new Intl.NumberFormat("fr-FR").format(value);
}

export default function Home() {
  const portrait = featuredResonator?.portrait;

  return (
    <main className="lab-home">
      <section className="lab-home-hero" aria-labelledby="home-title">
        <div className="lab-home-hero__copy">
          <div className="lab-home-kicker">
            <span className="lab-home-kicker__label">Wuthering Waves theorycraft</span>
            <span className="lab-home-kicker__rule" aria-hidden="true" />
            <span className="lab-home-kicker__meta">SYSTEM / V3</span>
          </div>

          <h1 id="home-title" className="lab-home-title">
            WUWA LAB
            <span>Construire précisément. Simuler clairement. Comparer sans bruit.</span>
          </h1>

          <p className="lab-home-lede">
            Un espace de theorycraft pensé pour les longues sessions : les images servent à reconnaître le build, les données restent faciles à scanner et les résultats gardent toujours la priorité sur les contrôles.
          </p>

          <div className="lab-home-actions">
            <LabLinkButton href="/character-box" variant="primary">
              Commencer un build <span aria-hidden="true">→</span>
            </LabLinkButton>
            <LabLinkButton href="/personal-dps" variant="secondary">
              Ouvrir le simulateur DPS
            </LabLinkButton>
          </div>

          <div className="lab-home-proof" aria-label="Principes du calculateur">
            <div className="lab-home-proof__item">
              <span className="lab-home-proof__label">Statistiques</span>
              <span className="lab-home-proof__value">finalStats reste la source permanente unique.</span>
            </div>
            <div className="lab-home-proof__item">
              <span className="lab-home-proof__label">Validation</span>
              <span className="lab-home-proof__value">Les Échos suivent le resolver exact existant.</span>
            </div>
            <div className="lab-home-proof__item">
              <span className="lab-home-proof__label">Interface</span>
              <span className="lab-home-proof__value">100 % composants et CSS, sans fond-image global.</span>
            </div>
          </div>
        </div>

        <aside className="lab-home-feature" aria-label="Resonator mis en avant">
          <div className="lab-home-feature__visual" aria-hidden="true">
            {portrait ? (
              <Image
                src={portrait.src}
                alt=""
                fill
                priority
                sizes="(max-width: 900px) 100vw, 46vw"
                className="lab-home-feature__image"
              />
            ) : (
              <div className="lab-home-feature__fallback">W</div>
            )}
          </div>

          <div className="lab-home-feature__content">
            <div className="lab-home-feature__top">
              <div>
                <p className="lab-home-feature__eyebrow">Build focus / aperçu local</p>
                <h2 className="lab-home-feature__name">
                  {featuredResonator?.name ?? "Resonator"}
                </h2>
                <div className="lab-home-feature__identity">
                  <span>{featuredResonator?.element ?? "Element"}</span>
                  <span>·</span>
                  <span>{featuredResonator?.weaponType ?? "Weapon"}</span>
                  <span>·</span>
                  <span>{featuredResonator?.rarity ?? 5}★</span>
                </div>
              </div>
              <LabBadge tone="accent">Local asset</LabBadge>
            </div>

            <div className="lab-home-feature__bottom">
              <div className="lab-home-feature__weapon">
                <span>Arme du preset</span>
                <strong>{featuredWeapon?.name ?? "Build à configurer"}</strong>
              </div>
              <div className="lab-home-feature__stats">
                <LabStatRow label="ATK" value={number(featuredPreset?.finalStats.attack)} />
                <LabStatRow label="Taux CRIT" value={featuredPreset ? `${featuredPreset.finalStats.critRate}%` : "—"} />
                <LabStatRow label="DGT CRIT" value={featuredPreset ? `${featuredPreset.finalStats.critDamage}%` : "—"} />
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="lab-home-database" aria-label="Couverture de la base de données">
        <div className="lab-home-database__intro">
          <span>Game database</span>
          <strong>Une base structurée derrière chaque module.</strong>
        </div>
        {databaseMetrics.map(([value, label, meta]) => (
          <div className="lab-home-database__metric" key={label}>
            <LabMetric label={label} value={value} meta={meta} />
          </div>
        ))}
        <div className="lab-home-database__pipeline">
          <span>Pipeline</span>
          <strong>RAW → normalisation → hardening → promotion</strong>
        </div>
      </section>

      <section className="lab-home-modules" aria-labelledby="modules-title">
        <LabSectionHeading
          eyebrow="Modules"
          title={<span id="modules-title">Une interface organisée autour du travail réel.</span>}
          description="La navigation reste volontairement courte. Les Échos ne sont plus un silo séparé : ils appartiennent au build du personnage dans Character Box."
          actions={<LabBadge tone="jade">5 destinations principales</LabBadge>}
        />

        <div className="lab-home-modules__grid">
          {modules.map((module) => (
            <Link
              key={module.key}
              href={module.href}
              className={`lab-module-card lab-module-card--${module.key}`}
            >
              <span className="lab-module-card__index">{module.index}</span>
              <h3 className="lab-module-card__title">{module.title}</h3>
              <p className="lab-module-card__copy">{module.description}</p>
              <div className="lab-module-card__features" aria-label={`Fonctions ${module.title}`}>
                {module.features.map((feature) => (
                  <span key={feature} className="lab-module-card__feature">
                    {feature}
                  </span>
                ))}
              </div>
              <span className="lab-module-card__cta">Ouvrir le module</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="lab-home-flow" aria-labelledby="flow-title">
        <div className="lab-home-flow__copy">
          <LabBadge tone="accent">Workflow</LabBadge>
          <h2 id="flow-title">Du build au résultat, sans perdre le contexte.</h2>
          <p>
            Le même langage visuel pourra ensuite porter Character Box, les simulations personnelles et d’équipe, puis le compendium. Les contrôles deviennent secondaires dès qu’un résultat existe.
          </p>
        </div>

        <div className="lab-home-flow__steps">
          <div className="lab-home-flow__step">
            <span>01 / BUILD</span>
            <strong>Configurer</strong>
            <p>Resonator, progression, arme, statistiques permanentes et Échos.</p>
          </div>
          <div className="lab-home-flow__step">
            <span>02 / SIM</span>
            <strong>Simuler</strong>
            <p>Rotation, buffs temporaires, dégâts et fenêtres temporelles.</p>
          </div>
          <div className="lab-home-flow__step">
            <span>03 / READ</span>
            <strong>Comprendre</strong>
            <p>DPS, contribution, timeline et diagnostics présentés par priorité.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
