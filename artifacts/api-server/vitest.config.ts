import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The api-server bundle pulls in pino transports + DB drivers at import
    // time. Tests rely on vi.mock to short-circuit those side effects, which
    // is automatically hoisted by vitest.
  },
});
