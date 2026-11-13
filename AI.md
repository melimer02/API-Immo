# Usage de l'IA dans le projet

Pendant ce projet, nous avons utilisé **Claude**  comme assistant. Ce fichier explique à quoi il nous a servi, ce que nous avons fait nous-mêmes et les erreurs que nous avons repérées dans ses propositions.

## À quoi l'IA nous a servi

**Comprendre le cours et le sujet.** On lui a demandé de résumer le cours et d'expliquer certaines notions (contrat, URI, code-first ou contract-first). 

**Générer du code.** Pour chaque étape, Claude nous a proposé du code. Nous l'avons lu, compris, adapté à notre projet, puis testé :
- la mise en place : `docker-compose.yml`, `.env.example`, `prisma.config.ts`, l'adaptation du schéma Prisma et du seed du TP1 ;

- le contrat : la configuration OpenAPI, le script d'export de la spec, la config Redocly et les scripts npm de génération du SDK ;
- le CORS, les tests Vitest et la base de test séparée ;
- l'API GraphQL (schéma, resolvers, DataLoader, limite de profondeur) ;
- le cache HTTP et la limitation de débit sur le login ;


**Nous aider à corriger des erreurs.** Quand une commande échouait (module introuvable, erreur de build, base de test arrêtée, port déjà utilisé…), on lui donnait le message d'erreur et il nous expliquait la cause.

**Gérer Git.** Claude nous a aidé dans la gestion des branches et sur les merge requests. Il nous a aussi aidées à résoudre un conflit de fusion entre les étapes 7 et 8. Les branches, les commits, les relectures croisées et les fusions, c'est nous qui les avons faits.

## Ce que nous avons décidé nous-mêmes

- La stack : Fastify, Zod, OpenAPI en code-first, TypeScript.
- Renvoyer 404 (et non 403) quand on accède à la ressource d'un autre utilisateur.
- La répartition du travail entre nous deux, étape par étape.
- Les vérifications à la main : navigateur, Swagger UI, GraphiQL, `curl`, `psql`.
- La relecture de la spec générée et du code proposé, avant chaque merge request.

## Les erreurs de l'IA que nous avons repérées

L'IA s'est trompée plusieurs fois. Voici les cas les plus importants.

### 1. Deux erreurs dans le contrat OpenAPI

En relisant la spec générée, on a trouvé deux promesses fausses faites aux clients :

- **`POST /auth/login`, réponse 401 :** la description parlait de « jeton absent, invalide ou expiré » (`UNAUTHENTICATED`). En réalité, le login renvoie `INVALID_CREDENTIALS` (mauvais email ou mot de passe), et on n'envoie même pas de jeton au login.
- **Des 409 qui n'arrivent jamais :** `PATCH` et `DELETE /annonces/{id}` ainsi que les routes `/publication` annonçaient un `409 Conflict`. Ça venait de `...erreurs`, qui ajoutait tous les codes d'erreur à toutes les routes. En réalité, seule `POST /questions/{id}/reponse` peut renvoyer un 409.

Correction : nous avons créé une liste d'erreurs spécifique aux routes du propriétaire (sans 409) et corrigé la description du 401.

On a aussi remarqué que la spec était en OpenAPI 3.0.3 au lieu de 3.1, et que le format de certains champs de date n'était pas documenté. Ces deux points ont été corrigés.

### 2. La limite de profondeur GraphQL bloquait GraphiQL

En ouvrant GraphiQL, nous avons eu cette erreur : « IntrospectionQuery query depth (15) exceeds the query depth limit of 5 ».

Pour afficher la documentation et l'autocomplétion, GraphiQL envoie au démarrage une requête d'introspection, qui demande au serveur de décrire son schéma. Cette requête est très imbriquée (profondeur 15), et l'option `queryDepth` de Mercurius la refusait comme n'importe quelle autre requête. Le test proposé par l'IA n'avait pas vu le problème, parce qu'il n'envoyait pas de requête d'introspection.

Correction : on a remplacé `queryDepth` par `graphql-depth-limit`, la bibliothèque citée dans le cours. Elle ignore les champs d'introspection (ceux qui commencent par `__`) mais limite toutes les autres requêtes. On a aussi désactivé l'introspection en production, comme le recommande le cours.

Vérifications :
- en développement, l'introspection fonctionne et GraphiQL affiche le schéma ;
- une requête trop profonde est toujours refusée (400) ;
- en production, l'introspection est refusée et `/graphiql` renvoie 404 ;
- tous les tests passent.

### 3. Autres erreurs corrigées en chemin

- **Un trou d'autorisation (IDOR) :** l'identifiant de l'utilisateur lu depuis le JWT était `undefined`, ce qui pouvait fausser le filtre sur le propriétaire. Nos tests d'autorisation l'ont révélé, et on l'a corrigé.
- **Une version de `graphql` incompatible :** `graphql@17` provoquait une erreur au démarrage avec Mercurius, on est revenues à `graphql@16`.
- **Un test du problème N+1 qui ne prouvait rien :** Prisma regroupe déjà automatiquement certaines requêtes, donc le test passait même sans DataLoader. On l'a réécrit pour qu'il échoue vraiment sans DataLoader.



