import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { introuvable } from "../lib/errors.js";
import { meta, pagination } from "../lib/pagination.js";
import {
  authentifier,
  authentifierSiPresent,
  exigerGestionnaire,
  utilisateurConnecte,
} from "../lib/auth.js";
import { filtreProprietaire, filtreVisibilite } from "../regles/autorisation.js";
import type { Prisma } from "../generated/prisma/client.js";
import {
  erreurs,
  IdParams,
  PaginationQuery,
  securite,
  securiteFacultative,
  securitePublique,
  erreursProprietaire,
} from "../schemas/commun.js";
import {
  AnnonceSchema,
  CreerAnnonceBody,
  ListeAnnoncesQuery,
  ModifierAnnonceBody,
  PageAnnoncesSchema,
  PublicationSchema,
} from "../schemas/annonces.js";

/** Liste blanche des colonnes renvoyées : jamais de findMany() "nu" */
const selectAnnonce = {
  id: true,
  titre: true,
  description: true,
  typeBien: true,
  statutPublication: true,
  statutBien: true,
  prix: true,
  surface: true,
  ville: true,
  dateDisponibilite: true,
  createdAt: true,
  updatedAt: true,
  auteur: { select: { id: true, name: true } },
  photos: { select: { id: true, url: true, alt: true }, orderBy: { id: "asc" } },
} satisfies Prisma.AnnonceSelect;

export const annoncesRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── GET /annonces : liste publique, uniquement les annonces publiées ──
  app.get("/annonces", {
    schema: {
      tags: ["annonces"],
      summary: "Liste paginée et filtrée des annonces publiées",
      operationId: "listerAnnonces",
      security: securitePublique,
      description: "Public. Ne renvoie jamais de brouillon, quel que soit l'appelant (réponse identique pour tous).",
      querystring: ListeAnnoncesQuery,
      response: { 200: PageAnnoncesSchema, 400: erreurs[400] },
    },
  }, async (req) => {
    const { page, limit, ville, type, prixMax } = req.query;
    const where: Prisma.AnnonceWhereInput = {
      statutPublication: "PUBLIEE",
      ...(ville && { ville: { equals: ville, mode: "insensitive" } }),
      ...(type && { typeBien: type }),
      ...(prixMax !== undefined && { prix: { lte: prixMax } }),
    };
    const [data, total] = await Promise.all([
      prisma.annonce.findMany({
        where,
        select: selectAnnonce,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...pagination(page, limit),
      }),
      prisma.annonce.count({ where }),
    ]);
    return { data, meta: meta(page, limit, total) };
  });

  // ── GET /annonces/:id : publiée, ou brouillon visible par son auteur / un admin ──
  app.get("/annonces/:id", {
    onRequest: [authentifierSiPresent],
    schema: {
      tags: ["annonces"],
      summary: "Détail d'une annonce",
      operationId: "lireAnnonce",
      description:
        "Public pour une annonce publiée. Un brouillon n'est visible que par son auteur et les admins : pour tout autre appelant, 404.",
      security: securiteFacultative,
      params: IdParams,
      response: { 200: AnnonceSchema, 400: erreurs[400], 401: erreurs[401], 404: erreurs[404] },
    },
  }, async (req) => {
    const annonce = await prisma.annonce.findFirst({
      where: { id: req.params.id, ...filtreVisibilite(req.utilisateur) },
      select: selectAnnonce,
    });
    // Brouillon d'un autre agent : 404, comme si elle n'existait pas
    if (!annonce) throw introuvable("Annonce");
    return annonce;
  });

  // ── GET /me/annonces : les annonces de l'agent connecté, brouillons compris ──
  app.get("/me/annonces", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Mes annonces (brouillons compris)",
      operationId: "mesAnnonces",
      security: securite,
      querystring: PaginationQuery,
      response: { 200: PageAnnoncesSchema, 400: erreurs[400], 401: erreurs[401], 403: erreurs[403] },
    },
  }, async (req) => {
    const user = utilisateurConnecte(req);
    const { page, limit } = req.query;
    const where = { auteurId: user.id };
    const [data, total] = await Promise.all([
      prisma.annonce.findMany({
        where,
        select: selectAnnonce,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...pagination(page, limit),
      }),
      prisma.annonce.count({ where }),
    ]);
    return { data, meta: meta(page, limit, total) };
  });

  // ── POST /annonces : création, toujours en brouillon ──
  app.post("/annonces", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Créer une annonce (brouillon)",
      operationId: "creerAnnonce",
      description: "AGENT ou ADMIN. Réponse 201 avec l'en-tête Location: /annonces/{id}.",
      security: securite,
      body: CreerAnnonceBody,
      response: { 201: AnnonceSchema, 400: erreurs[400], 401: erreurs[401], 403: erreurs[403] },
    },
  }, async (req, reply) => {
    const user = utilisateurConnecte(req);
    const { photos, ...champs } = req.body;
    const annonce = await prisma.annonce.create({
      data: {
        ...champs,
        statutPublication: "BROUILLON",
        auteurId: user.id, // l'auteur vient du jeton, jamais du corps de la requête
        photos: { create: photos },
      },
      select: selectAnnonce,
    });
    return reply.code(201).header("Location", `/annonces/${annonce.id}`).send(annonce);
  });

  // ── PATCH /annonces/:id : modification partielle, propriétaire uniquement ──
  app.patch("/annonces/:id", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Modifier une annonce (champs envoyés uniquement)",
      operationId: "modifierAnnonce",
      description: "Propriétaire ou ADMIN. La publication ne se modifie pas ici, mais via /annonces/{id}/publication.",
      security: securite,
      params: IdParams,
      body: ModifierAnnonceBody,
      response: { 200: AnnonceSchema, ...erreursProprietaire },
    },
  }, async (req) => {
    const user = utilisateurConnecte(req);
    // La propriété est vérifiée DANS la requête : pas de lecture puis écriture séparées
    const res = await prisma.annonce.updateMany({
      where: { id: req.params.id, ...filtreProprietaire(user) },
      data: req.body,
    });
    if (res.count === 0) throw introuvable("Annonce"); // absente OU pas à moi : indiscernable
    return prisma.annonce.findUniqueOrThrow({ where: { id: req.params.id }, select: selectAnnonce });
  });

  // ── DELETE /annonces/:id ──
  app.delete("/annonces/:id", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Supprimer une annonce",
      operationId: "supprimerAnnonce",
      description: "Propriétaire ou ADMIN. 404 si l'annonce n'existe pas ou appartient à un autre agent.",
      security: securite,
      params: IdParams,
      response: { 204: z.null().describe("Annonce supprimée"), ...erreursProprietaire },
    },
  }, async (req, reply) => {
    const user = utilisateurConnecte(req);
    const res = await prisma.annonce.deleteMany({
      where: { id: req.params.id, ...filtreProprietaire(user) },
    });
    if (res.count === 0) throw introuvable("Annonce");
    return reply.code(204).send(null);
  });

  // ── Publication : sous-ressource /annonces/:id/publication ──
  // PUT publie, DELETE dépublie. Les deux sont idempotents.
  async function changerPublication(
    id: number,
    user: ReturnType<typeof utilisateurConnecte>,
    statutPublication: "PUBLIEE" | "BROUILLON",
  ) {
    const res = await prisma.annonce.updateMany({
      where: { id, ...filtreProprietaire(user) },
      data: { statutPublication },
    });
    if (res.count === 0) throw introuvable("Annonce");
    return { id, statutPublication };
  }

  app.put("/annonces/:id/publication", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Publier une annonce",
      operationId: "publierAnnonce",
      description: "Idempotent : publier une annonce déjà publiée renvoie le même résultat.",
      security: securite,
      params: IdParams,
      response: { 200: PublicationSchema, ...erreursProprietaire },
    },
  }, async (req) => changerPublication(req.params.id, utilisateurConnecte(req), "PUBLIEE"));

  app.delete("/annonces/:id/publication", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Dépublier une annonce (retour en brouillon)",
      operationId: "depublierAnnonce",
      description: "Idempotent.",
      security: securite,
      params: IdParams,
      response: { 200: PublicationSchema, ...erreursProprietaire },
    },
  }, async (req) => changerPublication(req.params.id, utilisateurConnecte(req), "BROUILLON"));
};
