/* Politique d'autorisation  */

export type Role = "USER" | "AGENT" | "ADMIN";
export type Utilisateur = { id: string; role: Role };

/** Peut créer et gérer des annonces */
export function peutGererAnnonces(user: Utilisateur): boolean {
  return user.role === "AGENT" || user.role === "ADMIN";
}

/**
 * Restreint aux annonces dont l'utilisateur est propriétaire.
 * Un admin n'a aucune restriction ; un agent ne voit que les siennes.
 */
export function filtreProprietaire(user: Utilisateur): { auteurId?: string } {
  if (user.role === "ADMIN") return {};
  if (!user.id) throw new Error("filtreProprietaire : utilisateur sans identifiant");
  return { auteurId: user.id };
}

/**
 * anonyme ou USER : seulement les publiées 
 * AGENT : les publiées + ses propres brouillons 
 * ADMIN : tout
 */
export function filtreVisibilite(user: Utilisateur | null) {
  if (user?.role === "ADMIN") return {};
  if (user?.role === "AGENT") {
    return { OR: [{ statutPublication: "PUBLIEE" as const }, { auteurId: user.id }] };
  }
  return { statutPublication: "PUBLIEE" as const };
}
