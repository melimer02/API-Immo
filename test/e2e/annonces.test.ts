/** E2E : consultation, CRUD, publication, rôles et absence d'IDOR — via le SDK généré. */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { clients, connexion, demarrerServeur, echec, nouvelleAnnonce } from "../helpers.js";

let app: FastifyInstance;
let base: string;
let jetons: Record<"agent1" | "agent2" | "agent3" | "admin" | "user1", string>;
let brouillonAgent1: number; // un brouillon du seed appartenant à agent1

beforeAll(async () => {
  ({ app, base } = await demarrerServeur());
  jetons = {
    agent1: await connexion(base, "agent1@immo.fr"),
    agent2: await connexion(base, "agent2@immo.fr"),
    agent3: await connexion(base, "agent3@immo.fr"),
    admin: await connexion(base, "admin@immo.fr"),
    user1: await connexion(base, "user1@immo.fr"),
  };
  const brouillon = await prisma.annonce.findFirstOrThrow({
    where: { auteur: { email: "agent1@immo.fr" }, statutPublication: "BROUILLON" },
    select: { id: true },
  });
  brouillonAgent1 = brouillon.id;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("GET /annonces (public)", () => {
  it("200, paginé, avec total et pages", async () => {
    const page = await clients(base).annonces.listerAnnonces({ page: 1, limit: 5 });
    expect(page.data.length).toBeLessThanOrEqual(5);
    expect(page.meta).toMatchObject({ page: 1, limit: 5 });
    expect(page.meta.pages).toBe(Math.ceil(page.meta.total / 5));
  });

  it("ne renvoie jamais de brouillon", async () => {
    const page = await clients(base).annonces.listerAnnonces({ limit: 100 });
    expect(page.data.every((a) => a.statutPublication === "PUBLIEE")).toBe(true);
  });

  it("applique les filtres ville, type et prixMax", async () => {
    const page = await clients(base).annonces.listerAnnonces({ ville: "le havre", type: "LOCATION", prixMax: 5000 });
    for (const a of page.data) {
      expect(a.ville).toBe("Le Havre");
      expect(a.typeBien).toBe("LOCATION");
      expect(a.prix).toBeLessThanOrEqual(5000);
    }
  });

  it("400 si limit dépasse le plafond", async () => {
    const r = await echec(clients(base).annonces.listerAnnonces({ limit: 999999 }));
    expect(r).toMatchObject({ statut: 400, code: "VALIDATION_FAILED" });
  });
});

describe("Brouillons : visibles uniquement par leur auteur et les admins", () => {
  it("anonyme → 404", async () => {
    const r = await echec(clients(base).annonces.lireAnnonce({ id: brouillonAgent1 }));
    expect(r.statut).toBe(404);
  });

  it("un autre agent → 404 (son existence n'est pas révélée)", async () => {
    const r = await echec(clients(base, jetons.agent2).annonces.lireAnnonce({ id: brouillonAgent1 }));
    expect(r.statut).toBe(404);
  });

  it("son auteur → 200", async () => {
    const a = await clients(base, jetons.agent1).annonces.lireAnnonce({ id: brouillonAgent1 });
    expect(a.statutPublication).toBe("BROUILLON");
  });

  it("un admin → 200", async () => {
    const a = await clients(base, jetons.admin).annonces.lireAnnonce({ id: brouillonAgent1 });
    expect(a.id).toBe(brouillonAgent1);
  });
});

describe("Rôles", () => {
  it("USER → 403 à la création", async () => {
    const r = await echec(clients(base, jetons.user1).annonces.creerAnnonce({ creerAnnonceInput: nouvelleAnnonce() }));
    expect(r).toMatchObject({ statut: 403, code: "FORBIDDEN" });
  });

  it("agent EN_ATTENTE → 403 à la création", async () => {
    const r = await echec(clients(base, jetons.agent3).annonces.creerAnnonce({ creerAnnonceInput: nouvelleAnnonce() }));
    expect(r).toMatchObject({ statut: 403, code: "FORBIDDEN" });
  });

  it("sans jeton → 401", async () => {
    const r = await echec(clients(base).annonces.creerAnnonce({ creerAnnonceInput: nouvelleAnnonce() }));
    expect(r).toMatchObject({ statut: 401, code: "UNAUTHENTICATED" });
  });
});

describe("CRUD d'un agent sur ses annonces", () => {
  it("crée (201 + Location, brouillon), modifie (200), publie, dépublie puis supprime (204)", async () => {
    const api = clients(base, jetons.agent1).annonces;

    // Création : 201 + en-tête Location, toujours en brouillon
    const creation = await api.creerAnnonceRaw({ creerAnnonceInput: nouvelleAnnonce("CRUD") });
    expect(creation.raw.status).toBe(201);
    const annonce = await creation.value();
    expect(creation.raw.headers.get("location")).toBe(`/annonces/${annonce.id}`);
    expect(annonce.statutPublication).toBe("BROUILLON");

    // Modification partielle : seul le prix change
    const modifiee = await api.modifierAnnonce({ id: annonce.id, modifierAnnonceInput: { prix: 99000 } });
    expect(modifiee.prix).toBe(99000);
    expect(modifiee.titre).toBe(annonce.titre);

    // Publication (idempotente) puis dépublication
    expect((await api.publierAnnonce({ id: annonce.id })).statutPublication).toBe("PUBLIEE");
    expect((await api.publierAnnonce({ id: annonce.id })).statutPublication).toBe("PUBLIEE");
    expect((await api.depublierAnnonce({ id: annonce.id })).statutPublication).toBe("BROUILLON");

    // Suppression : 204, puis l'annonce n'existe plus
    await api.supprimerAnnonce({ id: annonce.id });
    expect(await prisma.annonce.findUnique({ where: { id: annonce.id } })).toBeNull();
  });

  it("400 si le corps est invalide", async () => {
    const r = await echec(
      clients(base, jetons.agent1).annonces.creerAnnonce({
        creerAnnonceInput: { ...nouvelleAnnonce(), prix: -5 },
      }),
    );
    expect(r.statut).toBe(400);
    expect(r.details.map((d) => d.field)).toContain("prix");
  });

  it("404 sur une annonce inexistante", async () => {
    const r = await echec(clients(base, jetons.agent1).annonces.supprimerAnnonce({ id: 999999 }));
    expect(r).toMatchObject({ statut: 404, code: "NOT_FOUND" });
  });
});

describe("IDOR : un agent ne touche pas aux annonces d'un autre agent", () => {
  it("agent2 ne peut PAS supprimer l'annonce d'agent1 : 404 ET l'annonce existe toujours en base", async () => {
    const r = await echec(clients(base, jetons.agent2).annonces.supprimerAnnonce({ id: brouillonAgent1 }));

    // Assertion 1 : le code de statut
    expect(r.statut).toBe(404);
    // Assertion 2 : l'état de la base — un 404 renvoyé APRÈS une suppression serait toujours une faille
    const enBase = await prisma.annonce.findUnique({ where: { id: brouillonAgent1 } });
    expect(enBase).not.toBeNull();
  });

  it("agent2 ne peut PAS modifier l'annonce d'agent1 : 404 ET le prix est inchangé", async () => {
    const avant = await prisma.annonce.findUniqueOrThrow({ where: { id: brouillonAgent1 } });
    const r = await echec(
      clients(base, jetons.agent2).annonces.modifierAnnonce({
        id: brouillonAgent1,
        modifierAnnonceInput: { prix: 1 },
      }),
    );
    expect(r.statut).toBe(404);
    const apres = await prisma.annonce.findUniqueOrThrow({ where: { id: brouillonAgent1 } });
    expect(apres.prix).toBe(avant.prix);
  });

  it("agent2 ne peut PAS publier le brouillon d'agent1 : 404 ET il reste brouillon", async () => {
    const r = await echec(clients(base, jetons.agent2).annonces.publierAnnonce({ id: brouillonAgent1 }));
    expect(r.statut).toBe(404);
    const enBase = await prisma.annonce.findUniqueOrThrow({ where: { id: brouillonAgent1 } });
    expect(enBase.statutPublication).toBe("BROUILLON");
  });
});

it("bloque les requêtes provenant d'une origine non autorisée (CORS)", async () => {
    // Un site pirate tente de récupérer la liste des annonces
    const response = await app.inject({
      method: "GET",
      url: "/annonces",
      headers: {
        Origin: "http://site-pirate.com" 
      }
    });

    //  Fastify et le plugin CORS voient que le site n'est pas dans la liste.
    // le serveur refuse d'ajouter l'en-tête "access-control-allow-origin" 
    expect(response.headers).not.toHaveProperty("access-control-allow-origin");
  });
