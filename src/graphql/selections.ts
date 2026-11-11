import type { Prisma } from "../generated/prisma/client.js";

/**
 * Colonnes lues pour une annonce GraphQL (liste blanche).
 * L'auteur n'est PAS joint ici : seul son identifiant est lu, et Annonce.auteur
 * le résout via le DataLoader (une requête pour toute la page).
 * Les photos sont lues dans la même requête que l'annonce.
 */
export const selectAnnonceGraphQL = {
  id: true,
  titre: true,
  description: true,
  typeBien: true,
  statutPublication: true,
  statutBien: true,
  prix: true,
  surface: true,
  ville: true,
  dateDisponibilite: true,
  createdAt: true,
  updatedAt: true,
  auteurId: true,
  photos: { select: { id: true, url: true, alt: true }, orderBy: { id: "asc" } },
} satisfies Prisma.AnnonceSelect;

export type AnnonceGraphQL = Prisma.AnnonceGetPayload<{ select: typeof selectAnnonceGraphQL }>;
