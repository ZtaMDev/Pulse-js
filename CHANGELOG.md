# Changelog

## v0.1.7 (Enterprise Reactivity & Cycle Detection)

This release focuses on hardening the core engine for large-scale applications with improved failure tracking, cyclic dependency detection, and enterprise-grade metadata.

### Core Improvements (@pulse-js/core 0.1.7)

- **Cyclic Dependency Detection**: Added a robust stack-based detection mechanism that catches infinite reactive loops (A -> B -> A) and reports them as descriptive failure reasons instead of causing stack overflows.
- **Persistent Dependency Insights**: The `.explain()` graph now persists even after a failure. Previously, failing early would clear downstream dependencies; now it remembers the last known graph for better debugging.
- **Structured Reason Metadata**: Introduced the `GuardReason` interface. Evaluators can now throw objects with `code`, `message`, and `meta` to provide rich error context to the UI.
- **Semantic State Preservation**: When a failed Guard re-evaluates, its `lastReason` is preserved while `pending`, preventing UI flickering and allowing users to see the previous error while the next attempt is in progress.
- **Flexible Pending State**: Returning `undefined` from a Guard evaluator now explicitly marks it as `pending`, simplifying data fetching and "not ready" patterns.

### DevTools Improvements (@pulse-js/tools 0.1.4)

- **Metadata Rendering**: The inspector now renders structured failure reasons, including error codes and JSON metadata snippets.
- **Evaluation State Tracking**: Visual indicators for `lastReason` when a guard is in a `pending` state after a failure.
- **Dependency Status**: Dependency lists now show the status of each dependent guard for faster troubleshooting.

### React Integration (@pulse-js/react 0.1.4)

- **Updated Dependencies**: Bumped to use `@pulse-js/core@0.1.7` and `@pulse-js/tools@0.1.4`.

---

## v0.1.6 (Solidification & Universal Tools)

This release focuses on solidifying the core reactivity model and transforming the developer tools into a framework-agnostic solution.

### Core Improvements (@pulse-js/core 0.1.6)

- **Independent `compute`**: The `compute` primitive is now a standalone export, allowing for pure, memoized transformations of Sources and Guards without the overhead of condition status.
- **Robust Async Cancellation**: Introduced an internal `runId` versioning system for async guards. This automatically prevents race conditions by canceling stale asynchronous updates if the underlying dependencies change before a previous evaluation completes.
- **Explainable Guards**: Added `.explain()` to the `Guard` interface. This returns a structured tree of the current status, failure reasons, and the status of all direct dependencies, significantly improving debuggability.

### Universal DevTools (@pulse-js/tools 0.1.3)

- **Web Component Transformation**: The DevTools suite has been completely rewritten into a framework-agnostic Web Component (`<pulse-inspector>`).
- **Zero Dependencies**: Removed all React dependencies from the tools package. It is now usable in any environment (Vue, Svelte, Vanilla JS, etc.) with a single import.
- **Explain API Integration**: The inspector now visualizes the dependency tree and detailed failure reasons provided by the new `explain()` API.

### React Integration (@pulse-js/react 0.1.3)

- **Zero-Config Auto-Injection**: Introducing `@pulse-js/react/devtools`. Simply importing this in your entry point automatically mounts the inspector in the DOM during development.
- **`PulseDevTools` Component**: A new React component wrapper for fine-grained control over the inspector's placement and configuration.

---

## v0.1.1 (Initial Base Release)

We are excited to announce the first public release of **Pulse**, a semantic reactivity system for modern applications. This release establishes the core primitives and ecosystem under the new `@pulse-js` namespace.

### 📦 Packages

- **`@pulse-js/core`**: The reactivity engine.
- **`@pulse-js/react`**: React 18+ integration hooks.
- **`@pulse-js/tools`**: Visual debugging suite (formerly devtools).

### Features

#### Core Reactivity

- **Sources**: Primitive containers for state values.
- **Guards**: First-class "Conditions" that track status (`ok`, `fail`, `pending`) and failure reasons.
- **Composition**: Logic helpers `guard.all`, `guard.any`, `guard.not`, and `guard.compute`.
- **Async Support**: Native Promise handling for async guards.
- **SSR**: Isomorphic `evaluate` (server) and `hydrate` (client) methods.

#### React Integration

- **`usePulse` Hook**: Universal hook for both Sources and Guards.
- **Concurrent Mode**: Built on `useSyncExternalStore` for safe concurrent updates.
- **Smart Re-renders**: Components only update when semantic state changes.

#### Developer Experience

- **Pulse Tools**: A zero-config, draggable overlay for inspecting the reactive graph.
- **Type Safety**: Full TypeScript support with inferred types.

### Getting Started

```bash
npm install @pulse-js/core @pulse-js/react @pulse-js/tools
```
