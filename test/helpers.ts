/**
 * Outils des tests E2E : démarre le vrai serveur sur un port libre
 * et fabrique des clients du SDK généré depuis openapi.yaml.
 */
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import {
  AnnoncesApi,
  AuthApi,
  Configuration,
  QuestionsApi,
  ResponseError,
  type CreerAnnonceInput,
} from "../sdk/index.js";

export const MOT_DE_PASSE = "motdepasse123";

export async function demarrerServeur(): Promise<{ app: FastifyInstance; base: string }> {
  const app = await buildApp({ logger: false });
  await app.listen({ port: 0, host: "127.0.0.1" }); // port 0 : le système choisit un port libre
  const adresse = app.server.address();
  if (!adresse || typeof adresse === "string") throw new Error("Adresse du serveur introuvable");
  return { app, base: `http://127.0.0.1:${adresse.port}` };
}

/** Les trois clients du SDK, avec ou sans jeton */
export function clients(base: string, jeton?: string) {
  const config = new Configuration({ basePath: base, accessToken: jeton });
  return {
    auth: new AuthApi(config),
    annonces: new AnnoncesApi(config),
    questions: new QuestionsApi(config),
  };
}

/** Se connecte avec un compte du seed et renvoie son JWT */
export async function connexion(base: string, email: string): Promise<string> {
  const { token } = await clients(base).auth.connecter({
    connexionInput: { email, password: MOT_DE_PASSE },
  });
  return token;
}

/**
 * Exécute un appel du SDK censé échouer et renvoie le code HTTP + le corps d'erreur.
 * Le SDK lève une ResponseError pour tout code hors 2xx.
 */
export async function echec(appel: Promise<unknown>) {
  try {
    await appel;
  } catch (e) {
    if (e instanceof ResponseError) {
      const corps = (await e.response.json()) as { error: { code: string; details: { field: string }[] } };
      return { statut: e.response.status, code: corps.error.code, details: corps.error.details };
    }
    throw e;
  }
  throw new Error("L'appel aurait dû échouer, mais il a réussi");
}

export function nouvelleAnnonce(suffixe = ""): CreerAnnonceInput {
  return {
    titre: `Appartement de test ${suffixe}`.trim(),
    description: "Annonce créée par les tests automatisés.",
    typeBien: "VENTE",
    prix: 150000,
    surface: 60,
    ville: "Le Havre",
    dateDisponibilite: new Date("2026-12-01"),
    photos: [{ url: "https://picsum.photos/seed/test/640/480", alt: "Salon" }],
  };
}
