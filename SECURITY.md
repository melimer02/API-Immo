# Audit de sécurité — ImmoService

## 1. Failles recherchées (OWASP API Security Top 10, édition 2023)

| Risque | Recherche et protection en place |
|---|---|
| **API1** Autorisation au niveau objet (IDOR) | `filtreProprietaire` dans le `where` de chaque écriture, en REST **et** dans chaque resolver GraphQL → 404 |
| **API2** Authentification défaillante | rate limit sur `/auth/login` (429) ; même message et même temps de réponse que l'email existe ou non |
| **API3** Autorisation au niveau des propriétés | entrées en liste blanche (Zod) : `role`, `auteurId`, `statutPublication` ignorés ; sorties en `select` explicites : `passwordHash` jamais renvoyé |
| **API4** Consommation de ressources | `limit` ≤ 100 (REST : 400, GraphQL : ramené à 100) ; profondeur GraphQL limitée à 4 ; rate limit |
| **API5** Autorisation au niveau des fonctions | rôle vérifié avant toute écriture : USER ou agent non validé → 403 / `FORBIDDEN` |
| **API6** Flux métier sensibles | **non traité** : inscription en masse et spam de questions possibles |
| **API7** SSRF | non applicable : les URL de photos sont stockées, jamais téléchargées par le serveur |
| **API8** Mauvaise configuration | CORS sans `*` (refusé au démarrage), pas de cookie ; erreurs 500 masquées ; introspection et GraphiQL désactivés en production ; secret JWT ≥ 32 caractères |
| **API9** Inventaire | toutes les routes sont documentées (`openapi.yaml`, schéma GraphQL) ; une seule version |
| **API10** API tierces | non applicable : aucun appel à un service externe |

**Méthode** : tests à deux comptes (agent A contre les ressources d'agent B, en vérifiant le statut **et** la base), filtre de propriété cassé volontairement (6 tests deviennent rouges), resolver GraphQL « oublié » volontairement (le test IDOR GraphQL échoue), recherche de `passwordHash` et de hachés bcrypt dans les réponses REST et GraphQL.

## 2. Failles trouvées dans notre code, et corrigées

| Faille | Cause | Correction |
|---|---|---|
| **IDOR (API1)** : agent2 pouvait supprimer les annonces d'agent1 | l'identifiant lu dans le JWT valait `undefined`, et Prisma **ignore** un filtre `auteurId: undefined` | `formatUser` (`sub` → `id`) ; `authentifier` et `filtreProprietaire` refusent un identifiant vide ; tests IDOR à deux assertions |
| **API5** : un agent `EN_ATTENTE` pouvait publier | seul le rôle était vérifié | `statutPro` dans le JWT ; `peutGererAnnonces` exige `VALIDE` |
| **API2** : force brute possible sur `/auth/login` | aucune limite | 10 tentatives / 15 min par IP, puis 429 + `Retry-After` ; compteurs **en base** (le stockage par défaut, en mémoire, violait la règle « aucun état applicatif en mémoire ») |
| **API4 / API8** : la limite de profondeur bloquait l'introspection (GraphiQL inutilisable) | `queryDepth` comptait aussi les champs `__schema` | `graphql-depth-limit` (ignore l'introspection) ; introspection désactivée en production |

## 3. Stockage du JWT côté client

L'API attend le jeton dans l'en-tête **`Authorization: Bearer`**, **jamais dans un cookie** : le navigateur ne l'envoie pas automatiquement, une attaque **CSRF est donc impossible**.

- **Front web** : en **mémoire** (variable JavaScript), pas dans `localStorage`, lisible par tout script injecté (XSS). Contrepartie : reconnexion après un rechargement de la page.
- **Application mobile** : stockage sécurisé du système (Keychain, Keystore).
- **Tests et scripts** : en mémoire, le temps de l'exécution.

## 4. Si un JWT est volé

**Il ne peut pas être révoqué individuellement** : l'API est sans état, le serveur ne garde aucune session.

- Le voleur agit au nom de la victime **jusqu'à l'expiration : 1 heure au maximum** (`JWT_EXPIRES_IN`).
- Le jeton est signé, pas chiffré, mais ne contient rien de sensible : identifiant, rôle, statut, expiration.
- Seul levier d'urgence : **changer `JWT_SECRET`**, ce qui invalide les jetons de **tous** les utilisateurs.
- Un changement de rôle ou de statut ne prend effet qu'à la prochaine connexion.
- **Amélioration prévue** : jeton d'accès court (15 min) et **refresh token stocké en base, donc révocable**, avec rotation à chaque utilisation.

## 5. Limites connues

- Rate limit par adresse IP : derrière un proxy ou un répartiteur de charge, il faut activer `trustProxy`.
- Pas de HTTPS en développement ; **obligatoire en production**, sinon le jeton circule en clair.
- `npm audit` signale des vulnérabilités dans l'outillage de développement (générateur de SDK, linter), pas dans le code exécuté par l'API.
