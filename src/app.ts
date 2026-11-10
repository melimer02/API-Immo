import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  jsonSchemaTransform,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { prisma } from "./lib/prisma.js";
import { enregistrerGestionErreurs } from "./lib/errors.js";
import { authRoutes } from "./routes/auth.js";
import { annoncesRoutes } from "./routes/annonces.js";
import { questionsRoutes } from "./routes/questions.js";


//une instance de l'appli 
export  async function buildApp() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET manquant ou trop court (32 caractères minimum)");
  }
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  // Zod valide les entrées et sérialise les sorties
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  enregistrerGestionErreurs(app);

  // Utilisateur courant : null tant qu'aucun hook d'authentification ne l'a rempli
  app.decorateRequest("utilisateur", null);

  await app.register(fastifyJwt, {
    secret,
    // Le jeton contient { sub, role } : on le transforme en { id, role } pour le reste du code
    formatUser: (payload) => ({ id: payload.sub, role: payload.role }),
  });

  // Documentation OpenAPI générée depuis les schémas Zod (code-first)
  await app.register(fastifySwagger, {
    openapi: {
      info: { title: "ImmoService API", version: "1.0.0" },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(fastifySwaggerUi, { routePrefix: "/docs" });


  //verification de la connexion entre l'api et la base .
  app.get("/health", { schema: { hide: true } }, async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  });

  await app.register(authRoutes);
  await app.register(annoncesRoutes);
  await app.register(questionsRoutes);

  return app;
}
