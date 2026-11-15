import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL manquante : copiez .env.example vers .env");
}

// Prisma 7 : c'est nous qui fournissons la connexion, via l'adaptateur pg.
// Chaque requête SQL émet un événement "query" 
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: [{ emit: "event", level: "query" }],
});

let nombreRequetesSql = 0;
prisma.$on("query", () => {
  nombreRequetesSql++;
});

/** Compteur des requêtes SQL envoyées par Prisma */
export const compteurSql = {
  lire: () => nombreRequetesSql,
  reinitialiser: () => {
    nombreRequetesSql = 0;
  },
};
