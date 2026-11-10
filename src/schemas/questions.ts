import { z } from "zod";
import { AuteurPublic, MetaSchema } from "./commun.js";

export const QuestionBody = z
  .object({
    contenu: z.string().trim().min(5).max(1000),
  })
  .meta({ id: "NouvelleQuestion", example: { contenu: "Les animaux sont-ils acceptés ?" } });

export const ReponseBody = z
  .object({
    contenu: z.string().trim().min(2).max(2000),
  })
  .meta({ id: "NouvelleReponse", example: { contenu: "Oui, les animaux sont acceptés." } });

export const ReponseSchema = z
  .object({
    id: z.number(),
    contenu: z.string(),
    createdAt: z.date(),
    auteur: AuteurPublic,
  })
  .meta({ id: "Reponse" });

export const QuestionSchema = z
  .object({
    id: z.number(),
    annonceId: z.number(),
    contenu: z.string(),
    createdAt: z.date(),
    auteur: AuteurPublic,
    reponse: ReponseSchema.nullable().describe("null tant que l'agent n'a pas répondu"),
  })
  .meta({ id: "Question" });

export const PageQuestionsSchema = z
  .object({
    data: z.array(QuestionSchema),
    meta: MetaSchema,
  })
  .meta({ id: "PageQuestions" });
