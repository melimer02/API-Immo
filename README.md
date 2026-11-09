# ImmoService — API REST & GraphQL pour le domaine immobilier

Projet n°2 du cours **Web Services** (Master 2 IWOCS — Université Le Havre Normandie).

Au TP1, l'application Next.js était son propre et unique client. Ici, on construit un **service** destiné à des clients que l'on ne contrôle pas (scripts, tests, application mobile, autre service). Le livrable est une **API**, sans interface : le contrat entre le service et ses clients devient explicite.

Ce projet reprend uniquement les **données** du TP1 (schéma Prisma et seed, adaptés). L'application Next du TP1 n'est ni modifiée ni requise.

---

## Démarrage depuis zéro

Prérequis : Node.js ≥ 20, Docker et Docker Compose.

```bash
git clone <url-du-depot>
cd webservices_immoservice

cp .env.example .env
# Générer un vrai secret JWT dans .env :
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env

npm install            # installe les dépendances et génère le client Prisma
docker compose up -d   # démarre PostgreSQL (base de dev + base de test)
npm run db:migrate     # applique les migrations
npm run db:seed        # insère les données de démonstration
npm run dev            # lance le serveur sur http://localhost:3000
```

Vérification : `curl localhost:3000/health` → `{"status":"ok"}`

## Comptes de test

Tous les comptes ont le mot de passe **`motdepasse123`**.

| Email | Rôle | Particularité |
|---|---|---|
| `admin@immo.fr` | ADMIN | voit tout, y compris les brouillons |
| `agent1@immo.fr` | AGENT | 10 annonces, dont 2 brouillons |
| `agent2@immo.fr` | AGENT | 10 annonces, dont 2 brouillons |
| `agent3@immo.fr` | AGENT | statut professionnel en attente, aucune annonce |
| `user1@immo.fr` | USER | a posé 2 questions, a 1 favori |
| `user2@immo.fr` | USER | aucune activité |

Les deux agents distincts permettent de tester l'autorisation : un agent ne doit jamais pouvoir modifier ou supprimer l'annonce de l'autre.

## Scripts npm

| Script | Rôle |
|---|---|
| `npm run dev` | serveur de développement (rechargement automatique) |
| `npm run build` | génère le client Prisma et compile TypeScript |
| `npm start` | lance la version compilée |
| `npm run db:migrate` | applique les migrations |
| `npm run db:seed` | insère les données de démonstration |

---

## Choix techniques et justifications

### Stack

| Élément | Choix |
|---|---|
| Langage | TypeScript, `strict: true` |
| Framework | **Fastify** |
| Validation | **Zod**, sur toute entrée |
| Contrat | **OpenAPI**, approche **code-first** |
| Base de données | PostgreSQL 17 via Docker |
| ORM | Prisma 7, avec l'adaptateur `@prisma/adapter-pg` |
| Authentification | JWT, sans session en base |
| Hachage des mots de passe | `bcryptjs` |

### Pourquoi Fastify plutôt que NestJS

NestJS intègre nativement OpenAPI et GraphQL, mais repose sur beaucoup de mécanismes implicites (décorateurs, injection de dépendances, modules). Fastify est plus léger : on assemble soi-même chaque pièce (validation, documentation, GraphQL, authentification), ce qui oblige à comprendre et maîtriser chacune.

Fastify s'intègre aussi naturellement avec **Zod** grâce à `fastify-type-provider-zod` : un même schéma Zod valide les requêtes, type le code et produit la documentation OpenAPI. Enfin, nous connaissions déjà Zod depuis le TP1, ce qui nous permet de réutiliser nos règles de validation.

### Pourquoi OpenAPI en code-first

Le choix entre code-first et contract-first détermine **la source de vérité** du contrat.

Nous avons choisi le **code-first** : les schémas Zod sont l'unique source de vérité. Ils valident les entrées **et** génèrent la spécification OpenAPI. Il n'y a donc pas de double saisie et aucun risque de dérive entre la spécification et l'implémentation : la documentation est à jour par construction.

Le risque de cette approche est que la spécification reflète un code mal conçu. Pour le limiter, nous avons conçu les routes (ressources, verbes, codes de statut) **avant** de les coder. La spécification générée est exportée dans `openapi.yaml`, commité, à partir duquel est généré le SDK client utilisé par les tests.

### Pourquoi pas de table `session`

Au TP1, Better Auth stockait les sessions en base (tables `session`, `account`, `verification`). Une API REST est **sans état** : chaque requête porte tout ce qui est nécessaire pour être traitée. L'authentification se fait donc par **JWT** : le jeton, signé par le serveur, contient l'identifiant, le rôle et la date d'expiration de l'utilisateur. Le serveur n'a qu'à vérifier la signature, sans rien stocker ni consulter.

Conséquences :
- les tables Better Auth sont supprimées et remplacées par un champ `passwordHash` sur `User` ;
- le serveur peut être dupliqué derrière un répartiteur de charge sans partager d'état ;
- contrepartie : un JWT ne peut pas être révoqué avant son expiration, d'où une durée de vie courte (voir `SECURITY.md`).

### Hachage des mots de passe

Les mots de passe ne sont jamais stockés en clair. Ils sont hachés avec **bcrypt**, un algorithme éprouvé, volontairement lent et salé. Nous utilisons l'implémentation `bcryptjs`, écrite en JavaScript pur : même algorithme, mais aucune compilation native à l'installation, donc pas de risque d'échec sur une machine vierge.

### Adaptations du schéma Prisma par rapport au TP1

| Changement | Raison |
|---|---|
| Suppression de `Session`, `Account`, `Verification`, `emailVerified`, `image` | spécifiques à Better Auth, inutiles pour une API sans état |
| Ajout de `passwordHash` sur `User`, `id` généré par `cuid()` | avant, Better Auth créait les identifiants et stockait le mot de passe |
| La réponse d'une question devient un **modèle `Reponse`** (au lieu d'un champ texte) | permet de savoir qui a répondu et d'en faire une sous-ressource ; une seule réponse par question (`questionId` unique) |
| `Photo` : une URL (Picsum) et un texte alternatif `alt` | aucun upload n'est demandé ; le texte alternatif est utile à l'accessibilité |
| `ville` obligatoire, ajout de `surface` | la ville sert de filtre de recherche |
| Index sur `auteurId` et `ville` | requêtes fréquentes : « mes annonces », filtrage par ville |
| `role` (`USER` / `AGENT` / `ADMIN`) et `statutPro` conservés | font partie du domaine |

Les migrations du TP1 ne sont pas reprises : le projet repart d'une migration initiale propre, versionnée dans `prisma/migrations`.

### Configuration et environnement

- **Aucun identifiant en dur** : `docker-compose.yml` lit toutes ses valeurs depuis `.env`, et refuse de démarrer si une variable manque.
- `.env.example` est commité avec des valeurs factices ; `.env`, qui contient les vrais secrets, ne l'est jamais.
- **Deux bases PostgreSQL** : une base de développement (persistante) et une **base de test séparée** (en mémoire, `tmpfs`), pour que les tests ne touchent jamais aux données de développement.
- Les ports (5433 et 5434) diffèrent de ceux du TP1 pour que les deux projets puissent tourner en même temps.

---

## Structure du projet
├── docker-compose.yml # PostgreSQL (dev + test)
├── prisma/
│ ├── schema.prisma # modèle de données
│ ├── migrations/ # migrations versionnées
│ └── seed.ts # données de démonstration
├── prisma.config.ts # configuration Prisma 7
└── src/
├── app.ts # construction de l’application (réutilisée par les tests)
├── server.ts # démarrage du serveur
└── lib/prisma.ts # client Prisma

---

## À compléter

- API REST : ressources, routes et choix de conception
- Documentation OpenAPI (`/docs`) et génération du SDK
- Authentification et autorisation
- Tests
- GraphQL, cache HTTP, durcissement
