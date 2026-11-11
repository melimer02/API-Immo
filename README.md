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

Vérifications :
- `curl localhost:3000/health` → `{"status":"ok"}`
- documentation interactive : http://localhost:3000/docs
- tests : `npm test` → `49 passed`

## Comptes de test

Tous les comptes ont le mot de passe **`motdepasse123`**.

| Email | Rôle | Particularité |
|---|---|---|
| `admin@immo.fr` | ADMIN | voit tout, y compris les brouillons ; peut gérer toutes les annonces |
| `agent1@immo.fr` | AGENT (VALIDE) | 10 annonces, dont 2 brouillons |
| `agent2@immo.fr` | AGENT (VALIDE) | 10 annonces, dont 2 brouillons |
| `agent3@immo.fr` | AGENT (EN_ATTENTE) | statut non validé : ne peut pas gérer d'annonces (403) |
| `user1@immo.fr` | USER | a posé 2 questions, a 1 favori |
| `user2@immo.fr` | USER | aucune activité |

Les deux agents distincts permettent de tester l'autorisation : un agent ne doit jamais pouvoir modifier ou supprimer l'annonce de l'autre.

Obtenir un jeton :

```bash
curl -s -X POST localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"agent1@immo.fr","password":"motdepasse123"}'
```

## Scripts npm

| Script | Rôle |
|---|---|
| `npm run dev` | serveur de développement (rechargement automatique) |
| `npm run build` | génère le client Prisma et compile TypeScript |
| `npm start` | lance la version compilée |
| `npm run db:migrate` | applique les migrations |
| `npm run db:seed` | insère les données de démonstration |
| `npm run openapi` | enchaîne les trois commandes ci-dessous |
| `npm run openapi:export` | régénère `openapi.yaml` depuis le code |
| `npm run openapi:lint` | valide la spécification (Redocly) |
| `npm run sdk:generate` | génère le client TypeScript dans `sdk/` (nécessite Java) |
| `npm test` | vérifie les types (tests + SDK) puis lance tous les tests |
| `npm run test:types` | vérifie uniquement les types des tests et du SDK |
| `npm run test:watch` | tests en mode surveillance |

---

## Choix techniques et justifications

### Stack

| Élément | Choix |
|---|---|
| Langage | TypeScript, `strict: true` |
| Framework | **Fastify** |
| Validation | **Zod**, sur toute entrée |
| Contrat | **OpenAPI 3.1**, approche **code-first** (`@fastify/swagger`, `fastify-type-provider-zod`) |
| Documentation | Swagger UI sur `/docs` |
| Client généré | `openapi-generator-cli`, générateur `typescript-fetch` |
| Base de données | PostgreSQL 17 via Docker |
| ORM | Prisma 7, avec l'adaptateur `@prisma/adapter-pg` |
| Authentification | JWT (`@fastify/jwt`), sans session en base |
| Hachage des mots de passe | `bcryptjs` |
| CORS | `@fastify/cors`, origines explicites |
| Tests | Vitest, sur une base de test séparée |

### Pourquoi Fastify plutôt que NestJS

NestJS intègre nativement OpenAPI et GraphQL, mais repose sur beaucoup de mécanismes implicites (décorateurs, injection de dépendances, modules). Fastify est plus léger : on assemble soi-même chaque pièce (validation, documentation, GraphQL, authentification), ce qui oblige à comprendre et maîtriser chacune.

Fastify s'intègre aussi naturellement avec **Zod** grâce à `fastify-type-provider-zod` : un même schéma Zod valide les requêtes, type le code et produit la documentation OpenAPI. Enfin, nous connaissions déjà Zod depuis le TP1, ce qui nous permet de réutiliser nos règles de validation.

### Pourquoi OpenAPI en code-first

Le choix entre code-first et contract-first détermine **la source de vérité** du contrat.

Nous avons choisi le **code-first** : les schémas Zod sont l'unique source de vérité. Ils valident les entrées **et** génèrent la spécification OpenAPI. Il n'y a donc pas de double saisie et aucun risque de dérive entre la spécification et l'implémentation : la documentation est à jour par construction.

Le risque de cette approche est que la spécification reflète un code mal conçu. Pour le limiter, nous avons conçu les routes (ressources, verbes, codes de statut) **avant** de les coder, et nous relisons la spécification générée : cette relecture nous a fait corriger des codes d'erreur annoncés à tort (un 409 promis sur des routes qui ne peuvent pas le renvoyer, un 401 de login mal décrit) et un champ de date dont le format n'était pas documenté.

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

## API REST

### Ressources et routes

| Méthode | Route | Accès | Succès |
|---|---|---|---|
| POST | `/auth/register` | public | 201 |
| POST | `/auth/login` | public | 200 (JWT) |
| GET | `/me` | connecté | 200 |
| GET | `/annonces` | public (annonces publiées uniquement) | 200 |
| GET | `/annonces/{id}` | public si publiée ; brouillon : auteur ou ADMIN | 200 |
| GET | `/me/annonces` | agent validé ou ADMIN | 200 |
| POST | `/annonces` | agent validé ou ADMIN | 201 + `Location` |
| PATCH | `/annonces/{id}` | propriétaire ou ADMIN | 200 |
| DELETE | `/annonces/{id}` | propriétaire ou ADMIN | 204 |
| PUT | `/annonces/{id}/publication` | propriétaire ou ADMIN | 200 (publie) |
| DELETE | `/annonces/{id}/publication` | propriétaire ou ADMIN | 200 (dépublie) |
| GET | `/annonces/{id}/questions` | si l'annonce est visible | 200 |
| POST | `/annonces/{id}/questions` | connecté, annonce publiée | 201 + `Location` |
| GET | `/questions/{id}` | si l'annonce est visible | 200 |
| POST | `/questions/{id}/reponse` | agent propriétaire de l'annonce ou ADMIN | 201 |

### Choix de conception

- **Des noms au pluriel, jamais de verbe dans l'URI** : l'action est portée par la méthode HTTP (`DELETE /annonces/42`, et non `/deleteAnnonce?id=42`).
- **`PATCH` plutôt que `PUT` ou `POST` pour modifier** : `POST` crée une ressource ; `PUT` remplace la ressource entière (un champ oublié serait effacé) ; `PATCH` ne modifie que les champs envoyés.
- **La publication est une sous-ressource** (`/annonces/{id}/publication`) plutôt qu'un champ modifiable par `PATCH` :
  - c'est une action métier distincte de l'édition du contenu, avec ses propres règles ;
  - `PUT` (publier) et `DELETE` (dépublier) sont **idempotents** : publier deux fois revient à publier une fois ;
  - on ne peut pas publier « par accident » en modifiant un prix.
- **Les questions sont une sous-ressource de l'annonce** (`/annonces/{id}/questions`) plutôt qu'un champ : une question n'existe pas sans son annonce, elle a sa propre vie (auteur, date, réponse) et n'est chargée que lorsqu'on la demande.
- **`/questions/{id}/reponse` au singulier** : une question a au plus une réponse (contrainte unique en base) ; une seconde réponse renvoie `409`.
- **`/me` et `/me/annonces`** désignent l'utilisateur authentifié : son identifiant vient du JWT, jamais de l'URI.
- **`GET /annonces` ne renvoie que des annonces publiées, quel que soit l'appelant** : la réponse est identique pour tous, donc cachable publiquement. Un agent consulte ses brouillons via `/me/annonces`.

### Pagination et filtres

```
GET /annonces?page=2&limit=20&ville=le%20havre&type=VENTE&prixMax=250000
```

```json
{ "data": [ ... ], "meta": { "page": 2, "limit": 20, "total": 137, "pages": 7 } }
```

- `page` (défaut 1) et `limit` (défaut 20, **maximum 100**) : une collection n'est jamais renvoyée sans limite.
- Filtres : `ville` (insensible à la casse), `type` (`VENTE` ou `LOCATION`), `prixMax`.
- Tous ces paramètres sont validés : une valeur invalide donne `400`, jamais `500`.

### Codes de statut

| Code | Signification dans l'API |
|---|---|
| 200 | lecture ou modification réussie |
| 201 | création réussie (avec l'en-tête `Location`) |
| 204 | suppression réussie, sans corps |
| 400 | requête invalide : body, query ou path |
| 401 | jeton absent, invalide ou expiré ; identifiants incorrects au login |
| 403 | le rôle ne permet pas l'opération (USER, ou agent non validé) |
| 404 | ressource inexistante **ou** appartenant à un autre utilisateur |
| 409 | email déjà utilisé, question déjà répondue |

### 404 plutôt que 403 sur la ressource d'un autre

Quand un agent tente de modifier, supprimer ou publier l'annonce d'un autre agent, ou de lire son brouillon, l'API répond **404** et non 403. Un 403 confirmerait que la ressource existe ; avec un 404, « absente » et « interdite » sont indiscernables.

Le **403** est réservé aux cas où c'est le **rôle** qui ne convient pas (un USER qui tente de créer une annonce) : l'existence de la route n'est pas un secret.

### Forme unique des erreurs

Toutes les erreurs, quelle que soit leur origine (validation, règle métier, base de données, route inconnue, erreur inattendue), ont la même forme :

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "La requête est invalide",
    "details": [{ "field": "prix", "message": "Too small: expected number to be >0" }]
  }
}
```

Le `code` est stable et fait partie du contrat : `VALIDATION_FAILED`, `BAD_REQUEST`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `NOT_FOUND`, `EMAIL_ALREADY_USED`, `QUESTION_ALREADY_ANSWERED`, `CONFLICT`, `INTERNAL_ERROR`. Le `message` est destiné à un humain et peut évoluer.

Une erreur `500` ne révèle jamais de détail technique au client : elle est journalisée côté serveur.

### Validation et exposition des données

- **Toute entrée est validée par Zod** avant d'atteindre le code : corps, paramètres de requête et paramètres de chemin (`GET /annonces/abc` → `400`).
- **Pas d'affectation de masse** : les schémas d'entrée ne contiennent que les champs autorisés, et Zod retire les autres. Un client qui envoie `"role": "ADMIN"` à l'inscription obtient un compte **USER** ; un `auteurId` ou un `statutPublication` envoyé à la création d'une annonce est ignoré (l'auteur vient du JWT, l'annonce naît en brouillon).
- **Liste blanche en sortie** : chaque requête Prisma utilise un `select` explicite, et chaque réponse est filtrée par son schéma Zod. `passwordHash` n'est jamais renvoyé, et une colonne ajoutée plus tard en base ne serait pas exposée automatiquement.

---

## Contrat OpenAPI

| Ressource | Emplacement |
|---|---|
| Documentation interactive (Swagger UI) | http://localhost:3000/docs |
| Spécification JSON (servie par l'API) | http://localhost:3000/docs/json |
| Spécification versionnée | `openapi.yaml` (OpenAPI 3.1) |
| Client TypeScript généré | `sdk/` |

La spécification est **générée** au démarrage depuis les schémas Zod (code-first), puis **exportée** dans `openapi.yaml`. Chaque route déclare :
- ses paramètres (path, query) avec leurs contraintes, son corps et ses réponses ;
- **uniquement les codes d'erreur qu'elle peut réellement renvoyer**, chacun décrit ;
- un `operationId`, qui devient le nom de la méthode dans le SDK (`api.supprimerAnnonce({ id })`) ;
- sa sécurité : `security: []` (publique), `bearerAuth` (jeton obligatoire), ou `[{}, { bearerAuth: [] }]` (jeton facultatif qui change la réponse, par exemple un agent qui voit ses brouillons).

Les schémas principaux (`Annonce`, `Question`, `Erreur`…) sont nommés et publiés une seule fois dans `components/schemas`. Les schémas qu'aucune route n'utilise sont retirés (`src/lib/openapi.ts`).

La spécification est validée par **Redocly** (`npm run openapi:lint`, configuration dans `redocly.yaml`). Une seule règle est désactivée, avec justification : l'adresse `localhost` du serveur, seul environnement existant.

```bash
npm run openapi   # export → lint → génération du SDK
```

`openapi.yaml` et `sdk/` sont **commités** : les tests utilisent le SDK sans nécessiter Java sur la machine qui les exécute. Ils sont à régénérer à chaque modification d'une route ou d'un schéma.

---

## Authentification et autorisation

### JWT

- `POST /auth/login` vérifie le mot de passe avec bcrypt et renvoie un JWT signé (HS256, secret `JWT_SECRET` d'au moins 32 caractères).
- Contenu du jeton :
```json
  { "sub": "<id>", "role": "AGENT", "statutPro": "VALIDE", "iat": 1794323456, "exp": 1794327056 }
```
- **Durée de vie : 1 heure** (`JWT_EXPIRES_IN`), car un JWT ne peut pas être révoqué avant son expiration.
- La charge utile est **signée, pas chiffrée** : elle est lisible par tous, elle ne contient donc rien de sensible.
- Le client envoie le jeton dans l'en-tête `Authorization: Bearer <jeton>`. L'API n'utilise aucun cookie.
- Au login, un email inconnu et un mauvais mot de passe donnent **le même message** (`INVALID_CREDENTIALS`), et le hachage est comparé dans les deux cas, pour ne pas révéler quels emails sont inscrits.

### Ordre des vérifications

Chaque route protégée applique, dans cet ordre :

1. **authentification** (`authentifier`) : jeton valide ? sinon `401` ;
2. **autorisation par rôle** (`exigerGestionnaire`) : le rôle permet-il l'opération ? sinon `403` ;
3. **validation** (Zod) : les données sont-elles correctes ? sinon `400` ;
4. **autorisation sur l'objet** : le filtre de propriété est ajouté au `where` de la requête Prisma ; si rien ne correspond, `404`.

### Politique d'autorisation

La politique est écrite en **fonctions pures** dans `src/regles/autorisation.ts`, sans dépendance à Fastify ni à Prisma : elle est testable sans serveur et réutilisable telle quelle (REST et, plus tard, GraphQL).

| Fonction | Règle |
|---|---|
| `peutGererAnnonces(user)` | ADMIN, ou AGENT dont le `statutPro` est `VALIDE` |
| `filtreProprietaire(user)` | un agent ne voit et ne modifie que ses annonces (`{ auteurId }`) ; un ADMIN n'a pas de restriction |
| `filtreVisibilite(user)` | anonyme et USER : annonces publiées ; AGENT : publiées + ses brouillons ; ADMIN : tout |

| Action | Anonyme | USER | AGENT non validé | AGENT validé | ADMIN |
|---|---|---|---|---|---|
| Lire les annonces publiées | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lire un brouillon | ❌ 404 | ❌ 404 | le sien seulement | le sien seulement | ✅ |
| Créer une annonce | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | ✅ |
| Modifier, supprimer, publier | ❌ 401 | ❌ 403 | ❌ 403 | les siennes (sinon 404) | ✅ |
| Poser une question | ❌ 401 | ✅ | ✅ | ✅ | ✅ |
| Répondre à une question | ❌ 401 | ❌ 403 | ❌ 403 | sur ses annonces (sinon 404) | ✅ |

La vérification de propriété se fait **dans la requête elle-même** (`deleteMany({ where: { id, ...filtreProprietaire(user) } })`, puis `404` si `count === 0`) : il n'y a pas de lecture puis d'écriture séparées entre lesquelles on pourrait passer.

### Statut professionnel des agents

Un AGENT ne gère des annonces que si son `statutPro` est `VALIDE` : un agent `EN_ATTENTE` ou `REFUSE` reçoit `403`.

Le statut est copié dans le JWT au login, ce qui évite une requête en base à chaque appel. Contrepartie : si un administrateur valide ou refuse un agent, le changement ne prend effet qu'à sa prochaine connexion (au plus tard une heure après, à l'expiration du jeton).

### CORS

```
CORS_ORIGIN=http://localhost:3001,http://localhost:5173
```

- Seules les origines listées dans `CORS_ORIGIN` peuvent appeler l'API depuis un navigateur. **`*` est refusé au démarrage** (`src/lib/cors.ts`).
- `credentials: false` : l'API n'utilise pas de cookie, le jeton passe par l'en-tête `Authorization`. Le cas « `*` avec credentials » ne peut donc pas se produire, et l'API n'est pas exposée au CSRF.
- Méthodes autorisées : `GET`, `POST`, `PATCH`, `PUT`, `DELETE` ; en-têtes : `Authorization`, `Content-Type` ; l'en-tête `Location` est exposé au front.
- **CORS ne protège pas le serveur** : c'est une règle appliquée par le navigateur, que curl, un script ou une application mobile ignorent. Ce qui protège les données, ce sont l'authentification et l'autorisation.

---

## Tests

### Lancer les tests

```bash
docker compose up -d   # démarre la base de développement ET la base de test (db-test)
npm test               # vérifie les types (tests + SDK) puis lance Vitest
```

Résultat attendu : `49 passed`.

`npm test` enchaîne deux étapes :
1. `npm run test:types` : compile les tests **et le SDK généré** (`tsconfig.test.json`). Si la spécification OpenAPI change (champ renommé, type modifié, route supprimée), le SDK change aussi et les tests ne compilent plus : **le contrat devient une dépendance vérifiée**.
2. `vitest run` : exécute les tests.

### Base de test séparée

Les tests utilisent exclusivement `DATABASE_URL_TEST` (service `db-test`, port 5434), jamais la base de développement.

- **Sans `DATABASE_URL_TEST`, la suite refuse de démarrer** : elle s'arrête avec un message explicite au lieu de vider la base de développement. Elle refuse aussi de démarrer si `DATABASE_URL_TEST` est identique à `DATABASE_URL`.
- Avant chaque lancement, `test/setup/global.ts` applique les migrations sur la base de test, la vide, puis relance le seed : les tests partent toujours du même état connu.

### Organisation

| Niveau | Fichier | Ce qui est testé | Tests |
|---|---|---|---|
| Unitaire | `test/unit/autorisation.test.ts` | politique d'autorisation, sans serveur ni base | 8 |
| Unitaire | `test/unit/schemas.test.ts` | schémas Zod : `role` ignoré, champs interdits retirés, prix négatif, date mal formée, plafond de `limit`, `id` non numérique | 9 |
| E2E | `test/e2e/auth.test.ts` | contenu du JWT, login (401), `/me` (401), inscription (201 toujours `USER`, 409, 400 avec détails par champ) | 9 |
| E2E | `test/e2e/annonces.test.ts` | pagination et filtres, brouillons invisibles (404), rôles (401/403, agent non validé), CRUD complet, publication, **IDOR** | 17 |
| E2E | `test/e2e/questions.test.ts` | poser une question, répondre (201 puis 409), brouillon (404), USER (403), **IDOR** | 6 |

Les tests **E2E** démarrent le vrai serveur sur un port libre et l'appellent **exclusivement via le SDK généré** depuis `openapi.yaml` :

```ts
const api = new AnnoncesApi(new Configuration({ basePath: base, accessToken: jeton }));
await api.supprimerAnnonce({ id });
```

Seule exception, volontaire : le test « `role=ADMIN` à l'inscription » utilise `fetch`, parce que le SDK, fidèle au contrat, ne permet même pas d'envoyer un champ `role`.

### Tests IDOR : deux assertions

Chaque test IDOR vérifie **le code de statut** (`404`) **et l'état de la base** (la ressource est intacte). Un `404` renvoyé *après* avoir supprimé la ligne serait toujours une faille.

| Tentative | Statut attendu | Vérification en base |
|---|---|---|
| agent2 supprime l'annonce d'agent1 | 404 | l'annonce existe toujours |
| agent2 modifie le prix de l'annonce d'agent1 | 404 | le prix est inchangé |
| agent2 publie le brouillon d'agent1 | 404 | elle reste en brouillon |
| agent2 répond à une question posée sur l'annonce d'agent1 | 404 | aucune réponse enregistrée |

### Les tests prouvent quelque chose

Pour vérifier que les tests détectent réellement une faille, nous avons cassé volontairement le filtre de propriété (`filtreProprietaire` renvoyant `{}`) :

```bash
sed -i 's/export function filtreProprietaire(user: Utilisateur): { auteurId?: string } {/&\n  return {}; \/\/ CASSÉ VOLONTAIREMENT/' src/regles/autorisation.ts
npx vitest run
git checkout src/regles/autorisation.ts   # restaurer
```

Résultat : **6 tests échouent**, dont les 4 tests IDOR. La suite ne reste pas verte quand la règle d'autorisation disparaît.

---

## Structure du projet

```
├── docker-compose.yml        # PostgreSQL (dev + test)
├── .env.example              # variables d'environnement (valeurs factices)
├── openapi.yaml              # contrat OpenAPI 3.1 (exporté depuis le code)
├── redocly.yaml              # configuration du linter de spécification
├── openapitools.json         # version du générateur de SDK
├── prisma.config.ts          # configuration Prisma 7
├── prisma/
│   ├── schema.prisma         # modèle de données
│   ├── migrations/           # migrations versionnées
│   └── seed.ts               # données de démonstration
├── scripts/
│   └── export-openapi.ts     # export de la spécification vers openapi.yaml
├── sdk/                      # client TypeScript généré depuis openapi.yaml
├── src/
│   ├── app.ts                # construction de l'application (réutilisée par les tests)
│   ├── server.ts             # démarrage du serveur
│   ├── lib/
│   │   ├── prisma.ts         # client Prisma
│   │   ├── auth.ts           # vérification du JWT, contrôle des rôles
│   │   ├── errors.ts         # forme unique des erreurs, gestionnaire global
│   │   ├── cors.ts           # lecture et contrôle des origines autorisées
│   │   ├── openapi.ts        # nettoyage de la spécification générée
│   │   └── pagination.ts     # pagination et métadonnées
│   ├── regles/
│   │   └── autorisation.ts   # politique d'autorisation (fonctions pures)
│   ├── schemas/              # schémas Zod : validation + contrat OpenAPI
│   └── routes/               # routes REST : auth, annonces, questions
└── test/
    ├── setup/                # base de test, migrations, seed
    ├── helpers.ts            # serveur de test et clients du SDK
    ├── unit/                 # tests unitaires
    └── e2e/                  # tests de bout en bout via le SDK
```

---

## À compléter

- GraphQL (`/graphql`, DataLoader, limite de profondeur)
- Cache HTTP (`Cache-Control`, `ETag`, `304`)
- Durcissement (limitation du nombre de tentatives de connexion)
- `SECURITY.md`
