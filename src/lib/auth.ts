import type { FastifyRequest } from "fastify";
import { interdit, nonAuthentifie } from "./errors.js";
import { peutGererAnnonces, type Role, type Utilisateur , type StatutPro} from "../regles/autorisation.js";
import "@fastify/jwt"

// Contenu du JWT : identifiant  et rôle. 
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: Role, statutPro: StatutPro };
    user: Utilisateur;
  }
}

// L'utilisateur courant, rempli par les hooks 
declare module "fastify" {
  interface FastifyRequest {
    utilisateur: Utilisateur | null;
  }
}

/** Hook authentification obligatoire */
export async function authentifier(req: FastifyRequest) {
  try {
    await req.jwtVerify();
  } catch {
    throw nonAuthentifie();
  }
  //un jeton sans identifiant ne doit jamais passer
  // (sinon un filtre { auteurId: undefined } serait ignoré par Prisma et ne filtrerait plus rien)
  if (!req.user?.id) throw nonAuthentifie();
  req.utilisateur = req.user;
}

/**
 * Hook "authentification facultative"

 */
export async function authentifierSiPresent(req: FastifyRequest) {
  if (!req.headers.authorization) return;
  await authentifier(req);
}

/** Hook "autorisation par rôle" : seuls AGENT et ADMIN gèrent des annonces → sinon 403. */
export async function exigerGestionnaire(req: FastifyRequest) {
  if (!req.utilisateur) throw nonAuthentifie();
  if (!peutGererAnnonces(req.utilisateur)) throw interdit();
}

/** Récupère l'utilisateur connecté dans une route protégée  */
export function utilisateurConnecte(req: FastifyRequest): Utilisateur {
  if (!req.utilisateur) throw nonAuthentifie();
  return req.utilisateur;
}
