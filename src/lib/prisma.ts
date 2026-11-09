import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL manquante : copiez .env.example vers .env");
}

// Prisma 7 : c'est nous qui fournissons la connexion, via l'adaptateur pg.
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
