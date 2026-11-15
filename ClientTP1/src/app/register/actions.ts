"use server"

import { redirect } from "next/navigation"
import { InscriptionInput } from "@/lib/schemas"
import { erreursDe, valeursDuFormulaire, type EtatFormulaire } from "@/lib/form"
import { authApi } from "@/lib/api-client" // Ton client centralisé
import { ResponseError } from "@/sdk"

export async function inscrire(
  _etat: EtatFormulaire,
  formData: FormData
): Promise<EtatFormulaire> {
  // On garde les valeurs pour réafficher le formulaire en cas d'erreur (sauf le mot de passe)
  const valeurs = valeursDuFormulaire(formData, ["password"])

  // Validation Zod côté Front
  const parsed = InscriptionInput.safeParse(valeursDuFormulaire(formData))
  if (!parsed.success) return { erreurs: erreursDe(parsed.error), valeurs }

  try {
    // Appel au SDK : Création du compte via l'API (qui forcera le rôle à USER)
    await authApi.inscrire({
      inscriptionInput: parsed.data
    })
  } catch (error: unknown) {
    // Si l'API renvoie une erreur (ex: 409 EMAIL_ALREADY_USED)
    if (error instanceof ResponseError) {
      if (error.response.status === 409) {
        return {
          erreurs: { email: ["Un compte existe déjà avec cette adresse email"] },
          valeurs,
        }
      }
    }
    // Pour toute autre erreur non gérée
    return { message: "Inscription impossible pour le moment, réessayez.", valeurs }
  }

  // Attention : L'API de création de compte ne connecte pas l'utilisateur (elle ne renvoie pas de JWT).
  // On le redirige donc logiquement vers la page de connexion !
  redirect("/login")
}