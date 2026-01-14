<div align="center">

<img width="200" height="200" alt="logo" src="https://raw.githubusercontent.com/ZtaMDev/Pulse/refs/heads/main/pulse.svg" />

# Pulse

> A semantic reactivity system for modern applications. Separate reactive data (sources) from business conditions (guards) with a declarative, composable, and observable approach.

Pulse differs from traditional signals or state managers by treating `Conditions` as first-class citizens. Instead of embedding complex boolean logic inside components or selectors, you define **Semantic Guards** that can be observed, composed, and debugged independently.

### Mental Model

Compare Pulse primitives at a glance:

| Concept     | Can be async | Has state | Observable | Purpose                              |
| :---------- | :----------: | :-------: | :--------: | :----------------------------------- |
| **Source**  |      ❌      |    ❌     |     ✅     | Reactive data (facts).               |
| **Guard**   |      ✅      |    ✅     |     ✅     | Business rules (conditioned truths). |
| **Compute** |      ❌      |    ❌     |     ✅     | Pure transformations (derivations).  |

</div>

## Installation

```bash
npm install @pulse-js/core @pulse-js/tools
```

### or

```bash
bun add @pulse-js/core @pulse-js/tools
```

Pulse works with React via adapters like `@pulse-js/react`.

```bash
bun add @pulse-js/react
```

## Core Concepts

### Sources (Refined Data)

Sources are the primitive containers for your application state. They hold values and notify dependents when those values change.

```typescript
import { source } from "@pulse-js/core";

// Create a source
const user = source({ name: "Alice", id: 1 });
const rawCount = source(0);

// Read the value (dependencies are tracked automatically if called inside a Guard)
console.log(user());

// Update the value
user.set({ name: "Bob", id: 1 });

// Update using a callback
rawCount.update((n) => n + 1);
```

### Guards (Semantic Logic)

Guards represent business rules or derivations. A Guard is not just a boolean: it is a **Semantic Guard**—an observable rule with context. They track their own state including `status` (ok, fail, pending) and `reason` (why it failed).

```typescript
import { guard } from "@pulse-js/core";

// Synchronous Guard
const isAdmin = guard("is-admin", () => {
  const u = user();
  if (u.role !== "admin") return false; // Implicitly sets status to 'fail'
  return true;
});

// Guards can be checked explicitly
if (isAdmin.ok()) {
  // Grant access
} else {
  console.log(isAdmin.reason()); // e.g. "is-admin failed"
}
```

### Computed Values

You can derive new data from sources or other guards using `compute`. It works like a memoized transformation that automatically re-evaluates when dependencies change.

```typescript
import { compute } from "@pulse-js/core";

const fullName = compute("full-name", [firstName, lastName], (first, last) => {
  return `${first} ${last}`;
});
```

### Async Guards & Race Control

Pulse handles asynchronous logic natively. Guards can return Promises, and their status will automatically transition from `pending` to `ok` or `fail`.

Pulse implements internal **runId versioning** to automatically cancel stale async evaluations if the underlying sources change multiple times before a promise resolves, preventing race conditions.

```typescript
const isServerOnline = guard("check-server", async () => {
  const response = await fetch("/health");
  if (!response.ok) throw new Error("Server unreachable");
  return true;
});
```

### Explanable Guards

For complex conditions, you can call `.explain()` to get a structured tree of the current status, failure reason, and the status of all direct dependencies.

```ts
const explanation = canCheckout.explain();
console.log(explanation);
// { status: 'fail', reason: 'auth failed', dependencies: [...] }
```

## Server-Side Rendering (SSR)

Pulse is designed with SSR in mind. It supports isomorphic rendering where async guards can be evaluated on the server, their state serialized, and then hydrated on the client.

### Server Side

```typescript
import { evaluate } from "@pulse-js/core";

// 1. Evaluate critical guards on the server
const hydrationState = await evaluate([isUserAuthenticated, appSettings]);

// 2. Serialize this state into your HTML
const html = `
  <script>window.__PULSE_STATE__ = ${JSON.stringify(hydrationState)}</script>
`;
```

### Client Side (Hydration)

```typescript
import { hydrate } from "@pulse-js/core";

// 1. Hydrate before rendering
hydrate(window.__PULSE_STATE__);
```

## API Reference

### `source<T>(initialValue: T, options?: SourceOptions)`

Creates a reactive source.

- `options.name`: Unique string name (highly recommended for debugging).
- `options.equals`: Custom equality function `(prev, next) => boolean`.

Methods:

- `.set(value: T)`: Updates the value.
- `.update(fn: (current: T) => T)`: Updates value using a transform.
- `.subscribe(fn: (value: T) => void)`: Manual subscription.

### `guard<T>(name: string, evaluator: () => T | Promise<T>)`

Creates a semantic guard.

Methods:

- `.ok()`: Returns true if status is 'ok'.
- `.fail()`: Returns true if status is 'fail'.
- `.pending()`: Returns true if evaluating async.
- `.reason()`: Returns the failure message.
- `.state()`: Returns full `{ status, value, reason }` object.
- `.subscribe(fn: (state: GuardState) => void)`: Manual subscription.

---

## Ecosystem

- **@pulse-js/react**: React bindings and hooks.
- **@pulse-js/tools**: Visual debugging tools.
