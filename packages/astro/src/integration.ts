/**
 * Astro Integration for Pulse-js
 * 
 * Automatically injects hydration scripts and provides
 * build-time optimizations for Pulse state management.
 * 
 * @example astro.config.mjs
 * ```js
 * import { defineConfig } from 'astro/config';
 * import pulse from '@pulse-js/astro/integration';
 * 
 * export default defineConfig({
 *   integrations: [pulse()]
 * });
 * ```
 */

import type { AstroIntegration } from 'astro';

export interface PulseIntegrationOptions {
  /**
   * Enable automatic DevTools injection in development.
   * @default true
   */
  devTools?: boolean;
  
  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Creates the Pulse Astro integration.
 */
export default function pulseIntegration(options: PulseIntegrationOptions = {}): AstroIntegration {
  const { devTools = true, debug = false } = options;
  
  return {
    name: '@pulse-js/astro',
    hooks: {
      'astro:config:setup': ({ injectScript, command }) => {
        if (debug) {
          console.log('[Pulse] Setting up Astro integration');
        }
        
        // Inject client-side initialization
        injectScript('page', `
          import { initPulseClient } from '@pulse-js/astro';
          initPulseClient();
        `);
        
        // Inject DevTools in development
        if (command === 'dev' && devTools) {
          injectScript('page', `
            if (typeof window !== 'undefined') {
              import('@pulse-js/react/devtools').catch(() => {
                console.log('[Pulse] DevTools not available');
              });
            }
          `);
        }
      },
      
      'astro:config:done': ({ config }) => {
        if (debug) {
          console.log('[Pulse] Config done, output:', config.output);
        }
      },
      
      'astro:build:done': ({ pages }) => {
        if (debug) {
          console.log(`[Pulse] Build complete. ${pages.length} pages generated.`);
        }
      }
    }
  };
}

// Named export for ESM
export { pulseIntegration as pulse };
