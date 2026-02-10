// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
import { pulse } from "@pulse-js/astro/integration";

export default defineConfig({
  integrations: [pulse()],
});
