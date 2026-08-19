"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { emptyCharacterBox } from "@/domain/character-box";
import {
  simulatePersonalDpsBuildV1,
  type PersonalDpsSimulationResultV1,
} from "@/domain/personal-dps-simulation";
import { personalDpsPilotProfiles10R1 } from "@/data/personal-dps-pilots-10r1";
import { resonators } from "@/data/catalog";
import {
  getBrowserCharacterBoxSnapshot,
  subscribeToBrowserCharacterBox,
} from "@/storage/character-box-storage";

const serverBox = emptyCharacterBox();
const formatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const format = (value: number) => formatter.format(value);
const supportedIds = new Set(
  personalDpsPilotProfiles10R1.map((profile) => profile.resonatorId),
);

const pilotName: Readonly<Record<string, string>> = {
  aemeath: "Aemeath",
  calcharo: "Calcharo",
  changli: "Changli",
};

export function UniversalPersonalDpsLab() {
  const box = useSyncExternalStore(
    subscribeToBrowserCharacterBox,
    getBrowserCharacterBoxSnapshot,
    () => serverBox,
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
  const resonator = build
    ? resonators.find((candidate) => candidate.id === build.resonatorId)
    : undefined;
  const [enemyLevel, setEnemyLevel] = useState(90);
  const [enemyResistance, setEnemyResistance] = useState(0.1);
  const [rotationId, setRotationId] = useState("");
  const selectedRotationId =
    profile?.rotations.some((rotation) => rotation.id === rotationId)
      ? rotationId
      : profile?.rotations[0]?.id ?? "";

  let result: PersonalDpsSimulationResultV1 | undefined;
  let calculationError: string | undefined;
  if (build && profile && resonator && selectedRotationId) {
    try {
      result = simulatePersonalDpsBuildV1({
        profile,
        resonator,
        build,
        rotationId: selectedRotationId,
        target: {
          id: "personal-dps-target",
          level: enemyLevel,
          elementalResistance: { [profile.element]: enemyResistance },
          physicalResistance: 0.1,
        },
      });
    } catch (error) {
      calculationError = error instanceof Error ? error.message : "Calcul indisponible.";
    }
  }

  if (!pilotBuilds.length) {
    return (
      <main className="lab-shell">
        <header className="lab-header">
          <div>
            <p className="eyebrow">DPS PERSONNEL</p>
            <h1>Calcul DPS</h1>
          </div>
          <Link className="lab-link" href="/character-box">← Character Box</Link>
        </header>
        <section className="lab-empty">
          <h2>Ajoute d’abord Aemeath, Calcharo ou Changli</h2>
          <p>Le calcul utilise directement le build sauvegardé dans Character Box.</p>
        </section>
      </main>
    );
  }

  const selectedRotation = profile?.rotations.find(
    (rotation) => rotation.id === selectedRotationId,
  );
  const actionNames = new Map(
    profile?.actions.map((action) => [action.id, action.name] as const) ?? [],
  );
  const timingLabel = result
    ? `${format(result.rotationDurationSeconds)} s · ${
        result.timingConfidence === "estimated-calibrated" ? "calibré" : "estimé"
      }`
    : "timing indisponible";

  return (
    <main className="lab-shell" style={{ maxWidth: 1050 }}>
      <header className="lab-header">
        <div>
          <p className="eyebrow">DPS PERSONNEL · BUILD SAUVEGARDÉ</p>
          <h1>Calcul DPS</h1>
          <p>Le build fournit les stats, la séquence, l’arme et les Echoes. Ici, on lit le résultat.</p>
        </div>
        <Link className="lab-link" href="/character-box">← Modifier le build</Link>
      </header>

      <div className="lab-column">
        <Panel title="Personnage">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
            <label>
              Build
              <select
                value={build?.id}
                onChange={(event) => {
                  setSelectedBuildId(event.target.value);
                  setRotationId("");
                }}
              >
                {pilotBuilds.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {pilotName[candidate.resonatorId] ?? candidate.resonatorId} · Lv{candidate.characterLevel} · S{candidate.sequence}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rotation
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
          </div>
          <div className="action-meta">
            <span>{pilotName[profile?.resonatorId ?? ""] ?? profile?.resonatorId}</span>
            <span>{profile?.element}</span>
            <span>Lv{build?.characterLevel} · S{build?.sequence}</span>
            <span>{timingLabel}</span>
          </div>
        </Panel>

        <Panel title="Résultat">
          {!result ? (
            <div className="unsupported">{calculationError ?? "Calcul indisponible."}</div>
          ) : (
            <>
              <div className="damage-cards" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
                <Metric label="Dégâts de rotation" value={result.totals.expected} featured />
                <Metric label="DPS attendu" value={result.dps.expected} featured />
              </div>
              <p className="hint">
                {result.timingConfidence === "estimated-calibrated"
                  ? "Timing calibré sur la durée totale de rotation vérifiée."
                  : "Timing estimé avec les mêmes profils temporels universels qu’Aemeath."}
              </p>
              {result.status === "partial" && (
                <p className="warning">
                  Certaines mécaniques restent signalées dans les détails ; aucune valeur manquante n’est remplacée silencieusement par zéro.
                </p>
              )}
            </>
          )}
        </Panel>

        <details className="lab-panel">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Options détaillées</summary>
          <div style={{ marginTop: 16 }}>
            <p className="hint">
              Ces réglages concernent uniquement la cible. Toutes les données du personnage viennent du build sauvegardé.
            </p>
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
            <h3>Build utilisé</h3>
            <div className="action-meta">
              <span>ATK {format(build?.finalStats.attack ?? 0)}</span>
              <span>HP {format(build?.finalStats.hp ?? 0)}</span>
              <span>DEF {format(build?.finalStats.defense ?? 0)}</span>
              <span>CR {format(build?.finalStats.critRate ?? 0)}%</span>
              <span>CD {format(build?.finalStats.critDamage ?? 0)}%</span>
              <span>ER {format(build?.finalStats.energyRegen ?? 0)}%</span>
            </div>
            {selectedRotation?.sourceNote && <p className="hint">{selectedRotation.sourceNote}</p>}
          </div>
        </details>

        <details className="lab-panel">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Détail des dégâts</summary>
          <div style={{ marginTop: 16 }}>
            {result && (
              <div className="damage-cards">
                <Metric label="Non Crit" value={result.totals.nonCrit} />
                <Metric label="Crit" value={result.totals.crit} />
                <Metric label="Attendu" value={result.totals.expected} />
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Attendu</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result?.perAction ?? {}).map(([actionId, amounts]) => (
                    <tr key={actionId}>
                      <td>{actionNames.get(actionId) ?? actionId}</td>
                      <td>{format(amounts.expected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <details className="lab-panel">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Mécaniques et validation</summary>
          <div style={{ marginTop: 16 }}>
            <p className="hint">
              Le runtime applique les effets structurés de séquence, aptitudes, arme et Sonata au fil de la rotation. Les bonus permanents restent uniquement dans finalStats pour éviter le double comptage.
            </p>
            <p className="hint">
              Les Motion Values de base restent comparées aux fixtures WutheringTools avec les mêmes stats. Aemeath garde sa cible 11,69 s ; les autres utilisent les mêmes profils temporels estimés.
            </p>
            {result?.diagnostics.length ? (
              <ul>
                {result.diagnostics.slice(0, 12).map((diagnostic, index) => (
                  <li key={`${diagnostic.code}-${index}`} className="hint">
                    {diagnostic.code} : {diagnostic.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">Aucun diagnostic runtime pour cette rotation.</p>
            )}
          </div>
        </details>
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

function Metric({
  label,
  value,
  featured = false,
}: {
  label: string;
  value: number;
  featured?: boolean;
}) {
  return (
    <div>
      <small>{label}</small>
      <strong style={featured ? { fontSize: "1.65rem" } : undefined}>{format(value)}</strong>
    </div>
  );
}
