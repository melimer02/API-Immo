import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/setup/global.ts"],
    setupFiles: ["test/setup/env.ts"],
    // Les fichiers E2E partagent la même base de test : on les exécute l'un après l'autre
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
