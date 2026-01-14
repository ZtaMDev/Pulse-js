import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@pulse-js/core": resolve(__dirname, "../src"),
      "@pulse-js/react": resolve(__dirname, "../packages/react/src"),
      "@pulse-js/tools": resolve(__dirname, "../packages/tools/src"),
    },
  },
  server: {
    port: 3000,
  },
});
