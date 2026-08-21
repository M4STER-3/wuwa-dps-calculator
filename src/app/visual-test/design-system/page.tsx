import {
  V4Badge,
  V4Button,
  V4Divider,
  V4EmptyState,
  V4InputField,
  V4Notice,
  V4Page,
  V4Panel,
  V4SectionHeader,
  V4SelectField,
  V4SelectorItem,
  V4Skeleton,
  V4Stat,
  V4Tabs,
} from "@/components/ui/v4-ui";

import styles from "./design-system-preview.module.css";

const tabs = [
  { id: "build", label: "Build" },
  { id: "stats", label: "Stats" },
  { id: "echoes", label: "Echoes" },
] as const;

export default function V4DesignSystemPreviewPage() {
  return (
    <div className={styles.stage}>
      <V4Page>
        <header className={styles.header}>
          <div>
            <p className="v4-eyebrow">V4 · Design system</p>
            <h1 className="v4-page-title">WUWA LAB, plus clair et plus précis.</h1>
            <p className="v4-lead">
              Ce checkpoint teste uniquement le langage visuel qui servira ensuite à Character Box,
              aux sélecteurs d&apos;assets et aux écrans DPS. Aucun moteur de calcul n&apos;est modifié.
            </p>
          </div>
          <div className={styles.headerActions}>
            <V4Button variant="secondary">Annuler</V4Button>
            <V4Button variant="primary">Enregistrer le build</V4Button>
          </div>
        </header>

        <div className={styles.layout}>
          <div className={styles.stack}>
            <V4Panel>
              <V4SectionHeader
                eyebrow="Sélection"
                title="Resonator"
                description="Aperçu de la densité prévue pour les futurs sélecteurs visuels."
                action={<V4Badge tone="accent">60 disponibles</V4Badge>}
              />
              <div className={styles.controls}>
                <V4InputField
                  label="Recherche"
                  name="preview-search"
                  placeholder="Nom du Resonator…"
                />
                <V4SelectField label="Élément" name="preview-element" defaultValue="all">
                  <option value="all">Tous</option>
                  <option value="spectro">Spectro</option>
                  <option value="aero">Aero</option>
                </V4SelectField>
              </div>
              <V4Divider />
              <div className={styles.selectorList}>
                <V4SelectorItem
                  title="Resonator sélectionné"
                  meta="Niveau 90 · build actif"
                  media="R"
                  trailing="Actif"
                  selected
                />
                <V4SelectorItem
                  title="Autre Resonator"
                  meta="Portrait local à l’étape Assets"
                  media="R"
                  trailing="90"
                />
                <V4SelectorItem
                  title="Indisponible"
                  meta="État désactivé explicite"
                  media="R"
                  disabled
                />
              </div>
            </V4Panel>

            <V4Panel>
              <V4SectionHeader
                eyebrow="États"
                title="Feedback et chargement"
                description="Les états sémantiques restent distincts de la couleur de marque."
              />
              <div className={styles.stack}>
                <V4Notice title="Build valide" tone="success">
                  Les statistiques permanentes sont prêtes à être utilisées par le calculateur.
                </V4Notice>
                <V4Notice title="Équipement incomplet" tone="warning">
                  Un slot Echo peut rester incomplet sans masquer le reste du build.
                </V4Notice>
                <V4Notice title="Valeur non disponible" tone="danger">
                  Une donnée inconnue reste explicitement indisponible au lieu d’être inventée.
                </V4Notice>
                <div className={styles.skeletonGroup} aria-label="Exemple de chargement">
                  <V4Skeleton width="38%" />
                  <V4Skeleton width="82%" height={10} />
                  <V4Skeleton width="64%" height={10} />
                </div>
              </div>
            </V4Panel>
          </div>

          <div className={styles.stack}>
            <V4Panel>
              <V4SectionHeader
                eyebrow="Character Box"
                title="Hiérarchie d’un build"
                description="Cette composition n’est pas la Character Box finale : elle teste les surfaces, les chiffres et le rôle futur des assets."
                action={<V4Badge tone="success">Build complet</V4Badge>}
              />

              <div className={styles.mediaPlaceholder}>
                Zone réservée à un artwork local du Resonator — aucun asset fictif n’est utilisé ici
              </div>

              <V4Divider />

              <div className={styles.statSummary}>
                <div className={styles.statTile}>
                  <div className={styles.statTileLabel}>Niveau</div>
                  <div className={styles.statTileValue}>90</div>
                </div>
                <div className={styles.statTile}>
                  <div className={styles.statTileLabel}>ATK</div>
                  <div className={styles.statTileValue}>2 184</div>
                </div>
                <div className={styles.statTile}>
                  <div className={styles.statTileLabel}>Crit. Rate</div>
                  <div className={styles.statTileValue}>72.4%</div>
                </div>
              </div>

              <V4Tabs items={tabs} activeId="build" label="Sections de build" />
              <V4Divider />
              <V4Stat label="HP" value="18 420" />
              <V4Stat label="ATK" value="2 184" emphasis="strong" />
              <V4Stat label="Crit. DMG" value="248.6%" />
              <V4Stat label="Energy Regen" value="121.4%" />

              <p className={styles.caption}>
                Les chiffres utilisent une hiérarchie compacte et des nombres tabulaires. Les vrais
                portraits, armes et Echoes seront connectés seulement après la projection d&apos;assets sécurisée.
              </p>
            </V4Panel>

            <V4Panel>
              <V4SectionHeader
                eyebrow="Composants"
                title="Actions et états secondaires"
                description="Les contrôles restent sobres afin que les résultats et les assets gardent la priorité."
              />
              <div className={styles.buttons}>
                <V4Button variant="primary">Action principale</V4Button>
                <V4Button variant="secondary">Secondaire</V4Button>
                <V4Button variant="ghost">Discrète</V4Button>
                <V4Button variant="danger">Supprimer</V4Button>
                <V4Button variant="secondary" disabled>Indisponible</V4Button>
              </div>
              <V4Divider />
              <div className={styles.badges}>
                <V4Badge>Neutre</V4Badge>
                <V4Badge tone="accent">Sélectionné</V4Badge>
                <V4Badge tone="success">Validé</V4Badge>
                <V4Badge tone="warning">Partiel</V4Badge>
                <V4Badge tone="danger">Erreur</V4Badge>
              </div>
              <V4Divider />
              <V4EmptyState title="Aucun Echo équipé" icon="E">
                Le futur picker visuel apparaîtra ici sans transformer la page en mur de selects.
              </V4EmptyState>
            </V4Panel>
          </div>
        </div>
      </V4Page>
    </div>
  );
}
