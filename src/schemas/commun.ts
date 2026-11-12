import { z } from "zod";

/**
 * Les schémas portant un `id` (via .meta) sont publiés une seule fois dans
 * components/schemas de la spec OpenAPI, puis référencés par $ref partout ailleurs.
 */

/** Forme unique des erreurs : { error: { code, message, details } } */
export const ErreurSchema = z
  .object({
    error: z.object({
      code: z
        .enum([
          "VALIDATION_FAILED",
          "BAD_REQUEST",
          "UNAUTHENTICATED",
          "INVALID_CREDENTIALS",
          "FORBIDDEN",
          "NOT_FOUND",
          "EMAIL_ALREADY_USED",
          "QUESTION_ALREADY_ANSWERED",
          "CONFLICT",
          "TOO_MANY_REQUESTS",
          "INTERNAL_ERROR",
        ])
        .describe("Code stable, lisible par une machine. Fait partie du contrat : ne change jamais."),
      message: z.string().describe("Message destiné à un humain (peut évoluer)"),
      details: z
        .array(
          z.object({
            field: z.string().describe("Champ concerné (ex. prix, limit)"),
            message: z.string().describe("Problème sur ce champ"),
          }),
        )
        .describe("Détails par champ (vide si non pertinent)"),
    }),
  })
  .meta({
    id: "Erreur",
    description: "Forme unique de toutes les erreurs de l'API",
    example: {
      error: {
        code: "VALIDATION_FAILED",
        message: "La requête est invalide",
        details: [{ field: "prix", message: "Too small: expected number to be >0" }],
      },
    },
  });

/** Paramètre de chemin :id — un entier positif, sinon 400 (jamais 500) */
export const IdParams = z.object({
  id: z.coerce.number().int().positive().describe("Identifiant numérique de la ressource"),
});

/** Pagination commune à toutes les listes. Le plafond (100) protège la base. */
export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1).describe("Numéro de page (à partir de 1)"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Nombre d'éléments par page (100 maximum)"),
});

export const MetaSchema = z
  .object({
    page: z.number().describe("Page courante"),
    limit: z.number().describe("Taille de page"),
    total: z.number().describe("Nombre total d'éléments correspondant aux filtres"),
    pages: z.number().describe("Nombre total de pages"),
  })
  .meta({ id: "MetaPagination", description: "Métadonnées de pagination" });

/** Auteur exposé publiquement : jamais d'email, jamais de passwordHash */
export const AuteurPublic = z
  .object({
    id: z.string(),
    name: z.string(),
  })
  .meta({ id: "AuteurPublic", description: "Auteur visible publiquement (ni email ni mot de passe)" });

/** Réponses d'erreur réutilisables, avec la signification de chaque code dans notre API */
export const erreurs = {
  400: ErreurSchema.describe("Requête invalide (body, query ou path) — VALIDATION_FAILED ou BAD_REQUEST"),
  401: ErreurSchema.describe("Jeton absent, invalide ou expiré — UNAUTHENTICATED"),
  403: ErreurSchema.describe("Le rôle ne permet pas l'opération, ou agent non validé — FORBIDDEN"),
  404: ErreurSchema.describe(
    "Ressource inexistante OU appartenant à un autre utilisateur (indiscernables volontairement) — NOT_FOUND",
  ),
  409: ErreurSchema.describe("Conflit avec l'état actuel — EMAIL_ALREADY_USED, QUESTION_ALREADY_ANSWERED"),
};

/** Réponse 429 : seulement sur les routes soumises à une limitation de débit (POST /auth/login) */
export const erreurTropDeRequetes = ErreurSchema.describe(
  "Trop de tentatives : réessayer après le délai indiqué par Retry-After — TOO_MANY_REQUESTS",
);

/** Erreurs possibles sur une ressource dont on doit être propriétaire (pas de 409) */
export const erreursProprietaire = {
  400: erreurs[400],
  401: erreurs[401],
  403: erreurs[403],
  404: erreurs[404],
};

type ExigencesSecurite = { [schema: string]: string[] }[];

/** Routes publiques : aucun jeton requis (déclaré explicitement dans la spec) */
export const securitePublique: ExigencesSecurite = [];

/** Routes protégées : jeton obligatoire */
export const securite: ExigencesSecurite = [{ bearerAuth: [] }];

/** Routes publiques dont la réponse dépend de l'appelant : anonyme OU avec jeton */
export const securiteFacultative: ExigencesSecurite = [{}, { bearerAuth: [] }];
