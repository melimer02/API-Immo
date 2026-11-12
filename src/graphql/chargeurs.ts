import DataLoader from "dataloader";
import { prisma } from "../lib/prisma.js";

export type Auteur = { id: string; name: string };

export type QuestionAvecReponse = {
  id: number;
  annonceId: number;
  contenu: string;
  createdAt: Date;
  auteurId: string;
  reponse: { id: number; contenu: string; createdAt: Date; auteurId: string } | null;
};

/**
 * Chargeurs (DataLoader) : regroupent tous les appels d'un même tour de boucle
 * d'événements en UNE requête SQL (WHERE id IN (...)). C'est la parade au problème N+1.
 *
 * ⚠️ Ils sont créés À CHAQUE REQUÊTE HTTP (dans le contexte), jamais partagés :
 * un DataLoader met en cache ce qu'il charge ; un loader global servirait des données
 * périmées, voire celles d'un autre utilisateur.
 */
export function creerChargeurs() {
  return {
    /** Annonce.auteur, Question.auteur, Reponse.auteur */
    auteurs: new DataLoader<string, Auteur | null>(async (ids) => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...ids] } },
        select: { id: true, name: true }, // liste blanche : jamais d'email ni de passwordHash
      });
      // ⚠️ L'ordre du résultat DOIT correspondre à l'ordre des ids reçus,
      // sinon le mauvais auteur est associé silencieusement à la mauvaise annonce.
      const parId = new Map(users.map((u) => [u.id, u]));
      return ids.map((id) => parId.get(id) ?? null);
    }),

    /** Annonce.questions : toutes les questions des annonces d'une page, en une requête */
    questionsParAnnonce: new DataLoader<number, QuestionAvecReponse[]>(async (annonceIds) => {
      const questions = await prisma.question.findMany({
        where: { annonceId: { in: [...annonceIds] } },
        select: {
          id: true,
          annonceId: true,
          contenu: true,
          createdAt: true,
          auteurId: true,
          reponse: { select: { id: true, contenu: true, createdAt: true, auteurId: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return annonceIds.map((id) => questions.filter((q) => q.annonceId === id));
    }),
  };
}

export type Chargeurs = ReturnType<typeof creerChargeurs>;
