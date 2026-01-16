# @pulse-js/tools

The official visual debugging suite for the Pulse ecosystem. Inspect, monitor, and debug your reactive graph in real-time with a premium, developer-focused UI.

## Features

- **Tabbed Interface**: Switch between the standard "Inspector" list and the new "Pulse Tree" dependency graph.
- **Pulse Tree Visualization**: See your component hierarchy and dependency flow in a collapsible tree view.
- **Editable Sources**: Click on any Source value to edit it on the fly. Auto-parses JSON and primitives.
- **Explain API Integration**: Full support for the `guard.explain()` method, showing semantic failure reasons and dependencies.
- **Draggable & Resizable**: A floating widget that lives anywhere on your screen with intelligent positioning.
- **Framework-Agnostic**: Built as a standard Web Component, usable in any environment.

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
