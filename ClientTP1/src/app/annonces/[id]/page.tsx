import Link from "next/link"
import { FormTexte } from "@/components/ui/form-texte"
import { poserQuestion } from "../actions" 
import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { Configuration, AnnoncesApi, AuthApi, ResponseError,Question } from "@/sdk"
import {
  CLASSE_STATUT_BIEN,
  LIBELLE_STATUT_BIEN,
  LIBELLE_TYPE,
  formatPrix,
} from "@/lib/affichage"
import { changerPublication, supprimerAnnonce,repondreQuestion } from "../actions" 
import { getApi } from "@/lib/api-client" 

// ----------------------------------------------------------------------
// 1. LE COMPOSANT QUI AFFICHE LES QUESTIONS 
// ----------------------------------------------------------------------
async function Questions({ annonceId, isOwner, token }: { annonceId: number; isOwner: boolean; token?: string }) {

  const { questionsApi } = getApi(token);

 let questions: Question[] = []

  try {
    // On récupère l'objet complet 
    const pageQuestions = await questionsApi.listerQuestions({ id: annonceId })
    

    questions = pageQuestions.data 
  } catch (error: unknown) {
    if (error instanceof ResponseError && error.response.status === 404) {
      return <div className="p-4 text-center text-gray-500">Aucune question </div>
    }
    return <p className="text-red-500">Erreur lors du chargement des questions.</p>
  }

  if (!questions || questions.length === 0) {
    return <div className="p-4 text-center text-gray-500">Aucune question pour </div>
  }

  return (
    <ul className="mt-4 space-y-4 max-h-[500px] overflow-y-auto pr-2">
      {questions.map((q) => (
        <li key={q.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <div aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">
              {q.auteur.name.charAt(0).toUpperCase()}
            </div>
            <p className="font-semibold text-gray-900">{q.auteur.name}</p>
          </div>
          <p className="ml-10 whitespace-pre-wrap break-words text-gray-700">{q.contenu}</p>

          <div className="ml-10 mt-3 border-l-2 border-teal-200 pl-4">
           {q.reponse ? (
              <div>
                <p className="mb-1 text-sm font-semibold text-teal-700">Réponse de l&apos;agent</p>
                <p className="whitespace-pre-wrap break-words text-gray-700">{q.reponse.contenu}</p>
              </div>
            ) : (
              <>
                <p className="mb-2 text-sm italic text-gray-600">En attente de réponse…</p>
               
                {isOwner && (
                  <FormTexte 
                    action={repondreQuestion.bind(null, q.id)} 
                    nom="reponse" 
                    bouton="Répondre" 
                    label="Votre réponse"
                    placeholder="Saisissez votre réponse ici..."
                  />
                )}
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

// ----------------------------------------------------------------------
// 2. LA PAGE PRINCIPALE DE L'ANNONCE
// ----------------------------------------------------------------------
export default async function AnnonceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
  const id = parseInt(resolvedParams.id, 10)
  
  if (isNaN(id)) notFound()

  // 1. Récupération du JWT
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt")?.value

  const { api, authApi } = getApi(token);

  // 2. Récupérer le profil utilisateur
  let user = null
  if (token) {
    try {
    
      user = await authApi.monProfil()
    } catch (e) {
      // Jeton invalide ou expiré
    }
  }

  // 3. Récupérer l'annonce
 
  let annonce

  try {
    annonce = await api.lireAnnonce({ id })
  } catch (error: unknown) {
    if (error instanceof ResponseError && error.response.status === 404) notFound()
    throw error 
  }

  const peutEditer = user?.role === "ADMIN" || (user?.role === "AGENT" && user.id === annonce.auteur.id)
  const photo = annonce.photos?.[0]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
  
      <div className="mb-6">
        <Link href="/annonces" className="text-sm font-medium text-gray-600 hover:text-blue-600">
          ← Retour aux annonces
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section Image */}
          <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200">
            <div className="relative aspect-video w-full bg-gray-100">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={photo.alt || annonce.titre} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-500">Aucune photo disponible</div>
              )}
              
              <div className="absolute left-4 top-4 flex gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-sm font-bold shadow-sm text-gray-900">
                  {LIBELLE_TYPE[annonce.typeBien as keyof typeof LIBELLE_TYPE] ?? annonce.typeBien}
                </span>
                {annonce.statutPublication === "BROUILLON" && (
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-800 shadow-sm">
                    Brouillon
                  </span>
                )}
              </div>
            </div>

            {/* Titre et Description */}
            <div className="p-6">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{annonce.titre}</h1>
              {annonce.ville && (
                <p className="text-lg text-gray-600 mb-6 flex items-center gap-1">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {annonce.ville}
                </p>
              )}
              
              <h3 className="text-lg font-bold text-gray-900 mb-2 border-b pb-2">Description</h3>
              <p className="whitespace-pre-line text-gray-700 leading-relaxed">{annonce.description}</p>
            </div>
          </article>

          {/* Section Questions */}
          <section id="questions" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">Questions & Réponses</h2>

            {peutEditer ? (
              <div className="mb-6 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
                Vous êtes le propriétaire. Vous pouvez répondre aux questions ci-dessous.
              </div>
            ) : user ? (
              <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
                <h3 className="mb-3 font-semibold text-gray-900">Une question sur ce bien ?</h3>
                <FormTexte
                  action={poserQuestion.bind(null, annonce.id)}
                  nom="contenu"
                  placeholder="Posez votre question à l'agent..."
                  bouton="Envoyer"
                  multiligne
                  label="Votre question"
                />
              </div>
            ) : (
              <p className="mb-6 text-gray-700">
                <Link href="/login" className="font-semibold text-blue-600 underline">Connectez-vous</Link> pour poser une question.
              </p>
            )}

            <Questions annonceId={annonce.id} isOwner={peutEditer} token={token} />
          </section>

        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            
            {/* Prix et Statut */}
            <div className="mb-6 text-center border-b pb-6">
              <p className="text-4xl font-extrabold text-blue-600 mb-3">{formatPrix(annonce.prix, annonce.typeBien)}</p>
              <span className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${CLASSE_STATUT_BIEN[annonce.statutBien as keyof typeof CLASSE_STATUT_BIEN] ?? "bg-gray-100"}`}>
                {LIBELLE_STATUT_BIEN[annonce.statutBien as keyof typeof LIBELLE_STATUT_BIEN] ?? annonce.statutBien}
              </span>
            </div>

            {/* Caractéristiques */}
            <dl className="space-y-4 mb-8">
              {annonce.surface && (
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <dt className="text-gray-500 font-medium">Surface</dt>
                  <dd className="text-gray-900 font-semibold">{annonce.surface} m²</dd>
                </div>
              )}
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <dt className="text-gray-500 font-medium">Disponibilité</dt>
                <dd className="text-gray-900 font-semibold">{new Date(annonce.dateDisponibilite).toLocaleDateString("fr-FR")}</dd>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <dt className="text-gray-500 font-medium">Agent</dt>
                <dd className="text-gray-900 font-semibold">{annonce.auteur.name}</dd>
              </div>
            </dl>

            {/* Actions Administratives (Si propriétaire) */}
            {peutEditer && (
              <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Gestion de l&apos;annonce</h4>
                <div className="space-y-3">
                  <Link href={`/annonces/${annonce.id}/edit`} className="block w-full rounded-lg border border-gray-300 bg-white py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100 transition">
                    Modifier l&apos;annonce
                  </Link>

                  <form action={changerPublication.bind(null, annonce.id, annonce.statutPublication === "BROUILLON")}>
                    <button type="submit" className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
                      {annonce.statutPublication === "BROUILLON" ? "Publier l'annonce" : "Dépublier"}
                    </button>
                  </form>
                  
                  <form action={supprimerAnnonce.bind(null, annonce.id)}>
                    <button type="submit" className="w-full rounded-lg bg-red-50 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition">
                      Supprimer l&apos;annonce
                    </button>
                  </form>
                </div>
              </div>
            )}
            
          </div>
        </div>
        
      </div>
    </div>
  )
}