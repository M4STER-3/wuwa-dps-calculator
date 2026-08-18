"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { emptyCharacterBox } from "@/domain/character-box";
import { calculatePersonalDpsV1 } from "@/domain/personal-dps-engine";
import type { Element, FinalStats } from "@/domain/models";
import {
  personalDpsPilotProfiles10R1,
} from "@/data/personal-dps-pilots-10r1";
import {
  getBrowserCharacterBoxSnapshot,
  subscribeToBrowserCharacterBox,
} from "@/storage/character-box-storage";

const serverBox = emptyCharacterBox();
const formatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const format = (value: number) => formatter.format(value);

const pilotName: Readonly<Record<string, string>> = {
  aemeath: "Aemeath",
  calcharo: "Calcharo",
  changli: "Changli",
};

const pilotElements: Readonly<Record<string, Element>> = {
  aemeath: "fusion",
  calcharo: "electro",
  changli: "fusion",
};

function cloneStats(stats: FinalStats): FinalStats {
  return structuredClone(stats);
}

export function UniversalPersonalDpsLab() {
  const box = useSyncExternalStore(
    subscribeToBrowserCharacterBox,
    getBrowserCharacterBoxSnapshot,
    () => serverBox,
  );
  const supportedIds = useMemo(
    () => new Set(personalDpsPilotProfiles10R1.map((profile) => profile.resonatorId)),
    [],
  );
  const pilotBuilds = box.builds.filter((build) => supportedIds.has(build.resonatorId));
  const [selectedBuildId, setSelectedBuildId] = useState("");
  const build =
    pilotBuilds.find((candidate) => candidate.id === selectedBuildId) ??
    pilotBuilds[0];
  const profile = build
    ? personalDpsPilotProfiles10R1.find(
        (candidate) => candidate.resonatorId === build.resonatorId,
      )
    : undefined;
  const [sandbox, setSandbox] = useState<FinalStats | null>(null);
  const stats = sandbox ?? build?.finalStats;
  const [enemyLevel, setEnemyLevel] = useState(90);
  const [enemyResistance, setEnemyResistance] = useState(0.1);
  const [rotationId, setRotationId] = useState("");
  const selectedRotationId =
    profile?.rotations.some((rotation) => rotation.id === rotationId)
      ? rotationId
      : profile?.rotations[0]?.id ?? "";

  const result = useMemo(() => {
    if (!build || !profile || !stats || !selectedRotationId) return undefined;
    const element = pilotElements[profile.resonatorId] ?? profile.element;
    return calculatePersonalDpsV1({
      profile,
      rotationId: selectedRotationId,
      finalStats: stats,
      attackerLevel: build.characterLevel,
      skillLevels: build.skillLevels,
      target: {
        level: enemyLevel,
        elementalResistance: { [element]: enemyResistance },
        physicalResistance: 0.1,
      },
    });
  }, [build, profile, stats, selectedRotationId, enemyLevel, enemyResistance]);

  const editStat = (
    key: keyof Pick<
      FinalStats,
      "attack" | "hp" | "defense" | "critRate" | "critDamage" | "energyRegen"
    >,
    value: number,
  ) => {
    if (!stats || !Number.isFinite(value)) return;
    setSandbox({ ...cloneStats(stats), [key]: value });
  };

  if (!pilotBuilds.length) {
    return (
      <main className="lab-shell">
        <header className="lab-header">
          <div>
            <p className="eyebrow">UNIVERSAL PERSONAL DPS · D2</p>
            <h1>DPS personnel</h1>
          </div>
          <Link className="lab-link" href="/character-box">← Character Box</Link>
        </header>
        <section className="lab-empty">
          <h2>Ajoute d’abord un des trois pilotes</h2>
          <p>
            Cette première validation universelle accepte Aemeath, Calcharo et Changli.
            Crée ou charge leur build dans Character Box, puis reviens ici.
          </p>
        </section>
      </main>
    );
  }

  const selectedRotation = profile?.rotations.find(
    (rotation) => rotation.id === selectedRotationId,
  );

  return (
    <main className="lab-shell">
      <header className="lab-header">
        <div>
          <p className="eyebrow">UNIVERSAL PERSONAL DPS · D2 · 3 PILOTES</p>
          <h1>DPS personnel</h1>
          <p>
            Même moteur pour Aemeath, Calcharo et Changli. Les valeurs partent de
            <code> UserBuild.finalStats</code> et les Motion Values sont des données,
            jamais des branches spécifiques au personnage.
          </p>
        </div>
        <Link className="lab-link" href="/character-box">← Character Box</Link>
      </header>

      <div className="lab-grid">
        <aside className="lab-column">
          <Panel title="Build">
            <label>
              Pilote sauvegardé
              <select
                value={build?.id}
                onChange={(event) => {
                  setSelectedBuildId(event.target.value);
                  setSandbox(null);
                  setRotationId("");
                }}
              >
                {pilotBuilds.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {pilotName[candidate.resonatorId] ?? candidate.resonatorId} · Lv
                    {candidate.characterLevel} · S{candidate.sequence}
                  </option>
                ))}
              </select>
            </label>
            <p className="hint">
              Source permanente unique : Character Box → <code>finalStats</code>.
            </p>
            <div className="stat-grid">
              {(["attack", "hp", "defense", "critRate", "critDamage", "energyRegen"] as const).map(
                (key) => (
                  <label key={key}>
                    {key}
                    <input
                      type="number"
                      value={stats?.[key] ?? 0}
                      onChange={(event) => editStat(key, Number(event.target.value))}
                    />
                  </label>
                ),
              )}
            </div>
            <button type="button" onClick={() => setSandbox(null)}>
              Réinitialiser depuis le build
            </button>
          </Panel>

          <Panel title="Cible">
            <div className="stat-grid">
              <label>
                Niveau ennemi
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={enemyLevel}
                  onChange={(event) => setEnemyLevel(Number(event.target.value))}
                />
              </label>
              <label>
                RES élémentaire
                <input
                  type="number"
                  step="0.01"
                  value={enemyResistance}
                  onChange={(event) => setEnemyResistance(Number(event.target.value))}
                />
              </label>
            </div>
            <p className="hint">
              Pour reproduire les fixtures WutheringTools : ennemi Lv90 et RES 0,10.
            </p>
          </Panel>
        </aside>

        <section className="lab-column lab-main">
          <Panel title="Rotation">
            <label>
              Rotation vérifiée
              <select
                value={selectedRotationId}
                onChange={(event) => setRotationId(event.target.value)}
              >
                {profile?.rotations.map((rotation) => (
                  <option key={rotation.id} value={rotation.id}>
                    {rotation.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedRotation?.sourceNote && (
              <p className="hint">{selectedRotation.sourceNote}</p>
            )}
            <div className="action-meta">
              <span>{pilotName[profile?.resonatorId ?? ""] ?? profile?.resonatorId}</span>
              <span>{profile?.element}</span>
              <span>{selectedRotation?.steps.length ?? 0} étapes</span>
              <span>
                {selectedRotation?.durationSeconds
                  ? `${selectedRotation.durationSeconds}s vérifiées`
                  : "durée non vérifiée"}
              </span>
            </div>
          </Panel>

          <Panel title="Résultat personnel">
            {!result ? (
              <div className="unsupported">Calcul indisponible.</div>
            ) : (
              <>
                <span className={`status ${result.status === "partial" ? "partial" : "complete"}`}>
                  {result.status === "partial" ? "PARTIAL" : "FORMULES SUPPORTÉES"}
                </span>
                <div className="damage-cards">
                  <Metric label="Total Non Crit" value={result.totals.nonCrit} />
                  <Metric label="Total Crit" value={result.totals.crit} />
                  <Metric label="Total attendu" value={result.totals.expected} />
                  {result.dps ? (
                    <Metric label="DPS attendu" value={result.dps.expected} />
                  ) : (
                    <div>
                      <small>DPS attendu</small>
                      <strong>—</strong>
                    </div>
                  )}
                </div>
                {!result.dps && (
                  <p className="warning">
                    Aucun DPS par seconde n’est affiché sans durée de rotation vérifiée.
                    Le total de dégâts reste calculé. Nous n’inventons pas un timing.
                  </p>
                )}
                {!!result.unsupportedSteps.length && (
                  <p className="warning">
                    {result.unsupportedSteps.length} étape(s) non supportée(s) sont exclues,
                    jamais remplacées par zéro.
                  </p>
                )}
              </>
            )}
          </Panel>

          <Panel title="Détail action par action">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>×</th>
                  <th>Type</th>
                  <th>MV</th>
                  <th>Non Crit</th>
                  <th>Crit</th>
                  <th>Attendu</th>
                </tr>
              </thead>
              <tbody>
                {result?.resolvedSteps.map((step) => (
                  <tr key={`${step.index}-${step.actionId}`}>
                    <td>{step.actionName}</td>
                    <td>{step.count}</td>
                    <td>{step.result.effectiveDamageType}</td>
                    <td>{format(step.result.totalMotionValue * 100)}%</td>
                    <td>{format(step.subtotal.nonCrit)}</td>
                    <td>{format(step.subtotal.crit)}</td>
                    <td>{format(step.subtotal.expected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </section>

        <aside className="lab-column">
          <Panel title="Validation WutheringTools">
            <p className="hint">
              Les tests automatiques utilisent les mêmes stats affichées par
              WutheringTools pour contrôler les dégâts de chaque action.
            </p>
            <ul>
              <li>Aemeath : benchmark externe déjà versionné.</li>
              <li>Calcharo : fixture naked Lv90, ATK 437.</li>
              <li>Changli : fixture naked Lv80, ATK 412.</li>
            </ul>
          </Panel>
          <Panel title="État D2">
            <p>
              Les dégâts standards des trois pilotes sont data-driven. Les mécaniques
              runtime/états/ressources restent soumises au Temporal Engine et seront
              ajoutées sans logique spécifique par personnage.
            </p>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="lab-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{format(value)}</strong>
    </div>
  );
}
