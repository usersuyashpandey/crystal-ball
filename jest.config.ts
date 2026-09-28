import type { Config } from "jest";

// Jest runs our unit tests and "integration" tests (route handlers invoked
// directly, see README for why we don't spin up Supertest against a real
// HTTP server for a Next.js App Router project). Component tests live under
// vitest instead (see vitest.config.ts) because RTL + jsdom + Next's App
// Router server/client component split plays more predictably with Vite's
// transform pipeline than with ts-jest for .tsx files.
const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: [
    "<rootDir>/__tests__/unit/**/*.test.ts",
    "<rootDir>/__tests__/integration/**/*.test.ts",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react-jsx",
        },
      },
    ],
  },
  clearMocks: true,
};

export default config;
