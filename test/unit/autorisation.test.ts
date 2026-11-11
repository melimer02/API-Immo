/**
 * Tests unitaires de la politique d'autorisation.
 * Fonctions pures : aucun serveur, aucune base, quelques millisecondes.
 */
import { describe, expect, it } from "vitest";
import {
  filtreProprietaire,
  filtreVisibilite,
  peutGererAnnonces,
  type Utilisateur,
} from "../../src/regles/autorisation.js";

const agentValide: Utilisateur = { id: "agent-1", role: "AGENT", statutPro: "VALIDE" };
const agentEnAttente: Utilisateur = { id: "agent-3", role: "AGENT", statutPro: "EN_ATTENTE" };
const agentRefuse: Utilisateur = { id: "agent-4", role: "AGENT", statutPro: "REFUSE" };
const admin: Utilisateur = { id: "admin", role: "ADMIN", statutPro: "AUCUN" };
const user: Utilisateur = { id: "user-1", role: "USER", statutPro: "AUCUN" };

describe("peutGererAnnonces", () => {
  it("autorise un agent validé et un admin", () => {
    expect(peutGererAnnonces(agentValide)).toBe(true);
    expect(peutGererAnnonces(admin)).toBe(true);
  });

  it("refuse un USER et un agent non validé (en attente ou refusé)", () => {
    expect(peutGererAnnonces(user)).toBe(false);
    expect(peutGererAnnonces(agentEnAttente)).toBe(false);
    expect(peutGererAnnonces(agentRefuse)).toBe(false);
  });
});

describe("filtreProprietaire", () => {
  it("restreint un agent à ses propres annonces", () => {
    expect(filtreProprietaire(agentValide)).toEqual({ auteurId: "agent-1" });
  });

  it("ne restreint pas un admin", () => {
    expect(filtreProprietaire(admin)).toEqual({});
  });

  it("refuse un utilisateur sans identifiant (un filtre undefined serait ignoré par Prisma)", () => {
    expect(() => filtreProprietaire({ ...agentValide, id: "" })).toThrow();
  });
});

describe("filtreVisibilite", () => {
  it("anonyme et USER : seulement les annonces publiées", () => {
    expect(filtreVisibilite(null)).toEqual({ statutPublication: "PUBLIEE" });
    expect(filtreVisibilite(user)).toEqual({ statutPublication: "PUBLIEE" });
  });

  it("AGENT : les publiées et ses propres brouillons", () => {
    expect(filtreVisibilite(agentValide)).toEqual({
      OR: [{ statutPublication: "PUBLIEE" }, { auteurId: "agent-1" }],
    });
  });

  it("ADMIN : tout", () => {
    expect(filtreVisibilite(admin)).toEqual({});
  });
});
