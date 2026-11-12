/** E2E : durcissement — limitation de débit sur la connexion, aucune fuite de passwordHash, plafond de pagination. */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { connexion, demarrerServeur, MOT_DE_PASSE } from "../helpers.js";

let app: FastifyInstance;
let base: string;

beforeAll(async () => {
  ({ app, base } = await demarrerServeur());
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const json = { "Content-Type": "application/json" };

function login(email: string, password: string) {
  return fetch(`${base}/auth/login`, { method: "POST", headers: json, body: JSON.stringify({ email, password }) });
}

describe("Limitation de débit sur POST /auth/login", () => {
  it("au-delà de 10 tentatives : 429 TOO_MANY_REQUESTS avec Retry-After, même avec le bon mot de passe", async () => {
    await prisma.limiteDebit.deleteMany();

    // 10 tentatives autorisées (ici, mauvais mot de passe → 401)
    for (let i = 1; i <= 10; i++) {
      expect((await login("agent1@immo.fr", "mauvais")).status).toBe(401);
    }

    // 11e tentative : bloquée avant même de vérifier le mot de passe
    const bloquee = await login("agent1@immo.fr", MOT_DE_PASSE);
    expect(bloquee.status).toBe(429);
    expect(Number(bloquee.headers.get("retry-after"))).toBeGreaterThan(0);
    const corps = await bloquee.json();
    expect(corps.error.code).toBe("TOO_MANY_REQUESTS"); // forme unique des erreurs
  });

  it("les compteurs sont en base, pas en mémoire (aucun état applicatif)", async () => {
    const compteurs = await prisma.limiteDebit.findMany();
    expect(compteurs.length).toBeGreaterThan(0);
    expect(compteurs[0]!.cle).toContain("/auth/login");
  });

  it("seule la connexion est limitée : les autres routes répondent normalement", async () => {
    expect((await fetch(`${base}/annonces`)).status).toBe(200);
  });

  it("après remise à zéro des compteurs, la connexion fonctionne de nouveau", async () => {
    await prisma.limiteDebit.deleteMany();
    expect((await login("agent1@immo.fr", MOT_DE_PASSE)).status).toBe(200);
  });
});

describe("L'API ne renvoie jamais passwordHash", () => {
  /** Ni le nom du champ, ni un hachage bcrypt ($2a$ / $2b$) */
  const FUITE = /passwordHash|\$2[aby]\$/;

  it("sur aucun endpoint REST ni GraphQL", async () => {
    await prisma.limiteDebit.deleteMany();
    const jeton = await connexion(base, "agent1@immo.fr");
    const auth = { Authorization: `Bearer ${jeton}` };
    const publiee = await prisma.annonce.findFirstOrThrow({ where: { statutPublication: "PUBLIEE" } });

    const reponses = await Promise.all([
      fetch(`${base}/auth/register`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ name: "Nouveau", email: "nouveau@test.fr", password: MOT_DE_PASSE }),
      }),
      fetch(`${base}/me`, { headers: auth }),
      fetch(`${base}/annonces?limit=100`),
      fetch(`${base}/annonces/${publiee.id}`),
      fetch(`${base}/me/annonces?limit=100`, { headers: auth }),
      fetch(`${base}/annonces/${publiee.id}/questions`),
      fetch(`${base}/graphql`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ query: "{ annonces(limit: 100) { data { auteur { id name } questions { auteur { id name } } } } }" }),
      }),
    ]);

    for (const r of reponses) {
      expect(r.ok).toBe(true);
      expect(await r.text()).not.toMatch(FUITE);
    }
  });
});

describe("Plafond de pagination, quoi que demande le client", () => {
  it("REST : au-delà de 100, la requête est refusée (400) — le maximum fait partie du contrat OpenAPI", async () => {
    expect((await fetch(`${base}/annonces?limit=101`)).status).toBe(400);
    const page = await (await fetch(`${base}/annonces?limit=100`)).json();
    expect(page.data.length).toBeLessThanOrEqual(100);
  });

  it("GraphQL : limit est ramené à 100 côté serveur", async () => {
    const r = await fetch(`${base}/graphql`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ query: "{ annonces(limit: 999999) { meta { limit } data { id } } }" }),
    });
    const { data } = await r.json();
    expect(data.annonces.meta.limit).toBe(100);
    expect(data.annonces.data.length).toBeLessThanOrEqual(100);
  });
});
