import type { RateLimitPluginOptions, FastifyRateLimitStore } from "@fastify/rate-limit";
import { AppError } from "./errors.js";
import { prisma } from "./prisma.js";

/**
 * Stockage des compteurs de @fastify/rate-limit dans PostgreSQL.
 *
 * Par défaut, le plugin garde ses compteurs EN MÉMOIRE : c'est un état applicatif,
 * interdit par nos règles d'architecture. Il serait perdu à chaque redémarrage, et
 * chaque instance du serveur aurait sa propre limite (10 tentatives × N serveurs).
 * Ici, les compteurs sont en base : partagés, durables, cohérents.
 *
 * Une seule requête SQL atomique (INSERT … ON CONFLICT) incrémente le compteur, ou le remet
 * à 1 si la fenêtre de temps est écoulée : deux requêtes simultanées ne peuvent pas se perdre.
 */
export class StockagePostgres implements FastifyRateLimitStore {
  constructor(
    _options?: unknown,
    private readonly prefixe = "",
  ) {}

  incr(
    cle: string,
    callback: (erreur: Error | null, resultat?: { current: number; ttl: number }) => void,
    fenetreMs: number,
  ) {
    const id = this.prefixe + cle;
    prisma
      .$queryRaw<{ compteur: number; ttl: number }[]>`
        INSERT INTO "limite_debit" ("cle", "compteur", "expireA")
        VALUES (${id}, 1, now() + ${fenetreMs}::double precision * interval '1 millisecond')
        ON CONFLICT ("cle") DO UPDATE SET
          "compteur" = CASE WHEN "limite_debit"."expireA" <= now() THEN 1
                            ELSE "limite_debit"."compteur" + 1 END,
          "expireA"  = CASE WHEN "limite_debit"."expireA" <= now() THEN EXCLUDED."expireA"
                            ELSE "limite_debit"."expireA" END
        RETURNING "compteur",
                  CEIL(EXTRACT(EPOCH FROM ("expireA" - now())) * 1000)::int AS "ttl"`
      .then(([ligne]) => callback(null, { current: ligne!.compteur, ttl: ligne!.ttl }))
      .catch((erreur: Error) => callback(erreur));
  }

  /** Un compteur distinct par route limitée (ex. "POST:/auth/login:127.0.0.1") */
  child(options: Parameters<FastifyRateLimitStore["child"]>[0]): FastifyRateLimitStore {
    // À l'exécution, le plugin transmet la route dans "routeInfo" (les types du plugin ne le déclarent pas)
    const route = (options as unknown as { routeInfo?: { method?: string | string[]; url?: string } }).routeInfo ?? {};
    return new StockagePostgres(undefined, `${String(route.method ?? "")}:${route.url ?? ""}:`);
  }
}

/**
 * Options du plugin @fastify/rate-limit :
 * - global: false → aucune route n'est limitée par défaut ; la limite est activée route par route
 *   (POST /auth/login, voir src/routes/auth.ts) ;
 * - compteurs stockés en base (StockagePostgres) ;
 * - erreur 429 dans la forme unique de l'API ; l'en-tête Retry-After est ajouté par le plugin.
 */
export const optionsLimiteDebit: RateLimitPluginOptions = {
  global: false,
  store: StockagePostgres,
  errorResponseBuilder: (_req, contexte) =>
    new AppError(429, "TOO_MANY_REQUESTS", `Trop de tentatives, réessayez dans ${contexte.after}`),
};
