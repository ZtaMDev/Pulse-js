# @pulse-js/tools

The official visual debugging suite for the Pulse ecosystem. Inspect, monitor, and debug your reactive graph in real-time with a premium, developer-focused UI.

## Features

- **Draggable UI**: A floating widget that lives anywhere on your screen.
- **Quadrant-Aware Anchoring**: Intelligent positioning system. The panel automatically expands from the corner closest to its current position (top-left, bottom-right, etc.), ensuring the UI never jumps or floats awkwardly.
- **Persistent State**: innovative positioning engine remembers exactly where you left the widget, persisting across page reloads and HMR updates.
- **Real-Time Inspection**: Visualize the status (OK, FAIL, PENDING) and values of all registered Sources and Guards instantly.
- **Explain API Integration**: Full support for the `guard.explain()` method, showing semantic failure reasons and dependencies.
- **Glassmorphism Design**: A modern, dark-themed aesthetic that fits seamlessly into developer workflows without obstructing functionality.
- **Framework-Agnostic**: Built as a standard Web Component, usable in any environment (React, Vue, Svelte, or Vanilla JS).

## Installation

```bash
npm install @pulse-js/tools
```

## Usage

### React Integration (Recommended)

The easiest way to use Pulse Tools in React is via the `@pulse-js/react` package, which handles auto-injection.

```tsx
// main.tsx
import "@pulse-js/react/devtools";
```

### Vanilla / Other Frameworks

You can use the `<pulse-inspector>` Web Component directly.

```html
<script type="module" src="node_modules/@pulse-js/tools/dist/index.js"></script>

<pulse-inspector shortcut="Ctrl+D"></pulse-inspector>
```

Or in JavaScript:

```javascript
import "@pulse-js/tools";

const inspector = document.createElement("pulse-inspector");
document.body.appendChild(inspector);
```

### Configuration Props

| Prop       | Type     | Default    | Description                                              |
| ---------- | -------- | ---------- | -------------------------------------------------------- |
| `shortcut` | `string` | `'Ctrl+D'` | Keyboard shortcut to toggle the visibility of the panel. |

## Tips

- **Naming Matters**: Ensure you provide string names to your Sources and Guards (e.g., `source(val, { name: 'my-source' })`). The DevTools rely on these names to provide meaningful debugging information. Unnamed units will appear but are harder to trace.
- **Status Indicators**:
  - 🟢 **Green**: OK / Active
  - 🔴 **Red**: Fails (Hover to see semantic failure reasons)
  - 🟡 **Yellow**: Pending (Async operations in flight)

## Architecture

The DevTools communicate with the core library via the global `PulseRegistry`. This means it works seamlessly even if your application code is split across multiple modules or bundles, as long as they share the same Pulse instance.
