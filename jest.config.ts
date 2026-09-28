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
          // The base tsconfig targets ESM ("module": "esnext") for Next's
          // own bundler. Jest's runtime needs CommonJS output to run
          // transformed files and for jest.mock()/jest.doMock() to work
          // (they patch node's `require`) — override just for this
          // transform rather than touching the app's own tsconfig.
          module: "commonjs",
          moduleResolution: "node",
        },
      },
    ],
  },
  clearMocks: true,
};

export default config;
