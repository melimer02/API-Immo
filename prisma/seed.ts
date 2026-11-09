import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

type Role = "USER" | "AGENT" | "ADMIN";
type StatutPro = "AUCUN" | "EN_ATTENTE" | "VALIDE";

const MOT_DE_PASSE = "motdepasse123";

// Crée le compte s'il n'existe pas (seed relançable sans doublon)
async function compte(email: string, name: string, role: Role = "USER", statutPro: StatutPro = "AUCUN") {
  const passwordHash = await bcrypt.hash(MOT_DE_PASSE, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, statutPro, passwordHash },
  });
}

// ── Données ──
const VILLES = [
  { nom: "Paris", m2: 10500, quartiers: ["Montmartre", "Bastille", "Batignolles", "Vincennes"] },
  { nom: "Bordeaux", m2: 4600, quartiers: ["Chartrons", "Saint-Pierre", "Caudéran"] },
  { nom: "Aix-en-Provence", m2: 5200, quartiers: ["Mazarin", "Jas de Bouffan", "centre historique"] },
  { nom: "Rouen", m2: 3100, quartiers: ["Saint-Marc", "Jouvenet", "rive gauche"] },
  { nom: "Caen", m2: 2800, quartiers: ["Vaucelles", "Saint-Gilles", "Université"] },
  { nom: "Le Havre", m2: 2400, quartiers: ["Perret", "Sainte-Adresse", "Saint-François"] },
  { nom: "Saint-Étienne", m2: 1300, quartiers: ["Jacquard", "Bellevue", "Châteaucreux"] },
  { nom: "L'Aigle", m2: 1500, quartiers: ["centre-ville", "gare", "route de Mortagne"] },
];

const BIENS = [
  { nom: "Maison", pieces: [4, 5, 6], surfaces: [95, 120, 150], coef: 1,
    photos: ["façade", "salon", "cuisine", "chambre", "salle de bain"],
    atouts: ["jardin clos de 400 m²", "garage double", "terrasse plein sud", "cheminée", "cave voûtée", "combles aménageables"] },
  { nom: "Appartement", pieces: [2, 3, 4], surfaces: [45, 68, 85], coef: 1,
    photos: ["immeuble", "salon", "cuisine", "chambre"],
    atouts: ["balcon", "ascenseur", "parquet ancien", "double vitrage", "cave", "place de parking"] },
  { nom: "Studio", pieces: [1], surfaces: [20, 25, 30], coef: 1.1,
    photos: ["immeuble", "pièce principale", "coin cuisine", "salle d'eau"],
    atouts: ["entièrement rénové", "cuisine équipée", "proche transports", "interphone", "fibre optique", "charges réduites"] },
  { nom: "Villa", pieces: [5, 6, 7], surfaces: [160, 200, 240], coef: 1.3,
    photos: ["façade", "piscine", "salon", "cuisine", "chambre"],
    atouts: ["piscine chauffée", "grand jardin arboré", "double garage", "vue dégagée", "pool house", "domotique"] },
];

const DPE = ["B", "C", "C", "D", "D", "E"];

async function main() {
  console.log("Comptes de démonstration...");
  await compte("admin@immo.fr", "Admin", "ADMIN");
  const agent1 = await compte("agent1@immo.fr", "Agent Un", "AGENT", "VALIDE");
  const agent2 = await compte("agent2@immo.fr", "Agent Deux", "AGENT", "VALIDE");
  await compte("agent3@immo.fr", "Agent Trois", "AGENT", "EN_ATTENTE");
  const user1 = await compte("user1@immo.fr", "Client Un");
  await compte("user2@immo.fr", "Client Deux");

  if ((await prisma.annonce.count()) > 0) {
    console.log("Annonces déjà présentes : ignorées.");
    return;
  }

  console.log("Création de 20 annonces...");
  for (let i = 0; i < 20; i++) {
    const vente = i % 2 === 0;
    const ville = VILLES[i % VILLES.length]!;
    const quartier = ville.quartiers[i % ville.quartiers.length]!;
    const bien = BIENS[i % BIENS.length]!;
    const pieces = bien.pieces[i % bien.pieces.length]!;
    const surface = bien.surfaces[(i + 1) % bien.surfaces.length]!;
    const atouts = [bien.atouts[i % 6], bien.atouts[(i + 2) % 6], bien.atouts[(i + 4) % 6]];
    const dpe = DPE[i % DPE.length];

    const prixVente = Math.round((surface * ville.m2 * bien.coef) / 1000) * 1000;
    const prix = vente ? prixVente : Math.round((prixVente * 0.0035) / 10) * 10;

    const type = pieces > 1 ? `${pieces} pièces` : "T1";
    const titre = `${bien.nom} ${type} de ${surface} m² – ${quartier}, ${ville.nom}`;
    const description = [
      `${bien.nom} de ${surface} m² (${type}) situé dans le quartier ${quartier}, à ${ville.nom}.`,
      `Points forts : ${atouts.join(", ")}.`,
      `Commerces, écoles et transports à proximité. Diagnostic énergétique : ${dpe}.`,
      vente
        ? "Visite sur rendez-vous, dossier complet disponible auprès de l'agence."
        : "Loyer charges comprises. Dossier de location à constituer.",
    ].join("\n");

    // Photos : une URL Picsum stable + un texte alternatif
    const photos = bien.photos.map((piece, k) => ({
      url: `https://picsum.photos/seed/immo-${i}-${k}/640/480`,
      alt: `${bien.nom} à ${ville.nom} – ${piece}`,
    }));

    // i % 5 === 0 → annonces 0, 5, 10, 15 : brouillons répartis entre agent 1 et agent 2
    const publiee = i % 5 !== 0;

    await prisma.annonce.create({
      data: {
        titre,
        description,
        typeBien: vente ? "VENTE" : "LOCATION",
        statutPublication: publiee ? "PUBLIEE" : "BROUILLON",
        statutBien: publiee && i % 7 === 0 ? (vente ? "VENDU" : "LOUE") : "DISPONIBLE",
        prix,
        surface,
        ville: ville.nom,
        dateDisponibilite: new Date(Date.now() + (i % 6) * 7 * 24 * 3600 * 1000),
        auteurId: (i % 2 === 0 ? agent1 : agent2).id,
        photos: { create: photos },
      },
    });
  }

  console.log("Questions, réponse et favori...");
  const pub1 = await prisma.annonce.findFirst({
    where: { auteurId: agent1.id, statutPublication: "PUBLIEE" },
    orderBy: { id: "asc" },
  });
  const pub2 = await prisma.annonce.findFirst({
    where: { auteurId: agent2.id, statutPublication: "PUBLIEE" },
    orderBy: { id: "asc" },
  });
  if (!pub1 || !pub2) throw new Error("Il faut une annonce publiée par agent pour le seed.");

  // Question avec réponse de l'agent propriétaire
  await prisma.question.create({
    data: {
      contenu: "Le bien est-il toujours disponible pour une visite ce mois-ci ?",
      annonceId: pub1.id,
      auteurId: user1.id,
      reponse: {
        create: { contenu: "Oui, contactez l'agence pour fixer un rendez-vous.", auteurId: agent1.id },
      },
    },
  });

  // Question sans réponse, sur une annonce de l'agent 2
  await prisma.question.create({
    data: {
      contenu: "Les charges de copropriété sont-elles incluses ?",
      annonceId: pub2.id,
      auteurId: user1.id,
    },
  });

  await prisma.favori.create({ data: { userId: user1.id, annonceId: pub2.id } });

  console.log(`Seed terminé : 6 comptes (mot de passe : ${MOT_DE_PASSE}), 20 annonces dont 4 brouillons.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
