import type { FastifyInstance } from "fastify";
import { GraphQLError, NoSchemaIntrospectionCustomRule } from "graphql";
import depthLimit from "graphql-depth-limit";
import mercurius from "mercurius";
import { schema } from "./schema.js";
import { authentifierGraphQL, construireContexte } from "./contexte.js";
import { resolversTypes } from "./types.js";
import { Query } from "./queries.js";
import { Mutation } from "./mutations.js";

/**
 * Profondeur maximale d'une requête GraphQL (garde-fou contre les requêtes imbriquées abusives).
 * graphql-depth-limit compte à partir de 0 pour le premier champ :
 *   annonces(0) > data(1) > questions(2) > reponse(3) > contenu(4)              → acceptée
 *   annonces(0) > data(1) > questions(2) > reponse(3) > auteur(4) > name(5)     → refusée
 */
export const PROFONDEUR_MAX = 4;

const enProduction = process.env.NODE_ENV === "production";

/**
 * Branche GraphQL (Mercurius) sur le même serveur que l'API REST : POST /graphql.
 * GraphiQL (interface de test dans le navigateur) est servi sur /graphiql hors production.
 *
 * Ce plugin est ENCAPSULÉ (pas de fastify-plugin) : les compilateurs Zod de l'API REST
 * ne s'y appliquent pas. Mercurius déclare ses propres routes avec des schémas JSON
 * classiques, que les compilateurs Zod ne savent pas lire. Ici, la validation est
 * assurée par GraphQL lui-même (le schéma SDL), et les réponses sont sérialisées en JSON.
 */
export async function graphqlPlugin(app: FastifyInstance) {
  app.setValidatorCompiler(() => () => true);
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));

  // Authentification par le jeton, avant chaque requête GraphQL
  app.addHook("onRequest", authentifierGraphQL);

  await app.register(mercurius, {
    schema,
    resolvers: { ...resolversTypes, Query, Mutation },
    context: (req) => construireContexte(req),
    // Garde-fous appliqués à chaque requête, avant toute exécution :
    // - limite de profondeur (les champs d'introspection __schema/__type, utilisés par GraphiQL, ne comptent pas) ;
    // - en production, introspection désactivée : le schéma n'est pas exposé à n'importe qui.
    validationRules: enProduction
      ? [depthLimit(PROFONDEUR_MAX), NoSchemaIntrospectionCustomRule]
      : [depthLimit(PROFONDEUR_MAX)],
    graphiql: !enProduction,
    errorFormatter: (execution, ctx) => {
      // Une erreur inattendue (bug, Prisma…) ne doit rien révéler au client :
      // seules les erreurs portant un code (ErrorWithProps) sont transmises telles quelles.
      const errors = execution.errors.map((e) => {
        const code = (e.extensions as { code?: string } | undefined)?.code;
        const origine = e.originalError as { code?: string } | undefined;
        // Erreurs sans danger, transmises telles quelles :
        // - nos erreurs métier (elles portent un code) ;
        // - les erreurs du langage GraphQL (champ inconnu, requête trop profonde, syntaxe…).
        if (code || !origine || origine instanceof GraphQLError || origine.code?.startsWith("MER_ERR")) return e;
        ctx.reply.request.log.error(e.originalError);
        return new GraphQLError("Erreur interne du serveur", {
          nodes: e.nodes,
          path: e.path,
          extensions: { code: "INTERNAL_ERROR" },
        });
      });
      return mercurius.defaultErrorFormatter({ ...execution, errors }, ctx);
    },
  });
}
