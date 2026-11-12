/**
 * E2E : mutations GraphQL — rôles, validation dans le résultat, et absence d'IDOR.

 */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { connexion, demarrerServeur } from "../helpers.js";

let app: FastifyInstance;
let base: string;
let jetons: Record<"agent1" | "agent2" | "agent3" | "admin" | "user1", string>;
let brouillonAgent1: number;
let publieeAgent1: number;

type Reponse = {
  data?: Record<string, any> | null;
  errors?: { message: string; extensions?: { code?: string } }[];
};

/** Envoie une requête GraphQL et renvoie le statut HTTP et le corps */
async function graphql(query: string, variables: Record<string, unknown> = {}, jeton?: string) {
  const r = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(jeton && { Authorization: `Bearer ${jeton}` }) },
    body: JSON.stringify({ query, variables }),
  });
  return { statut: r.status, ...((await r.json()) as Reponse) };
}

/** Code de la première erreur GraphQL (UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT…) */
const codeErreur = (r: Reponse) => r.errors?.[0]?.extensions?.code;

const CREER = /* GraphQL */ `
  mutation ($input: CreerAnnonceInput!) {
    creerAnnonce(input: $input) {
      annonce { id titre statutPublication auteur { name } photos { url } }
      erreurs { champ message }
    }
  }
`;
const MODIFIER = /* GraphQL */ `
  mutation ($id: ID!, $input: ModifierAnnonceInput!) {
    modifierAnnonce(id: $id, input: $input) {
      annonce { id titre prix }
      erreurs { champ message }
    }
  }
`;
const SUPPRIMER = "mutation ($id: ID!) { supprimerAnnonce(id: $id) }";
const PUBLIER = "mutation ($id: ID!) { publierAnnonce(id: $id) { id statutPublication } }";
const DEPUBLIER = "mutation ($id: ID!) { depublierAnnonce(id: $id) { id statutPublication } }";
const POSER = /* GraphQL */ `
  mutation ($annonceId: ID!, $input: QuestionInput!) {
    poserQuestion(annonceId: $annonceId, input: $input) {
      question { id contenu auteur { name } reponse { contenu } }
      erreurs { champ message }
    }
  }
`;
const REPONDRE = /* GraphQL */ `
  mutation ($questionId: ID!, $input: ReponseInput!) {
    repondreQuestion(questionId: $questionId, input: $input) {
      reponse { id contenu auteur { name } }
      erreurs { champ message }
    }
  }
`;

function nouvelleAnnonce(titre = "Studio créé en GraphQL") {
  return {
    titre,
    description: "Annonce créée par les tests GraphQL.",
    typeBien: "LOCATION",
    prix: 650,
    ville: "Le Havre",
    dateDisponibilite: "2026-12-01",
    photos: [{ url: "https://picsum.photos/seed/gql/640/480", alt: "Salon" }],
  };
}

beforeAll(async () => {
  ({ app, base } = await demarrerServeur());
  jetons = {
    agent1: await connexion(base, "agent1@immo.fr"),
    agent2: await connexion(base, "agent2@immo.fr"),
    agent3: await connexion(base, "agent3@immo.fr"),
    admin: await connexion(base, "admin@immo.fr"),
    user1: await connexion(base, "user1@immo.fr"),
  };
  const annoncesAgent1 = { auteur: { email: "agent1@immo.fr" } };
  brouillonAgent1 = (
    await prisma.annonce.findFirstOrThrow({
      where: { ...annoncesAgent1, statutPublication: "BROUILLON" },
      select: { id: true },
    })
  ).id;
  publieeAgent1 = (
    await prisma.annonce.findFirstOrThrow({
      where: { ...annoncesAgent1, statutPublication: "PUBLIEE" },
      select: { id: true },
    })
  ).id;
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("Cycle de vie d'une annonce", () => {
  it("créer (brouillon), modifier, publier, dépublier puis supprimer", async () => {
    const creation = await graphql(CREER, { input: nouvelleAnnonce() }, jetons.agent1);
    expect(creation.errors).toBeUndefined();
    const annonce = creation.data!.creerAnnonce.annonce;
    expect(creation.data!.creerAnnonce.erreurs).toEqual([]);
    expect(annonce.statutPublication).toBe("BROUILLON");
    expect(annonce.auteur.name).toBe("Agent Un"); // l'auteur vient du jeton
    expect(annonce.photos).toHaveLength(1);

    const modif = await graphql(MODIFIER, { id: annonce.id, input: { prix: 700 } }, jetons.agent1);
    expect(modif.data!.modifierAnnonce.annonce).toMatchObject({ prix: 700, titre: annonce.titre });

    expect((await graphql(PUBLIER, { id: annonce.id }, jetons.agent1)).data!.publierAnnonce.statutPublication).toBe(
      "PUBLIEE",
    );
    expect(
      (await graphql(DEPUBLIER, { id: annonce.id }, jetons.agent1)).data!.depublierAnnonce.statutPublication,
    ).toBe("BROUILLON");

    expect((await graphql(SUPPRIMER, { id: annonce.id }, jetons.agent1)).data!.supprimerAnnonce).toBe(true);
    expect(await prisma.annonce.findUnique({ where: { id: Number(annonce.id) } })).toBeNull();
  });
});

describe("Les erreurs de validation sont dans le type de retour", () => {
  it("création invalide : annonce null, erreurs par champ, AUCUNE erreur GraphQL, rien en base", async () => {
    const avant = await prisma.annonce.count();
    const r = await graphql(
      CREER,
      { input: { ...nouvelleAnnonce(), titre: "ab", prix: -5, dateDisponibilite: "demain" } },
      jetons.agent1,
    );
    expect(r.errors).toBeUndefined(); // ce n'est pas une erreur technique
    expect(r.data!.creerAnnonce.annonce).toBeNull();
    const champs = r.data!.creerAnnonce.erreurs.map((e: any) => e.champ);
    expect(champs).toEqual(expect.arrayContaining(["titre", "prix", "dateDisponibilite"]));
    expect(await prisma.annonce.count()).toBe(avant);
  });

  it("modification vide : erreur dans le résultat", async () => {
    const r = await graphql(MODIFIER, { id: String(brouillonAgent1), input: {} }, jetons.agent1);
    expect(r.errors).toBeUndefined();
    expect(r.data!.modifierAnnonce.annonce).toBeNull();
    expect(r.data!.modifierAnnonce.erreurs.length).toBeGreaterThan(0);
  });

  it("un champ hors schéma (auteurId) est refusé par GraphQL lui-même", async () => {
    const r = await graphql(CREER, { input: { ...nouvelleAnnonce(), auteurId: "pirate" } }, jetons.agent1);
    expect(r.statut).toBe(400);
    expect(r.errors?.[0]?.message).toMatch(/auteurId/);
  });
});

describe("Authentification et rôles (vérifiés dans chaque resolver)", () => {
  it("anonyme → UNAUTHENTICATED", async () => {
    expect(codeErreur(await graphql(CREER, { input: nouvelleAnnonce() }))).toBe("UNAUTHENTICATED");
    expect(
      codeErreur(await graphql(POSER, { annonceId: String(publieeAgent1), input: { contenu: "Question anonyme ?" } })),
    ).toBe("UNAUTHENTICATED");
  });

  it("USER et agent non validé → FORBIDDEN, et rien n'est créé", async () => {
    const avant = await prisma.annonce.count();
    expect(codeErreur(await graphql(CREER, { input: nouvelleAnnonce() }, jetons.user1))).toBe("FORBIDDEN");
    expect(codeErreur(await graphql(CREER, { input: nouvelleAnnonce() }, jetons.agent3))).toBe("FORBIDDEN");
    expect(await prisma.annonce.count()).toBe(avant);
  });
});

describe("IDOR : agent2 ne touche pas aux annonces d'agent1 (statut ET état de la base)", () => {
  it("supprimer → NOT_FOUND, et l'annonce existe toujours", async () => {
    const r = await graphql(SUPPRIMER, { id: String(brouillonAgent1) }, jetons.agent2);
    expect(codeErreur(r)).toBe("NOT_FOUND");
    expect(await prisma.annonce.findUnique({ where: { id: brouillonAgent1 } })).not.toBeNull();
  });

  it("modifier → NOT_FOUND, et le prix est inchangé", async () => {
    const avant = await prisma.annonce.findUniqueOrThrow({ where: { id: brouillonAgent1 } });
    const r = await graphql(MODIFIER, { id: String(brouillonAgent1), input: { prix: 1 } }, jetons.agent2);
    expect(codeErreur(r)).toBe("NOT_FOUND");
    const apres = await prisma.annonce.findUniqueOrThrow({ where: { id: brouillonAgent1 } });
    expect(apres.prix).toBe(avant.prix);
  });

  it("publier → NOT_FOUND, et l'annonce reste en brouillon", async () => {
    const r = await graphql(PUBLIER, { id: String(brouillonAgent1) }, jetons.agent2);
    expect(codeErreur(r)).toBe("NOT_FOUND");
    const enBase = await prisma.annonce.findUniqueOrThrow({ where: { id: brouillonAgent1 } });
    expect(enBase.statutPublication).toBe("BROUILLON");
  });

  it("dépublier → NOT_FOUND, et l'annonce reste publiée", async () => {
    const r = await graphql(DEPUBLIER, { id: String(publieeAgent1) }, jetons.agent2);
    expect(codeErreur(r)).toBe("NOT_FOUND");
    const enBase = await prisma.annonce.findUniqueOrThrow({ where: { id: publieeAgent1 } });
    expect(enBase.statutPublication).toBe("PUBLIEE");
  });
});

describe("Questions et réponses", () => {
  it("un USER pose une question, l'agent propriétaire répond, une seconde réponse donne CONFLICT", async () => {
    const q = await graphql(
      POSER,
      { annonceId: String(publieeAgent1), input: { contenu: "Le parking est-il inclus ?" } },
      jetons.user1,
    );
    expect(q.errors).toBeUndefined();
    const question = q.data!.poserQuestion.question;
    expect(question).toMatchObject({ contenu: "Le parking est-il inclus ?", reponse: null });
    expect(question.auteur.name).toBe("Client Un");

    const r = await graphql(
      REPONDRE,
      { questionId: question.id, input: { contenu: "Oui, une place en sous-sol." } },
      jetons.agent1,
    );
    expect(r.data!.repondreQuestion.reponse).toMatchObject({ contenu: "Oui, une place en sous-sol." });
    expect(r.data!.repondreQuestion.reponse.auteur.name).toBe("Agent Un");

    const encore = await graphql(REPONDRE, { questionId: question.id, input: { contenu: "Encore" } }, jetons.agent1);
    expect(codeErreur(encore)).toBe("CONFLICT");
  });

  it("question trop courte : erreur dans le résultat", async () => {
    const r = await graphql(POSER, { annonceId: String(publieeAgent1), input: { contenu: "?" } }, jetons.user1);
    expect(r.errors).toBeUndefined();
    expect(r.data!.poserQuestion.question).toBeNull();
    expect(r.data!.poserQuestion.erreurs[0].champ).toBe("contenu");
  });

  it("question sur un brouillon → NOT_FOUND", async () => {
    const r = await graphql(
      POSER,
      { annonceId: String(brouillonAgent1), input: { contenu: "Visible ou pas ?" } },
      jetons.user1,
    );
    expect(codeErreur(r)).toBe("NOT_FOUND");
  });

  it("IDOR : agent2 ne peut PAS répondre sur l'annonce d'agent1 → NOT_FOUND, et aucune réponse en base", async () => {
    const q = await graphql(
      POSER,
      { annonceId: String(publieeAgent1), input: { contenu: "Y a-t-il une cave ?" } },
      jetons.user1,
    );
    const questionId = q.data!.poserQuestion.question.id;

    const r = await graphql(REPONDRE, { questionId, input: { contenu: "Réponse usurpée" } }, jetons.agent2);
    expect(codeErreur(r)).toBe("NOT_FOUND");
    expect(await prisma.reponse.findUnique({ where: { questionId: Number(questionId) } })).toBeNull();
  });

  it("USER → FORBIDDEN pour répondre", async () => {
    const question = await prisma.question.findFirstOrThrow({ select: { id: true } });
    const r = await graphql(
      REPONDRE,
      { questionId: String(question.id), input: { contenu: "Je ne suis pas agent" } },
      jetons.user1,
    );
    expect(codeErreur(r)).toBe("FORBIDDEN");
  });
});
