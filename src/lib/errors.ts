import type { FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { Prisma } from "../generated/prisma/client.js";

/**
 * Codes d'erreur stables : ils font partie du contrat de l'API.
 * Un client peut s'appuyer dessus, donc on ne les renomme jamais.
 */
export type CodeErreur =
  | "VALIDATION_FAILED"
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EMAIL_ALREADY_USED"
  | "QUESTION_ALREADY_ANSWERED"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_ERROR";

export type DetailErreur = { field: string; message: string };

/** Erreur métier : lancée dans le code, transformée en réponse par le gestionnaire global. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: CodeErreur,
    message: string,
    public readonly details: DetailErreur[] = [],
  ) {
    super(message);
  }
}

// Raccourcis pour les cas fréquents
export const nonAuthentifie = () =>
  new AppError(401, "UNAUTHENTICATED", "Authentification requise : jeton absent, invalide ou expiré");
export const interdit = () =>
  new AppError(403, "FORBIDDEN", "Votre rôle ne permet pas cette opération ( ou votre statut d'agent n'est pas encore validé) ");
export const introuvable = (ressource = "Ressource") =>
  new AppError(404, "NOT_FOUND", `${ressource} introuvable`);

/** La forme unique de toutes les erreurs de l'API */
function corps(code: CodeErreur, message: string, details: DetailErreur[] = []) {
  return { error: { code, message, details } };
}

/**
 * Gestionnaire d'erreurs global : quelle que soit l'origine de l'erreur, le client
 * reçoit toujours { error: { code, message, details } }.
 */
export function enregistrerGestionErreurs(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    // 1. Erreurs métier lancées par notre code
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send(corps(err.code, err.message, err.details));
    }

    // 2. Échec de validation Zod (body, query ou path)
    if (hasZodFastifySchemaValidationErrors(err)) {
      const details = err.validation.map((v) => ({
        field: v.instancePath.replace(/^\//, "").replaceAll("/", ".") || (err.validationContext ?? "requete"),
        message: v.message ?? "valeur invalide",
      }));
      return reply.code(400).send(corps("VALIDATION_FAILED", "La requête est invalide", details));
    }

    // 3. Erreurs Prisma connues
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return reply.code(409).send(corps("CONFLICT", "Cette ressource existe déjà"));
      }
      if (err.code === "P2025") {
        return reply.code(404).send(corps("NOT_FOUND", "Ressource introuvable"));
      }
    }

    // 4. La réponse ne respecte pas son propre schéma : c'est un bug serveur
    if (isResponseSerializationError(err)) {
      req.log.error({ issues: err.cause.issues }, "Réponse non conforme au schéma");
      return reply.code(500).send(corps("INTERNAL_ERROR", "Erreur interne du serveur"));
    }

    // 5. Erreurs client levées par Fastify (JSON mal formé, corps vide…)
    const { statusCode, message } = err as { statusCode?: number; message?: string };
    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send(corps("BAD_REQUEST", message ?? "Requête incorrecte"));
    }

    // 6. Tout le reste : on journalise, et on ne révèle rien au client
    req.log.error(err);
    return reply.code(500).send(corps("INTERNAL_ERROR", "Erreur interne du serveur"));
  });

  // Route inexistante : même forme d'erreur
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send(corps("NOT_FOUND", `Route ${req.method} ${req.url} introuvable`));
  });
}
