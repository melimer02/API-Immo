import type { IResolvers } from "mercurius";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { meta } from "../lib/pagination.js";
import { filtreVisibilite } from "../regles/autorisation.js";
import { exigerGestionnaire, idNumerique } from "./erreurs.js";
import { selectAnnonceGraphQL } from "./selections.js";

/** Plafond serveur de la pagination : quoi que demande le client, jamais plus de 100 annonces */
export const LIMITE_MAX = 100;

type ArgsPagination = { page: number; limit: number };
type ArgsAnnonces = ArgsPagination & {
  filtre?: { ville?: string | null; type?: "VENTE" | "LOCATION" | null; prixMax?: number | null } | null;
};

/** Page et limite ramenées dans des bornes sûres (page ≥ 1, 1 ≤ limit ≤ 100) */
function bornes({ page, limit }: ArgsPagination) {
  const p = Math.max(1, Math.trunc(page));
  const l = Math.min(LIMITE_MAX, Math.max(1, Math.trunc(limit)));
  return { page: p, limit: l, skip: (p - 1) * l, take: l };
}

/** Une page d'annonces : données + métadonnées, en deux requêtes SQL quelle que soit la taille */
async function pageAnnonces(where: Prisma.AnnonceWhereInput, args: ArgsPagination) {
  const { page, limit, skip, take } = bornes(args);
  const [data, total] = await Promise.all([
    prisma.annonce.findMany({
      where,
      select: selectAnnonceGraphQL,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
    }),
    prisma.annonce.count({ where }),
  ]);
  return { data, meta: meta(page, limit, total) };
}

/**
 * Queries GraphQL.
 * Chaque resolver applique lui-même l'autorisation : en GraphQL, il n'y a pas de
 * middleware par route, un resolver qui l'oublie serait une porte ouverte.
 */
export const Query: IResolvers["Query"] = {
  /** Public : uniquement les annonces publiées, quel que soit l'appelant */
  annonces: async (_parent, args: ArgsAnnonces) => {
    const { ville, type, prixMax } = args.filtre ?? {};
    const where: Prisma.AnnonceWhereInput = {
      statutPublication: "PUBLIEE",
      ...(ville && { ville: { equals: ville.trim(), mode: "insensitive" } }),
      ...(type && { typeBien: type }),
      ...(prixMax != null && { prix: { lte: prixMax } }),
    };
    return pageAnnonces(where, args);
  },

  /** Détail : publiée, ou brouillon visible par son auteur et les admins. Sinon null (pas d'erreur). */
  annonce: async (_parent, args: { id: string }, ctx) => {
    const id = idNumerique(args.id);
    if (id === null) return null;
    return prisma.annonce.findFirst({
      where: { id, ...filtreVisibilite(ctx.user) }, // autorisation dans le where, comme en REST
      select: selectAnnonceGraphQL,
    });
  },

  /** Annonces de l'agent connecté, brouillons compris */
  mesAnnonces: async (_parent, args: ArgsPagination, ctx) => {
    const user = exigerGestionnaire(ctx); // authentification + rôle
    return pageAnnonces({ auteurId: user.id }, args);
  },
};
