import { z } from "zod";

/**
 * Inscription : seulement name, email, password.
 * Zod SUPPRIME les champs inconnus : un "role": "ADMIN" envoyé par le client
 * disparaît avant d'atteindre le code. Le rôle est fixé côté serveur (USER).
 */
export const InscriptionBody = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().toLowerCase(),
  password: z.string().min(8).max(100),
});

export const ConnexionBody = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});

/** Profil renvoyé au client : liste blanche, passwordHash n'y figure pas */
export const ProfilSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["USER", "AGENT", "ADMIN"]),
  createdAt: z.date(),
});

export const JetonSchema = z.object({
  token: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.string(),
});
