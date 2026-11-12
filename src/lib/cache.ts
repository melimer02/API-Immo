import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Cache HTTP : 
 * Cache-Control : qui peut garder la réponse, et combien de temps ;
 * ETag + 304   : si le client a déjà la bonne version, on ne renvoie pas le corps.
 */

/** Durée de cache des lectures publiques */
export const DUREE_CACHE_PUBLIC = 300;

/** Lectures dont la réponse est identique pour tous les appelants  */
const ROUTES_PUBLIQUES = new Set(["/annonces"]);

/**
 * Lectures publiques dont la réponse peut dépendre de l'appelant
 * (un agent connecté voit son brouillon) : publiques si anonyme, privées sinon.
 */
const ROUTES_SELON_APPELANT = new Set(["/annonces/:id", "/annonces/:id/questions", "/questions/:id"]);

/** Routes laissées telles quelles (documentation, interface GraphiQL) */
const PREFIXES_IGNORES = ["/docs", "/graphiql"];

/** ETag : empreinte SHA-1 du corps de la réponse */
export function calculerEtag(corps: string | Buffer): string {
  return `"${createHash("sha1").update(corps).digest("base64url")}"`;
}

/** Ajoute une valeur à l'en-tête Vary sans écraser celles déjà présentes (ex. Origin, posé par CORS) */
function ajouterVary(reply: FastifyReply, valeur: string) {
  const actuel = reply.getHeader("vary");
  const valeurs = new Set(
    String(actuel ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );
  valeurs.add(valeur);
  reply.header("vary", [...valeurs].join(", "));
}

/** Politique Cache-Control d'une réponse */
export function politiqueCache(req: FastifyRequest, statut: number): string {
  const route = req.routeOptions.url ?? "";
  const lecture = req.method === "GET" || req.method === "HEAD";

  // Écritures, erreurs, authentification, GraphQL (POST) : jamais en cache
  if (!lecture || statut >= 400) return "no-store";

  if (ROUTES_PUBLIQUES.has(route)) return `public, max-age=${DUREE_CACHE_PUBLIC}`;

  if (ROUTES_SELON_APPELANT.has(route)) {
    return req.headers.authorization
      ? "private, no-cache" // propre à l'utilisateur : navigateur seulement, revalidé à chaque fois
      : `public, max-age=${DUREE_CACHE_PUBLIC}`;
  }

  // Tout le reste (/me, /me/annonces…) : données personnelles, jamais en cache
  return "no-store";
}

/** Branche le cache HTTP sur toute l'application (à appeler AVANT d'enregistrer les routes) */
export function enregistrerCache(app: FastifyInstance) {
  app.addHook("onSend", async (req, reply, payload) => {
    if (PREFIXES_IGNORES.some((p) => req.url.startsWith(p))) return payload;

    const cacheControl = politiqueCache(req, reply.statusCode);
    reply.header("cache-control", cacheControl);

    const route = req.routeOptions.url ?? "";
    if (ROUTES_SELON_APPELANT.has(route)) ajouterVary(reply, "Authorization");

    // ETag + 304 : uniquement sur les lectures réussies et cachables
    const cachable = reply.statusCode === 200 && cacheControl !== "no-store";
    if (!cachable || (typeof payload !== "string" && !Buffer.isBuffer(payload))) return payload;

    const etag = calculerEtag(payload);
    reply.header("etag", etag);

    if (req.headers["if-none-match"] === etag) {
      // Le client a déjà cette version : on ne renvoie que quelques octets d'en-têtes
      reply.code(304);
      reply.removeHeader("content-type");
      return "";
    }
    return payload;
  });
}
