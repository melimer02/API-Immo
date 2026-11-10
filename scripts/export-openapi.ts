/**
 * Exporte la spécification OpenAPI générée (code-first) dans openapi.yaml.
 * L'application est construite sans démarrer de serveur HTTP ni interroger la base.
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { buildApp } from "../src/app.js";

const app = await buildApp();
await app.ready();

const yaml = app.swagger({ yaml: true });
writeFileSync("openapi.yaml", yaml);
console.log(`openapi.yaml écrit (${Object.keys(app.swagger().paths ?? {}).length} chemins)`);

await app.close();
process.exit(0);
