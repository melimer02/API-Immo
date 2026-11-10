import bcrypt from "bcryptjs";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { AppError, nonAuthentifie } from "../lib/errors.js";
import { authentifier, utilisateurConnecte } from "../lib/auth.js";
import { Prisma } from "../generated/prisma/client.js";
import { erreurs } from "../schemas/commun.js";
import { ConnexionBody, InscriptionBody, JetonSchema, ProfilSchema } from "../schemas/auth.js";

// Liste blanche des colonnes du profil 
const selectProfil = { id: true, name: true, email: true, role: true, createdAt: true } as const;



const HASH_FACTICE = bcrypt.hashSync("mot-de-passe-factice", 10);

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── POST /auth/register ─────────────────────────────────────────
  app.post("/auth/register", {
    schema: {
      tags: ["auth"],
      summary: "Créer un compte (toujours avec le rôle USER)",
      body: InscriptionBody,
      response: { 201: ProfilSchema, 400: erreurs[400], 409: erreurs[409] },
    },
  }, async (req, reply) => {
    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const user = await prisma.user.create({
        data: { name, email, passwordHash, role: "USER" }, // rôle imposé par le serveur
        select: selectProfil,
      });
      return reply.code(201).header("Location", "/me").send(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(409, "EMAIL_ALREADY_USED", "Cet email est déjà utilisé", [
          { field: "email", message: "déjà utilisé" },
        ]);
      }
      throw e;
    }
  });

  // ── POST /auth/login ────────────────────────────────────────────
  app.post("/auth/login", {
    schema: {
      tags: ["auth"],
      summary: "S'authentifier et obtenir un JWT",
      body: ConnexionBody,
      response: { 200: JetonSchema, 400: erreurs[400], 401: erreurs[401] },
    },
  }, async (req) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, passwordHash: true },
    });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? HASH_FACTICE);
    if (!user || !ok) {
  
      throw new AppError(401, "INVALID_CREDENTIALS", "Email ou mot de passe incorrect");
    }
    const expiresIn = process.env.JWT_EXPIRES_IN ?? "1h";
    const token = app.jwt.sign({ sub: user.id, role: user.role }, { expiresIn });
    return { token, tokenType: "Bearer" as const, expiresIn };
  });

  // ── GET /me ─────────────────────────────────────────────────────
  app.get("/me", {
    onRequest: [authentifier],
    schema: {
      tags: ["auth"],
      summary: "Mon profil",
      security: [{ bearerAuth: [] }],
      response: { 200: ProfilSchema, 401: erreurs[401] },
    },
  }, async (req) => {
    const moi = utilisateurConnecte(req);
    const user = await prisma.user.findUnique({ where: { id: moi.id }, select: selectProfil });
    if (!user) throw nonAuthentifie(); // compte supprimé depuis l'émission du jeton
    return user;
  });
};
