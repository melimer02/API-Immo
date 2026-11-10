/**
 * Origines autorisées à appeler l'API depuis un navigateur.
 */
export function originesAutorisees(valeur = process.env.CORS_ORIGIN): string[] {
  const origines = (valeur ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  if (origines.includes("*")) {
    throw new Error("CORS_ORIGIN ne doit pas contenir '*' : listez les origines autorisées explicitement");
  }
  return origines;
}
