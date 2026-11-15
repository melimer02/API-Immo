"use client"

import { useActionState, useEffect, useId, useState, type KeyboardEvent } from "react"
import { Champ } from "@/components/ui/champ"
import { jourParis } from "@/lib/dates"
import type { EtatFormulaire } from "@/lib/form"

type Valeurs = Partial<
  Record<"titre" | "description" | "prix" | "dateDisponibilite" | "typeBien" | "statutBien" | "ville", string>
>

type Props = {
  action: (etat: EtatFormulaire, formData: FormData) => Promise<EtatFormulaire>
  bouton: string
  valeursInitiales?: Valeurs
  avecStatutBien?: boolean
}

type Commune = { code: string; nom: string; codesPostaux?: string[] }

export function FormAnnonce({
  action,
  bouton,
  valeursInitiales,
  avecStatutBien = false,
}: Props) {
  const [etat, formAction, enCours] = useActionState(action, {} as EtatFormulaire)

  const e = etat.erreurs ?? {}
  const v: Valeurs = { ...valeursInitiales, ...etat.valeurs }

  // ── Autocomplétion de la ville (inchangée, parfaite pour le front) ──
  const id = useId()
  const idChamp = `${id}-ville`
  const idListe = `${id}-liste`
  const idAide = `${id}-aide`
  const idErreur = `${id}-erreur`

  const [saisie, setSaisie] = useState(v.ville ?? "") 
  const [villeChoisie, setVilleChoisie] = useState(v.ville ?? "") 
  const [suggestions, setSuggestions] = useState<Commune[]>([])
  const [actif, setActif] = useState(-1) 
  const [apiIndisponible, setApiIndisponible] = useState(false)
  const [statut, setStatut] = useState("") 

  useEffect(() => {
    if (saisie.length < 2 || saisie === villeChoisie) return

    const controleur = new AbortController() 
    const minuteur = setTimeout(async () => {
      try {
        const url =
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(saisie)}` +
          `&fields=nom,code,codesPostaux&boost=population&limit=5`
        const reponse = await fetch(url, { signal: controleur.signal })
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
        const communes: Commune[] = await reponse.json()
        setSuggestions(communes)
        setActif(-1)
        setApiIndisponible(false)
        setStatut(communes.length > 0 ? `${communes.length} suggestion(s) disponible(s)` : "Aucune ville trouvée")
      } catch {
        if (controleur.signal.aborted) return
        setApiIndisponible(true)
        setSuggestions([])
      }
    }, 250)

    return () => {
      clearTimeout(minuteur)
      controleur.abort()
    }
  }, [saisie, villeChoisie])

  function changerSaisie(valeur: string) {
    setSaisie(valeur)
    setActif(-1)
    setVilleChoisie(apiIndisponible ? valeur.trim() : "")
    if (valeur.length < 2) {
      setSuggestions([])
      setStatut("")
    }
  }

  function choisir(commune: Commune) {
    setVilleChoisie(commune.nom)
    setSaisie(commune.nom)
    setSuggestions([])
    setActif(-1)
    setStatut(`${commune.nom} sélectionnée`)
  }

  function toucheClavier(ev: KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return
    if (ev.key === "ArrowDown") {
      ev.preventDefault()
      setActif((i) => (i + 1) % suggestions.length)
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault()
      setActif((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (ev.key === "Enter" && actif >= 0) {
      ev.preventDefault() 
      choisir(suggestions[actif])
    } else if (ev.key === "Escape") {
      setSuggestions([])
      setActif(-1)
    }
  }

  return (
    // Plus de layout en grille complexe pour les photos : juste le formulaire simple.
    <form action={formAction} noValidate className="space-y-5">
      
      {/* Affichage des erreurs globales si l'API back-end renvoie une erreur inattendue */}
      {etat.message && (
        <div className="rounded-md bg-red-50 p-4 text-sm font-medium text-red-800">
          {etat.message}
        </div>
      )}

      <Champ label="Titre" erreurs={e.titre}>
        <input name="titre" defaultValue={v.titre} className="champ w-full" />
      </Champ>

      <Champ label="Description" erreurs={e.description}>
        <textarea name="description" rows={5} defaultValue={v.description} className="champ w-full" />
      </Champ>

      <fieldset className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <legend className="px-1 text-sm font-semibold text-gray-800">Localisation</legend>

        <label htmlFor={idChamp} className="text-sm font-medium">Ville</label>
        <div className="relative">
          <input
            id={idChamp}
            type="text"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls={idListe}
            aria-autocomplete="list"
            aria-activedescendant={actif >= 0 ? `${id}-option-${actif}` : undefined}
            aria-invalid={e.ville ? true : undefined}
            aria-describedby={e.ville ? `${idAide} ${idErreur}` : idAide}
            value={saisie}
            onChange={(ev) => changerSaisie(ev.target.value)}
            onKeyDown={toucheClavier}
            autoComplete="off"
            placeholder="Ex : Le Havre"
            className="champ w-full"
          />

          {suggestions.length > 0 && (
            <ul
              id={idListe}
              role="listbox"
              aria-label="Villes suggérées"
              className="absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
            >
              {suggestions.map((commune, i) => (
                <li
                  key={commune.code}
                  id={`${id}-option-${i}`}
                  role="option"
                  aria-selected={i === actif}
                  onClick={() => choisir(commune)}
                  className={`cursor-pointer px-3 py-2 ${
                    i === actif ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="font-medium">{commune.nom}</span>
                  {commune.codesPostaux?.[0] && (
                    <span className="ml-2 text-sm text-gray-600">{commune.codesPostaux[0]}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p id={idAide} className="text-sm text-gray-600">
          {apiIndisponible
            ? "Suggestions indisponibles : saisissez le nom de la ville."
            : "Tapez au moins 2 lettres, puis choisissez une ville dans la liste (flèches + Entrée au clavier)."}
        </p>

        {e.ville?.[0] && (
          <p id={idErreur} role="alert" className="text-sm text-red-700">
            {e.ville[0]}
          </p>
        )}

        <input type="hidden" name="ville" value={villeChoisie} />

        {villeChoisie && (
          <p className="rounded bg-green-50 px-2 py-1 text-sm text-green-800">
            ✓ Ville retenue : <strong>{villeChoisie}</strong>
          </p>
        )}

        <p role="status" className="sr-only">{statut}</p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Champ label="Prix (€)" erreurs={e.prix}>
          <input name="prix" type="number" step="any" defaultValue={v.prix} className="champ w-full" />
        </Champ>
        <Champ label="Date de disponibilité" erreurs={e.dateDisponibilite}>
          <input name="dateDisponibilite" type="date" min={jourParis()} defaultValue={v.dateDisponibilite} className="champ w-full" />
        </Champ>
      </div>

      <Champ label="Type de bien" erreurs={e.typeBien}>
        <select name="typeBien" defaultValue={v.typeBien ?? "VENTE"} className="champ w-full">
          <option value="VENTE">Vente</option>
          <option value="LOCATION">Location</option>
        </select>
      </Champ>

      {avecStatutBien && (
        <Champ label="Statut du bien" erreurs={e.statutBien}>
          <select name="statutBien" defaultValue={v.statutBien ?? "DISPONIBLE"} className="champ w-full">
            <option value="DISPONIBLE">Disponible</option>
            <option value="LOUE">Loué</option>
            <option value="VENDU">Vendu</option>
          </select>
        </Champ>
      )}
<fieldset className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <legend className="px-1 text-sm font-semibold text-gray-800">Photo principale (Optionnelle)</legend>
        
        <div>
          <label htmlFor="photoUrl" className="mb-1 block text-sm font-medium text-gray-700">Lien de l&apos;image (URL)</label>
          <input type="url" id="photoUrl" name="photoUrl" placeholder="https://..." className="champ w-full" />
        </div>
        <div>
          <label htmlFor="photoAlt" className="mb-1 block text-sm font-medium text-gray-700">Description de l&apos;image</label>
          <input type="text" id="photoAlt" name="photoAlt" placeholder="Ex: Vue dégagée sur le jardin" className="champ w-full" />
        </div>
      </fieldset>
      <div className="pt-4">
        <button
          type="submit"
          disabled={enCours}
          className="rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700 w-full md:w-auto"
        >
          {enCours ? "Enregistrement…" : bouton}
        </button>
      </div>
    </form>
  )
}