# ImmoService — API REST & GraphQL pour le domaine immobilier



L'application annonces-immo (Next.js )était son propre et unique client. Ici, on construit un **service** destiné à des clients que l'on ne contrôle pas (scripts, tests, application mobile, autre service). Le livrable est une **API**, sans interface : le contrat entre le service et ses clients devient explicite.



------

## Démarrage depuis zéro

Prérequis : Node.js ≥ 20, Docker et Docker Compose.

```bash
git clone https://www-apps.univ-lehavre.fr/forge/ai223266/webservices_immoservice.git
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
- API GraphQL (interface de test) : http://localhost:3000/graphiql
- tests : `npm test` → `100 passed`



## Comptes de test

Tous les comptes ont le mot de passe **`motdepasse123`**.

| Email            | Rôle               | Particularité                                                |
| ---------------- | ------------------ | ------------------------------------------------------------ |
| `admin@immo.fr`  | ADMIN              | voit tout, y compris les brouillons ; peut gérer toutes les annonces |
| `agent1@immo.fr` | AGENT (VALIDE)     | 10 annonces, dont 2 brouillons                               |
| `agent2@immo.fr` | AGENT (VALIDE)     | 10 annonces, dont 2 brouillons                               |
| `agent3@immo.fr` | AGENT (EN_ATTENTE) | statut non validé : ne peut pas gérer d'annonces (403)       |
| `user1@immo.fr`  | USER               | a posé 2 questions, a 1 favori                               |
| `user2@immo.fr`  | USER               | aucune activité                                              |

Les deux agents distincts permettent de tester l'autorisation : un agent ne doit jamais pouvoir modifier ou supprimer l'annonce de l'autre.

Obtenir un jeton :

```bash
curl -s -X POST localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"agent1@immo.fr","password":"motdepasse123"}'
```

## Scripts npm

| Script                   | Rôle                                                      |
| ------------------------ | --------------------------------------------------------- |
| `npm run dev`            | serveur de développement (rechargement automatique)       |
| `npm run build`          | génère le client Prisma et compile TypeScript             |
| `npm start`              | lance la version compilée                                 |
| `npm run db:migrate`     | applique les migrations                                   |
| `npm run db:seed`        | insère les données de démonstration                       |
| `npm run openapi`        | enchaîne les trois commandes ci-dessous                   |
| `npm run openapi:export` | régénère `openapi.yaml` depuis le code                    |
| `npm run openapi:lint`   | valide la spécification (Redocly)                         |
| `npm run sdk:generate`   | génère le client TypeScript dans `sdk/` (nécessite Java)  |
| `npm test`               | vérifie les types (tests + SDK) puis lance tous les tests |
| `npm run test:types`     | vérifie uniquement les types des tests et du SDK          |
| `npm run test:watch`     | tests en mode surveillance                                |

------

## Choix techniques et justifications

### Stack

| Élément                   | Choix                                                        |
| ------------------------- | ------------------------------------------------------------ |
| Langage                   | TypeScript, `strict: true`                                   |
| Framework                 | **Fastify**                                                  |
| Validation                | **Zod**, sur toute entrée                                    |
| Contrat                   | **OpenAPI 3.1**, approche **code-first** (`@fastify/swagger`, `fastify-type-provider-zod`) |
| Documentation             | Swagger UI sur `/docs`                                       |
| Client généré             | `openapi-generator-cli`, générateur `typescript-fetch`       |
| Base de données           | PostgreSQL 17 via Docker                                     |
| ORM                       | Prisma 7, avec l'adaptateur `@prisma/adapter-pg`             |
| Authentification          | JWT (`@fastify/jwt`), sans session en base                   |
| Hachage des mots de passe | `bcryptjs`                                                   |
| API GraphQL               | **Mercurius** (plugin GraphQL de Fastify), `dataloader`, `graphql-depth-limit` |
| CORS                      | `@fastify/cors`, origines explicites                         |
| Cache HTTP                | `Cache-Control`, `ETag` et `304`, centralisés dans un hook (`src/lib/cache.ts`) |
| Limitation de débit       | `@fastify/rate-limit`, compteurs stockés dans PostgreSQL     |
| Tests                     | Vitest, sur une base de test séparée                         |



### Pourquoi OpenAPI en code-first

Le choix entre code-first et contract-first détermine **la source de vérité** du contrat.

Nous avons choisi le **code-first** : les schémas Zod sont l'unique source de vérité. Ils valident les entrées **et** génèrent la spécification OpenAPI. Il n'y a donc pas de double saisie  et aucun risque de dérive entre la spécification et l'implémentation :  la documentation est à jour par construction.

Le risque de cette  approche est que la spécification reflète un code mal conçu. Pour le  limiter, nous avons conçu les routes (ressources, verbes, codes de  statut) **avant** de les coder, et nous relisons la  spécification générée : cette relecture nous a fait corriger des codes  d'erreur annoncés à tort (un 409 promis sur des routes qui ne peuvent  pas le renvoyer, un 401 de login mal décrit) et un champ de date dont le format n'était pas documenté.




## API REST

### Ressources et routes

| Méthode | Route                        | Accès                                           | Succès           |
| ------- | ---------------------------- | ----------------------------------------------- | ---------------- |
| POST    | `/auth/register`             | public                                          | 201              |
| POST    | `/auth/login`                | public                                          | 200 (JWT)        |
| GET     | `/me`                        | connecté                                        | 200              |
| GET     | `/annonces`                  | public (annonces publiées uniquement)           | 200              |
| GET     | `/annonces/{id}`             | public si publiée ; brouillon : auteur ou ADMIN | 200              |
| GET     | `/me/annonces`               | agent validé ou ADMIN                           | 200              |
| POST    | `/annonces`                  | agent validé ou ADMIN                           | 201 + `Location` |
| PATCH   | `/annonces/{id}`             | propriétaire ou ADMIN                           | 200              |
| DELETE  | `/annonces/{id}`             | propriétaire ou ADMIN                           | 204              |
| PUT     | `/annonces/{id}/publication` | propriétaire ou ADMIN                           | 200 (publie)     |
| DELETE  | `/annonces/{id}/publication` | propriétaire ou ADMIN                           | 200 (dépublie)   |
| GET     | `/annonces/{id}/questions`   | si l'annonce est visible                        | 200              |
| POST    | `/annonces/{id}/questions`   | connecté, annonce publiée                       | 201 + `Location` |
| GET     | `/questions/{id}`            | si l'annonce est visible                        | 200              |
| POST    | `/questions/{id}/reponse`    | agent propriétaire de l'annonce ou ADMIN        | 201              |



### Codes de statut

| Code | Signification dans l'API                                     |
| ---- | ------------------------------------------------------------ |
| 200  | lecture ou modification réussie                              |
| 201  | création réussie (avec l'en-tête `Location`)                 |
| 204  | suppression réussie, sans corps                              |
| 304  | le client possède déjà la bonne version (`If-None-Match`), corps vide |
| 400  | requête invalide : body, query ou path                       |
| 401  | jeton absent, invalide ou expiré ; identifiants incorrects au login |
| 403  | le rôle ne permet pas l'opération (USER, ou agent non validé) |
| 404  | ressource inexistante **ou** appartenant à un autre utilisateur |
| 409  | email déjà utilisé, question déjà répondue                   |
| 429  | trop de tentatives de connexion (avec l'en-tête `Retry-After`) |

### 404 plutôt que 403 sur la ressource d'un autre

Quand un agent tente de modifier, supprimer ou publier l'annonce d'un autre agent, ou de lire son brouillon, l'API répond **404** et non 403. Un 403 confirmerait que la ressource existe ; avec un 404, « absente » et « interdite » sont indiscernables.

Le **403** est réservé aux cas où c'est le **rôle** qui ne convient pas (un USER qui tente de créer une annonce) : l'existence de la route n'est pas un secret.

### Forme unique des erreurs

Toutes les erreurs, quelle que soit leur origine (validation, règle métier,  base de données, route inconnue, erreur inattendue), ont la même forme :

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "La requête est invalide",
    "details": [{ "field": "prix", "message": "Too small: expected number to be >0" }]
  }
}
```

Le `code` est stable et fait partie du contrat : `VALIDATION_FAILED`, `BAD_REQUEST`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `NOT_FOUND`, `EMAIL_ALREADY_USED`, `QUESTION_ALREADY_ANSWERED`, `CONFLICT`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`. Le `message` est destiné à un humain et peut évoluer.

Une erreur `500` ne révèle jamais de détail technique au client : elle est journalisée côté serveur.



## Contrat OpenAPI

| Ressource                              | Emplacement                     |
| -------------------------------------- | ------------------------------- |
| Documentation interactive (Swagger UI) | http://localhost:3000/docs      |
| Spécification JSON (servie par l'API)  | http://localhost:3000/docs/json |
| Spécification versionnée               | `openapi.yaml` (OpenAPI 3.1)    |
| Client TypeScript généré               | `sdk/`                          |

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

`openapi.yaml` et `sdk/` sont **commités** : les tests utilisent le SDK sans nécessiter Java sur la machine qui  les exécute. Ils sont à régénérer à chaque modification d'une route ou  d'un schéma.

------

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

La politique est écrite en **fonctions pures** dans `src/regles/autorisation.ts`, sans dépendance à Fastify ni à Prisma : elle est testable sans serveur  et réutilisée telle quelle par l'API REST et par les resolvers GraphQL.

| Fonction                   | Règle                                                        |
| -------------------------- | ------------------------------------------------------------ |
| `peutGererAnnonces(user)`  | ADMIN, ou AGENT dont le `statutPro` est `VALIDE`             |
| `filtreProprietaire(user)` | un agent ne voit et ne modifie que ses annonces (`{ auteurId }`) ; un ADMIN n'a pas de restriction |
| `filtreVisibilite(user)`   | anonyme et USER : annonces publiées ; AGENT : publiées + ses brouillons ; ADMIN : tout |

| Action                       | Anonyme | USER  | AGENT non validé  | AGENT validé                 | ADMIN |
| ---------------------------- | ------- | ----- | ----------------- | ---------------------------- | ----- |
| Lire les annonces publiées   | ✅       | ✅     | ✅                 | ✅                            | ✅     |
| Lire un brouillon            | ❌ 404   | ❌ 404 | le sien seulement | le sien seulement            | ✅     |
| Créer une annonce            | ❌ 401   | ❌ 403 | ❌ 403             | ✅                            | ✅     |
| Modifier, supprimer, publier | ❌ 401   | ❌ 403 | ❌ 403             | les siennes (sinon 404)      | ✅     |
| Poser une question           | ❌ 401   | ✅     | ✅                 | ✅                            | ✅     |
| Répondre à une question      | ❌ 401   | ❌ 403 | ❌ 403             | sur ses annonces (sinon 404) | ✅     |

La vérification de propriété se fait **dans la requête elle-même** (`deleteMany({ where: { id, ...filtreProprietaire(user) } })`, puis `404` si `count === 0`) : il n'y a pas de lecture puis d'écriture séparées entre lesquelles on pourrait passer.

#
### CORS

```
CORS_ORIGIN=http://localhost:3001,http://localhost:5173
```

- Seules les origines listées dans `CORS_ORIGIN` peuvent appeler l'API depuis un navigateur. **`\*` est refusé au démarrage** (`src/lib/cors.ts`).
- `credentials: false` : l'API n'utilise pas de cookie, le jeton passe par l'en-tête `Authorization`. Le cas « `*` avec credentials » ne peut donc pas se produire, et l'API n'est pas exposée au CSRF.
- Méthodes autorisées : `GET`, `POST`, `PATCH`, `PUT`, `DELETE` ; en-têtes : `Authorization`, `Content-Type` ; l'en-tête `Location` est exposé au front.
- **CORS ne protège pas le serveur** : c'est une règle appliquée par le navigateur, que curl, un script ou une application mobile ignorent. Ce qui protège les données, ce sont l'authentification et l'autorisation.

------

## API GraphQL

| Ressource                         | Emplacement                                                  |
| --------------------------------- | ------------------------------------------------------------ |
| Endpoint                          | `POST http://localhost:3000/graphql` (même serveur, même domaine que l'API REST) |
| Interface de test (développement) | http://localhost:3000/graphiql                               |
| Schéma (le contrat)               | `src/graphql/schema.ts`                                      |

### Le schéma

Le schéma GraphQL est le **contrat** de cette API : il est obligatoire, et tout ce qui n'y figure pas ne peut pas être demandé (`passwordHash` n'existe pas pour un client GraphQL).

- **Types** : `Annonce`, `Photo`, `Auteur`, `Question`, `Reponse`, `PageAnnonces`, `MetaPagination`, scalaire `DateTime`.
- **`enum`** : `TypeBien`, `StatutPublication`, `StatutBien`.
- **Types `input`** : `FiltreAnnonces`, `CreerAnnonceInput`, `ModifierAnnonceInput`, `QuestionInput`, `ReponseInput`. Ajouter un champ facultatif à un `input` ne casse pas la signature d'une mutation.
- **Types de retour** : `ResultatAnnonce`, `ResultatQuestion`, `ResultatReponse`, qui portent les erreurs de validation.
- **Queries** : `annonces(page, limit, filtre)`, `annonce(id)`, `mesAnnonces(page, limit)`.
- **Mutations** : `creerAnnonce`, `modifierAnnonce`, `supprimerAnnonce`, `publierAnnonce`, `depublierAnnonce`, `poserQuestion`, `repondreQuestion`.

`annonce(id: ID!): Annonce` n'a pas de `!` sur son retour : un identifiant inconnu, ou un brouillon que l'appelant n'a pas le droit de voir, renvoie `null`. C'est l'équivalent du `404` REST : l'existence d'un brouillon n'est pas révélée.

### Exemples

```graphql
# Le client choisit exactement les champs et les relations qu'il veut, en une seule requête
{
  annonces(limit: 3, filtre: { ville: "bordeaux", type: LOCATION }) {
    meta { total pages }
    data { titre prix auteur { name } questions { contenu reponse { contenu } } }
  }
}
# En-tête : { "Authorization": "Bearer <jeton>" }
mutation {
  creerAnnonce(input: {
    titre: "Studio lumineux", description: "Proche de la plage.", typeBien: LOCATION,
    prix: 650, ville: "Le Havre", dateDisponibilite: "2026-12-01"
  }) {
    annonce { id statutPublication }
    erreurs { champ message }
  }
}
```

### Deux sortes d'erreurs

- **Erreurs de validation → dans le type de retour.** Une donnée invalide fait partie du résultat normal d'une mutation, ce n'est pas une erreur technique :

  ```json
  { "data": { "creerAnnonce": { "annonce": null, "erreurs": [{ "champ": "prix", "message": "…" }] } } }
  ```

  La validation utilise 

  les mêmes schémas Zod que l'API REST

  .

- **Erreurs d'accès → erreurs GraphQL**, avec un code stable dans `extensions.code`, au même vocabulaire que l'API REST : `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`. Une erreur inattendue est masquée (`INTERNAL_ERROR`) et journalisée côté serveur.

### Authentification et autorisation

- **Authentification par le contexte** : le JWT est vérifié une fois par requête (hook `onRequest`). Le contexte contient l'utilisateur (`null` s'il est anonyme) et les DataLoaders. Un jeton présent mais invalide donne une erreur `UNAUTHENTICATED` (401), il n'est jamais ignoré.
- **Autorisation resolver par resolver.** Il n'existe pas de middleware d'autorisation en GraphQL : tout passe par un seul endpoint. Chaque resolver commence donc par **authentification → autorisation → validation**, avec **les mêmes fonctions qu'en REST** (`src/regles/autorisation.ts`) : une seule politique, deux paradigmes.

| Opération                                                    | Vérification dans le resolver                                |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `annonces`                                                   | aucune (public), uniquement les annonces publiées            |
| `annonce`                                                    | `filtreVisibilite(user)` dans le `where`                     |
| `mesAnnonces`, `creerAnnonce`                                | `exigerGestionnaire` : ADMIN ou agent validé                 |
| `modifierAnnonce`, `supprimerAnnonce`, `publierAnnonce`, `depublierAnnonce` | `exigerGestionnaire`, puis `filtreProprietaire(user)` dans le `where` → `NOT_FOUND` |
| `poserQuestion`                                              | `exigerConnexion`, annonce publiée sinon `NOT_FOUND`         |
| `repondreQuestion`                                           | `exigerGestionnaire`, puis la question doit porter sur une annonce de l'agent → `NOT_FOUND` |

Un resolver qui oublierait cette vérification ne serait détecté par **aucun test de route** : les tests IDOR sont donc refaits côté GraphQL (`graphql-mutations.test.ts`). En retirant volontairement le filtre de propriété d'une seule mutation, ces tests échouent.

### DataLoader et problème N+1

Sans précaution, afficher 20 annonces avec leur auteur coûte 1 requête pour les annonces, puis 1 requête **par** auteur : 21 requêtes, et 501 pour 500 annonces.

Les relations `Annonce.auteur`, `Question.auteur`, `Reponse.auteur` et `Annonce.questions` passent par des **DataLoaders** (`src/graphql/chargeurs.ts`), qui regroupent les demandes d'un même tour de boucle en **une** requête `WHERE id IN (...)`.

- **Un loader par requête HTTP** : les chargeurs sont créés dans le contexte, jamais partagés. Un loader global servirait des données périmées, voire celles d'un autre utilisateur.
- **L'ordre du résultat correspond à l'ordre des identifiants reçus** : sinon, le mauvais auteur serait associé silencieusement à la mauvaise annonce.

**Le test N+1** compte les requêtes SQL envoyées par Prisma pour la même requête GraphQL avec 2 puis 16 annonces : **4 requêtes dans les deux cas**. En remplaçant volontairement le DataLoader par une requête par annonce, on passe à 5 puis 19 requêtes, et le test échoue.

À noter : Prisma regroupe déjà automatiquement les `findUnique` lancés dans le même tour de boucle. Une version naïve avec `findUnique` ne montre donc pas le N+1 ; il apparaît avec `findFirst` ou `findMany`.

### Garde-fous

- **Limite de profondeur** (`graphql-depth-limit`, profondeur 4) : `annonces > data > questions > reponse > contenu` est acceptée, une imbrication plus profonde est refusée (400) avant toute exécution. Les champs d'introspection (`__schema`, `__type`) ne sont pas comptés, pour que GraphiQL fonctionne.
- **Plafond de pagination côté serveur** : `limit` est ramené à 100, quoi que demande le client.
- **Introspection désactivée en production** (`NODE_ENV=production`) : le schéma n'est pas exposé à n'importe qui, et GraphiQL n'est pas servi.

### Choix techniques

- **Mercurius** est le plugin GraphQL officiel de l'écosystème Fastify : même serveur, mêmes hooks, même JWT que l'API REST.
- Le plugin GraphQL est **encapsulé** : les compilateurs Zod de l'API REST ne s'appliquent pas à ses routes, qui utilisent des schémas JSON classiques. Sans encapsulation, le serveur refusait de démarrer.
- **`graphql@16`** plutôt que la version 17 : la version 17 existe en deux variantes (ESM et CommonJS), et notre code et Mercurius en chargeaient chacun une différente. Le scalaire `DateTime` n'était alors pas reconnu.
- Les routes GraphQL sont **exclues de la spécification OpenAPI** : leur contrat est le schéma GraphQL.

### REST ou GraphQL ?

Les deux API exposent les mêmes données, avec les mêmes règles.

|                     | REST                                                   | GraphQL                    |
| ------------------- | ------------------------------------------------------ | -------------------------- |
| Forme de la réponse | fixée par le serveur                                   | choisie par le client      |
| Relations           | une requête par ressource (`/annonces/{id}/questions`) | en une seule requête       |
| Contrat             | OpenAPI (`openapi.yaml`)                               | schéma GraphQL             |
| Autorisation        | hooks par route + filtre dans chaque requête           | dans chaque resolver       |
| Cache HTTP          | oui (`GET` cachable, `ETag`, `304`)                    | non : tout passe en `POST` |
| Risques principaux  | sur-récupération de données                            | N+1, requêtes abusives     |

------

## Cache HTTP

Le cache HTTP est l'avantage structurel de REST. Il réduit le **volume de données transféré** de deux façons : dire **qui** peut garder une réponse et **combien de temps** (`Cache-Control`), et ne pas renvoyer ce que le client possède déjà (`ETag` et `304`).

Les règles sont **centralisées** dans un seul hook `onSend` (`src/lib/cache.ts`), plutôt que dispersées route par route.

| Endpoint                                                     | `Cache-Control`                                              | Pourquoi                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `GET /annonces`                                              | `public, max-age=300` + `ETag`                               | réponse **identique pour tous** : cachable par le navigateur, les proxys et les CDN |
| `GET /annonces/{id}`, `/annonces/{id}/questions`, `/questions/{id}` | `public, max-age=300` si anonyme ; **`private, no-cache`** avec un jeton (+ `Vary: Authorization`) | avec un jeton, la réponse peut contenir un brouillon : seul le navigateur de l'utilisateur peut la garder |
| `/me`, `/me/annonces`                                        | `no-store`                                                   | données personnelles                                         |
| écritures, `/auth/login`, erreurs, `POST /graphql`           | `no-store`                                                   | jamais en cache                                              |

### ETag et 304

La première réponse porte un `ETag` (empreinte SHA-1 du corps). Si le client renvoie cet `ETag` dans `If-None-Match` et que rien n'a changé, la réponse est **`304 Not Modified` sans corps**.

```bash
curl -s -o /dev/null -w "%{http_code} %{size_download} octets\n" "localhost:3000/annonces?limit=20"
# 200 7922 octets
curl -s -o /dev/null -w "%{http_code} %{size_download} octets\n" "localhost:3000/annonces?limit=20" -H 'If-None-Match: "<etag reçu>"'
# 304 0 octets
```

Dès qu'une annonce change, l'`ETag` change aussi : le client reçoit de nouveau un `200` avec les nouvelles données.

------

## Durcissement

### Limitation de débit sur la connexion

`POST /auth/login` est limité à **10 tentatives par tranche de 15 minutes et par adresse IP** (`LOGIN_MAX_TENTATIVES`, `LOGIN_FENETRE`). Au-delà : **`429 TOO_MANY_REQUESTS`** avec l'en-tête `Retry-After`, même si le mot de passe est correct. Cela protège contre la force brute et le *credential stuffing*.

```bash
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code} " -X POST localhost:3000/auth/login \
    -H 'content-type: application/json' -d '{"email":"agent1@immo.fr","password":"faux"}'
done
# 401 401 401 401 401 401 401 401 401 401 429 429
```

Par défaut, `@fastify/rate-limit` garde ses compteurs **en mémoire**. Cela aurait violé la règle « aucun état applicatif en mémoire » : les  compteurs seraient perdus à chaque redémarrage, et chaque instance du  serveur aurait sa propre limite. Les compteurs sont donc stockés **dans PostgreSQL** (`src/lib/limite-debit.ts`, table `limite_debit`), avec une requête **atomique** (`INSERT … ON CONFLICT`) : deux tentatives simultanées ne peuvent pas se perdre.

Pour se débloquer en développement :

```bash
docker compose exec db psql -U immo -d immoservice -c 'delete from limite_debit;'
```



------

## Tests

### Lancer les tests

```bash
docker compose up -d   # démarre la base de développement ET la base de test (db-test)
npm test               # vérifie les types (tests + SDK) puis lance Vitest
```

Résultat attendu : `100 passed`.

`npm test` enchaîne deux étapes :

1. `npm run test:types` : compile les tests **et le SDK généré** (`tsconfig.test.json`). Si la spécification OpenAPI change (champ renommé, type modifié, route supprimée), le SDK change aussi et les tests ne compilent plus : **le contrat devient une dépendance vérifiée**.
2. `vitest run` : exécute les tests.

### Base de test séparée

Les tests utilisent exclusivement `DATABASE_URL_TEST` (service `db-test`, port 5434), jamais la base de développement.

- **Sans `DATABASE_URL_TEST`, la suite refuse de démarrer** : elle s'arrête avec un message explicite au lieu de vider la base de développement. Elle refuse aussi de démarrer si `DATABASE_URL_TEST` est identique à `DATABASE_URL`.
- Avant chaque lancement, `test/setup/global.ts` applique les migrations sur la base de test, la vide, puis relance le seed : les tests partent toujours du même état connu.

### Organisation

| Niveau      | Fichier                              | Ce qui est testé                                             | Tests |
| ----------- | ------------------------------------ | ------------------------------------------------------------ | ----- |
| Unitaire    | `test/unit/autorisation.test.ts`     | politique d'autorisation, sans serveur ni base               | 8     |
| Unitaire    | `test/unit/schemas.test.ts`          | schémas Zod (`role` ignoré, champs interdits retirés, prix négatif, date mal formée, plafond de `limit`, `id` non numérique) et origines CORS (refus de `*`) | 11    |
| E2E REST    | `test/e2e/auth.test.ts`              | contenu du JWT, login (401), `/me` (401), inscription (201 toujours `USER`, 409, 400 avec détails par champ) | 9     |
| E2E REST    | `test/e2e/annonces.test.ts`          | pagination et filtres, brouillons invisibles (404), rôles (401/403, agent non validé), CRUD complet, publication, **IDOR** | 18    |
| E2E REST    | `test/e2e/questions.test.ts`         | poser une question, répondre (201 puis 409), brouillon (404), USER (403), **IDOR** | 6     |
| E2E REST    | `test/e2e/cache.test.ts`             | `Cache-Control` selon les routes, `ETag`, `304`, `ETag` qui change avec les données | 7     |
| E2E REST    | `test/e2e/durcissement.test.ts`      | rate limit (429 + `Retry-After`, compteurs en base), aucune fuite de `passwordHash` (REST et GraphQL), plafond de pagination | 7     |
| E2E GraphQL | `test/e2e/graphql-base.test.ts`      | endpoint, jeton invalide (401), limite de profondeur, champ hors schéma | 5     |
| E2E GraphQL | `test/e2e/graphql-queries.test.ts`   | liste, filtres, plafond de pagination, détail (brouillon → `null`), `mesAnnonces` (rôles), **test N+1** | 13    |
| E2E GraphQL | `test/e2e/graphql-mutations.test.ts` | cycle de vie d'une annonce, erreurs de validation dans le résultat, rôles, questions/réponses, **IDOR** | 15    |

Les tests **E2E REST** démarrent le vrai serveur sur un port libre et appellent les routes métier **via le SDK généré** depuis `openapi.yaml` :

```typescript
const api = new AnnoncesApi(new Configuration({ basePath: base, accessToken: jeton }));
await api.supprimerAnnonce({ id });
```

Exceptions, volontaires : le test « `role=ADMIN` à l'inscription » utilise `fetch`, parce que le SDK, fidèle au contrat, ne permet même pas d'envoyer un champ `role` ; les tests du cache et du rate limit utilisent aussi `fetch`, pour lire directement les en-têtes HTTP (`ETag`, `Cache-Control`, `Retry-After`). Les tests GraphQL envoient leurs requêtes à `/graphql`.

Chaque fichier de test remet à zéro les compteurs de limitation de débit au  démarrage, pour que les connexions des tests ne soient pas bloquées.

### Tests IDOR : deux assertions

Chaque test IDOR vérifie **le code de statut** (`404`) **et l'état de la base** (la ressource est intacte). Un `404` renvoyé *après* avoir supprimé la ligne serait toujours une faille.

| Tentative                                                    | Statut attendu | Vérification en base       |
| ------------------------------------------------------------ | -------------- | -------------------------- |
| agent2 supprime l'annonce d'agent1                           | 404            | l'annonce existe toujours  |
| agent2 modifie le prix de l'annonce d'agent1                 | 404            | le prix est inchangé       |
| agent2 publie le brouillon d'agent1                          | 404            | elle reste en brouillon    |
| agent2 répond à une question posée sur l'annonce d'agent1    | 404            | aucune réponse enregistrée |
| les mêmes tentatives en **GraphQL** (supprimer, modifier, publier, dépublier, répondre) | `NOT_FOUND`    | la ressource est intacte   |

### Les tests prouvent quelque chose

Pour vérifier que les tests détectent réellement une faille, nous avons cassé volontairement le filtre de propriété (`filtreProprietaire` renvoyant `{}`) :

```bash
sed -i 's/export function filtreProprietaire(user: Utilisateur): { auteurId?: string } {/&\n  return {}; \/\/ CASSÉ VOLONTAIREMENT/' src/regles/autorisation.ts
npx vitest run
git checkout src/regles/autorisation.ts   # restaurer
```

Résultat : les tests IDOR échouent (REST et GraphQL). La suite ne reste pas verte quand la règle d'autorisation disparaît.

De la même façon, en retirant le filtre de propriété d'**une seule** mutation GraphQL, le test IDOR GraphQL correspondant échoue ; et en  remplaçant le DataLoader par une requête par annonce, le test N+1  échoue.

------

## Structure du projet

```markdown
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
│   │   ├── cache.ts          # Cache-Control, ETag et 304
│   │   ├── limite-debit.ts   # limitation de débit, compteurs en base
│   │   ├── openapi.ts        # nettoyage de la spécification générée
│   │   └── pagination.ts     # pagination et métadonnées
│   ├── regles/
│   │   └── autorisation.ts   # politique d'autorisation (fonctions pures)
│   ├── schemas/              # schémas Zod : validation + contrat OpenAPI
│   ├── routes/               # routes REST : auth, annonces, questions
│   └── graphql/
│       ├── schema.ts         # schéma GraphQL (le contrat)
│       ├── index.ts          # branchement de Mercurius, garde-fous, format des erreurs
│       ├── contexte.ts       # authentification et contexte de chaque requête
│       ├── chargeurs.ts      # DataLoaders (un jeu par requête)
│       ├── erreurs.ts        # erreurs GraphQL, contrôles d'accès, erreurs de validation
│       ├── selections.ts     # colonnes lues pour une annonce
│       ├── types.ts          # resolvers des relations et scalaire DateTime
│       ├── queries.ts        # queries
│       └── mutations.ts      # mutations
└── test/
    ├── setup/                # base de test, migrations, seed
    ├── helpers.ts            # serveur de test et clients du SDK
    ├── unit/                 # tests unitaires
    └── e2e/                  # tests de bout en bout (REST via le SDK, GraphQL)
```