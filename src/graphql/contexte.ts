import "mercurius"; // charge les types de Mercurius (nécessaire pour compléter MercuriusContext ci-dessous)
import type { FastifyRequest } from "fastify";
import type { Utilisateur } from "../regles/autorisation.js";
import { creerChargeurs, type Chargeurs } from "./chargeurs.js";
import { erreurGraphQL } from "./erreurs.js";

export type Contexte = {
  /** Utilisateur authentifié par son JWT, ou null s'il est anonyme */
  user: Utilisateur | null;
  /** DataLoaders propres à CETTE requête */
  chargeurs: Chargeurs;
};

// Les resolvers Mercurius reçoivent ce contexte typé
declare module "mercurius" {
  interface MercuriusContext extends Contexte {}
}

/**
 * Authentification, exécutée avant chaque requête GraphQL (hook onRequest) :
 * - pas d'en-tête Authorization → anonyme ;
 * - en-tête présent mais jeton invalide ou expiré → erreur UNAUTHENTICATED (jamais ignoré).
 */
export async function authentifierGraphQL(req: FastifyRequest) {
  if (!req.headers.authorization) return;
  try {
    await req.jwtVerify();
  } catch {
    throw erreurGraphQL("UNAUTHENTICATED", "Jeton invalide ou expiré", 401);
  }
  if (!req.user?.id) throw erreurGraphQL("UNAUTHENTICATED", "Jeton invalide ou expiré", 401);
  req.utilisateur = req.user;
}

/**
 * Construit le contexte UNE FOIS par requête HTTP : l'utilisateur et de NOUVEAUX chargeurs.
 * L'AUTORISATION, elle, se fait dans chaque resolver : en GraphQL, il n'existe pas
 * de middleware par route, tout passe par le même endpoint.
 */
export function construireContexte(req: FastifyRequest): Contexte {
  return { user: req.utilisateur ?? null, chargeurs: creerChargeurs() };
}
