const catalog = [
  ["Resonators", "60", "Progressions exactes 1→90"],
  ["Armes", "120", "Progressions exactes 1→90"],
  ["Échos", "178", "Entrées canoniques sélectionnables"],
  ["Sonata Sets", "34", "Identités source stables"],
] as const;

const pipeline = [
  ["01", "Import", "Release externe conservée en quarantaine RAW."],
  ["02", "Normalize", "Identités, types et champs utiles sont normalisés."],
  ["03", "Harden", "Contenu source traité comme donnée inerte et contrôlée."],
  ["04", "Promote", "Seul le snapshot vérifié devient public côté application."],
] as const;

export default function DataPage() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-10 sm:px-8 lg:px-12 lg:py-14">
      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">Game Data</p>
          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-100">Vue informative</span>
        </div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Ce que le calculateur connaît réellement.</h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          Cette page expose l’état du catalogue structuré sans afficher le RAW ni transformer les descriptions externes en logique exécutable.
        </p>
      </header>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {catalog.map(([name, value, note]) => (
          <article key={name} className="rounded-2xl border border-white/10 bg-[#11151d]/85 p-5">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted)]">{name}</span>
            <strong className="mt-4 block text-4xl font-black text-white">{value}</strong>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{note}</p>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-white/10 bg-[#11151d]/75 p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Pipeline</p><h2 className="mt-2 text-xl font-bold text-white">De la source au navigateur</h2></div>
          <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">RAW non exposé</span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pipeline.map(([step, title, copy]) => (
            <article key={step} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <span className="text-xs font-black text-[var(--accent)]">{step}</span>
              <h3 className="mt-4 font-bold text-white">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-[#11151d]/75 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Prêt maintenant</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[#c8d0dc]">
            <li>✓ stats exactes personnages et armes ;</li>
            <li>✓ tables de stats Echo 5★ +25 ;</li>
            <li>✓ compatibilités Echo → Sonata ;</li>
            <li>✓ Build Resolver permanent en amont.</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Encore à structurer</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-amber-50/80">
            <li>• nœuds permanents des personnages ;</li>
            <li>• passifs permanents des armes ;</li>
            <li>• bonus permanents Sonata 2pc / 5pc ;</li>
            <li>• séparation finale permanent / runtime pour chaque effet.</li>
          </ul>
        </article>
      </section>
    </main>
  );
}
