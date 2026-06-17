import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "~": fileURLToPath(new URL("./app", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          environment: "jsdom",
          globals: true,
          exclude: ["tests/rules/**", "**/node_modules/**"],
        },
      },
      {
        test: {
          environment: "node",
          globals: true,
          include: ["tests/rules/**"],
        },
      },
    ],
  },
});
