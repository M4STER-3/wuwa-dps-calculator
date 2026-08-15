# Wuthering Waves DPS Calculator

Base technique d'une future application web dédiée à **Wuthering Waves**. Le Team Builder, les fiches de personnages et le calculateur de DPS ne font pas encore partie de cette étape.

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
