# @pulse-js/astro

Astro integration for Pulse-js reactive state management.

## Installation

```bash
npm install @pulse-js/astro @pulse-js/core
```

## Setup

Add the integration to your `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import pulse from "@pulse-js/astro/integration";

export default defineConfig({
  integrations: [pulse()],
});
```

## Usage

### Server-Side Rendering (SSR)

Evaluate guards on the server and hydrate on the client:

```astro
---
import { createHydrationScript } from '@pulse-js/astro';
import { userGuard, themeGuard } from '../state';

const hydrationScript = await createHydrationScript([userGuard, themeGuard]);
---
<html>
  <head>
    <Fragment set:html={hydrationScript} />
  </head>
  <body>
    <!-- Your content -->
  </body>
</html>
```

### In Island Components

Use Pulse state in React/Vue/Svelte islands:

```tsx
// React Island
import { usePulse } from "@pulse-js/react";
import { countSource } from "../state";

export default function Counter() {
  const count = usePulse(countSource);
  return <button onClick={() => countSource.set(count + 1)}>{count}</button>;
}
```

### SSR-Safe Reading

For reading state in server/client agnostic components:

```ts
import { usePulseSSR } from "@pulse-js/astro";
import { userGuard } from "../state";

const state = usePulseSSR(userGuard);
if (state.status === "ok") {
  console.log("User:", state.value);
}
```

## API

### `createHydrationScript(guards)`

Creates an HTML script tag for client hydration.

### `evaluateForHydration(guards)`

Returns serialized guard state as JSON string.

### `initPulseClient()`

Initializes client-side hydration (called automatically by integration).

### `usePulseSSR(unit)`

SSR-safe hook for reading Source or Guard values.

## License

MIT
