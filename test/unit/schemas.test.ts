/** Tests unitaires des schémas de validation Zod (sans serveur). */
import { describe, expect, it } from "vitest";
import { InscriptionBody } from "../../src/schemas/auth.js";
import { CreerAnnonceBody, ListeAnnoncesQuery, ModifierAnnonceBody } from "../../src/schemas/annonces.js";
import { IdParams } from "../../src/schemas/commun.js";
import { originesAutorisees } from "../../src/lib/cors.js";
const annonceValide = {
  titre: "Appartement lumineux",
  description: "Une description assez longue.",
  typeBien: "VENTE",
  prix: 150000,
  ville: "Le Havre",
  dateDisponibilite: "2026-12-01",
};

describe("InscriptionBody", () => {
  it("retire un champ role envoyé par le client (pas d'auto-promotion ADMIN)", () => {
    const r = InscriptionBody.parse({
      name: "Pirate",
      email: "PIRATE@Test.fr",
      password: "motdepasse123",
      role: "ADMIN",
    });
    expect(r).not.toHaveProperty("role");
    expect(r.email).toBe("pirate@test.fr"); // email normalisé en minuscules
  });

  it("refuse un mot de passe trop court et un email invalide", () => {
    const r = InscriptionBody.safeParse({ name: "Al", email: "pas-un-email", password: "court" });
    expect(r.success).toBe(false);
    const champs = r.error!.issues.map((i) => i.path.join("."));
    expect(champs).toEqual(expect.arrayContaining(["email", "password"]));
  });
});

describe("CreerAnnonceBody", () => {
  it("accepte une annonce valide et ignore statutPublication / auteurId", () => {
    const r = CreerAnnonceBody.parse({ ...annonceValide, statutPublication: "PUBLIEE", auteurId: "pirate" });
    expect(r).not.toHaveProperty("statutPublication");
    expect(r).not.toHaveProperty("auteurId");
    expect(r.dateDisponibilite).toBeInstanceOf(Date);
    expect(r.photos).toEqual([]); // valeur par défaut
  });

  it("refuse un prix négatif, un type inconnu et une date mal formée", () => {
    const r = CreerAnnonceBody.safeParse({
      ...annonceValide,
      prix: -1,
      typeBien: "MAISON",
      dateDisponibilite: "demain",
    });
    expect(r.success).toBe(false);
    const champs = r.error!.issues.map((i) => i.path.join("."));
    expect(champs).toEqual(expect.arrayContaining(["prix", "typeBien", "dateDisponibilite"]));
  });
});

describe("ModifierAnnonceBody", () => {
  it("accepte une modification partielle", () => {
    expect(ModifierAnnonceBody.safeParse({ prix: 120000 }).success).toBe(true);
  });

  it("refuse un corps vide", () => {
    expect(ModifierAnnonceBody.safeParse({}).success).toBe(false);
  });
});

describe("ListeAnnoncesQuery et IdParams", () => {
  it("applique les valeurs par défaut de pagination", () => {
    expect(ListeAnnoncesQuery.parse({})).toMatchObject({ page: 1, limit: 20 });
  });

  it("plafonne limit à 100", () => {
    expect(ListeAnnoncesQuery.safeParse({ limit: "999999" }).success).toBe(false);
  });

  it("refuse un id non numérique (400 au lieu d'un 500)", () => {
    expect(IdParams.safeParse({ id: "abc" }).success).toBe(false);
    expect(IdParams.parse({ id: "42" })).toEqual({ id: 42 });
  });
});

/// test CORS : la liste des origines autorisées
describe("originesAutorisees (CORS)", () => {
  it("lit une liste d'origines séparées par des virgules", () => {
    expect(originesAutorisees("http://a.fr, http://b.fr")).toEqual(["http://a.fr", "http://b.fr"]);
  });

  it("refuse *", () => {
    expect(() => originesAutorisees("*")).toThrow();
  });
});