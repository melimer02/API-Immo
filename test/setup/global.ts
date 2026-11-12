/**
 * Exécuté UNE fois avant toute la suite :
 * 1. vérifie DATABASE_URL_TEST (sinon arrêt) ;
 * 2. applique les migrations sur la base de test ;
 * 3. vide la base de test puis la remplit avec le seed (état connu et identique à chaque lancement).
 */
import { execSync } from "node:child_process";
import { utiliserBaseDeTest } from "./base-de-test.js";

export default async function setup() {
  utiliserBaseDeTest();
  const env = { ...process.env };

  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });

  const { prisma } = await import("../../src/lib/prisma.js");
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Reponse", "Question", "Favori", "Photo", "Annonce", "user", "limite_debit" RESTART IDENTITY CASCADE',
  );
  await prisma.$disconnect();

  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
}
