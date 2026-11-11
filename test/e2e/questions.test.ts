/** E2E : questions des utilisateurs, réponses des agents propriétaires — via le SDK généré. */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { clients, connexion, demarrerServeur, echec } from "../helpers.js";

let app: FastifyInstance;
let base: string;
let jetons: Record<"agent1" | "agent2" | "user1", string>;
let publieeAgent1: number;
let brouillonAgent1: number;

beforeAll(async () => {
  ({ app, base } = await demarrerServeur());
  jetons = {
    agent1: await connexion(base, "agent1@immo.fr"),
    agent2: await connexion(base, "agent2@immo.fr"),
    user1: await connexion(base, "user1@immo.fr"),
  };
  publieeAgent1 = (
    await prisma.annonce.findFirstOrThrow({
      where: { auteur: { email: "agent1@immo.fr" }, statutPublication: "PUBLIEE" },
      select: { id: true },
    })
  ).id;
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

describe("Questions et réponses", () => {
  it("un utilisateur pose une question (201), l'agent propriétaire y répond (201), une seconde réponse donne 409", async () => {
    const question = await clients(base, jetons.user1).questions.poserQuestion({
      id: publieeAgent1,
      nouvelleQuestionInput: { contenu: "Le chauffage est-il collectif ?" },
    });
    expect(question.annonceId).toBe(publieeAgent1);
    expect(question.reponse).toBeNull();

    const reponse = await clients(base, jetons.agent1).questions.repondreQuestion({
      id: question.id,
      nouvelleReponseInput: { contenu: "Non, il est individuel." },
    });
    expect(reponse.contenu).toBe("Non, il est individuel.");

    const r = await echec(
      clients(base, jetons.agent1).questions.repondreQuestion({
        id: question.id,
        nouvelleReponseInput: { contenu: "Encore une réponse" },
      }),
    );
    expect(r).toMatchObject({ statut: 409, code: "QUESTION_ALREADY_ANSWERED" });
  });

  it("401 pour poser une question sans être connecté", async () => {
    const r = await echec(
      clients(base).questions.poserQuestion({
        id: publieeAgent1,
        nouvelleQuestionInput: { contenu: "Question anonyme ?" },
      }),
    );
    expect(r.statut).toBe(401);
  });

  it("404 pour poser une question sur un brouillon", async () => {
    const r = await echec(
      clients(base, jetons.user1).questions.poserQuestion({
        id: brouillonAgent1,
        nouvelleQuestionInput: { contenu: "Visible ou pas ?" },
      }),
    );
    expect(r.statut).toBe(404);
  });

  it("IDOR : agent2 ne peut PAS répondre à une question sur l'annonce d'agent1 → 404 ET aucune réponse en base", async () => {
    const question = await clients(base, jetons.user1).questions.poserQuestion({
      id: publieeAgent1,
      nouvelleQuestionInput: { contenu: "Y a-t-il une cave ?" },
    });

    const r = await echec(
      clients(base, jetons.agent2).questions.repondreQuestion({
        id: question.id,
        nouvelleReponseInput: { contenu: "Réponse usurpée" },
      }),
    );
    expect(r.statut).toBe(404);
    expect(await prisma.reponse.findUnique({ where: { questionId: question.id } })).toBeNull();
  });

  it("USER → 403 pour répondre", async () => {
    const question = await prisma.question.findFirstOrThrow({ select: { id: true } });
    const r = await echec(
      clients(base, jetons.user1).questions.repondreQuestion({
        id: question.id,
        nouvelleReponseInput: { contenu: "Je ne suis pas agent" },
      }),
    );
    expect(r).toMatchObject({ statut: 403, code: "FORBIDDEN" });
  });

  it("liste les questions d'une annonce publiée, avec leur réponse", async () => {
    const page = await clients(base).questions.listerQuestions({ id: publieeAgent1 });
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data.every((q) => q.annonceId === publieeAgent1)).toBe(true);
  });
});
