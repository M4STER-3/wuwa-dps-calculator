# Wuthering Waves DPS Calculator

Première version du **Character Box / Build Planner** pour Wuthering Waves. Elle permet d'ajouter Aemeath ou les fixtures restantes, de personnaliser leurs builds et de les conserver localement. Les données réelles, recommandations communautaires, calculs communautaires, inconnues et fixtures techniques sont identifiés séparément.

Le Team Builder et le calculateur de DPS ne font pas partie de cette étape. Les décisions métier importantes, notamment la règle anti-double-comptage des statistiques finales, sont documentées dans [`docs/architecture.md`](docs/architecture.md). Le modèle de menace et les protections du dépôt sont documentés dans [`docs/security.md`](docs/security.md).

## Prérequis

- Node.js 20.9 ou plus récent
- npm

## Commandes

```bash
npm ci             # installe exactement les dépendances du package-lock.json
npm run dev        # démarre le serveur de développement
npm run build      # crée le build de production
npm run build:cloudflare # crée le Worker Cloudflare avec OpenNext
npm run start      # sert le build de production
npm run preview    # construit puis prévisualise le Worker localement
npm run deploy     # construit puis déploie le Worker (authentification requise)
npm run upload     # construit puis téléverse une version du Worker
npm run cf-typegen # régénère les types des bindings Cloudflare
npm run assets:sync:dry # vérifie la synchronisation d'assets sans écrire les téléchargements
npm run assets:sync # synchronise les assets via le wrapper de sécurité
npm run assets:test-security # teste les scénarios hostiles du pipeline d'assets sans réseau
npm run game-data:import:audit # audite Encore Release sans promouvoir les données RAW
npm run game-data:import # récupère et promeut un snapshot RAW seulement si tout est valide
npm run game-data:test-security # teste l'importeur Encore avec un transport simulé sans réseau
npm run lint       # exécute ESLint
npm run typecheck  # vérifie les types TypeScript sans générer de fichiers
npm test           # exécute les tests Vitest une fois
npm run test:watch # exécute Vitest en mode interactif
```

L'importeur de données Encore est documenté dans [`docs/game-data-import.md`](docs/game-data-import.md). Le workflow GitHub `Encore import audit` est manuel et n'a pas le droit d'écrire dans le dépôt ; il sert à inspecter le schéma Release réel avant d'ajouter des mappings normalisés.

Ouvrez [http://localhost:3000](http://localhost:3000) après avoir lancé le serveur de développement.

## Déploiement sur Cloudflare Workers

Le build Cloudflare utilise l'adaptateur officiel OpenNext pour Workers. Le développement
local habituel reste inchangé avec `npm run dev`. `npm run preview` exécute quant à lui le
résultat adapté dans le runtime Workers local de Wrangler.

Pour connecter ce dépôt depuis le dashboard Cloudflare :

1. Ouvrez **Workers & Pages**, puis **Create application** et **Import a repository**.
2. Autorisez GitHub et sélectionnez ce dépôt.
3. Utilisez `npm run build:cloudflare` comme commande de build et
   `npx wrangler deploy` comme commande de déploiement. Le répertoire racine doit rester
   `/` et aucune variable d'environnement n'est nécessaire actuellement.
4. Enregistrez et lancez le premier build. Cloudflare publiera le Worker à l'adresse
   `https://wuwa-dps-calculator.<votre-sous-domaine>.workers.dev`, visible dans les
   paramètres du Worker. Un domaine personnalisé peut ensuite être ajouté dans
   **Settings > Domains & Routes**.

La configuration ne déclare ni base de données, ni R2, ni service externe. Si des données
ISR sont ajoutées plus tard, un cache persistant pourra être configuré séparément.

## Stack

- Next.js avec App Router
- React
- TypeScript en mode strict
- Tailwind CSS via son plugin PostCSS officiel
- ESLint avec les règles Next.js Core Web Vitals et TypeScript
- Vitest

Le code applicatif se trouve dans `src/app/`. L'alias TypeScript `@/*` cible `src/*`.
