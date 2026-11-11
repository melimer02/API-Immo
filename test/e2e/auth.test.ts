/** E2E : inscription, connexion, profil — via le SDK généré. */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { clients, connexion, demarrerServeur, echec, MOT_DE_PASSE } from "../helpers.js";

let app: FastifyInstance;
let base: string;

beforeAll(async () => {
  ({ app, base } = await demarrerServeur());
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe("POST /auth/login", () => {
  it("renvoie un JWT contenant l'identifiant, le rôle et l'expiration", async () => {
    const jeton = await connexion(base, "agent1@immo.fr");
    const charge = JSON.parse(Buffer.from(jeton.split(".")[1]!, "base64url").toString());
    expect(charge).toMatchObject({ role: "AGENT", statutPro: "VALIDE" });
    expect(typeof charge.sub).toBe("string");
    expect(charge.exp).toBeGreaterThan(charge.iat);
    expect(charge).not.toHaveProperty("passwordHash");
  });

  it("401 INVALID_CREDENTIALS si le mot de passe est faux", async () => {
    const r = await echec(
      clients(base).auth.connecter({ connexionInput: { email: "agent1@immo.fr", password: "mauvais" } }),
    );
    expect(r).toMatchObject({ statut: 401, code: "INVALID_CREDENTIALS" });
  });

  it("401 avec le même code si l'email n'existe pas", async () => {
    const r = await echec(
      clients(base).auth.connecter({ connexionInput: { email: "inconnu@immo.fr", password: MOT_DE_PASSE } }),
    );
    expect(r).toMatchObject({ statut: 401, code: "INVALID_CREDENTIALS" });
  });
});

describe("GET /me", () => {
  it("200 avec le profil, sans passwordHash", async () => {
    const jeton = await connexion(base, "user1@immo.fr");
    const moi = await clients(base, jeton).auth.monProfil();
    expect(moi).toMatchObject({ email: "user1@immo.fr", role: "USER" });
    expect(moi).not.toHaveProperty("passwordHash");
  });

  it("401 sans jeton", async () => {
    const r = await echec(clients(base).auth.monProfil());
    expect(r).toMatchObject({ statut: 401, code: "UNAUTHENTICATED" });
  });

  it("401 avec un jeton falsifié", async () => {
    const r = await echec(clients(base, "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.faux").auth.monProfil());
    expect(r).toMatchObject({ statut: 401, code: "UNAUTHENTICATED" });
  });
});

describe("POST /auth/register", () => {
  it("201 et le compte créé est toujours USER, même si le client envoie role=ADMIN", async () => {
    // Appel direct (fetch) : le SDK, fidèle au contrat, ne permet même pas d'envoyer "role"
    const r = await fetch(`${base}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Pirate", email: "pirate@test.fr", password: MOT_DE_PASSE, role: "ADMIN" }),
    });
    expect(r.status).toBe(201);
    expect((await r.json()).role).toBe("USER");

    // Vérification en base : aucun ADMIN de plus
    const enBase = await prisma.user.findUnique({ where: { email: "pirate@test.fr" }, select: { role: true } });
    expect(enBase?.role).toBe("USER");
  });

  it("409 EMAIL_ALREADY_USED si l'email existe déjà", async () => {
    const r = await echec(
      clients(base).auth.inscrire({
        inscriptionInput: { name: "Doublon", email: "user1@immo.fr", password: MOT_DE_PASSE },
      }),
    );
    expect(r).toMatchObject({ statut: 409, code: "EMAIL_ALREADY_USED" });
  });

  it("400 VALIDATION_FAILED avec un détail par champ", async () => {
    const r = await echec(
      clients(base).auth.inscrire({ inscriptionInput: { name: "A", email: "pas-un-email", password: "court" } }),
    );
    expect(r.statut).toBe(400);
    expect(r.code).toBe("VALIDATION_FAILED");
    expect(r.details.map((d) => d.field)).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });
});
