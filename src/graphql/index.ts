import type { FastifyInstance } from "fastify";
import { GraphQLError } from "graphql";
import mercurius from "mercurius";
import { schema } from "./schema.js";
import { authentifierGraphQL, construireContexte } from "./contexte.js";
import { resolversTypes } from "./types.js";
import { Query } from "./queries.js";
import { Mutation } from "./mutations.js";

/** Profondeur maximale d'une requête GraphQL (garde-fou contre les requêtes imbriquées abusives) */
export const PROFONDEUR_MAX = 5;

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
    queryDepth: PROFONDEUR_MAX,
    graphiql: process.env.NODE_ENV !== "production",
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
