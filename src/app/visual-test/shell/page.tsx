import Link from "next/link";

import { V4Badge, V4Panel, V4SectionHeader } from "@/components/ui/v4-ui";

import styles from "./shell-preview.module.css";

const destinations = [
  { href: "/", title: "Accueil", copy: "Entrée générale du produit — redesign final prévu à l’étape 15." },
  { href: "/character-box", title: "Character Box", copy: "Page phare du build, reconstruite progressivement aux étapes 7 à 11." },
  { href: "/personal-dps", title: "DPS personnel", copy: "Résultats et rotation d’un build individuel." },
  { href: "/team-dps", title: "DPS équipe", copy: "Composition, contributions et timeline commune." },
  { href: "/data", title: "Données", copy: "Compendium visuel Resonators, armes, Echoes et Sonata." },
] as const;

export default function V4ShellPreviewPage() {
  return (
    <div className="v4-theme v4-page">
      <div className="v4-page__inner">
        <header className={styles.header}>
          <div>
            <p className="v4-eyebrow">V4 · Shell global</p>
            <h1 className="v4-page-title">Toutes les pages restent accessibles.</h1>
            <p className="v4-lead">
              Character Box fixe la qualité visuelle du produit, mais la navigation globale relie
              toujours Accueil, Character Box, DPS personnel, DPS équipe et Données.
            </p>
          </div>
          <V4Badge tone="accent">Étape 3 / 15</V4Badge>
        </header>

        <V4Panel>
          <V4SectionHeader
            eyebrow="Navigation"
            title="Cinq destinations principales"
            description="Échos n’est plus une destination principale : son interface sera intégrée à Character Box sans supprimer sa logique existante."
          />
          <div className={styles.destinationGrid}>
            {destinations.map((destination) => (
              <Link key={destination.href} href={destination.href} className={styles.destination}>
                <span className={styles.destinationTitle}>{destination.title}</span>
                <span className={styles.destinationCopy}>{destination.copy}</span>
                <span className={styles.destinationAction}>Ouvrir →</span>
              </Link>
            ))}
          </div>
        </V4Panel>
      </div>
    </div>
  );
}
