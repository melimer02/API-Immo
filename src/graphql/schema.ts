/**
 * Schéma GraphQL (SDL) : c'est le CONTRAT de l'API GraphQL.
 * Il est obligatoire et intégré : tout ce qui n'y figure pas ne peut pas être demandé.
 *
 * Rappel sur "!" :
 *   [Annonce!]!  la liste existe toujours et ne contient jamais null
 *   Annonce      (sans !) peut être null : un id inconnu renvoie null, ce n'est pas une erreur
 */
export const schema = /* GraphQL */ `
  "Date et heure au format ISO 8601 (ex. 2026-12-01T00:00:00.000Z)"
  scalar DateTime

  enum TypeBien {
    VENTE
    LOCATION
  }

  enum StatutPublication {
    BROUILLON
    PUBLIEE
  }

  enum StatutBien {
    DISPONIBLE
    LOUE
    VENDU
  }

  "Auteur visible publiquement : ni email ni mot de passe"
  type Auteur {
    id: ID!
    name: String!
  }

  type Photo {
    id: ID!
    url: String!
    alt: String!
  }

  type Reponse {
    id: ID!
    contenu: String!
    createdAt: DateTime!
    auteur: Auteur!
  }

  type Question {
    id: ID!
    contenu: String!
    createdAt: DateTime!
    auteur: Auteur!
    "null tant que l'agent n'a pas répondu"
    reponse: Reponse
  }

  type Annonce {
    id: ID!
    titre: String!
    description: String!
    typeBien: TypeBien!
    statutPublication: StatutPublication!
    statutBien: StatutBien!
    prix: Float!
    surface: Int
    ville: String!
    dateDisponibilite: DateTime!
    createdAt: DateTime!
    updatedAt: DateTime!
    "Chargé par un DataLoader : une seule requête SQL pour tous les auteurs d'une page"
    auteur: Auteur!
    photos: [Photo!]!
    questions: [Question!]!
  }

  type MetaPagination {
    page: Int!
    limit: Int!
    total: Int!
    pages: Int!
  }

  type PageAnnonces {
    data: [Annonce!]!
    meta: MetaPagination!
  }

  # ── Entrées ────────────────────────────────────────────────────────

  input FiltreAnnonces {
    "Ville exacte, insensible à la casse"
    ville: String
    type: TypeBien
    prixMax: Float
  }

  input PhotoInput {
    url: String!
    alt: String!
  }

  "Une annonce est toujours créée en BROUILLON, avec l'utilisateur connecté comme auteur"
  input CreerAnnonceInput {
    titre: String!
    description: String!
    typeBien: TypeBien!
    prix: Float!
    surface: Int
    ville: String!
    "Format AAAA-MM-JJ (ex. 2026-12-01)"
    dateDisponibilite: String!
    photos: [PhotoInput!]
  }

  "Modification partielle : seuls les champs fournis changent (au moins un)"
  input ModifierAnnonceInput {
    titre: String
    description: String
    typeBien: TypeBien
    prix: Float
    surface: Int
    ville: String
    "Format AAAA-MM-JJ"
    dateDisponibilite: String
    statutBien: StatutBien
  }

  input QuestionInput {
    contenu: String!
  }

  input ReponseInput {
    contenu: String!
  }

  # ── Résultats des mutations ────────────────────────────────────────
  # Une erreur de validation fait partie du résultat normal : elle est renvoyée
  # dans "erreurs", pas dans les erreurs techniques de GraphQL.

  "Erreur de validation sur un champ"
  type ErreurChamp {
    champ: String!
    message: String!
  }

  type ResultatAnnonce {
    "null si erreurs n'est pas vide"
    annonce: Annonce
    erreurs: [ErreurChamp!]!
  }

  type ResultatQuestion {
    question: Question
    erreurs: [ErreurChamp!]!
  }

  type ResultatReponse {
    reponse: Reponse
    erreurs: [ErreurChamp!]!
  }

  # ── Opérations ─────────────────────────────────────────────────────

  type Query {
    "Annonces publiées, paginées et filtrables. limit est plafonné à 100 par le serveur."
    annonces(page: Int = 1, limit: Int = 20, filtre: FiltreAnnonces): PageAnnonces!
    "Détail d'une annonce. null si elle n'existe pas ou si c'est un brouillon non visible par l'appelant."
    annonce(id: ID!): Annonce
    "Annonces de l'agent connecté, brouillons compris"
    mesAnnonces(page: Int = 1, limit: Int = 20): PageAnnonces!
  }

  type Mutation {
    creerAnnonce(input: CreerAnnonceInput!): ResultatAnnonce!
    modifierAnnonce(id: ID!, input: ModifierAnnonceInput!): ResultatAnnonce!
    "true si l'annonce a été supprimée"
    supprimerAnnonce(id: ID!): Boolean!
    publierAnnonce(id: ID!): Annonce!
    depublierAnnonce(id: ID!): Annonce!
    poserQuestion(annonceId: ID!, input: QuestionInput!): ResultatQuestion!
    repondreQuestion(questionId: ID!, input: ReponseInput!): ResultatReponse!
  }
`;
