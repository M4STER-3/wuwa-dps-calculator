# Wuthering Waves DPS Calculator

Première version du **Character Box / Build Planner** pour Wuthering Waves. Elle permet d'ajouter Aemeath ou les fixtures restantes, de personnaliser leurs builds et de les conserver localement. Les données réelles, recommandations communautaires, calculs communautaires, inconnues et fixtures techniques sont identifiés séparément.

Le Team Builder et le calculateur de DPS ne font pas partie de cette étape. Les décisions métier importantes, notamment la règle anti-double-comptage des statistiques finales, sont documentées dans [`docs/architecture.md`](docs/architecture.md).

## Prérequis

- Node.js 20.9 ou plus récent
- npm

## Commandes

```bash
npm install        # installe les dépendances verrouillées par package-lock.json
npm run dev        # démarre le serveur de développement
npm run build      # crée le build de production
npm run start      # sert le build de production
npm run lint       # exécute ESLint
npm run typecheck  # vérifie les types TypeScript sans générer de fichiers
npm test           # exécute les tests Vitest une fois
npm run test:watch # exécute Vitest en mode interactif
```

Ouvrez [http://localhost:3000](http://localhost:3000) après avoir lancé le serveur de développement.

## Stack

- Next.js avec App Router
- React
- TypeScript en mode strict
- Tailwind CSS via son plugin PostCSS officiel
- ESLint avec les règles Next.js Core Web Vitals et TypeScript
- Vitest

Le code applicatif se trouve dans `src/app/`. L'alias TypeScript `@/*` cible `src/*`.
