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
      "@pulse-js/core": resolve(__dirname, "../src"),
      "@pulse-js/react": resolve(__dirname, "../packages/react/src"),
      "@pulse-js/tools": resolve(__dirname, "../packages/tools/src"),
      "@pulse-js/vue": resolve(__dirname, "../packages/vue/src"),
      "@pulse-js/svelte": resolve(__dirname, "../packages/svelte/src/index.svelte.ts"),
      "@pulse-js/tanstack": resolve(__dirname, "../packages/tanstack/src"),
      "@pulse-js/astro": resolve(__dirname, "../packages/astro/src"),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [], // Add setup files if needed
  },
});
