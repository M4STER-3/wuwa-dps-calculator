"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { presets, resonators, weapons } from "@/data/catalog";
import { getConfiguredBuildOptions } from "@/data/build-options";
import {
  addBuild,
  clampBuildNumber,
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
  type FinalStats,
  type Sequence,
  type UserBuild,
} from "@/domain/models";
import {
  createBrowserCharacterBoxStorage,
  getBrowserCharacterBoxSnapshot,
  subscribeToBrowserCharacterBox,
} from "@/storage/character-box-storage";
import { ResonatorPortrait } from "./resonator-portrait";

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
const damageLabels: Record<keyof FinalStats["damageTypeBonus"], string> = {
  basicAttack: "Basic Attack DMG",
  heavyAttack: "Heavy Attack DMG",
  resonanceSkill: "Resonance Skill DMG",
  resonanceLiberation: "Resonance Liberation DMG",
  introSkill: "Intro Skill DMG",
  echoSkill: "Echo Skill DMG",
};
const serverBox = emptyCharacterBox();
const selectableResonators = resonators.filter(
  (resonator) => resonator.source.kind !== "technical-fixture",
);

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
      selectableResonators.filter((resonator) => {
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
    <main className="min-h-screen px-4 py-6 sm:px-8 lg:px-12 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-[var(--line)] pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
              Build Planner · V0.1
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Character Box
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Votre collection de Resonators et leurs builds personnalisés,
              sauvegardés sur cet appareil.
            </p>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[#07110f] hover:bg-white"
          >
            + Ajouter un personnage
          </button>
        </header>

        {box.builds.length === 0 ? (
          <section className="grid min-h-[28rem] place-items-center rounded-2xl border border-dashed border-[var(--line)] bg-[rgba(17,21,29,.72)] p-8 text-center">
            <div className="max-w-md">
              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--panel-strong)] text-2xl">
                ◇
              </div>
              <h2 className="text-xl font-semibold">Votre Box est vide</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Ajoutez un premier Resonator pour créer un build indépendant
                depuis son preset de départ.
              </p>
              <button
                onClick={() => setPickerOpen(true)}
                className="mt-6 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[#07110f]"
              >
                Ajouter un personnage
              </button>
            </div>
          </section>
        ) : (
          <section
            aria-label="Resonators dans votre Box"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
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
                  onClick={() => setEditingId(build.id)}
                  className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] text-left transition hover:-translate-y-0.5 hover:border-[var(--accent-strong)]"
                >
                  <div className="flex gap-4 p-5">
                    <ResonatorPortrait resonator={resonator} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="truncate font-semibold">
                          {resonator.name}
                        </h2>
                        <span className="rounded-md bg-white/5 px-2 py-1 text-xs">
                          S{build.sequence}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                        {elementLabels[resonator.element]} ·{" "}
                        {resonator.weaponType}
                      </p>
                      <p className="mt-3 truncate text-sm text-[var(--muted)]">
                        Niv. {build.characterLevel} ·{" "}
                        {weapon?.name ?? "Arme inconnue"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 border-t border-[var(--line)] bg-black/10 text-center text-xs text-[var(--muted)]">
                    <span className="p-3">
                      ATK{" "}
                      <b className="ml-1 text-white">
                        {build.finalStats.attack}
                      </b>
                    </span>
                    <span className="border-x border-[var(--line)] p-3">
                      CR{" "}
                      <b className="ml-1 text-white">
                        {build.finalStats.critRate}%
                      </b>
                    </span>
                    <span className="p-3">
                      CD{" "}
                      <b className="ml-1 text-white">
                        {build.finalStats.critDamage}%
                      </b>
                    </span>
                  </div>
                </button>
              );
            })}
          </section>
        )}
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
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="mx-auto max-w-5xl rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-[var(--line)] bg-[rgba(17,21,29,.96)] p-5 backdrop-blur">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--line)] text-xl text-[var(--muted)] hover:text-white"
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
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
  visibleResonators: typeof selectableResonators;
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell
      title="Ajouter un Resonator"
      subtitle="Choisissez un Resonator configuré dans le catalogue."
      onClose={onClose}
    >
      <div className="grid gap-3 border-b border-[var(--line)] p-5 sm:grid-cols-[1fr_13rem]">
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Recherche
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom du Resonator"
            className="rounded-xl border border-[var(--line)] bg-black/20 px-4 py-3 text-sm font-normal normal-case tracking-normal text-white"
          />
        </label>
        <label className="grid gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Élément
          <select
            value={elementFilter}
            onChange={(event) =>
              setElementFilter(event.target.value as Element | "all")
            }
            className="rounded-xl border border-[var(--line)] bg-[#0e1219] px-4 py-3 text-sm font-normal normal-case tracking-normal text-white"
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
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {visibleResonators.map((resonator) => {
          const owned = builds.some(
            (build) => build.resonatorId === resonator.id,
          );
          return (
            <article
              key={resonator.id}
              className="flex items-center gap-4 rounded-xl border border-[var(--line)] bg-black/10 p-4"
            >
              <ResonatorPortrait
                resonator={resonator}
                className="h-16 w-16"
                sizes="64px"
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{resonator.name}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {elementLabels[resonator.element]} · {resonator.weaponType} ·{" "}
                  {resonator.rarity}★
                </p>
              </div>
              <button
                disabled={owned}
                onClick={() => onAdd(resonator.id)}
                className="rounded-lg border border-[var(--accent-strong)] px-3 py-2 text-xs font-bold text-[var(--accent)] disabled:border-[var(--line)] disabled:text-[var(--muted)]"
              >
                {owned ? "Ajouté" : "Ajouter"}
              </button>
            </article>
          );
        })}
        {visibleResonators.length === 0 && (
          <p className="py-12 text-center text-sm text-[var(--muted)] sm:col-span-2">
            Aucun résultat.
          </p>
        )}
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
  const preset = presets.find((item) => item.id === build.sourcePresetId);
  const configuredOptions = getConfiguredBuildOptions(resonator.id);
  const numberField = (
    value: number,
    setValue: (value: number) => void,
    options?: { min?: number; max?: number; integer?: boolean },
  ) => (
    <input
      type="number"
      min={options?.min ?? 0}
      max={options?.max}
      step={options?.integer ? 1 : "any"}
      value={value}
      onChange={(event) =>
        setValue(
          clampBuildNumber(
            Number(event.target.value),
            options?.min ?? 0,
            options?.max,
            options?.integer,
          ),
        )
      }
      className="w-full rounded-lg border border-[var(--line)] bg-black/20 px-3 py-2 text-white"
    />
  );
  const field = (label: string, control: React.ReactNode) => (
    <label className="grid gap-2 text-xs font-semibold text-[var(--muted)]">
      <span>{label}</span>
      {control}
    </label>
  );
  const patchStats = (patch: Partial<FinalStats>) =>
    onChange({ ...build, finalStats: { ...build.finalStats, ...patch } });

  return (
    <ModalShell
      title={resonator.name}
      subtitle="Édition du build · sauvegarde locale automatique"
      onClose={onClose}
    >
      <div className="space-y-6 p-5 sm:p-7">
        <aside className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-amber-100">
          <b>
            {resonator.source.kind === "technical-fixture"
              ? "Fixture technique :"
              : `${preset?.label ?? "Preset recommandé"} :`}
          </b>{" "}
          {resonator.source.kind === "technical-fixture"
            ? "ces valeurs ne sont pas une recommandation de build. "
            : "les statistiques initiales correspondent aux seuils inférieurs de recommandations communautaires. "}
          Les statistiques finales sont saisies directement et ne sont jamais
          recalculées depuis l’arme, le Sonata, le Main Echo ou l’arbre.
        </aside>
        <EditorSection title="Progression">
          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              "Niveau du personnage",
              numberField(
                build.characterLevel,
                (characterLevel) => onChange({ ...build, characterLevel }),
                { min: 1, max: 90, integer: true },
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
                className="rounded-lg border border-[var(--line)] bg-[#0e1219] px-3 py-2 text-white"
              >
                {[0, 1, 2, 3, 4, 5, 6].map((sequence) => (
                  <option key={sequence} value={sequence}>
                    S{sequence}
                  </option>
                ))}
              </select>,
            )}
          </div>
        </EditorSection>
        <EditorSection title="Aptitudes">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                  { min: 1, max: 10, integer: true },
                ),
              ),
            )}
          </div>
        </EditorSection>
        <EditorSection title="Arme">
          <div className="grid gap-4 sm:grid-cols-3">
            <BuildOptionControl
              label="Arme compatible"
              options={configuredOptions.weapons}
              value={build.weapon.weaponId}
              onChange={(weaponId) =>
                onChange({ ...build, weapon: { ...build.weapon, weaponId } })
              }
            />
            {field(
              "Niveau",
              numberField(
                build.weapon.level,
                (level) =>
                  onChange({ ...build, weapon: { ...build.weapon, level } }),
                { min: 1, max: 90, integer: true },
              ),
            )}
            {field(
              "Rang",
              numberField(
                build.weapon.rank,
                (rank) =>
                  onChange({ ...build, weapon: { ...build.weapon, rank } }),
                { min: 1, max: 5, integer: true },
              ),
            )}
          </div>
        </EditorSection>
        <EditorSection title="Statistiques finales">
          <p className="mb-4 text-xs leading-5 text-[var(--muted)]">
            Valeurs permanentes affichées sur le panneau du personnage. Les
            pourcentages sont saisis en points (ex. 65 pour 65 %).
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["HP", "hp"],
                ["ATK", "attack"],
                ["DEF", "defense"],
                ["Crit Rate (%)", "critRate"],
                ["Crit DMG (%)", "critDamage"],
                ["Energy Regen (%)", "energyRegen"],
                ["Healing Bonus (%)", "healingBonus"],
              ] as const
            ).map(([label, key]) =>
              field(
                label,
                numberField(build.finalStats[key], (value) =>
                  patchStats({ [key]: value }),
                ),
              ),
            )}
          </div>
        </EditorSection>
        <EditorSection title="Bonus élémentaires">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {elements.map((element) =>
              field(
                `${elementLabels[element]} DMG (%)`,
                numberField(
                  build.finalStats.elementalDamageBonus[element],
                  (value) =>
                    patchStats({
                      elementalDamageBonus: {
                        ...build.finalStats.elementalDamageBonus,
                        [element]: value,
                      },
                    }),
                ),
              ),
            )}
          </div>
        </EditorSection>
        <EditorSection title="Bonus par catégorie">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              Object.keys(damageLabels) as Array<
                keyof FinalStats["damageTypeBonus"]
              >
            ).map((key) =>
              field(
                `${damageLabels[key]} (%)`,
                numberField(build.finalStats.damageTypeBonus[key], (value) =>
                  patchStats({
                    damageTypeBonus: {
                      ...build.finalStats.damageTypeBonus,
                      [key]: value,
                    },
                  }),
                ),
              ),
            )}
          </div>
        </EditorSection>
        <EditorSection title="Sonata & Main Echo">
          <div className="grid gap-4 sm:grid-cols-2">
            <BuildOptionControl
              label="Sonata"
              options={configuredOptions.sonatas}
              value={build.sonataId}
              onChange={(sonataId) => onChange({ ...build, sonataId })}
            />
            <BuildOptionControl
              label="Main Echo"
              options={configuredOptions.mainEchoes}
              value={build.mainEchoId}
              onChange={(mainEchoId) => onChange({ ...build, mainEchoId })}
            />
          </div>
          {preset && (
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
              Recommandation du preset :{" "}
              {configuredOptions.sonatas.find(
                (item) => item.id === preset.sonataId,
              )?.name ?? "—"}
              {" · "}
              {configuredOptions.mainEchoes.find(
                (item) => item.id === preset.mainEchoId,
              )?.name ?? "—"}
            </p>
          )}
        </EditorSection>
        <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:justify-between">
          <button
            onClick={onRemove}
            className="rounded-xl border border-red-400/40 px-4 py-3 text-sm font-semibold text-[var(--danger)]"
          >
            Retirer de la Box
          </button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onReset}
              className="rounded-xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              Réinitialiser vers le preset
            </button>
            <button
              onClick={onClose}
              className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-[#07110f]"
            >
              Terminer
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function BuildOptionControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: string; name: string }[];
  value?: string;
  onChange: (id: string) => void;
}) {
  if (options.length === 0) {
    return (
      <div className="grid gap-2 text-xs font-semibold text-[var(--muted)]">
        <span>{label}</span>
        <p className="rounded-lg border border-dashed border-[var(--line)] bg-black/10 px-3 py-2.5 font-normal">
          Aucune option configurée
        </p>
      </div>
    );
  }

  if (options.length === 1) {
    return (
      <div className="grid gap-2 text-xs font-semibold text-[var(--muted)]">
        <span>{label}</span>
        <p className="rounded-lg border border-[var(--line)] bg-black/10 px-3 py-2.5 font-medium text-white">
          {options[0].name}
        </p>
      </div>
    );
  }

  const hasCurrentValue = options.some((option) => option.id === value);
  return (
    <label className="grid gap-2 text-xs font-semibold text-[var(--muted)]">
      <span>{label}</span>
      <select
        value={hasCurrentValue ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-[var(--line)] bg-[#0e1219] px-3 py-2 text-white"
      >
        {!hasCurrentValue && (
          <option value="" disabled>
            Sélectionnez une option
          </option>
        )}
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function EditorSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-black/10 p-4 sm:p-5">
      <h3 className="mb-4 font-semibold">{title}</h3>
      {children}
    </section>
  );
}
