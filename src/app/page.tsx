import Link from "next/link";

const modules = [
  ["◇", "Character Box", "Construisez et conservez vos Resonators, armes et futurs loadouts d’Échos.", "/character-box", "Disponible"],
  ["◎", "DPS personnel", "Inspectez un build, ses actions, ses dégâts et les diagnostics du moteur personnel.", "/personal-dps", "Disponible"],
  ["△", "DPS équipe", "Préparez rotations et interactions d’équipe sans mélanger les statistiques permanentes.", "/team-dps", "Disponible"],
  ["✦", "Échos", "Préparez cinq Échos, Sonata, main stats et substats exactes.", "/echoes", "En préparation"],
  ["▦", "Game Data", "Consultez l’état du catalogue structuré utilisé par le calculateur.", "/data", "Aperçu"],
] as const;

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute -right-40 -top-52 h-[38rem] w-[38rem] rounded-full bg-[var(--accent)]/10 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1800px] gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[1.25fr_.75fr] lg:px-12 lg:py-24">
          <div className="max-w-4xl">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[var(--accent-strong)]/40 bg-[var(--accent)]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Wuthering Waves</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#cbd2de]">Interface V1</span>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              Construisez. Comparez.
              <span className="block text-[var(--accent)]">Comprenez vos dégâts.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#aab3c2] sm:text-lg">
              Builds, Échos, rotations et données structurées dans une interface unique, sans transformer les données externes en logique de combat non vérifiée.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/character-box" className="rounded-xl bg-[var(--accent)] px-5 py-3 text-center text-sm font-black text-[#06110f] no-underline hover:bg-white">Ouvrir ma Character Box</Link>
              <Link href="/personal-dps" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-center text-sm font-bold text-white no-underline hover:border-[var(--accent-strong)]">Explorer le DPS personnel</Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[var(--muted)]">
              <span>✓ finalStats centralisé</span><span>✓ Aucune interpolation</span><span>✓ Texte source non exécutable</span>
            </div>
          </div>

          <aside className="self-end rounded-2xl border border-white/10 bg-[#11151d]/90 p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">GameDatabase V1</p>
            <div className="mt-3 flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold text-white">Catalogue prêt pour l’interface</h2>
              <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200">Promu</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[["60", "Resonators"], ["120", "Armes"], ["178", "Échos"], ["34", "Sonata Sets"]].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-4"><strong className="block text-2xl font-black text-white">{value}</strong><span className="text-xs text-[var(--muted)]">{label}</span></div>
              ))}
            </div>
            <div className="mt-5 border-t border-white/10 pt-5 text-xs text-[var(--muted)]">RAW → normalisation → hardening → promotion</div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-[1800px] px-4 py-14 sm:px-8 lg:px-12">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Modules</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-2xl font-black text-white sm:text-3xl">Le calculateur, organisé par usage.</h2>
          <p className="max-w-xl text-sm leading-6 text-[var(--muted)]">Les écrans peuvent exister avant leur logique finale : chaque aperçu reste clairement identifié.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map(([icon, title, description, href, status]) => {
            const preview = status !== "Disponible";
            return (
              <Link key={title} href={href} className="group flex min-h-52 flex-col rounded-2xl border border-white/10 bg-[#11151d]/80 p-5 text-white no-underline transition hover:-translate-y-0.5 hover:border-[var(--accent-strong)]/60">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-black/20 text-xl text-[var(--accent)]">{icon}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${preview ? "border-amber-400/20 bg-amber-400/10 text-amber-100" : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"}`}>{status}</span>
                </div>
                <h3 className="mt-6 text-lg font-bold">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
                <span className="mt-5 text-sm font-bold text-[var(--accent)]">Ouvrir →</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.018]">
        <div className="mx-auto grid max-w-[1800px] gap-8 px-4 py-14 sm:px-8 lg:grid-cols-[.7fr_1.3fr] lg:px-12">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Architecture</p><h2 className="mt-2 text-2xl font-black text-white">Une frontière claire avant le combat.</h2><p className="mt-4 text-sm leading-6 text-[var(--muted)]">L’interface prépare le build. Le resolver produit les statistiques permanentes. Les moteurs reçoivent ensuite une seule feuille finale.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[["01", "Catalogue", "Données exactes"], ["02", "Build", "Sélections validées"], ["03", "finalStats", "Source permanente unique"], ["04", "Runtime", "Effets temporaires séparés"]].map(([n, title, copy]) => (
              <div key={n} className="rounded-xl border border-white/10 bg-[#11151d] p-4"><span className="text-xs font-black text-[var(--accent)]">{n}</span><h3 className="mt-4 font-bold text-white">{title}</h3><p className="mt-2 text-xs text-[var(--muted)]">{copy}</p></div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
