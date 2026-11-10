import { z } from "zod";
import { AuteurPublic, MetaSchema, PaginationQuery } from "./commun.js";

const TypeBien = z.enum(["VENTE", "LOCATION"]);
const StatutBien = z.enum(["DISPONIBLE", "LOUE", "VENDU"]);
const StatutPublication = z.enum(["BROUILLON", "PUBLIEE"]);

/** GET /annonces  */
export const ListeAnnoncesQuery = PaginationQuery.extend({
  ville: z.string().trim().min(1).max(100).optional(),
  type: TypeBien.optional(),
  prixMax: z.coerce.number().positive().optional(),
});

export const PhotoSchema = z.object({
  url: z.url(),
  alt: z.string().trim().min(1).max(200),
});

/** POST /annonces  */
export const CreerAnnonceBody = z.object({
  titre: z.string().trim().min(5).max(150),
  description: z.string().trim().min(10).max(5000),
  typeBien: TypeBien,
  prix: z.number().positive(),
  surface: z.number().int().positive().optional(),
  ville: z.string().trim().min(1).max(100),
  dateDisponibilite: z.coerce.date(),
  photos: z.array(PhotoSchema).max(20).default([]),
});

/** PATCH /annonces/:id — tous les champs facultatifs*/
export const ModifierAnnonceBody = CreerAnnonceBody.omit({ photos: true })
  .extend({ statutBien: StatutBien })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ à modifier est requis",
  });

/** Ce que l'API renvoie pour une annonce  */
export const AnnonceSchema = z.object({
  id: z.number(),
  titre: z.string(),
  description: z.string(),
  typeBien: TypeBien,
  statutPublication: StatutPublication,
  statutBien: StatutBien,
  prix: z.number(),
  surface: z.number().nullable(),
  ville: z.string(),
  dateDisponibilite: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
  auteur: AuteurPublic,
  photos: z.array(PhotoSchema.extend({ id: z.number() })),
});

export const PageAnnoncesSchema = z.object({
  data: z.array(AnnonceSchema),
  meta: MetaSchema,
});

export const PublicationSchema = z.object({
  id: z.number(),
  statutPublication: StatutPublication,
});
