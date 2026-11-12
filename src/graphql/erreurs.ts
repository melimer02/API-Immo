import mercurius from "mercurius";
import type { ZodError } from "zod";
import { peutGererAnnonces, type Utilisateur } from "../regles/autorisation.js";
import type { Contexte } from "./contexte.js";

/**
 * Deux sortes d'erreurs en GraphQL :
 * 1. erreurs de VALIDATION → dans le type de retour (ResultatAnnonce.erreurs), voir erreursChamps ;
 * 2. erreurs d'ACCÈS (non connecté, rôle, introuvable) → vraies erreurs GraphQL,
 *    avec un code stable dans extensions.code (le même vocabulaire qu'en REST).
 */
export type CodeErreurGraphQL = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";

export function erreurGraphQL(code: CodeErreurGraphQL, message: string, statutHttp?: number) {
  return new mercurius.ErrorWithProps(message, { code }, statutHttp);
}

export const introuvable = (ressource = "Ressource") => erreurGraphQL("NOT_FOUND", `${ressource} introuvable`);

/** Authentification : l'appelant doit être connecté */
export function exigerConnexion(ctx: Contexte): Utilisateur {
  if (!ctx.user) throw erreurGraphQL("UNAUTHENTICATED", "Authentification requise");
  return ctx.user;
}

/** Autorisation par rôle : ADMIN ou AGENT validé (même règle qu'en REST) */
export function exigerGestionnaire(ctx: Contexte): Utilisateur {
  const user = exigerConnexion(ctx);
  if (!peutGererAnnonces(user)) {
    throw erreurGraphQL("FORBIDDEN", "Votre rôle (ou votre statut d'agent, s'il n'est pas validé) ne permet pas cette opération");
  }
  return user;
}

/** Erreur Zod → liste d'ErreurChamp, renvoyée dans le résultat de la mutation */
export function erreursChamps(erreur: ZodError) {
  return erreur.issues.map((i) => ({
    champ: i.path.join(".") || "input",
    message: i.message,
  }));
}

/** Identifiant GraphQL (ID = texte) → entier positif, ou null s'il est invalide */
export function idNumerique(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}
