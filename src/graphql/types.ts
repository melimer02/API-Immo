import { GraphQLScalarType, Kind } from "graphql";
import type { IResolvers } from "mercurius";
import type { AnnonceGraphQL } from "./selections.js";
import type { QuestionAvecReponse } from "./chargeurs.js";

/** Scalaire DateTime : une Date côté serveur, un texte ISO 8601 côté client */
const DateTime = new GraphQLScalarType({
  name: "DateTime",
  serialize: (valeur) => (valeur instanceof Date ? valeur.toISOString() : String(valeur)),
  parseValue: (valeur) => new Date(String(valeur)),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? new Date(ast.value) : null),
});

/**
 * Resolvers de CHAMPS : comment obtenir les relations d'un objet.
 * Ils passent par les chargeurs du contexte → pas de N+1.
 * Ils n'ont pas besoin de vérifier l'autorisation : l'objet parent n'a été
 * renvoyé que si l'appelant avait le droit de le voir.
 */
export const resolversTypes: IResolvers = {
  DateTime,

  Annonce: {
    auteur: (annonce: AnnonceGraphQL, _args, ctx) => ctx.chargeurs.auteurs.load(annonce.auteurId),
    questions: (annonce: AnnonceGraphQL, _args, ctx) => ctx.chargeurs.questionsParAnnonce.load(annonce.id),
  },

  Question: {
    auteur: (question: QuestionAvecReponse, _args, ctx) => ctx.chargeurs.auteurs.load(question.auteurId),
  },

  Reponse: {
    auteur: (reponse: { auteurId: string }, _args, ctx) => ctx.chargeurs.auteurs.load(reponse.auteurId),
  },
};
