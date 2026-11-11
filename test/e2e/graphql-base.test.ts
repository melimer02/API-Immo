/** E2E : socle GraphQL (endpoint, authentification par le contexte, garde-fous du langage). */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { connexion, demarrerServeur } from "../helpers.js";

let app: FastifyInstance;
let base: string;

beforeAll(async () => {
  ({ app, base } = await demarrerServeur());
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

/** Envoie une requête GraphQL et renvoie le statut HTTP et le corps */
async function graphql(query: string, jeton?: string) {
  const r = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(jeton && { Authorization: `Bearer ${jeton}` }) },
    body: JSON.stringify({ query }),
  });
  return { statut: r.status, corps: (await r.json()) as { data?: unknown; errors?: { message: string; extensions?: { code?: string } }[] } };
}

describe("Endpoint /graphql", () => {
  it("répond sur le même serveur que l'API REST", async () => {
    const { statut, corps } = await graphql("{ __typename }");
    expect(statut).toBe(200);
    expect(corps.data).toEqual({ __typename: "Query" });
  });

  it("accepte un jeton valide", async () => {
    const jeton = await connexion(base, "agent1@immo.fr");
    const { statut } = await graphql("{ __typename }", jeton);
    expect(statut).toBe(200);
  });

  it("refuse un jeton invalide (401 UNAUTHENTICATED), il n'est pas ignoré silencieusement", async () => {
    const { statut, corps } = await graphql("{ __typename }", "jeton-bidon");
    expect(statut).toBe(401);
    expect(corps.errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });
});

describe("Garde-fous du schéma", () => {
  it("refuse une requête trop profonde", async () => {
    const { statut, corps } = await graphql(
      "{ annonces { data { questions { reponse { auteur { name } } } } } }",
    );
    expect(statut).toBe(400);
    expect(corps.errors?.[0]?.message).toMatch(/depth/);
  });

  it("refuse un champ absent du schéma (passwordHash n'existe pas pour un client GraphQL)", async () => {
    const { statut, corps } = await graphql("{ annonces { data { auteur { passwordHash } } } }");
    expect(statut).toBe(400);
    expect(corps.errors?.[0]?.message).toMatch(/passwordHash/);
  });
});
