import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "server-only": fileURLToPath(new URL("./tests/mocks/server-only.ts", import.meta.url)) } },
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.tsx"],
    maxWorkers: 3,
    testTimeout: 10000,
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      include: ["src/components/**/*.{ts,tsx}", "src/features/**/components/**/*.{ts,tsx}", "src/features/**/screens/**/*.{ts,tsx}", "src/features/**/hooks/*.ts", "src/app/**/page.tsx", "src/lib/use*.ts"],
      exclude: ["src/components/ui/**", "src/**/*.test.*"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { statements: 70, branches: 60, functions: 65, lines: 80 },
    },
  },
});
