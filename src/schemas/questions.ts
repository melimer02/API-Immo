import { z } from "zod";
import { AuteurPublic, MetaSchema } from "./commun.js";

export const QuestionBody = z.object({
  contenu: z.string().trim().min(5).max(1000),
});

export const ReponseBody = z.object({
  contenu: z.string().trim().min(2).max(2000),
});

export const ReponseSchema = z.object({
  id: z.number(),
  contenu: z.string(),
  createdAt: z.date(),
  auteur: AuteurPublic,
});

export const QuestionSchema = z.object({
  id: z.number(),
  annonceId: z.number(),
  contenu: z.string(),
  createdAt: z.date(),
  auteur: AuteurPublic,
  reponse: ReponseSchema.nullable(),
});

export const PageQuestionsSchema = z.object({
  data: z.array(QuestionSchema),
  meta: MetaSchema,
});
