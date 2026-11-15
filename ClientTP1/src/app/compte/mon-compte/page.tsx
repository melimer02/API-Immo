import Link from "next/link"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { Heart, Settings, User, Smile } from "lucide-react"

import { getApi } from "@/lib/api-client"

export const metadata = { title: "Mon compte · AgenceWeb" }

export default async function CompteParticulierPage() {

  const cookieStore = await cookies()
  const token = cookieStore.get("jwt")?.value

  if (!token) redirect("/login")

  const { authApi } = getApi(token)


  let compte
  try {
    compte = await authApi.monProfil()
  } catch (error) {
    redirect("/login")
  }


  if (compte.role === "AGENT") {
    redirect("/compte/agent")
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      
      {/* En-tête de bienvenue */}
      <header className="mb-8 rounded-2xl border border-slate-100 bg-slate-50 px-6 py-8">
        <h1 className="text-3xl font-extrabold text-gray-900">
          <Smile className="mr-2 inline h-6 w-6 text-blue-600" /> Bienvenue, {compte.name} !
        </h1>
        <p className="mt-2 text-gray-600">Bienvenue sur votre espace personnel.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-1">
        
        {/* Carte 1 : Profil */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="rounded-full bg-slate-100 p-2 text-slate-600">
              <User className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Mes informations</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            <p><span className="font-semibold text-gray-900">Nom :</span> {compte.name}</p>
            <p><span className="font-semibold text-gray-900">Email :</span> {compte.email}</p>
            <p><span className="font-semibold text-gray-900">Statut :</span> Particulier</p>
          </div>
          <div className="mt-6">
            <button className="inline-flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Settings className="mr-2 h-4 w-4" /> Paramètres du compte
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}