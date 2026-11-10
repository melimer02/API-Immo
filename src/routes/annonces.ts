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
import { erreurs, IdParams, PaginationQuery } from "../schemas/commun.js";
import {
  AnnonceSchema,
  CreerAnnonceBody,
  ListeAnnoncesQuery,
  ModifierAnnonceBody,
  PageAnnoncesSchema,
  PublicationSchema,
} from "../schemas/annonces.js";

/** Liste des colonnes renvoyées  */
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

const securite = [{ bearerAuth: [] }];

export const annoncesRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── GET /annonces : liste publique, uniquement les annonces publiées ──
  app.get("/annonces", {
    schema: {
      tags: ["annonces"],
      summary: "Liste paginée et filtrée des annonces publiées",
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

  // GET /annonces/:id : publiée, ou brouillon visible par son auteur / un admin 
  app.get("/annonces/:id", {
    onRequest: [authentifierSiPresent],
    schema: {
      tags: ["annonces"],
      summary: "Détail d'une annonce",
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

  // GET /me/annonces : les annonces de l'agent connecté, brouillons compris
  app.get("/me/annonces", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Mes annonces (brouillons compris)",
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

  // POST /annonces : création, toujours en brouillon 
  app.post("/annonces", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Créer une annonce (brouillon)",
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
        auteurId: user.id, 
        photos: { create: photos },
      },
      select: selectAnnonce,
    });
    return reply.code(201).header("Location", `/annonces/${annonce.id}`).send(annonce);
  });

  // ── PATCH /annonces/:id : modification partielle, propriétaire uniquement
  app.patch("/annonces/:id", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Modifier une annonce (champs envoyés uniquement)",
      security: securite,
      params: IdParams,
      body: ModifierAnnonceBody,
      response: { 200: AnnonceSchema, ...erreurs },
    },
  }, async (req) => {
    const user = utilisateurConnecte(req);
    const res = await prisma.annonce.updateMany({
      where: { id: req.params.id, ...filtreProprietaire(user) },
      data: req.body,
    });
    if (res.count === 0) throw introuvable("Annonce"); 
    return prisma.annonce.findUniqueOrThrow({ where: { id: req.params.id }, select: selectAnnonce });
  });

  // ── DELETE /annonces/:id ──
  app.delete("/annonces/:id", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Supprimer une annonce",
      security: securite,
      params: IdParams,
      response: { 204: z.null().describe("Annonce supprimée"), ...erreurs },
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
  // PUT publie, DELETE dépublie.
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
      security: securite,
      params: IdParams,
      response: { 200: PublicationSchema, ...erreurs },
    },
  }, async (req) => changerPublication(req.params.id, utilisateurConnecte(req), "PUBLIEE"));

  app.delete("/annonces/:id/publication", {
    onRequest: [authentifier, exigerGestionnaire],
    schema: {
      tags: ["annonces"],
      summary: "Dépublier une annonce (retour en brouillon)",
      security: securite,
      params: IdParams,
      response: { 200: PublicationSchema, ...erreurs },
    },
  }, async (req) => changerPublication(req.params.id, utilisateurConnecte(req), "BROUILLON"));
};
