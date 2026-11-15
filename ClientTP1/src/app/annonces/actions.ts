"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect, notFound } from "next/navigation"
import { cookies } from "next/headers"
import { AnnonceInput, annonceModificationInput, IdInput, QuestionInput, ReponseInput } from "@/lib/schemas"
import { erreursDe, valeursDuFormulaire, type EtatFormulaire } from "@/lib/form"
import { Configuration, AnnoncesApi, QuestionsApi, ResponseError } from "@/sdk"

// --- Utilitaire pour configurer l'API avec le jeton JWT ---
async function getApiConfig() {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt")?.value
  return new Configuration({
    basePath: "http://localhost:3000",
    ...(token && { accessToken: token }),
  })
}

// ------------------------------------------------------------------
// Création d'une annonce
// ------------------------------------------------------------------
export async function creerAnnonce(
  _etat: EtatFormulaire,
  formData: FormData
): Promise<EtatFormulaire> {
  const valeurs = valeursDuFormulaire(formData)
  
  const parsed = AnnonceInput.safeParse(valeurs)
  if (!parsed.success) return { erreurs: erreursDe(parsed.error), valeurs }

  const api = new AnnoncesApi(await getApiConfig())
  let annonce

  try {
    // Zod nous a extrait proprement photoUrl et photoAlt :
    const { statutBien, photoUrl, photoAlt, ...donneesApi } = parsed.data

    // On prépare les photos pour le SDK
    const photos = photoUrl ? [{ url: photoUrl, alt: photoAlt || "Photo de l'annonce" }] : undefined

    annonce = await api.creerAnnonce({
      creerAnnonceInput: {
        ...donneesApi,
        photos
      }
    })
  } catch (error: unknown) {
    if (error instanceof ResponseError) {
      if (error.response.status === 401) redirect("/login")
      if (error.response.status === 403) return { message: "Seul un agent validé peut créer une annonce.", valeurs }
    }
    return { message: "Erreur lors de la création de l'annonce.", valeurs }
  }

  revalidatePath("/annonces")
  redirect(`/annonces/${annonce.id}`)
}
// ------------------------------------------------------------------
// Modification : le propriétaire (ou un admin) uniquement
// ------------------------------------------------------------------
export async function modifierAnnonce(
  rawId: unknown,
  _etat: EtatFormulaire,
  formData: FormData
): Promise<EtatFormulaire> {
  const id = IdInput.safeParse(rawId)
  if (!id.success) notFound()

  const valeurs = valeursDuFormulaire(formData)
  
  // Remarque: L'API validera la date. On simplifie la validation Front.
  const parsed = annonceModificationInput(new Date().toISOString().slice(0, 10)).safeParse(valeurs)
  if (!parsed.success) return { erreurs: erreursDe(parsed.error), valeurs }

  const api = new AnnoncesApi(await getApiConfig())

  try {
    await api.modifierAnnonce({
      id: id.data,
      modifierAnnonceInput: parsed.data
    })
  } catch (error: unknown) {
    if (error instanceof ResponseError) {
      if (error.response.status === 401) redirect("/login")
      if (error.response.status === 404) notFound() // L'API renvoie 404 si l'annonce n'est pas à toi !
    }
    return { message: "Erreur lors de la modification.", valeurs }
  }

  revalidatePath("/annonces")
  revalidatePath(`/annonces/${id.data}`)
  redirect(`/annonces/${id.data}`)
}

// ------------------------------------------------------------------
// Publier / dépublier
// ------------------------------------------------------------------
export async function changerPublication(rawId: unknown, publier: unknown) {
  const id = IdInput.safeParse(rawId)
  const publie = z.boolean().safeParse(publier)
  if (!id.success || !publie.success) notFound()

  const api = new AnnoncesApi(await getApiConfig())

  try {
    if (publie.data) {
      await api.publierAnnonce({ id: id.data })
    } else {
      await api.depublierAnnonce({ id: id.data })
    }
  } catch (error: unknown) {
    if (error instanceof ResponseError && error.response.status === 404) {
      notFound() // L'annonce n'est pas à toi
    }
    throw error
  }

  revalidatePath("/annonces")
  revalidatePath(`/annonces/${id.data}`)
}

// ------------------------------------------------------------------
// Suppression
// ------------------------------------------------------------------
export async function supprimerAnnonce(rawId: unknown) {
  const id = IdInput.safeParse(rawId)
  if (!id.success) notFound()

  const api = new AnnoncesApi(await getApiConfig())

  try {
    await api.supprimerAnnonce({ id: id.data })
  } catch (error: unknown) {
    if (error instanceof ResponseError && error.response.status === 404) {
      notFound() // L'annonce n'existe pas ou n'est pas à toi
    }
    throw error
  }

  revalidatePath("/annonces")
  redirect("/annonces")
}

// ------------------------------------------------------------------
// Poser une question : tout utilisateur connecté
// ------------------------------------------------------------------
export async function poserQuestion(
  rawAnnonceId: unknown,
  _etat: EtatFormulaire,
  formData: FormData
): Promise<EtatFormulaire> {
  const annonceId = IdInput.safeParse(rawAnnonceId)
  if (!annonceId.success) notFound()

  const valeurs = valeursDuFormulaire(formData)
  const parsed = QuestionInput.safeParse(valeurs)
  if (!parsed.success) return { erreurs: erreursDe(parsed.error), valeurs }

  const api = new QuestionsApi(await getApiConfig())

  try {
    await api.poserQuestion({
      id: annonceId.data,
      nouvelleQuestionInput: { contenu: parsed.data.contenu }
    })
  } catch (error: unknown) {
    if (error instanceof ResponseError) {
      if (error.response.status === 401) redirect("/login")
      if (error.response.status === 404) notFound() // Annonce inexistante ou en brouillon
    }
    return { message: "Impossible de poser la question.", valeurs }
  }

  revalidatePath(`/annonces/${annonceId.data}`)
  return {}
}

// ------------------------------------------------------------------
// Répondre à une question : l'agent propriétaire
// ------------------------------------------------------------------
export async function repondreQuestion(
  rawQuestionId: unknown,
  _etat: EtatFormulaire,
  formData: FormData
): Promise<EtatFormulaire> {
  const questionId = IdInput.safeParse(rawQuestionId)
  if (!questionId.success) notFound()

  const valeurs = valeursDuFormulaire(formData)
  const parsed = ReponseInput.safeParse(valeurs)
  if (!parsed.success) return { erreurs: erreursDe(parsed.error), valeurs }

  const api = new QuestionsApi(await getApiConfig())

  try {
    await api.repondreQuestion({
      id: questionId.data,
      nouvelleReponseInput: { contenu: parsed.data.reponse }
    })
  } catch (error: unknown) {
    if (error instanceof ResponseError) {
      if (error.response.status === 401) redirect("/login")
      if (error.response.status === 404) notFound() // Pas à toi
      if (error.response.status === 409) return { message: "Cette question a déjà une réponse.", valeurs }
    }
    return { message: "Impossible de répondre.", valeurs }
  }

  // Idéalement, il faudrait revalider la page de l'annonce, 
  // mais l'API de réponse ne renvoie pas l'ID de l'annonce.
  // Un revalidate générique ou via le front fera l'affaire.
  revalidatePath("/annonces/[id]", "page")
  return {}
}


