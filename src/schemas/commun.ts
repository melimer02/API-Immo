import { z } from "zod";

/** Forme unique des erreurs  */
export const ErreurSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ field: z.string(), message: z.string() })),
  }),
});

/** Paramètre de chemin :id — un entier positif */
export const IdParams = z.object({
  id: z.coerce.number().int().positive(),
});

/** Pagination commune à toutes les listes. Le plafond (100) protège la base. */
export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const MetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  pages: z.number(),
});

/** Auteur exposé publiquement  */
export const AuteurPublic = z.object({
  id: z.string(),
  name: z.string(),
});

/** Réponses d'erreur */
export const erreurs = {
  400: ErreurSchema,
  401: ErreurSchema,
  403: ErreurSchema,
  404: ErreurSchema,
  409: ErreurSchema,
};
