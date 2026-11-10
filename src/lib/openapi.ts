import { jsonSchemaTransformObject } from "fastify-type-provider-zod";
import type { SwaggerTransformObject } from "@fastify/swagger";

/**
 * fastify-type-provider-zod publie chaque schéma nommé en deux variantes :
 * "Annonce" (ce que l'API renvoie) et "AnnonceInput" (ce que l'API reçoit).
 * Les deux sont utiles quand elles diffèrent (ex. dateDisponibilite : texte en entrée,
 * photos facultatives grâce au .default([])), mais la plupart des variantes ne sont
 * référencées par aucune route.
 *
 * On ne garde dans components/schemas que les schémas réellement utilisés
 * (directement ou via un autre schéma) : la spec et le SDK généré restent lisibles.
 */
export const transformerSpec: SwaggerTransformObject = (documentObject) => {
  const spec = jsonSchemaTransformObject(documentObject) as {
    paths?: unknown;
    components?: { schemas?: Record<string, unknown> };
  };
  const schemas = spec.components?.schemas;
  if (!schemas) return spec as ReturnType<SwaggerTransformObject>;

  const references = (objet: unknown) =>
    [...JSON.stringify(objet).matchAll(/"#\/components\/schemas\/([^"]+)"/g)].map((m) => m[1]!);

  // On part des schémas cités par les routes, puis on suit les $ref de proche en proche
  const utilises = new Set<string>();
  const aVisiter = references(spec.paths);
  while (aVisiter.length > 0) {
    const nom = aVisiter.pop()!;
    if (utilises.has(nom)) continue;
    utilises.add(nom);
    aVisiter.push(...references(schemas[nom]));
  }

  spec.components!.schemas = Object.fromEntries(
    Object.entries(schemas).filter(([nom]) => utilises.has(nom)),
  );
  return spec as ReturnType<SwaggerTransformObject>;
};
