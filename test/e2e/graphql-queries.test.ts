/** E2E : queries GraphQL (liste, détail, mes annonces), autorisation et problème N+1. */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compteurSql, prisma } from "../../src/lib/prisma.js";
import { connexion, demarrerServeur } from "../helpers.js";

let app: FastifyInstance;
let base: string;
let jetons: Record<"agent1" | "agent2" | "agent3" | "admin" | "user1", string>;
let brouillonAgent1: number;

type Reponse = {
  data?: Record<string, any> | null;
  errors?: { message: string; extensions?: { code?: string } }[];
};

/** Envoie une requête GraphQL (avec variables et jeton facultatifs) */
async function graphql(query: string, variables: Record<string, unknown> = {}, jeton?: string): Promise<Reponse> {
  const r = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(jeton && { Authorization: `Bearer ${jeton}` }) },
    body: JSON.stringify({ query, variables }),
  });
  return (await r.json()) as Reponse;
}

const LISTE = /* GraphQL */ `
  query ($page: Int, $limit: Int, $filtre: FiltreAnnonces) {
    annonces(page: $page, limit: $limit, filtre: $filtre) {
      data { id titre ville typeBien prix statutPublication auteur { id name } photos { url alt } }
      meta { page limit total pages }
    }
  }
`;

const DETAIL = /* GraphQL */ `
  query ($id: ID!) {
    annonce(id: $id) { id titre statutPublication auteur { name } }
  }
`;

beforeAll(async () => {
  ({ app, base } = await demarrerServeur());
  jetons = {
    agent1: await connexion(base, "agent1@immo.fr"),
    agent2: await connexion(base, "agent2@immo.fr"),
    agent3: await connexion(base, "agent3@immo.fr"),
    admin: await connexion(base, "admin@immo.fr"),
    user1: await connexion(base, "user1@immo.fr"),
  };
  brouillonAgent1 = (
    await prisma.annonce.findFirstOrThrow({
      where: { auteur: { email: "agent1@immo.fr" }, statutPublication: "BROUILLON" },
      select: { id: true },
    })
  ).id;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("Query annonces (liste publique)", () => {
  it("renvoie une page d'annonces publiées avec ses métadonnées", async () => {
    const { data, errors } = await graphql(LISTE, { page: 1, limit: 5 });
    expect(errors).toBeUndefined();
    const page = data!.annonces;
    expect(page.data.length).toBeLessThanOrEqual(5);
    expect(page.meta).toMatchObject({ page: 1, limit: 5 });
    expect(page.meta.pages).toBe(Math.ceil(page.meta.total / 5));
    expect(page.data.every((a: any) => a.statutPublication === "PUBLIEE")).toBe(true);
  });

  it("résout l'auteur et les photos de chaque annonce", async () => {
    const { data } = await graphql(LISTE, { limit: 3 });
    for (const a of data!.annonces.data) {
      expect(a.auteur.name).toBeTruthy();
      expect(Array.isArray(a.photos)).toBe(true);
    }
  });

  it("applique les filtres ville, type et prixMax", async () => {
    const { data } = await graphql(LISTE, {
      limit: 100,
      filtre: { ville: "le havre", type: "LOCATION", prixMax: 5000 },
    });
    for (const a of data!.annonces.data) {
      expect(a.ville).toBe("Le Havre");
      expect(a.typeBien).toBe("LOCATION");
      expect(a.prix).toBeLessThanOrEqual(5000);
    }
  });

  it("plafonne la pagination côté serveur : limit 999999 → 100", async () => {
    const { data, errors } = await graphql(LISTE, { limit: 999999 });
    expect(errors).toBeUndefined();
    expect(data!.annonces.meta.limit).toBe(100);
    expect(data!.annonces.data.length).toBeLessThanOrEqual(100);
  });

  it("ne renvoie jamais de brouillon, même à son auteur", async () => {
    const { data } = await graphql(LISTE, { limit: 100 }, jetons.agent1);
    expect(data!.annonces.data.some((a: any) => Number(a.id) === brouillonAgent1)).toBe(false);
  });
});

describe("Query annonce (détail)", () => {
  it("renvoie une annonce publiée à un anonyme", async () => {
    const publiee = await prisma.annonce.findFirstOrThrow({ where: { statutPublication: "PUBLIEE" } });
    const { data } = await graphql(DETAIL, { id: String(publiee.id) });
    expect(data!.annonce).toMatchObject({ id: String(publiee.id), statutPublication: "PUBLIEE" });
  });

  it("brouillon : null pour un anonyme et pour un autre agent (son existence n'est pas révélée)", async () => {
    expect((await graphql(DETAIL, { id: String(brouillonAgent1) })).data!.annonce).toBeNull();
    expect((await graphql(DETAIL, { id: String(brouillonAgent1) }, jetons.agent2)).data!.annonce).toBeNull();
  });

  it("brouillon : visible par son auteur et par un admin", async () => {
    const auteur = await graphql(DETAIL, { id: String(brouillonAgent1) }, jetons.agent1);
    expect(auteur.data!.annonce.statutPublication).toBe("BROUILLON");
    const admin = await graphql(DETAIL, { id: String(brouillonAgent1) }, jetons.admin);
    expect(admin.data!.annonce.id).toBe(String(brouillonAgent1));
  });

  it("identifiant inconnu ou invalide : null, pas une erreur", async () => {
    expect((await graphql(DETAIL, { id: "999999" })).data!.annonce).toBeNull();
    expect((await graphql(DETAIL, { id: "abc" })).data!.annonce).toBeNull();
  });
});

describe("Query mesAnnonces (autorisation dans le resolver)", () => {
  const MES = "{ mesAnnonces(limit: 100) { data { id statutPublication } meta { total } } }";

  it("un agent validé voit ses annonces, brouillons compris", async () => {
    const { data, errors } = await graphql(MES, {}, jetons.agent1);
    expect(errors).toBeUndefined();
    const statuts = data!.mesAnnonces.data.map((a: any) => a.statutPublication);
    expect(statuts).toContain("BROUILLON");
    expect(statuts).toContain("PUBLIEE");
  });

  it("anonyme → UNAUTHENTICATED", async () => {
    const { errors } = await graphql(MES);
    expect(errors?.[0]?.extensions?.code).toBe("UNAUTHENTICATED");
  });

  it("USER et agent non validé → FORBIDDEN", async () => {
    expect((await graphql(MES, {}, jetons.user1)).errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
    expect((await graphql(MES, {}, jetons.agent3)).errors?.[0]?.extensions?.code).toBe("FORBIDDEN");
  });
});

describe("Problème N+1 (DataLoader)", () => {
  const AVEC_AUTEURS = "query ($limit: Int) { annonces(limit: $limit) { data { titre auteur { name } } } }";

  async function nombreRequetesSql(limit: number) {
    compteurSql.reinitialiser();
    const { data, errors } = await graphql(AVEC_AUTEURS, { limit });
    expect(errors).toBeUndefined();
    return { requetes: compteurSql.lire(), annonces: data!.annonces.data.length as number };
  }

  it("le nombre de requêtes SQL ne dépend pas du nombre d'annonces", async () => {
    const petit = await nombreRequetesSql(2);
    const grand = await nombreRequetesSql(20);

    expect(grand.annonces).toBeGreaterThan(petit.annonces); // on compare bien des tailles différentes
    // Sans DataLoader, il y aurait une requête par auteur : le total grandirait avec la page.
    // Avec DataLoader, 4 requêtes dans les deux cas : annonces, leurs photos (Prisma les charge
    // en une requête pour toute la page), count, et UNE requête pour tous les auteurs.
    expect(grand.requetes).toBe(petit.requetes);
    expect(grand.requetes).toBe(4);
  });
});
