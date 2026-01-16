# @pulse-js/react

React integration for the Pulse reactivity ecosystem. Provides hooks and utilities to consume Pulse Sources and Guards within React components efficiently.

## Features

- **Concurrent Mode Compatible**: Built with `useSyncExternalStore` for compatibility with React 18+ concurrent features.
- **Zero Polling**: Logic driven by direct subscriptions to the Pulse core, ensuring updates happen exactly when state changes.
- **Type Safety**: Full TypeScript support for inferred types from Sources and Guards.

## Installation

```bash
npm install @pulse-js/react @pulse-js/core
```

## Usage

The primary API is the `usePulse` hook. It adapts automatically depending on whether you pass it a Source or a Guard.

### Using Sources

When used with a **Source**, `usePulse` returns the current value and triggers a re-render whenever that value updates.

```jsx
import { source } from "@pulse-js/core";
import { usePulse } from "@pulse-js/react";

const counter = source(0);

function Counter() {
  const value = usePulse(counter);

  return (
    <button onClick={() => counter.update((n) => n + 1)}>Count: {value}</button>
  );
}
```

### Using Guards

When used with a **Guard**, `usePulse` returns the complete `GuardState` object, which includes `status`, `value`, and `reason`. This allows you to handle loading and error states declaratively.

```tsx
import { guard } from "@pulse-js/core";
import { usePulse } from "@pulse-js/react";

const isAuthorized = guard("auth-check", async () => {
  // ... async logic
});

function ProtectedRoute() {
  const { status, reason } = usePulse(isAuthorized);

  if (status === "pending") {
    return <LoadingSpinner />;
  }

  if (status === "fail") {
    return <AccessDenied message={formatReason(reason)} />;
  }

  return <AdminDashboard />;
}
```

### Rendering Failure Reasons

The `reason` property in a `GuardState` can be a string or a `GuardReason` object. To render it safely in JSX, use the `formatReason` helper:

```tsx
import { formatReason } from "@pulse-js/react";

<p className="error">{formatReason(reason)}</p>;
```

## Developer Tools

Pulse provides a dedicated inspector for debugging your reactive graph. In React applications, you can enable it with zero configuration.

### Auto-Injection (Recommended)

Simply import `@pulse-js/react/devtools` at the top of your main entry point (e.g., `main.tsx`). The inspector will automatically mount to the DOM only in development environments (`NODE_ENV === 'development'`).

```tsx
import "@pulse-js/react/devtools";
```

### Manual Component

Alternatively, you can use the `PulseDevTools` component for more control:

```tsx
import { PulseDevTools } from "@pulse-js/react/devtools";

function App() {
  return (
    <>
      <MyRoutes />
      <PulseDevTools shortcut="Ctrl+D" />
    </>
  );
}
```

## API

### `usePulse<T>(unit: PulseUnit<T>): T | GuardState<T>`

- **Arguments**:
  - `unit`: A Pulse Source or Guard.
- **Returns**:
  - For Sources: The inner value `T`.
  - For Guards: An object `{ status: 'ok' | 'fail' | 'pending', value?: T, reason?: string }`.

## Performance

`@pulse-js/react` leverages modern React 18 patterns to ensure optimal performance. It avoids unnecessary re-renders by strictly tracking object references and using the `useSyncExternalStore` API to integrate with React's scheduling system.
