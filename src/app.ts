import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { prisma } from "./lib/prisma.js";
import { enregistrerGestionErreurs } from "./lib/errors.js";

import { originesAutorisees } from "./lib/cors.js";
import { transformerSpec } from "./lib/openapi.js";
import { authRoutes } from "./routes/auth.js";
import { annoncesRoutes } from "./routes/annonces.js";
import { questionsRoutes } from "./routes/questions.js";
import fastifyCors from "@fastify/cors";

export async function buildApp(options: { logger?: boolean } = {}) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET manquant ou trop court (32 caractères minimum)");
  }

  const app = Fastify({ logger: options.logger ?? true }).withTypeProvider<ZodTypeProvider>();

  // Zod valide les entrées et sérialise les sorties (les champs hors schéma sont retirés)
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  enregistrerGestionErreurs(app);

  // Utilisateur courant : null tant qu'aucun hook d'authentification ne l'a rempli
  app.decorateRequest("utilisateur", null);

  await app.register(fastifyCors, {
    origin: originesAutorisees(),
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    exposedHeaders: ["Location"], // permet au front de lire l'URL de la ressource créée (201)
    credentials: false, // jeton dans l'en-tête Authorization
    maxAge: 600, 
  });




  await app.register(fastifyJwt, {
    secret,
    // Le jeton contient { sub, role } : on le transforme en { id, role } pour le reste du code
     formatUser: (payload) => ({ id: payload.sub, role: payload.role, statutPro: payload.statutPro }),
  });

  // Documentation OpenAPI générée depuis les schémas Zod (code-first)
  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "ImmoService API",
        version: "1.0.0",
        license: {
          name: "Projet pédagogique — M2 IWOCS, Université Le Havre Normandie",
          url: "https://www-apps.univ-lehavre.fr/forge/ai223266/webservices_immoservice",
        },
        description: [
          "API REST du domaine immobilier : annonces, questions/réponses, comptes.",
          "",
          "- **Lecture publique** : les annonces publiées sont accessibles sans authentification.",
          "- **Écriture protégée** : JWT obligatoire (`Authorization: Bearer <jeton>`), obtenu via `POST /auth/login`.",
          "- **Erreurs** : toujours de la forme `{ error: { code, message, details } }`, avec un `code` stable.",
          "- **404 plutôt que 403** sur une ressource d'un autre utilisateur : on ne révèle pas son existence.",
        ].join("\n"),
      },
      servers: [{ url: "http://localhost:3000", description: "Développement" }],
      tags: [
        { name: "auth", description: "Inscription, connexion (JWT) et profil" },
        { name: "annonces", description: "Consultation publique et gestion des annonces par les agents" },
        { name: "questions", description: "Questions des utilisateurs et réponses des agents propriétaires" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Jeton obtenu via POST /auth/login",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
    // Publie les schémas nommés (.meta({ id })) dans components/schemas et les référence par $ref
    transformObject: transformerSpec,
  });
  await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

  app.get("/health", { schema: { hide: true } }, async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  });

  await app.register(authRoutes);
  await app.register(annoncesRoutes);
  await app.register(questionsRoutes);

  return app;
}
