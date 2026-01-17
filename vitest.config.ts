import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    vue(), 
    svelte({ 
      hot: !process.env.VITEST,
      compilerOptions: { runes: true }
    }),
    svelteTesting()
  ] as any[],
  resolve: {
    alias: {
      "@pulse-js/core": resolve(__dirname, "./src/index.ts"),
      "@pulse-js/react": resolve(__dirname, "./packages/react/src/index.ts"),
      "@pulse-js/tools": resolve(__dirname, "./packages/tools/src/index.ts"),
      "@pulse-js/vue": resolve(__dirname, "./packages/vue/src/index.ts"),
      "@pulse-js/svelte": resolve(__dirname, "./packages/svelte/src/index.svelte.ts"),
    },
    conditions: ['browser', 'module', 'jsnext:main', 'jsnext']
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [], // Add setup files if needed
  },
});
