import Link from "next/link"
// 1. On importe le type officiel généré par OpenAPI
import type { Annonce } from "@/sdk" 
import {
  CLASSE_STATUT_BIEN,
  LIBELLE_STATUT_BIEN,
  LIBELLE_TYPE,
  formatPrix,
} from "@/lib/affichage"

type Props = {
  // 2. On utilise le type strict du SDK au lieu de l'écrire à la main !
  annonce: Annonce 
  userRole?: string
  peutEditer?: boolean
}

export function CarteAnnonce({ annonce, userRole, peutEditer = false }: Props) {
  const photo = annonce.photos?.[0]

  return (
    <article className="carte relative flex h-full flex-col overflow-hidden transition hover:border-primary hover:shadow-md has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
      
      <Link href={`/annonces/${annonce.id}`} className="group flex flex-1 flex-col outline-none z-0">
        <div className="relative overflow-hidden bg-gray-100">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo.url}
              alt={photo.alt || ""}
              loading="lazy"
              className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center text-sm font-medium text-gray-600">
              Pas de photo
            </div>
          )}

          {/* Badges */}
          <span className="badge absolute left-2 top-2 bg-white text-gray-900 shadow-sm z-10">
            {LIBELLE_TYPE[annonce.typeBien as keyof typeof LIBELLE_TYPE] ?? annonce.typeBien}
          </span>
          {annonce.statutPublication === "BROUILLON" && (
            <span className="badge absolute right-2 top-2 bg-orange-50 text-orange-800 shadow-sm z-10">
              Brouillon
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h2 className="line-clamp-1 text-lg font-bold text-gray-900 group-hover:text-primary pr-8">
            {annonce.titre}
          </h2>
          
          {annonce.ville && (
            <p className="flex items-center gap-1 text-sm text-gray-600">
              <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {annonce.ville}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="text-lg font-extrabold text-primary">
              {formatPrix(annonce.prix, annonce.typeBien)}
            </span>
            <span className={`badge ${CLASSE_STATUT_BIEN[annonce.statutBien as keyof typeof CLASSE_STATUT_BIEN] ?? "bg-gray-100 text-gray-700"}`}>
              {LIBELLE_STATUT_BIEN[annonce.statutBien as keyof typeof LIBELLE_STATUT_BIEN] ?? annonce.statutBien}
            </span>
          </div>
        </div>
      </Link>

      {/* Section "Modifier", visible uniquement si on est l'agent ou admin */}
      {peutEditer && (
        <div className="border-t border-gray-100 bg-gray-50 p-3 z-10 relative">
          <Link href={`/annonces/${annonce.id}/edit`} className="btn btn-secondary w-full text-center block">
            Modifier l&apos;annonce
          </Link>
        </div>
      )}
    </article>
  )
}