"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import { emptyCharacterBox } from "@/domain/character-box";
import type { PersonalCombatResult } from "@/domain/personal-combat-simulation";
import {
  DEFAULT_LAB_TARGET,
  calculateActionLab,
  diagnosticsByFamily,
  resolvePersonalLoadout,
  simulateRotationLab,
  type LabTarget,
} from "@/domain/personal-dps-lab";
import {
  getBrowserCharacterBoxSnapshot,
  subscribeToBrowserCharacterBox,
} from "@/storage/character-box-storage";

const serverBox = emptyCharacterBox();
const formatNumber = (value: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
const formatPercent = (value: number) => `${value.toFixed(1)} %`;

export function PersonalDpsLab() {
  const box = useSyncExternalStore(
    subscribeToBrowserCharacterBox,
    getBrowserCharacterBoxSnapshot,
    () => serverBox,
  );
  const [buildId, setBuildId] = useState("");
  const [resonanceMode, setResonanceMode] = useState("tune-rupture");
  const [target, setTarget] = useState<LabTarget>(DEFAULT_LAB_TARGET);
  const [actionId, setActionId] = useState("");

  const build = box.builds.find((item) => item.id === buildId) ?? box.builds[0];
  const loadout = useMemo(
    () => (build ? resolvePersonalLoadout(build) : undefined),
    [build],
  );
  const availableModes = loadout?.resonator?.combat?.modes ?? [];
  const selectedMode = availableModes.includes(resonanceMode)
    ? resonanceMode
    : availableModes[0];
  const rotation = useMemo(
    () =>
      loadout && build
        ? simulateRotationLab(loadout, build.finalStats, target, selectedMode)
        : undefined,
    [loadout, build, target, selectedMode],
  );
  const selectedActionId = loadout?.actions.some((action) => action.id === actionId)
    ? actionId
    : loadout?.actions[0]?.id ?? "";
  const actionResult = useMemo(
    () =>
      loadout && build && selectedActionId
        ? calculateActionLab({
            loadout,
            actionId: selectedActionId,
            stats: build.finalStats,
            target,
            resonanceMode: selectedMode,
          })
        : undefined,
    [loadout, build, selectedActionId, target, selectedMode],
  );

  if (!box.builds.length) {
    return (
      <main className="lab-shell">
        <section className="lab-empty">
          <p className="eyebrow">WUWA LAB · PERSONAL DPS</p>
          <h1>Aucun build disponible</h1>
          <p>Ajoutez et configurez d’abord un Resonator dans la Character Box.</p>
          <Link href="/character-box">Ouvrir la Character Box →</Link>
        </section>
      </main>
    );
  }

  const topActions = rotation
    ? Object.entries(rotation.perAction)
        .filter(([, amounts]) => amounts.expected > 0)
        .sort((left, right) => right[1].expected - left[1].expected)
        .slice(0, 8)
    : [];

  return (
    <main className="lab-shell dps-results-shell">
      <header className="lab-header dps-results-header">
        <div>
          <p className="eyebrow">WUWA LAB · PERSONAL DPS</p>
          <h1>DPS personnel</h1>
          <p>
            Résultat de la rotation théorique universelle. Le build et ses statistiques
            se modifient uniquement dans la Character Box.
          </p>
        </div>
        <Link className="lab-link" href="/character-box">
          Modifier le build →
        </Link>
      </header>

      <section className="lab-panel dps-build-strip">
        <label>
          Build analysé
          <select value={build?.id} onChange={(event) => setBuildId(event.target.value)}>
            {box.builds.map((item) => (
              <option key={item.id} value={item.id}>
                {item.resonatorId} · Lv{item.characterLevel} · S{item.sequence}
              </option>
            ))}
          </select>
        </label>
        {loadout?.resonator ? (
          <div className="build-summary dps-build-summary">
            {loadout.resonator.portrait ? (
              <Image
                src={loadout.resonator.portrait.src}
                alt={loadout.resonator.portrait.alt}
                width={68}
                height={68}
              />
            ) : null}
            <div>
              <strong>{loadout.resonator.name}</strong>
              <small>
                Lv{build?.characterLevel} · S{build?.sequence} · {loadout.weapon?.name ?? "Arme non résolue"}
              </small>
              <small>
                {loadout.sonata?.name ?? "Sonata non résolu"} · {loadout.mainEcho?.name ?? "Main Echo non résolu"}
              </small>
            </div>
          </div>
        ) : null}
        {availableModes.length > 1 ? (
          <label>
            Mode de résonance
            <select
              value={selectedMode}
              onChange={(event) => setResonanceMode(event.target.value)}
            >
              {availableModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === "tune-rupture" ? "Tune Rupture" : mode === "fusion-burst" ? "Fusion Burst" : mode}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <div className="dps-overview-grid">
        <section className="lab-panel dps-primary-result">
          <div className="dps-result-heading">
            <div>
              <p className="eyebrow">RÉSULTAT PRINCIPAL</p>
              <h2>{loadout?.resonator?.name ?? "Resonator"}</h2>
            </div>
            {rotation ? <Status partial={rotation.partial} /> : null}
          </div>
          {rotation ? (
            <>
              <div className="damage-cards dps-hero-metrics">
                <Metric label="DPS attendu" value={rotation.personalDps.expected} primary />
                <Metric label="Dégâts / rotation" value={rotation.personalDamage.expected} />
                <Metric label="Durée théorique" value={rotation.rotationDurationSeconds} suffix=" s" />
                <Metric label="Actions calculées" value={rotation.coverage.relevantSupported} />
              </div>
              {rotation.partial ? (
                <p className="warning">
                  Résultat partiel : une mécanique non résolue est exclue du total au lieu d’être comptée comme zéro.
                </p>
              ) : null}
            </>
          ) : (
            <div className="unsupported">
              Aucune rotation théorique n’est encore enregistrée pour ce personnage.
            </div>
          )}
        </section>

        <section className="lab-panel">
          <h2>Répartition des dégâts</h2>
          {rotation ? (
            <div className="dps-source-list">
              {Object.entries(rotation.breakdown)
                .filter(([, amounts]) => amounts.expected > 0)
                .sort((left, right) => right[1].expected - left[1].expected)
                .map(([name, amounts]) => (
                  <DamageShare
                    key={name}
                    label={damageCategoryLabel(name)}
                    damage={amounts.expected}
                    total={rotation.personalDamage.expected}
                  />
                ))}
            </div>
          ) : null}
        </section>
      </div>

      <section className="lab-panel">
        <h2>Principales aptitudes</h2>
        {rotation && topActions.length ? (
          <table>
            <thead>
              <tr>
                <th>Aptitude</th>
                <th>Dégâts</th>
                <th>Part du total</th>
                <th>DPS</th>
              </tr>
            </thead>
            <tbody>
              {topActions.map(([name, amounts]) => (
                <tr key={name}>
                  <td>{actionLabel(loadout, name)}</td>
                  <td>{formatNumber(amounts.expected)}</td>
                  <td>
                    {rotation.personalDamage.expected > 0
                      ? formatPercent((amounts.expected / rotation.personalDamage.expected) * 100)
                      : "—"}
                  </td>
                  <td>{formatNumber(amounts.expected / rotation.rotationDurationSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="hint">Aucune aptitude dommageable calculée.</p>
        )}
      </section>

      <details className="lab-panel dps-advanced">
        <summary>Analyse avancée</summary>
        <div className="dps-advanced-grid">
          <div>
            <h3>Tester une aptitude</h3>
            <label>
              Aptitude
              <select value={selectedActionId} onChange={(event) => setActionId(event.target.value)}>
                {loadout?.actions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.name}
                  </option>
                ))}
              </select>
            </label>
            {actionResult?.damage.status === "supported" ? (
              <div className="damage-cards">
                <Metric label="Non CRIT" value={actionResult.damage.total.nonCrit} />
                <Metric label="CRIT" value={actionResult.damage.total.crit} />
                <Metric label="Attendu" value={actionResult.damage.total.expected} />
              </div>
            ) : (
              <p className="hint">Cette formule n’est pas encore disponible.</p>
            )}
          </div>

          <div>
            <h3>Cible technique</h3>
            <p className="hint">
              Ces paramètres servent à comparer les calculs. Ils ne modifient jamais le build sauvegardé.
            </p>
            <div className="stat-grid">
              <label>
                Niveau ennemi
                <input
                  type="number"
                  value={target.level}
                  onChange={(event) => setTarget({ ...target, level: Number(event.target.value) })}
                />
              </label>
              <label>
                Résistance physique
                <input
                  type="number"
                  step="0.01"
                  value={target.physicalResistance}
                  onChange={(event) =>
                    setTarget({ ...target, physicalResistance: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <button type="button" onClick={() => setTarget(DEFAULT_LAB_TARGET)}>
              Réinitialiser la cible
            </button>
          </div>
        </div>

        {rotation ? (
          <AdvancedDiagnostics result={rotation} loadoutDiagnostics={loadout?.diagnostics ?? []} />
        ) : null}
      </details>
    </main>
  );
}

function Metric({
  label,
  value,
  suffix = "",
  primary = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  primary?: boolean;
}) {
  return (
    <div data-primary={primary || undefined}>
      <small>{label}</small>
      <strong>
        {formatNumber(value)}{suffix}
      </strong>
    </div>
  );
}

function Status({ partial }: { partial: boolean }) {
  return (
    <span className={`status ${partial ? "partial" : "complete"}`}>
      {partial ? "PARTIEL" : "COMPLET"}
    </span>
  );
}

function DamageShare({
  label,
  damage,
  total,
}: {
  label: string;
  damage: number;
  total: number;
}) {
  const share = total > 0 ? (damage / total) * 100 : 0;
  return (
    <div className="dps-source-row">
      <div>
        <strong>{label}</strong>
        <span>{formatNumber(damage)}</span>
      </div>
      <div className="dps-share-track" aria-label={`${label}: ${formatPercent(share)}`}>
        <span style={{ width: `${Math.min(100, Math.max(0, share))}%` }} />
      </div>
      <small>{formatPercent(share)}</small>
    </div>
  );
}

function AdvancedDiagnostics({
  result,
  loadoutDiagnostics,
}: {
  result: PersonalCombatResult;
  loadoutDiagnostics: readonly { code: string; message: string }[];
}) {
  const unique = [
    ...new Map(
      [...loadoutDiagnostics, ...result.diagnostics].map((item) => [
        `${item.code}:${item.message}`,
        item,
      ]),
    ).values(),
  ];
  const groups = diagnosticsByFamily(unique);
  return (
    <div className="dps-diagnostics">
      <h3>Couverture & diagnostics</h3>
      <div className="coverage">
        <span>Calculé <b>{result.coverage.relevantSupported}</b></span>
        <span>Non résolu <b>{result.coverage.relevantUnsupported}</b></span>
        <span>Contexte manquant <b>{result.coverage.notEmittedDueToMissingContext}</b></span>
      </div>
      {!unique.length ? (
        <p className="hint">Aucun diagnostic pour cette rotation.</p>
      ) : (
        Object.entries(groups).map(([family, items]) => (
          <details key={family}>
            <summary>{family} ({items.length})</summary>
            {items.map((item, index) => (
              <div className="diagnostic" key={`${item.code}-${index}`}>
                <code>{item.code}</code>
                <p>{item.message}</p>
              </div>
            ))}
          </details>
        ))
      )}
    </div>
  );
}

function damageCategoryLabel(name: string): string {
  const labels: Record<string, string> = {
    direct: "Dégâts directs",
    echo: "Echo",
    "follow-up": "Follow-up",
    coordinated: "Attaques coordonnées",
    summon: "Invocation",
    status: "Statuts",
    tune: "Tune",
  };
  return labels[name] ?? name;
}

function actionLabel(
  loadout: ReturnType<typeof resolvePersonalLoadout> | undefined,
  actionId: string,
): string {
  return loadout?.actions.find((action) => action.id === actionId)?.name ?? actionId;
}
