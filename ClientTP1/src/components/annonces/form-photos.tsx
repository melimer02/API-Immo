"use client" // useActionState → composant client

import { useActionState } from "react"
import type { EtatFormulaire } from "@/lib/form"

type Props = {
  action: (etat: EtatFormulaire, formData: FormData) => Promise<EtatFormulaire>
}

export function FormPhotos({ action }: Props) {
  const [etat, formAction, enCours] = useActionState(action, {} as EtatFormulaire)

  return (
    <form action={formAction} noValidate className="flex max-w-lg flex-col gap-4">
      {/* Affichage d'un message d'erreur global si présent */}
      {etat?.message && (
        <p className="text-sm font-medium text-red-600">{etat.message}</p>
      )}

      <div>
        <label htmlFor="url" className="mb-1 block text-sm font-semibold text-gray-700">
          Lien de l&apos;image (URL)
        </label>
        <input
          type="url"
          id="url"
          name="url"
          required
          placeholder="https://..."
          defaultValue={etat?.valeurs?.url as string || ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {etat?.erreurs?.url && (
          <p className="mt-1 text-sm text-red-600">{etat.erreurs.url[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="alt" className="mb-1 block text-sm font-semibold text-gray-700">
          Texte alternatif (Description)
        </label>
        <input
          type="text"
          id="alt"
          name="alt"
          required
          placeholder="Ex: Vue dégagée sur le jardin"
          defaultValue={etat?.valeurs?.alt as string || ""}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {etat?.erreurs?.alt && (
          <p className="mt-1 text-sm text-red-600">{etat.erreurs.alt[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="btn btn-primary self-start"
      >
        {enCours ? "Ajout en cours…" : "Ajouter cette photo"}
      </button>
    </form>
  )
}