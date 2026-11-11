/**
 * Garde-fou commun : les tests ne tournent QUE sur la base de test.
 * Sans DATABASE_URL_TEST, la suite refuse de démarrer (sinon elle viderait la base de dev).
 */
import "dotenv/config";

export function urlBaseDeTest(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      "DATABASE_URL_TEST manquante : les tests refusent de démarrer pour ne pas toucher la base de développement. " +
        "Ajoutez-la dans .env (voir .env.example).",
    );
  }
  if (process.env.DATABASE_URL && url === process.env.DATABASE_URL && !process.env.IMMO_BASE_DE_TEST_ACTIVE) {
    throw new Error("DATABASE_URL_TEST est identique à DATABASE_URL : utilisez une base de test séparée.");
  }
  return url;
}

/** Redirige l'application (et Prisma) vers la base de test. À appeler AVANT d'importer src/. */
export function utiliserBaseDeTest() {
  process.env.DATABASE_URL = urlBaseDeTest();
  process.env.IMMO_BASE_DE_TEST_ACTIVE = "1";
}
