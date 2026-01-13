<div align="center">

<img width="200" height="200" alt="logo" src="./pulse.svg" />

# Pulse

> A semantic reactivity system for modern applications. Separate reactive data (sources) from business conditions (guards) with a declarative, composable, and observable approach.

Pulse differs from traditional signals or state managers by treating `Conditions` as first-class citizens. Instead of embedding complex boolean logic inside components or selectors, you define semantic **Guards** that can be observed, composed, and debugged independently.

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

Guards represent business rules or derivations. They are not just boolean flags; they track their own state including `status` (ok, fail, pending) and `reason` (why it failed).

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

### Async Guards

Pulse handles asynchronous logic natively. Guards can return Promises, and their status will automatically transition from `pending` to `ok` or `fail`.

```typescript
const isServerOnline = guard("check-server", async () => {
  const response = await fetch("/health");
  if (!response.ok) throw new Error("Server unreachable");
  return true;
});

// Check status synchronously non-blocking
if (isServerOnline.pending()) {
  showSpinner();
}
```

### Composition

Guards can be composed using logical operators. This creates a semantic tree of conditions that is easy to debug.

```typescript
import { guard } from "@pulse-js/core";

// .all() - Success only if ALL pass. Fails with the reason of the first failure.
const canCheckout = guard.all("can-checkout", [
  isAuthenticated,
  hasItemsInCart,
  isServerOnline,
]);

// .any() - Success if AT LEAST ONE passes.
const hasAccess = guard.any("has-access", [isAdmin, isEditor]);

// .not() - Inverts the logical result.
const isGuest = guard.not("is-guest", isAuthenticated);
```

### Computed Values

You can derive new data from sources or other guards using `guard.compute`.

```typescript
const fullName = guard.compute(
  "full-name",
  [firstName, lastName],
  (first, last) => {
    return `${first} ${last}`;
  }
);
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
