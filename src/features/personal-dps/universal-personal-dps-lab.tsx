"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { emptyCharacterBox } from "@/domain/character-box";
import { calculatePersonalDpsV1 } from "@/domain/personal-dps-engine";
import type { Element, TalentLevel } from "@/domain/models";
import { personalDpsPilotProfiles10R1 } from "@/data/personal-dps-pilots-10r1";
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

const pilotElements: Readonly<Record<string, Element>> = {
  aemeath: "fusion",
  calcharo: "electro",
  changli: "fusion",
};

function toTalentLevel(value: number): TalentLevel {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    throw new Error(`Invalid saved talent level: ${value}`);
  }
  return value as TalentLevel;
}

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
  const [enemyLevel, setEnemyLevel] = useState(90);
  const [enemyResistance, setEnemyResistance] = useState(0.1);
  const [rotationId, setRotationId] = useState("");
  const selectedRotationId =
    profile?.rotations.some((rotation) => rotation.id === rotationId)
      ? rotationId
      : profile?.rotations[0]?.id ?? "";

  const element = profile
    ? pilotElements[profile.resonatorId] ?? profile.element
    : undefined;
  const skillLevels = build
    ? {
        basicAttack: toTalentLevel(build.skillLevels.basicAttack),
        resonanceSkill: toTalentLevel(build.skillLevels.resonanceSkill),
        forteCircuit: toTalentLevel(build.skillLevels.forteCircuit),
        resonanceLiberation: toTalentLevel(build.skillLevels.resonanceLiberation),
        introSkill: toTalentLevel(build.skillLevels.introSkill),
      }
    : undefined;
  const result =
    build && profile && selectedRotationId && element
      ? calculatePersonalDpsV1({
          profile,
          rotationId: selectedRotationId,
          finalStats: build.finalStats,
          attackerLevel: build.characterLevel,
          skillLevels,
          target: {
            level: enemyLevel,
            elementalResistance: { [element]: enemyResistance },
            physicalResistance: 0.1,
          },
        })
      : undefined;

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

  return (
    <main className="lab-shell" style={{ maxWidth: 1050 }}>
      <header className="lab-header">
        <div>
          <p className="eyebrow">DPS PERSONNEL · BUILD SAUVEGARDÉ</p>
          <h1>Calcul DPS</h1>
          <p>Choisis ton build. Les statistiques viennent automatiquement de Character Box.</p>
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
            <span>
              {selectedRotation?.durationSeconds
                ? `${selectedRotation.durationSeconds}s`
                : "durée à valider"}
            </span>
          </div>
        </Panel>

        <Panel title="Résultat">
          {!result ? (
            <div className="unsupported">Calcul indisponible.</div>
          ) : (
            <>
              <div className="damage-cards" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
                <Metric label="Dégâts de rotation" value={result.totals.expected} featured />
                {result.dps ? (
                  <Metric label="DPS attendu" value={result.dps.expected} featured />
                ) : (
                  <div>
                    <small>DPS attendu</small>
                    <strong>—</strong>
                    <span className="hint">Durée non vérifiée</span>
                  </div>
                )}
              </div>
              {result.status === "partial" && (
                <p className="warning">
                  Certaines étapes ne sont pas encore supportées et ne sont jamais remplacées par zéro.
                </p>
              )}
            </>
          )}
        </Panel>

        <details className="lab-panel">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Options détaillées</summary>
          <div style={{ marginTop: 16 }}>
            <p className="hint">
              Ces réglages concernent uniquement la cible. Les stats du personnage restent celles du build sauvegardé.
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
            <h3>Stats utilisées</h3>
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
                    <th>×</th>
                    <th>Type</th>
                    <th>Attendu</th>
                  </tr>
                </thead>
                <tbody>
                  {result?.resolvedSteps.map((step) => (
                    <tr key={`${step.index}-${step.actionId}`}>
                      <td>{step.actionName}</td>
                      <td>{step.count}</td>
                      <td>{step.result.effectiveDamageType}</td>
                      <td>{format(step.subtotal.expected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <details className="lab-panel">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Validation et sources</summary>
          <div style={{ marginTop: 16 }}>
            <p className="hint">
              Les dégâts des trois pilotes sont comparés automatiquement à des fixtures WutheringTools avec les mêmes statistiques. Aucun timing non vérifié n’est transformé en DPS/s.
            </p>
            <p className="hint">
              Aemeath utilise actuellement une durée totale communautaire calibrée. Les durées individuelles restent estimées par profils temporels jusqu’à disponibilité de mesures d’animation fiables.
            </p>
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
