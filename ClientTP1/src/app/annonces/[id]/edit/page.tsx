import { notFound, redirect } from "next/navigation"
import { cookies } from "next/headers"

import { Configuration, AuthApi, AnnoncesApi, ResponseError } from "@/sdk"
import { IdInput } from "@/lib/schemas"
import { modifierAnnonce } from "@/app/annonces/actions"
import { FormAnnonce } from "@/components/annonces/form-annonce"
import { LienRetour } from "@/components/ui/lien-retour"

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const id = IdInput.safeParse(rawId)
  if (!id.success) notFound()

  // 1. Récupération du JWT et configuration du SDK
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt")?.value

  if (!token) redirect("/login")

  const apiConfig = new Configuration({
    basePath: "http://localhost:3000",
    accessToken: token,
  })

  const authApi = new AuthApi(apiConfig)
  const annoncesApi = new AnnoncesApi(apiConfig)

  // 2. Vérification de l'utilisateur
  let compte
  try {
    compte = await authApi.monProfil()
  } catch (error) {
    redirect("/login")
  }

  // 3. Récupération de l'annonce via l'API
  let annonce
  try {
    annonce = await annoncesApi.lireAnnonce({ id: id.data })
  } catch (error) {
    if (error instanceof ResponseError && error.response.status === 404) notFound()
    throw error
  }

  // 4. Vérification des droits (Seul le propriétaire ou un ADMIN peut modifier)
  const peutEditer = compte.role === "ADMIN" || (compte.role === "AGENT" && compte.id === annonce.auteur.id)
  if (!peutEditer) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <LienRetour href={`/annonces/${annonce.id}`}>Retour à l&apos;annonce</LienRetour>
      <h1 className="mb-6 text-3xl font-extrabold text-gray-900">Modifier l&apos;annonce</h1>

      {/* Le formulaire occupe maintenant toute la largeur puisqu'on n'a plus la gestion des photos locales */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <FormAnnonce
          action={modifierAnnonce.bind(null, annonce.id)}
          bouton="Enregistrer les modifications"
          avecStatutBien
          valeursInitiales={{
            titre: annonce.titre,
            description: annonce.description,
            prix: String(annonce.prix),
            // Le SDK convertit souvent les dates en objet Date, on sécurise l'affichage pour l'input type="date"
            dateDisponibilite: new Date(annonce.dateDisponibilite).toISOString().slice(0, 10),
            typeBien: annonce.typeBien,
            statutBien: annonce.statutBien,
            ville: annonce.ville ?? "",
          }}
        />
      </div>
    </div>
  )
}