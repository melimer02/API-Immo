import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { Configuration, AuthApi } from "@/sdk"
import { creerAnnonce } from "../actions"
import { FormAnnonce } from "@/components/annonces/form-annonce"
import { LienRetour } from "@/components/ui/lien-retour"

export default async function NouvelleAnnoncePage() {
  // 1. Récupération du JWT
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt")?.value

  if (!token) {
    redirect("/login")
  }

  // 2. Vérification des droits via l'API
  try {
    const apiConfig = new Configuration({
      basePath: "http://localhost:3000",
      accessToken: token
    })
    const authApi = new AuthApi(apiConfig)
    
    // Appel à GET /me
    const profil = await authApi.monProfil()
    
    // Seul un ADMIN ou un AGENT validé peut créer une annonce
const peutGerer = profil.role === "ADMIN" || profil.role === "AGENT"
    
    if (!peutGerer) {
      redirect("/annonces") // Ou page 403
    }
  } catch (error) {
    // Si le jeton est expiré ou invalide (l'API renvoie 401)
    redirect("/login")
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <LienRetour href="/annonces">Retour aux annonces</LienRetour>
      <h1 className="text-3xl font-extrabold text-gray-900">Nouvelle annonce</h1>
      <p className="mb-6 mt-1 text-gray-600">
        L&apos;annonce est créée en brouillon. Vous pourrez la publier depuis sa page de détail.
      </p>
      <FormAnnonce action={creerAnnonce} bouton="Créer l'annonce" />
    </div>
  )
}