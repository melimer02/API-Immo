import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { AppError, introuvable } from "../lib/errors.js";
import { meta, pagination } from "../lib/pagination.js";
import {
  authentifier,
  authentifierSiPresent,
  exigerGestionnaire,
  utilisateurConnecte,
} from "../lib/auth.js";
import { filtreProprietaire, filtreVisibilite } from "../regles/autorisation.js";
import { Prisma } from "../generated/prisma/client.js";
import { erreurs, IdParams, PaginationQuery, securite, securiteFacultative } from "../schemas/commun.js";
import {
  PageQuestionsSchema,
  QuestionBody,
  QuestionSchema,
  ReponseBody,
  ReponseSchema,
} from "../schemas/questions.js";

const auteur = { select: { id: true, name: true } } as const;

const selectReponse = { id: true, contenu: true, createdAt: true, auteur } satisfies Prisma.ReponseSelect;

const selectQuestion = {
  id: true,
  annonceId: true,
  contenu: true,
  createdAt: true,
  auteur,
  reponse: { select: selectReponse },
} satisfies Prisma.QuestionSelect;

export const questionsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── GET /annonces/:id/questions : questions d'une annonce visible ──
  app.get("/annonces/:id/questions", {
    onRequest: [authentifierSiPresent],
    schema: {
      tags: ["questions"],
      summary: "Questions posées sur une annonce (avec leur réponse)",
      operationId: "listerQuestions",
      security: securiteFacultative,
      params: IdParams,
      querystring: PaginationQuery,
      response: { 200: PageQuestionsSchema, 400: erreurs[400], 401: erreurs[401], 404: erreurs[404] },
    },
  }, async (req) => {
    const annonce = await prisma.annonce.findFirst({
      where: { id: req.params.id, ...filtreVisibilite(req.utilisateur) },
      select: { id: true },
    });
    if (!annonce) throw introuvable("Annonce");

    const { page, limit } = req.query;
    const where = { annonceId: annonce.id };
    const [data, total] = await Promise.all([
      prisma.question.findMany({
        where,
        select: selectQuestion,
        orderBy: { createdAt: "asc" },
        ...pagination(page, limit),
      }),
      prisma.question.count({ where }),
    ]);
    return { data, meta: meta(page, limit, total) };
  });

  // ── GET /questions/:id : une question (si son annonce est visible) ──
  app.get("/questions/:id", {
    onRequest: [authentifierSiPresent],
    schema: {
      tags: ["questions"],
      summary: "Détail d'une question",
      operationId: "lireQuestion",
      security: securiteFacultative,
      params: IdParams,
      response: { 200: QuestionSchema, 400: erreurs[400], 401: erreurs[401], 404: erreurs[404] },
    },
  }, async (req) => {
    const question = await prisma.question.findFirst({
      where: { id: req.params.id, annonce: filtreVisibilite(req.utilisateur) },
      select: selectQuestion,
    });
    if (!question) throw introuvable("Question");
    return question;
  });

  // ── POST /annonces/:id/questions : tout utilisateur connecté, sur une annonce publiée ──
  app.post("/annonces/:id/questions", {
    onRequest: [authentifier],
    schema: {
      tags: ["questions"],
      summary: "Poser une question sur une annonce publiée",
      operationId: "poserQuestion",
      description: "Tout utilisateur connecté. 404 si l'annonce n'existe pas ou n'est pas publiée. 201 avec Location: /questions/{id}.",
      security: securite,
      params: IdParams,
      body: QuestionBody,
      response: { 201: QuestionSchema, 400: erreurs[400], 401: erreurs[401], 404: erreurs[404] },
    },
  }, async (req, reply) => {
    const user = utilisateurConnecte(req);
    const annonce = await prisma.annonce.findFirst({
      where: { id: req.params.id, statutPublication: "PUBLIEE" },
      select: { id: true },
    });
    if (!annonce) throw introuvable("Annonce"); // inexistante ou brouillon
    const question = await prisma.question.create({
      data: { contenu: req.body.contenu, annonceId: annonce.id, auteurId: user.id },
      select: selectQuestion,
    });
    return reply.code(201).header("Location", `/questions/${question.id}`).send(question);
  });

  // ── POST /questions/:id/reponse : l'agent propriétaire de l'annonce uniquement ──
  app.post("/questions/:id/reponse", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["questions"],
      summary: "Répondre à une question posée sur une de mes annonces",
      operationId: "repondreQuestion",
      description:
        "Agent propriétaire de l'annonce (ou ADMIN). 404 si la question porte sur l'annonce d'un autre agent, 409 si elle a déjà une réponse.",
      security: securite,
      params: IdParams,
      body: ReponseBody,
      response: { 201: ReponseSchema, ...erreurs },
    },
  }, async (req, reply) => {
    const user = utilisateurConnecte(req);
    // La question doit porter sur une annonce de l'agent : propriété vérifiée dans le where
    const question = await prisma.question.findFirst({
      where: { id: req.params.id, annonce: filtreProprietaire(user) },
      select: { id: true, reponse: { select: { id: true } } },
    });
    if (!question) throw introuvable("Question"); // inexistante OU pas sur mon annonce

    const dejaRepondue = () =>
      new AppError(409, "QUESTION_ALREADY_ANSWERED", "Cette question a déjà une réponse");
    if (question.reponse) throw dejaRepondue();

    try {
      const reponse = await prisma.reponse.create({
        data: { contenu: req.body.contenu, questionId: question.id, auteurId: user.id },
        select: selectReponse,
      });
      return reply.code(201).header("Location", `/questions/${question.id}`).send(reponse);
    } catch (e) {
      // Deux réponses simultanées : la contrainte unique de la base tranche
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw dejaRepondue();
      throw e;
    }
  });
};
