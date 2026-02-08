<div align="center">
<img width="200" height="200" alt="logo" src="https://raw.githubusercontent.com/ZtaMDev/Pulse/refs/heads/main/pulse.svg" />

# Pulse-JS

[![npm version](https://img.shields.io/npm/v/@pulse-js/core.svg?color=blue)](https://www.npmjs.com/package/@pulse-js/core)

> A semantic reactivity system for modern applications. Separate reactive state (pulse) from business conditions (guards) with a declarative, composable, and proxied approach.

Official [Documentation](https://pulse-js.vercel.app)

Pulse differs from traditional signals or state managers by treating `Conditions` as first-class citizens. Instead of embedding complex boolean logic inside components, you define **Semantic Guards** that are observed, composed, and debugged independently.

</div>

## Installation

```bash
bun add @pulse-js/core @pulse-js/tools
```

## Core Concepts

### Pulse Objects (Universal Reactivity)

`pulse()` creates a deep reactive Proxy. Use it for complex objects and arrays. Track property access automatically and mutate state directly.

```typescript
import { pulse } from "@pulse-js/core";

const user = pulse({
  name: "Alice",
  role: "admin",
  increment() {
    this.stats.clicks++;
  },
  stats: { clicks: 0 },
});

// Mutate directly - it's reactive!
user.name = "Bob";
user.increment();
```

### Sources (Primitive Records)

Sources are primitive containers for your application state. They hold values and notify dependents when those values change.

```typescript
import { source } from "@pulse-js/core";
const count = source(0);
count.set(5);
```

### Guards (Semantic Logic)

Guards represent business rules or derivations. They act as high-performance **Selectors** with built-in dependency tracking and rich failure context.

```typescript
import { guard } from "@pulse-js/core";

const isAuthorized = guard("auth-check", async () => {
  const u = user();
  if (!u) return false;
  return true;
});
```

### Explanable Guards

Get a structured tree of the current status, failure reasons, and the status of all direct dependencies.

```ts
const explanation = canCheckout.explain();
// { status: 'fail', reason: { code: 'AUTH', message: '...' }, dependencies: [...] }
```

## Framework Integrations

Pulse provides official adapters for all major frameworks.

| Framework    | Package              | Status |
| :----------- | :------------------- | :----- |
| **Astro**    | `@pulse-js/astro`    | NEW    |
| **React**    | `@pulse-js/react`    | Stable |
| **Vue**      | `@pulse-js/vue`      | Stable |
| **Svelte**   | `@pulse-js/svelte`   | Stable |
| **TanStack** | `@pulse-js/tanstack` | NEW    |

## Developer Tools

Debug your reactive graph with **[Pulse Tools](https://pulse-js.vercel.app/guides/devtools/)**, a decoupled Agent-Client inspector.

- **Agent-Client Architecture**: Isolated UI that doesn't restart your app.
- **Dependency Graph**: Visualize how your guards are connected.
- **Glassmorphism UI**: A premium, draggable development experience.
- **Zero Config**: Works out of the box with `@pulse-js/tools`.
