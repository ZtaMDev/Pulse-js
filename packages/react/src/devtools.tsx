import '@pulse-js/tools';

/**
 * Pulse DevTools for React.
 * 
 * This module automatically injects the Pulse Inspector Web Component
 * into the DOM when imported in a development environment.
 * 
 * Usage:
 * ```ts
 * import '@pulse-js/react/devtools';
 * ```
 */

const isDev = typeof process !== 'undefined' 
  ? process.env.NODE_ENV === 'development' 
  : (import.meta as any).env?.DEV || true; // Fallback for Vite/etc.

if (isDev && typeof document !== 'undefined') {
  // Prevent duplicate injection
  if (!document.querySelector('pulse-inspector')) {
    const inspector = document.createElement('pulse-inspector');
    // You can pass props here if needed, e.g. shortcut
    document.body.appendChild(inspector);
    console.log('🚀 Pulse DevTools initialized');
  }
}

/**
 * A React component wrapper for Pulse DevTools.
 * Useful if you want to manually control where the inspector is mounted
 * or pass specific props.
 */
export function PulseDevTools({ shortcut = 'Ctrl+D' }: { shortcut?: string }) {
  // In React, we can just render the web component tag
  // TypeScript might complain about custom elements, so we use any or ignore
  const PulseInspectorTag = 'pulse-inspector' as any;
  
  if (!isDev) return null;
  
  return <PulseInspectorTag shortcut={shortcut} />;
}
