import { Configuration, AnnoncesApi, AuthApi, QuestionsApi } from "../sdk";

const BASE_PATH = "http://localhost:3000";

// 1. Configuration publique par défaut 
const publicConfig = new Configuration({ basePath: BASE_PATH });

// 2. Instances publiques 
export const api = new AnnoncesApi(publicConfig);
export const authApi = new AuthApi(publicConfig);
export const questionsApi = new QuestionsApi(publicConfig);

//  Crée les instances avec le token pour les requêtes privées
export function getApi(token?: string) {
  // Si pas de token, on renvoie les instances publiques par défaut
  if (!token) {
    return { api, authApi, questionsApi };
  }

  // Si on a un token, on crée une config spécifique avec l'accessToken
  const authConfig = new Configuration({
    basePath: BASE_PATH,
    accessToken: token, 
  });

  return {
    api: new AnnoncesApi(authConfig),
    authApi: new AuthApi(authConfig),
    questionsApi: new QuestionsApi(authConfig),
  };
}