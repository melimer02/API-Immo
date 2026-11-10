import { z } from "zod";

/**
 * Inscription : seulement name, email, password.
 * Zod SUPPRIME les champs inconnus : un "role": "ADMIN" envoyé par le client
 * disparaît avant d'atteindre le code. Le rôle est fixé côté serveur (USER).
 */
export const InscriptionBody = z
  .object({
    name: z.string().trim().min(2).max(100).describe("Nom affiché"),
    email: z.email().toLowerCase().describe("Email (unique, sert d'identifiant de connexion)"),
    password: z.string().min(8).max(100).describe("Mot de passe (8 caractères minimum)"),
  })
  .meta({
    id: "Inscription",
    description: "Tout autre champ (role, statutPro…) est ignoré : un compte créé ici est toujours USER.",
    example: { name: "Marie Durand", email: "marie@exemple.fr", password: "motdepasse123" },
  });

export const ConnexionBody = z
  .object({
    email: z.email().toLowerCase(),
    password: z.string().min(1),
  })
  .meta({
    id: "Connexion",
    example: { email: "agent1@immo.fr", password: "motdepasse123" },
  });

/** Profil renvoyé au client : liste blanche, passwordHash n'y figure pas */
export const ProfilSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    role: z.enum(["USER", "AGENT", "ADMIN"]),
    createdAt: z.date(),
  })
  .meta({ id: "Profil", description: "Profil de l'utilisateur (jamais le mot de passe ni son hash)" });

export const JetonSchema = z
  .object({
    token: z.string().describe("JWT signé, à envoyer dans l'en-tête Authorization: Bearer <token>"),
    tokenType: z.literal("Bearer"),
    expiresIn: z.string().describe("Durée de validité (ex. 1h)"),
  })
  .meta({ id: "Jeton" });
