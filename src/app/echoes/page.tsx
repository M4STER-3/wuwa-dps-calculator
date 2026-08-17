import Link from "next/link";

const slots = [
  ["Main Echo", "Slot principal"],
  ["Echo 2", "Libre"],
  ["Echo 3", "Libre"],
  ["Echo 4", "Libre"],
  ["Echo 5", "Libre"],
] as const;

export default function EchoesPage() {
  return (
    <main className="mx-auto max-w-[1800px] px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
      <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Echo Loadout · Preview</p>
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-100">Interface non branchée</span>
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Échos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Cette page prépare le futur éditeur de cinq Échos. Elle ne modifie encore aucun build et ne recalcule aucune statistique.
          </p>
        </div>
        <Link href="/character-box" className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white no-underline hover:border-[var(--accent-strong)]">Retour à la Character Box</Link>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <section className="rounded-2xl border border-white/10 bg-[#11151d]/85 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Loadout</p><h2 className="mt-1 text-xl font-bold text-white">5 emplacements</h2></div>
            <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-[var(--muted)]">Coût actuel : 0 / 12 max</span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
            {slots.map(([name, role], index) => (
              <article key={name} className={`min-h-60 rounded-2xl border p-4 ${index === 0 ? "border-[var(--accent-strong)]/50 bg-[var(--accent)]/5" : "border-white/10 bg-black/15"}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-[var(--accent)]">0{index + 1}</span><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-[var(--muted)]">Coût —</span></div>
                <div className="mt-6 grid h-16 w-16 place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20 text-2xl text-[var(--muted)]">✦</div>
                <h3 className="mt-5 font-bold text-white">{name}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{role}</p>
                <div className="mt-5 space-y-2 text-xs text-[var(--muted)]"><div className="rounded-lg border border-white/8 bg-black/15 px-3 py-2">Main stat —</div><div className="rounded-lg border border-white/8 bg-black/15 px-3 py-2">Substats —</div></div>
              </article>
            ))}
          </div>
        </section>

        <aside className="grid gap-5">
          <section className="rounded-2xl border border-white/10 bg-[#11151d]/85 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Résumé futur</p>
            <h2 className="mt-2 text-lg font-bold text-white">Contributions permanentes</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              {["HP", "ATK", "DEF", "Crit Rate", "Crit DMG", "Energy Regen"].map((stat) => (
                <div key={stat} className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="block text-xs text-[var(--muted)]">{stat}</span><strong className="mt-1 block text-white">—</strong></div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
            <h2 className="font-bold text-amber-100">Ce qui sera branché ensuite</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-50/80">
              <li>• catalogue léger des 178 Échos canoniques ;</li>
              <li>• Sonata réellement compatibles par Echo ;</li>
              <li>• main stats exactes selon le coût ;</li>
              <li>• cinq substats avec rolls exacts ;</li>
              <li>• validation du coût total et du Main Echo.</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
