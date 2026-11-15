"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { authApi } from "@/lib/api-client" 
import { ConnexionInput } from "@/lib/schemas"
import { erreursDe, valeursDuFormulaire, type EtatFormulaire } from "@/lib/form"

export async function connecter(
  _etat: EtatFormulaire,
  formData: FormData
): Promise<EtatFormulaire> {
  const valeurs = valeursDuFormulaire(formData, ["password"])

  const parsed = ConnexionInput.safeParse(valeursDuFormulaire(formData))
  if (!parsed.success) return { erreurs: erreursDe(parsed.error), valeurs }
try {
    const reponse = await authApi.connecter({
      connexionInput: parsed.data
    })

    // On ajoute un 'await' devant cookies() et on met des parenthèses
    const cookieStore = await cookies();
    
    cookieStore.set("jwt", reponse.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })

  } catch (e) {
    return { message: "Email ou mot de passe incorrect", valeurs }
  }

  redirect("/annonces")
}