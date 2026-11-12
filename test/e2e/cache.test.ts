/** E2E : cache HTTP — Cache-Control selon les routes, ETag et 304 sur If-None-Match. */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { connexion, demarrerServeur, MOT_DE_PASSE } from "../helpers.js";

let app: FastifyInstance;
let base: string;
let jetonAgent1: string;
let publiee: number;

beforeAll(async () => {
  ({ app, base } = await demarrerServeur());
  jetonAgent1 = await connexion(base, "agent1@immo.fr");
  publiee = (await prisma.annonce.findFirstOrThrow({ where: { statutPublication: "PUBLIEE" }, select: { id: true } })).id;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const avecJeton = (jeton: string) => ({ Authorization: `Bearer ${jeton}` });

describe("Cache-Control adapté à chaque endpoint", () => {
  it("GET /annonces (identique pour tous) → public", async () => {
    const r = await fetch(`${base}/annonces`);
    expect(r.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("détail d'une annonce : public si anonyme, private avec un jeton (un agent peut y voir son brouillon)", async () => {
    const anonyme = await fetch(`${base}/annonces/${publiee}`);
    expect(anonyme.headers.get("cache-control")).toBe("public, max-age=300");

    const connecte = await fetch(`${base}/annonces/${publiee}`, { headers: avecJeton(jetonAgent1) });
    expect(connecte.headers.get("cache-control")).toBe("private, no-cache");
    // La réponse dépend du jeton : un cache partagé doit en tenir compte
    expect(connecte.headers.get("vary")).toMatch(/Authorization/);
  });

  it("données personnelles (/me, /me/annonces) → no-store", async () => {
    for (const chemin of ["/me", "/me/annonces"]) {
      const r = await fetch(`${base}${chemin}`, { headers: avecJeton(jetonAgent1) });
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("connexion, écritures, erreurs et GraphQL → no-store", async () => {
    const login = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "agent1@immo.fr", password: MOT_DE_PASSE }),
    });
    expect(login.headers.get("cache-control")).toBe("no-store");

    const erreur = await fetch(`${base}/annonces/999999`);
    expect(erreur.status).toBe(404);
    expect(erreur.headers.get("cache-control")).toBe("no-store");

    const graphql = await fetch(`${base}/graphql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
    });
    expect(graphql.headers.get("cache-control")).toBe("no-store");
  });
});

describe("ETag et 304 sur GET /annonces", () => {
  it("renvoie un ETag, puis 304 sans corps si le client a déjà cette version", async () => {
    const premiere = await fetch(`${base}/annonces?limit=20`);
    const corps = await premiere.text();
    const etag = premiere.headers.get("etag");
    expect(premiere.status).toBe(200);
    expect(etag).toMatch(/^".+"$/);

    const seconde = await fetch(`${base}/annonces?limit=20`, { headers: { "If-None-Match": etag! } });
    expect(seconde.status).toBe(304);
    expect(await seconde.text()).toBe(""); // aucune donnée retransmise
    expect(seconde.headers.get("etag")).toBe(etag);

    // Volume transféré : plusieurs kilo-octets la première fois, 0 octet de corps ensuite
    expect(corps.length).toBeGreaterThan(1000);
  });

  it("ETag différent → 200 avec le corps complet", async () => {
    const r = await fetch(`${base}/annonces?limit=20`, { headers: { "If-None-Match": '"perime"' } });
    expect(r.status).toBe(200);
    expect((await r.json()).data.length).toBeGreaterThan(0);
  });

  it("l'ETag change quand les données changent", async () => {
    const avant = (await fetch(`${base}/annonces?limit=100`)).headers.get("etag");

    const annonce = await prisma.annonce.findFirstOrThrow({ where: { statutPublication: "PUBLIEE" } });
    await prisma.annonce.update({ where: { id: annonce.id }, data: { prix: annonce.prix + 1 } });

    const apres = (await fetch(`${base}/annonces?limit=100`)).headers.get("etag");
    expect(apres).not.toBe(avant);

    // Le client qui avait l'ancienne version reçoit les nouvelles données (200, pas 304)
    const r = await fetch(`${base}/annonces?limit=100`, { headers: { "If-None-Match": avant! } });
    expect(r.status).toBe(200);
  });

  it("pas d'ETag sur une donnée personnelle (no-store)", async () => {
    const r = await fetch(`${base}/me`, { headers: avecJeton(jetonAgent1) });
    expect(r.headers.get("etag")).toBeNull();
  });
});
