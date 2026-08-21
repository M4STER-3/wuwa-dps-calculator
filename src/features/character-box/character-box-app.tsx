"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { presets, resonators, weapons } from "@/data/catalog";
import {
  addBuild,
  createBuildFromPreset,
  emptyCharacterBox,
  removeBuild,
  resetBuild,
  updateBuild,
} from "@/domain/character-box";
import {
  elements,
  skillTypes,
  type CharacterBox,
  type Element,
  type Sequence,
  type UserBuild,
} from "@/domain/models";
import { replaceEchoLoadoutStatsV1 } from "@/game-data/echo-loadout-stats";
import { getResonatorUiAssetId } from "@/game-data/resonator-ui-asset-ids";
import {
  createBrowserCharacterBoxStorage,
  getBrowserCharacterBoxSnapshot,
  subscribeToBrowserCharacterBox,
} from "@/storage/character-box-storage";

import { EchoLoadoutChoice } from "./echo-loadout-choice";
import { ResonatorHeroArtwork } from "./resonator-hero-artwork";
import { WeaponVisualChoice } from "./weapon-visual-choice";
import styles from "./character-box-v4.module.css";

const elementLabels: Record<Element, string> = {
  aero: "Aero",
  glacio: "Glacio",
  electro: "Electro",
  fusion: "Fusion",
  havoc: "Havoc",
  spectro: "Spectro",
};

const skillLabels = {
  basicAttack: "Basic Attack",
  resonanceSkill: "Resonance Skill",
  forteCircuit: "Forte Circuit",
  resonanceLiberation: "Resonance Liberation",
  introSkill: "Intro Skill",
};

const serverBox = emptyCharacterBox();
const isRealData = (entry: { source: { kind: string } }) =>
  entry.source.kind !== "technical-fixture";

export function CharacterBoxApp() {
  const box = useSyncExternalStore(
    subscribeToBrowserCharacterBox,
    getBrowserCharacterBoxSnapshot,
    () => serverBox,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [elementFilter, setElementFilter] = useState<Element | "all">("all");

  const setBox = (
    update: CharacterBox | ((current: CharacterBox) => CharacterBox),
  ) => {
    const next =
      typeof update === "function"
        ? update(getBrowserCharacterBoxSnapshot())
        : update;
    createBrowserCharacterBoxStorage().save(next);
  };

  const editingBuild = box.builds.find((build) => build.id === editingId);
  const visibleResonators = useMemo(
    () =>
      resonators.filter((resonator) => {
        if (!isRealData(resonator)) return false;
        const matchesQuery = resonator.name
          .toLocaleLowerCase("fr")
          .includes(query.toLocaleLowerCase("fr").trim());
        return (
          matchesQuery &&
          (elementFilter === "all" || resonator.element === elementFilter)
        );
      }),
    [query, elementFilter],
  );

  function addResonator(resonatorId: string) {
    const preset = presets.find(
      (candidate) => candidate.resonatorId === resonatorId,
    );
    if (!preset) return;
    const now = new Date().toISOString();
    const build = createBuildFromPreset(preset, {
      id: crypto.randomUUID(),
      now,
    });
    setBox((current) => addBuild(current, build));
    setPickerOpen(false);
    setEditingId(build.id);
  }

  function saveBuild(build: UserBuild) {
    setBox((current) =>
      updateBuild(current, { ...build, updatedAt: new Date().toISOString() }),
    );
  }

  function confirmRemove(build: UserBuild) {
    if (
      window.confirm(
        "Retirer ce Resonator et supprimer son build personnalisé ?",
      )
    ) {
      setBox((current) => removeBuild(current, build.id));
      setEditingId(null);
    }
  }

  function confirmReset(build: UserBuild) {
    const preset = presets.find(
      (candidate) => candidate.id === build.sourcePresetId,
    );
    if (
      preset &&
      window.confirm(
        "Écraser vos modifications et restaurer le preset de départ ?",
      )
    ) {
      saveBuild(resetBuild(build, preset, new Date().toISOString()));
    }
  }

  return (
    <main className={`v4-theme ${styles.page}`}>
      <div className={styles.inner}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>WUWA LAB · Build Bay</p>
            <h1 className={styles.heroTitle}>Character Box</h1>
            <p className={styles.heroLead}>
              Votre atelier de builds personnels : une collection locale de
              Resonators, organisée pour préparer les simulations sans mélanger
              les statistiques permanentes et les effets de combat.
            </p>
            <div className={styles.overview} aria-label="État de la Character Box">
              <div className={styles.overviewItem}>
                <span className={styles.overviewLabel}>Roster</span>
                <span className={styles.overviewValue}>
                  {box.builds.length} Resonator{box.builds.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className={styles.overviewItem}>
                <span className={styles.overviewLabel}>Persistance</span>
                <span className={styles.overviewValue}>Workspace local</span>
              </div>
              <div className={styles.overviewItem}>
                <span className={styles.overviewLabel}>Source permanente</span>
                <span className={styles.overviewValue}>UserBuild.finalStats</span>
              </div>
            </div>
          </div>
          <div className={styles.heroActions}>
            <Link href="/personal-dps" className={styles.actionLink}>
              DPS personnel
            </Link>
            <Link href="/team-dps" className={styles.actionLink}>
              DPS équipe
            </Link>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={styles.primaryAction}
            >
              + Ajouter un Resonator
            </button>
          </div>
        </header>

        <section className={styles.collection} aria-labelledby="character-box-roster">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Collection active</p>
              <h2 id="character-box-roster" className={styles.sectionTitle}>
                Roster de theorycraft
              </h2>
              <p className={styles.sectionDescription}>
                Ouvrez une fiche pour modifier son build. Chaque carte reste
                indépendante et sauvegardée sur cet appareil.
              </p>
            </div>
            <span className={styles.collectionCount}>
              {box.builds.length} / {resonators.filter(isRealData).length} configurés
            </span>
          </div>

          {box.builds.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyInner}>
                <div className={styles.emptyGlyph} aria-hidden="true">◇</div>
                <h2>Votre Character Box est vide</h2>
                <p>
                  Ajoutez un premier Resonator pour générer un build indépendant
                  depuis son preset de départ, puis ajustez-le dans l’atelier.
                </p>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className={styles.primaryAction}
                >
                  Ajouter un Resonator
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.rosterGrid} aria-label="Resonators dans votre Box">
              {box.builds.map((build) => {
                const resonator = resonators.find(
                  (item) => item.id === build.resonatorId,
                )!;
                const weapon = weapons.find(
                  (item) => item.id === build.weapon.weaponId,
                );
                return (
                  <button
                    key={build.id}
                    type="button"
                    onClick={() => setEditingId(build.id)}
                    className={styles.buildCard}
                    data-element={resonator.element}
                    aria-label={`Ouvrir le build de ${resonator.name}`}
                  >
                    <div className={styles.cardTop}>
                      <ResonatorPortrait resonator={resonator} size="card" />
                      <div className={styles.cardIdentity}>
                        <h3 className={styles.cardName}>{resonator.name}</h3>
                        <p className={styles.cardMeta}>
                          {elementLabels[resonator.element]} · {resonator.weaponType} · {resonator.rarity}★
                        </p>
                        <p className={styles.cardWeapon}>
                          Niv. {build.characterLevel} · {weapon?.name ?? "Arme inconnue"}
                        </p>
                      </div>
                      <span className={styles.sequenceBadge}>S{build.sequence}</span>
                    </div>
                    <div className={styles.cardStats}>
                      <span className={styles.cardStat}>
                        <span className={styles.cardStatLabel}>ATK</span>
                        <strong className={styles.cardStatValue}>{build.finalStats.attack}</strong>
                      </span>
                      <span className={styles.cardStat}>
                        <span className={styles.cardStatLabel}>Crit Rate</span>
                        <strong className={styles.cardStatValue}>{build.finalStats.critRate}%</strong>
                      </span>
                      <span className={styles.cardStat}>
                        <span className={styles.cardStatLabel}>Echoes</span>
                        <strong className={styles.cardStatValue}>{build.echoLoadout?.echoes.length ?? 0}/5</strong>
                      </span>
                    </div>
                    <div className={styles.cardFooter}>
                      <span>Build local · preset {build.sourcePresetId}</span>
                      <strong>Ouvrir →</strong>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {pickerOpen && (
        <Picker
          builds={box.builds}
          query={query}
          setQuery={setQuery}
          elementFilter={elementFilter}
          setElementFilter={setElementFilter}
          visibleResonators={visibleResonators}
          onAdd={addResonator}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {editingBuild && (
        <BuildEditor
          build={editingBuild}
          onChange={saveBuild}
          onClose={() => setEditingId(null)}
          onRemove={() => confirmRemove(editingBuild)}
          onReset={() => confirmReset(editingBuild)}
        />
      )}
    </main>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  panelClassName,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      className={styles.modalBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`${styles.modalPanel} ${panelClassName ?? ""}`}>
        <header className={styles.modalHeader}>
          <div>
            <p className={styles.modalEyebrow}>Character Box</p>
            <h2 className={styles.modalTitle}>{title}</h2>
            <p className={styles.modalSubtitle}>{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={styles.closeButton}
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Picker({
  builds,
  query,
  setQuery,
  elementFilter,
  setElementFilter,
  visibleResonators,
  onAdd,
  onClose,
}: {
  builds: UserBuild[];
  query: string;
  setQuery: (value: string) => void;
  elementFilter: Element | "all";
  setElementFilter: (value: Element | "all") => void;
  visibleResonators: typeof resonators;
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell
      title="Ajouter un Resonator"
      subtitle="Choisissez un personnage réel du catalogue local pour créer son build."
      onClose={onClose}
    >
      <div className={styles.pickerToolbar}>
        <label className={styles.fieldLabel}>
          Recherche
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom du Resonator"
            className={styles.fieldControl}
            type="search"
          />
        </label>
        <label className={styles.fieldLabel}>
          Élément
          <select
            value={elementFilter}
            onChange={(event) =>
              setElementFilter(event.target.value as Element | "all")
            }
            className={styles.selectControl}
          >
            <option value="all">Tous</option>
            {elements.map((element) => (
              <option key={element} value={element}>
                {elementLabels[element]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.pickerBody}>
        <div className={styles.pickerSummary} aria-live="polite">
          <span><strong>{visibleResonators.length}</strong> Resonator{visibleResonators.length > 1 ? "s" : ""}</span>
          <span>Un personnage déjà présent ne peut pas être ajouté deux fois.</span>
        </div>
        <div className={styles.pickerGrid}>
          {visibleResonators.map((resonator) => {
            const owned = builds.some(
              (build) => build.resonatorId === resonator.id,
            );
            return (
              <article
                key={resonator.id}
                className={styles.pickerCard}
                data-element={resonator.element}
              >
                <ResonatorPortrait resonator={resonator} size="picker" />
                <div className={styles.pickerIdentity}>
                  <h3 className={styles.pickerName}>{resonator.name}</h3>
                  <p className={styles.pickerMeta}>
                    {elementLabels[resonator.element]} · {resonator.weaponType} · {resonator.rarity}★
                  </p>
                </div>
                <button
                  type="button"
                  disabled={owned}
                  onClick={() => onAdd(resonator.id)}
                  className={styles.addCardButton}
                >
                  {owned ? "Ajouté" : "Ajouter"}
                </button>
              </article>
            );
          })}
          {visibleResonators.length === 0 && (
            <p className={styles.noResults}>Aucun Resonator ne correspond à ces filtres.</p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function BuildEditor({
  build,
  onChange,
  onClose,
  onRemove,
  onReset,
}: {
  build: UserBuild;
  onChange: (build: UserBuild) => void;
  onClose: () => void;
  onRemove: () => void;
  onReset: () => void;
}) {
  const resonator = resonators.find((item) => item.id === build.resonatorId)!;
  const uiAssetId = getResonatorUiAssetId(resonator.id);
  const compatibleWeapons = weapons.filter(
    (weapon) => weapon.type === resonator.weaponType && isRealData(weapon),
  );
  const numberField = (
    value: number,
    setValue: (value: number) => void,
    options?: { min?: number; max?: number },
  ) => (
    <input
      type="number"
      min={options?.min ?? 0}
      max={options?.max}
      step="any"
      value={value}
      onChange={(event) => {
        const minimum = options?.min ?? 0;
        const parsed = Number(event.target.value);
        const bounded = Math.max(
          minimum,
          Number.isFinite(parsed) ? parsed : minimum,
        );
        setValue(
          options?.max === undefined
            ? bounded
            : Math.min(options.max, bounded),
        );
      }}
      className={styles.fieldControl}
    />
  );
  const field = (label: string, control: React.ReactNode) => (
    <label className={styles.editorField}>
      <span>{label}</span>
      {control}
    </label>
  );
  const equippedWeapon = weapons.find((item) => item.id === build.weapon.weaponId);
  const characterBase = resonator.baseStats?.find(
    (entry) => entry.level === build.characterLevel,
  );
  const weaponBase =
    build.weapon.level === 90 ? equippedWeapon?.level90Stats : undefined;
  const echoStatBasis =
    characterBase && weaponBase
      ? {
          hp: characterBase.hp,
          attack: characterBase.attack + weaponBase.baseAttack,
          defense: characterBase.defense,
        }
      : undefined;
  const echoCount = build.echoLoadout?.echoes.length ?? 0;

  const changeEchoLoadout = (echoLoadout: UserBuild["echoLoadout"]) => {
    if (!echoStatBasis) {
      onChange({ ...build, echoLoadout });
      return;
    }
    try {
      const resolved = replaceEchoLoadoutStatsV1(
        build.finalStats,
        echoStatBasis,
        build.echoLoadout,
        echoLoadout,
      );
      onChange({ ...build, echoLoadout, finalStats: resolved.finalStats });
    } catch (error) {
      console.error(
        "Unable to replace Echo permanent stats without double counting",
        error instanceof Error ? error.message : "unknown error",
      );
      window.alert(
        "Les stats Echo n’ont pas été sauvegardées : le panneau permanent actuel ne permet pas un remplacement sûr sans double comptage.",
      );
    }
  };

  return (
    <ModalShell
      title={`Build · ${resonator.name}`}
      subtitle="Atelier de configuration · sauvegarde locale automatique"
      onClose={onClose}
      panelClassName={styles.editorPanel}
    >
      <div className={styles.editorLayout}>
        <aside className={styles.editorRail} data-element={resonator.element}>
          {uiAssetId ? (
            <ResonatorHeroArtwork assetId={uiAssetId} name={resonator.name} />
          ) : null}
          <div className={styles.editorIdentity}>
            <ResonatorPortrait resonator={resonator} size="card" />
            <div>
              <h3 className={styles.editorName}>{resonator.name}</h3>
              <p className={styles.editorMeta}>
                {elementLabels[resonator.element]} · {resonator.weaponType} · {resonator.rarity}★
              </p>
            </div>
          </div>
          <div className={styles.editorRailFacts}>
            <div className={styles.editorFact}><span>Niveau</span><strong>{build.characterLevel}</strong></div>
            <div className={styles.editorFact}><span>Chaîne</span><strong>S{build.sequence}</strong></div>
            <div className={styles.editorFact}><span>Arme</span><strong>{equippedWeapon?.name ?? "—"}</strong></div>
            <div className={styles.editorFact}><span>Echoes</span><strong>{echoCount}/5</strong></div>
            <div className={styles.editorFact}>
              <span>Main Echo</span>
              <strong>{build.echoLoadout?.mainEchoId ? "Configuré" : "—"}</strong>
            </div>
          </div>
          <div className={styles.ruleNotice}>
            <strong>Règle anti-double comptage.</strong><br />
            L’arme et le loadout Echo sont des entrées structurées du Build Resolver. Les moteurs de combat continuent à consommer uniquement <code>UserBuild.finalStats</code>. À chaque changement d’Echo, l’ancienne contribution permanente est retirée avant d’appliquer la nouvelle.
          </div>
        </aside>

        <div className={styles.editorMain}>
          <div className={styles.editorStack}>
            <EditorSection title="Progression" hint="Identité du build">
              <div className={styles.controlGrid2}>
                {field(
                  "Niveau du personnage",
                  numberField(
                    build.characterLevel,
                    (characterLevel) => onChange({ ...build, characterLevel }),
                    { min: 1, max: 90 },
                  ),
                )}
                {field(
                  "Resonance Chain",
                  <select
                    value={build.sequence}
                    onChange={(event) =>
                      onChange({
                        ...build,
                        sequence: Number(event.target.value) as Sequence,
                      })
                    }
                    className={styles.selectControl}
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((sequence) => (
                      <option key={sequence} value={sequence}>S{sequence}</option>
                    ))}
                  </select>,
                )}
              </div>
            </EditorSection>

            <EditorSection title="Aptitudes" hint="Niveaux de talents">
              <div className={styles.controlGrid5}>
                {skillTypes.map((skill) =>
                  field(
                    skillLabels[skill],
                    numberField(
                      build.skillLevels[skill],
                      (value) =>
                        onChange({
                          ...build,
                          skillLevels: { ...build.skillLevels, [skill]: value },
                        }),
                      { min: 1, max: 10 },
                    ),
                  ),
                )}
              </div>
            </EditorSection>

            <EditorSection title="Arme" hint="Équipement du build">
              <div className={styles.editorField}>
                <span>Arme compatible</span>
                <WeaponVisualChoice
                  compact
                  value={build.weapon.weaponId}
                  options={compatibleWeapons}
                  onChange={(weaponId) =>
                    onChange({
                      ...build,
                      weapon: { ...build.weapon, weaponId },
                    })
                  }
                />
              </div>
              <div className={styles.controlGrid2}>
                {field(
                  "Niveau de l’arme",
                  numberField(
                    build.weapon.level,
                    (level) => onChange({ ...build, weapon: { ...build.weapon, level } }),
                    { min: 1, max: 90 },
                  ),
                )}
                {field(
                  "Rang",
                  numberField(
                    build.weapon.rank,
                    (rank) => onChange({ ...build, weapon: { ...build.weapon, rank } }),
                    { min: 1, max: 5 },
                  ),
                )}
              </div>
            </EditorSection>

            <EditorSection title="Echoes" hint="5 slots · coût 12 · resolver exact">
              <EchoLoadoutChoice
                key={build.id}
                value={build.echoLoadout}
                onChange={changeEchoLoadout}
              />
            </EditorSection>

            <div className={styles.editorActions}>
              <button type="button" onClick={onRemove} className={styles.dangerAction}>
                Retirer de la Box
              </button>
              <div className={styles.editorActionsRight}>
                <button type="button" onClick={onReset} className={styles.secondaryAction}>
                  Réinitialiser vers le preset
                </button>
                <button type="button" onClick={onClose} className={styles.primaryAction}>
                  Terminer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function ResonatorPortrait({
  resonator,
  size,
}: {
  resonator: (typeof resonators)[number];
  size: "picker" | "card";
}) {
  const [failed, setFailed] = useState(false);

  if (!resonator.portrait || failed) {
    return (
      <div
        className={styles.portrait}
        data-size={size}
        role="img"
        aria-label={`Portrait de ${resonator.name} indisponible`}
      >
        <span className={styles.portraitFallback}>Image indisponible</span>
      </div>
    );
  }

  return (
    <div className={styles.portrait} data-size={size}>
      <Image
        src={resonator.portrait.src}
        alt={resonator.portrait.alt}
        fill
        sizes={size === "card" ? "116px" : "70px"}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function EditorSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.editorSection}>
      <div className={styles.editorSectionHeader}>
        <h3 className={styles.editorSectionTitle}>{title}</h3>
        {hint ? <span className={styles.editorSectionHint}>{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}
