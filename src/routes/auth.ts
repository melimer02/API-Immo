import bcrypt from "bcryptjs";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../lib/prisma.js";
import { AppError, nonAuthentifie } from "../lib/errors.js";
import { authentifier, utilisateurConnecte } from "../lib/auth.js";
import { Prisma } from "../generated/prisma/client.js";
import { erreurs, securite, securitePublique, ErreurSchema } from "../schemas/commun.js";
import { ConnexionBody, InscriptionBody, JetonSchema, ProfilSchema } from "../schemas/auth.js";

// Liste blanche des colonnes du profil : passwordHash n'est jamais lu
const selectProfil = { id: true, name: true, email: true, role: true, createdAt: true } as const;

const HASH_FACTICE = bcrypt.hashSync("mot-de-passe-factice", 10);

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  // ── POST /auth/register ─────────────────────────────────────────
  app.post("/auth/register", {
    schema: {
      tags: ["auth"],
      summary: "Créer un compte (toujours avec le rôle USER)",
      operationId: "inscrire",
      security: securitePublique,
      description: "Un champ role envoyé par le client est ignoré. 409 si l'email est déjà utilisé.",
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
      operationId: "connecter",
      security: securitePublique,
      description: "401 avec le même message que l'email ou le mot de passe soit faux.",
      body: ConnexionBody,
            response: {
        200: JetonSchema,
        400: erreurs[400],
        401: ErreurSchema.describe("Email ou mot de passe incorrect — INVALID_CREDENTIALS"),
      },
    },
  }, async (req) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, statutPro: true, passwordHash: true },
    });
    const ok = await bcrypt.compare(password, user?.passwordHash ?? HASH_FACTICE);
    if (!user || !ok) {
      // Même message dans les deux cas : on ne dit pas si c'est l'email ou le mot de passe
      throw new AppError(401, "INVALID_CREDENTIALS", "Email ou mot de passe incorrect");
    }
    const expiresIn = process.env.JWT_EXPIRES_IN ?? "1h";
    const token = app.jwt.sign({ sub: user.id, role: user.role, statutPro: user.statutPro }, { expiresIn });
    return { token, tokenType: "Bearer" as const, expiresIn };
  });

  // ── GET /me ─────────────────────────────────────────────────────
  app.get("/me", {
    onRequest: [authentifier],
    schema: {
      tags: ["auth"],
      summary: "Mon profil",
      operationId: "monProfil",
      security: securite,
      response: { 200: ProfilSchema, 401: erreurs[401] },
    },
  }, async (req) => {
    const moi = utilisateurConnecte(req);
    const user = await prisma.user.findUnique({ where: { id: moi.id }, select: selectProfil });
    if (!user) throw nonAuthentifie(); // compte supprimé depuis l'émission du jeton
    return user;
  });
};
