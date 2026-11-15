import Link from "next/link"
import { cookies } from "next/headers" // Pour lire le JWT
import { User, LogOut, Shield, Heart, Plus, Briefcase } from "lucide-react"

import { LIBELLE_ROLE } from "@/lib/affichage"
import { deconnecter } from "@/app/logout/actions"
// On importe Configuration et AuthApi depuis le SDK généré
import { Configuration, AuthApi } from "@/sdk" 

export async function Navbar() {
  // 1. On récupère le jeton JWT qu'on a sauvegardé lors du login
  const cookieStore = await cookies();
  const token = cookieStore.get("jwt")?.value;

  let user = null;

  // 2. Si un jeton existe, on demande le profil à l'API 
  if (token) {
    try {
      // 💡 Astuce : En passant "accessToken", le SDK va automatiquement 
      // ajouter l'en-tête "Authorization: Bearer <token>" à la requête !
      const authApi = new AuthApi(new Configuration({
        basePath: "http://localhost:3000",
        accessToken: token 
      }));
      
      // Appel de la route GET /me définie dans ton openapi.yaml
      user = await authApi.monProfil(); 
    } catch (e) {
      // Si le serveur renvoie 401 (jeton expiré/invalide), user reste null
    }
  }
  
  // 3. Règles d'autorisation simplifiées (basées sur les rôles de ton OpenAPI)
  const peutPublier = user?.role === "AGENT" || user?.role === "ADMIN"

  const lienTableauDeBord = 
   
    user?.role === "AGENT" ? "/compte/agent" : 
    "/compte/mon-compte" 

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <nav aria-label="Navigation principale" className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        
        {/* GAUCHE : Logo */}
        <Link href="/annonces" className="text-2xl font-extrabold tracking-tight text-primary hover:opacity-90">
          M&I Immo
        </Link>

        {/* DROITE : Actions & Espace Utilisateur */}
        <div className="flex items-center gap-5">
          
          {/* 1. Les Actions */}
          <div className="hidden sm:flex items-center gap-4">
       

        

            {peutPublier && (
              <Link href="/annonces/new" className="btn btn-primary flex items-center gap-1.5 py-2 text-sm shadow-sm hover:shadow-md">
                <Plus className="h-4 w-4" /> Créer une annonce
              </Link>
            )}
          </div>

          {/* Séparateur vertical visuel */}
          {user && <div className="hidden sm:block h-8 w-px bg-gray-200" aria-hidden="true" />}

          {/* 2. L'Espace Utilisateur */}
          {user ? (
            <div className="flex items-center gap-3">
              
        

              {/* Pilule de Profil */}
              <Link 
                href={lienTableauDeBord} 
                className="flex items-center gap-2.5 rounded-full border border-gray-200 bg-gray-50 py-1 pl-1 pr-4 transition-all hover:border-gray-300 hover:bg-gray-100"
              >  
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-inner">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold leading-none text-gray-900">{user.name}</span>
                  <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {/* On affiche directement le rôle (sans vérifier le statutPro qui n'existe plus) */}
                    {LIBELLE_ROLE[user.role as keyof typeof LIBELLE_ROLE] || user.role}
                  </span> 
                </div>
              </Link>

              {/* Bouton de déconnexion */}
              <form action={deconnecter}>
                <button type="submit" className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors" title="Se déconnecter">
                  <LogOut className="h-5 w-5" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-primary">
                Connexion
              </Link>
              <Link href="/register" className="btn btn-primary py-2 text-sm">
                Inscription
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  )
}