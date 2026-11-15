import Link from "next/link"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { User, AlertCircle } from "lucide-react"

import { Configuration, AuthApi, AnnoncesApi, ResponseError, Annonce } from "@/sdk"
import { CompteInput } from "@/lib/schemas"
import { CarteAnnonce } from "@/components/annonces/carte-annonce"
import { EtatVide } from "@/components/ui/etat-vide"

export const metadata = { title: "Espace Agent" }

export default async function CompteAgentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { page, vue } = CompteInput.parse(await searchParams)
  const brouillons = vue === "brouillons"

  const cookieStore = await cookies()
  const token = cookieStore.get("jwt")?.value
  if (!token) redirect("/login")

  const apiConfig = new Configuration({
    basePath: "http://localhost:3000",
    accessToken: token,
  })

  const authApi = new AuthApi(apiConfig)
  const annoncesApi = new AnnoncesApi(apiConfig)

  // 1. Récupération du profil STRICT
  let compte
  try {
    compte = await authApi.monProfil()
  } catch (e) {
    redirect("/login")
  }

  if (compte.role !== "AGENT") {
    redirect("/annonces")
  }

  // 2. Récupération des annonces et déduction du statut via le code HTTP
  let annonces: Annonce[] = []
  let totalPages = 1
  let agentEnAttente = false

  try {
    const response = await annoncesApi.mesAnnonces({
      page,
      limit: 12,
    })
    
    const toutesMesAnnonces = response.data || []
    annonces = toutesMesAnnonces.filter((a) => 
      brouillons ? a.statutPublication === "BROUILLON" : a.statutPublication === "PUBLIEE"
    )
    totalPages = response.meta.pages
  } catch (error) {
    if (error instanceof ResponseError && error.response.status === 403) {
      // Si l'API nous bloque avec une 403, c'est que l'agent est en attente ou refusé !
      agentEnAttente = true
    } else {
      console.error(error)
    }
  }

  const lien = (p: number) => {
    const params = new URLSearchParams()
    if (brouillons) params.set("vue", "brouillons")
    if (p > 1) params.set("page", String(p))
    const qs = params.toString()
    return qs ? `/compte/agent?${qs}` : "/compte/agent"
  }

  const onglets = [
    { libelle: "Mes annonces publiées", href: "/compte/agent", actif: !brouillons },
    { libelle: "Mes brouillons", href: "/compte/agent?vue=brouillons", actif: brouillons },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      
      {/* L'alerte s'affiche automatiquement grâce au retour 403 de l'API */}
      {agentEnAttente && (
        <div className="mb-8 flex items-start gap-4 rounded-xl border border-orange-200 bg-orange-50 p-6 text-orange-800">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">Votre compte est en cours de validation</h2>
            <p className="mt-1 text-sm">
              Un administrateur doit valider votre profil avant que vous ne puissiez commencer à créer et publier des annonces. 
            </p>
          </div>
        </div>
      )}

      <section className="mb-8 flex flex-col items-center gap-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <User className="h-8 w-8" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl font-extrabold text-gray-900">{compte.name}</h1>
          <p className="text-gray-600">{compte.email}</p>
        </div>
      </section>

      {!agentEnAttente && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Filtrer mes annonces" className="flex flex-wrap gap-2">
            {onglets.map((o) => (
              <Link
                key={o.libelle}
                href={o.href}
                aria-current={o.actif ? "true" : undefined}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  o.actif
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 bg-white text-gray-800 hover:border-blue-600 hover:text-blue-600"
                }`}
              >
                {o.libelle}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {annonces.length === 0 ? (
        <EtatVide
          titre={
            agentEnAttente 
              ? "Votre compte doit être validé pour gérer des annonces"
              : brouillons
                ? "Vous n'avez aucun brouillon"
                : "Vous n'avez pas encore d'annonce publiée"
          }
          action={
            !agentEnAttente 
              ? { href: "/annonces/new", libelle: "Créer ma première annonce" }
              : undefined
          }
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {annonces.map((a) => (
            <li key={a.id}>
              <CarteAnnonce annonce={a} userRole={compte.role} peutEditer={true} />
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}