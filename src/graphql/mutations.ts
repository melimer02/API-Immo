import type { IResolvers } from "mercurius";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { filtreProprietaire } from "../regles/autorisation.js";
import { CreerAnnonceBody, ModifierAnnonceBody } from "../schemas/annonces.js";
import { QuestionBody, ReponseBody } from "../schemas/questions.js";
import {
  erreurGraphQL,
  erreursChamps,
  exigerConnexion,
  exigerGestionnaire,
  idNumerique,
  introuvable,
} from "./erreurs.js";
import { selectAnnonceGraphQL } from "./selections.js";



/** GraphQL envoie null pour un champ facultatif explicitement vide ; Zod attend "absent". */
function sansNull<T extends Record<string, unknown>>(objet: T) {
  return Object.fromEntries(Object.entries(objet).filter(([, v]) => v !== null && v !== undefined));
}

/** Colonnes d'une question renvoyée par GraphQL  */
const selectQuestion = {
  id: true,
  annonceId: true,
  contenu: true,
  createdAt: true,
  auteurId: true,
  reponse: { select: { id: true, contenu: true, createdAt: true, auteurId: true } },
} satisfies Prisma.QuestionSelect;

const selectReponse = { id: true, contenu: true, createdAt: true, auteurId: true } satisfies Prisma.ReponseSelect;

/** Identifiant d'annonce valide, sinon NOT_FOUND (comme un id inconnu) */
function idAnnonce(id: string) {
  const n = idNumerique(id);
  if (n === null) throw introuvable("Annonce");
  return n;
}

export const Mutation: IResolvers["Mutation"] = {
  // ── Annonces ──────────────────────────────────────────────────────

  creerAnnonce: async (_parent, args: { input: Record<string, unknown> }, ctx) => {
    const user = exigerGestionnaire(ctx);

    const validation = CreerAnnonceBody.safeParse(sansNull(args.input));
    if (!validation.success) return { annonce: null, erreurs: erreursChamps(validation.error) };

    const { photos, ...champs } = validation.data;
    const annonce = await prisma.annonce.create({
      data: {
        ...champs,
        statutPublication: "BROUILLON", // une annonce naît toujours brouillon
        auteurId: user.id, 
        photos: { create: photos },
      },
      select: selectAnnonceGraphQL,
    });
    return { annonce, erreurs: [] };
  },

  modifierAnnonce: async (_parent, args: { id: string; input: Record<string, unknown> }, ctx) => {
    const user = exigerGestionnaire(ctx);
    const id = idAnnonce(args.id);

    const validation = ModifierAnnonceBody.safeParse(sansNull(args.input));
    if (!validation.success) return { annonce: null, erreurs: erreursChamps(validation.error) };

    // Propriété vérifiée DANS la requête
    const res = await prisma.annonce.updateMany({
      where: { id, ...filtreProprietaire(user) },
      data: validation.data,
    });
    if (res.count === 0) throw introuvable("Annonce");

    const annonce = await prisma.annonce.findUniqueOrThrow({ where: { id }, select: selectAnnonceGraphQL });
    return { annonce, erreurs: [] };
  },

  supprimerAnnonce: async (_parent, args: { id: string }, ctx) => {
    const user = exigerGestionnaire(ctx);
    const id = idAnnonce(args.id);

    const res = await prisma.annonce.deleteMany({ where: { id, ...filtreProprietaire(user) } });
    if (res.count === 0) throw introuvable("Annonce");
    return true;
  },

  publierAnnonce: async (_parent, args: { id: string }, ctx) => {
    const user = exigerGestionnaire(ctx);
    const id = idAnnonce(args.id);

    const res = await prisma.annonce.updateMany({
      where: { id, ...filtreProprietaire(user) },
      data: { statutPublication: "PUBLIEE" },
    });
    if (res.count === 0) throw introuvable("Annonce");
    return prisma.annonce.findUniqueOrThrow({ where: { id }, select: selectAnnonceGraphQL });
  },

  depublierAnnonce: async (_parent, args: { id: string }, ctx) => {
    const user = exigerGestionnaire(ctx);
    const id = idAnnonce(args.id);

    const res = await prisma.annonce.updateMany({
      where: { id, ...filtreProprietaire(user) },
      data: { statutPublication: "BROUILLON" },
    });
    if (res.count === 0) throw introuvable("Annonce");
    return prisma.annonce.findUniqueOrThrow({ where: { id }, select: selectAnnonceGraphQL });
  },

  // ── Questions et réponses ─────────────────────────────────────────

  poserQuestion: async (_parent, args: { annonceId: string; input: Record<string, unknown> }, ctx) => {
    const user = exigerConnexion(ctx); // tout utilisateur connecté
    const annonceId = idAnnonce(args.annonceId);

    const validation = QuestionBody.safeParse(sansNull(args.input));
    if (!validation.success) return { question: null, erreurs: erreursChamps(validation.error) };

    // Seulement sur une annonce publiée (un brouillon est invisible → NOT_FOUND)
    const annonce = await prisma.annonce.findFirst({
      where: { id: annonceId, statutPublication: "PUBLIEE" },
      select: { id: true },
    });
    if (!annonce) throw introuvable("Annonce");

    const question = await prisma.question.create({
      data: { contenu: validation.data.contenu, annonceId: annonce.id, auteurId: user.id },
      select: selectQuestion,
    });
    return { question, erreurs: [] };
  },

  repondreQuestion: async (_parent, args: { questionId: string; input: Record<string, unknown> }, ctx) => {
    const user = exigerGestionnaire(ctx);
    const questionId = idNumerique(args.questionId);
    if (questionId === null) throw introuvable("Question");

    const validation = ReponseBody.safeParse(sansNull(args.input));
    if (!validation.success) return { reponse: null, erreurs: erreursChamps(validation.error) };

    // La question doit porter sur une annonce de l'agent : propriété vérifiée dans le where
    const question = await prisma.question.findFirst({
      where: { id: questionId, annonce: filtreProprietaire(user) },
      select: { id: true, reponse: { select: { id: true } } },
    });
    if (!question) throw introuvable("Question"); // inexistante OU pas sur mon annonce

    const dejaRepondue = () => erreurGraphQL("CONFLICT", "Cette question a déjà une réponse");
    if (question.reponse) throw dejaRepondue();

    try {
      const reponse = await prisma.reponse.create({
        data: { contenu: validation.data.contenu, questionId: question.id, auteurId: user.id },
        select: selectReponse,
      });
      return { reponse, erreurs: [] };
    } catch (e) {

      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw dejaRepondue();
      throw e;
    }
  },
};
