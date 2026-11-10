import { z } from "zod";
import { AuteurPublic, MetaSchema, PaginationQuery } from "./commun.js";

const TypeBien = z.enum(["VENTE", "LOCATION"]).meta({ id: "TypeBien" });
const StatutBien = z.enum(["DISPONIBLE", "LOUE", "VENDU"]).meta({ id: "StatutBien" });
const StatutPublication = z
  .enum(["BROUILLON", "PUBLIEE"])
  .meta({ id: "StatutPublication", description: "Modifié uniquement via /annonces/{id}/publication" });

/** GET /annonces : pagination + filtres (tous validés) */
export const ListeAnnoncesQuery = PaginationQuery.extend({
  ville: z.string().trim().min(1).max(100).optional().describe("Ville exacte (insensible à la casse)"),
  type: TypeBien.optional().describe("VENTE ou LOCATION"),
  prixMax: z.coerce.number().positive().optional().describe("Prix maximum (inclus), en euros"),
});

export const PhotoSchema = z
  .object({
    url: z.url().describe("URL de l'image"),
    alt: z.string().trim().min(1).max(200).describe("Texte alternatif (accessibilité)"),
  })
  .meta({ id: "Photo" });

/** POST /annonces — statutPublication volontairement absent : une annonce naît brouillon */
export const CreerAnnonceBody = z
  .object({
    titre: z.string().trim().min(5).max(150),
    description: z.string().trim().min(10).max(5000),
    typeBien: TypeBien,
    prix: z.number().positive().describe("Prix de vente ou loyer mensuel, en euros"),
    surface: z.number().int().positive().optional().describe("Surface en m²"),
    ville: z.string().trim().min(1).max(100),
    // Entrée : une date "AAAA-MM-JJ" (documentée comme telle dans la spec), convertie en Date pour Prisma
    dateDisponibilite: z.iso
      .date()
      .transform((texte) => new Date(texte))
      .describe("Date de disponibilité au format AAAA-MM-JJ (ex. 2026-12-01)"),
    photos: z.array(PhotoSchema).max(20).default([]),
  })
  .meta({
    id: "CreerAnnonce",
    description:
      "L'annonce est créée en BROUILLON, avec l'agent connecté comme auteur. auteurId et statutPublication éventuellement envoyés sont ignorés.",
    example: {
      titre: "Appartement 3 pièces – Perret, Le Havre",
      description: "Appartement lumineux de 68 m² proche de la plage.",
      typeBien: "VENTE",
      prix: 163000,
      surface: 68,
      ville: "Le Havre",
      dateDisponibilite: "2026-12-01",
      photos: [{ url: "https://picsum.photos/seed/demo/640/480", alt: "Salon" }],
    },
  });

/** PATCH /annonces/:id — tous les champs facultatifs, mais au moins un */
export const ModifierAnnonceBody = CreerAnnonceBody.omit({ photos: true })
  .extend({ statutBien: StatutBien })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins un champ à modifier est requis",
  })
  .meta({
    id: "ModifierAnnonce",
    description: "Modification partielle : seuls les champs envoyés changent (au moins un).",
    example: { prix: 155000 },
  });

/** Ce que l'API renvoie pour une annonce — liste blanche explicite */
export const AnnonceSchema = z
  .object({
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
  })
  .meta({ id: "Annonce" });

export const PageAnnoncesSchema = z
  .object({
    data: z.array(AnnonceSchema),
    meta: MetaSchema,
  })
  .meta({ id: "PageAnnonces" });

export const PublicationSchema = z
  .object({
    id: z.number(),
    statutPublication: StatutPublication,
  })
  .meta({ id: "Publication" });
