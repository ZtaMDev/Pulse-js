# @pulse-js/tanstack

TanStack Query integration for Pulse-js reactive state management.

## Installation

```bash
npm install @pulse-js/tanstack @pulse-js/core @tanstack/react-query
```

## Usage

### Create Guard from Query

```tsx
import { useQuery } from "@tanstack/react-query";
import { guardFromQuery } from "@pulse-js/tanstack";
import { guard } from "@pulse-js/core";

function UserDashboard() {
  const userQuery = useQuery({ queryKey: ["user"], queryFn: fetchUser });
  const userGuard = guardFromQuery(() => userQuery, { name: "user" });

  // Compose with other guards
  const canAccessDashboard = guard.all("dashboard-access", [
    isAuthenticated,
    userGuard,
  ]);

  if (canAccessDashboard.pending()) return <Loading />;
  if (canAccessDashboard.fail())
    return <Error reason={canAccessDashboard.reason()} />;
  return <Dashboard user={userGuard()} />;
}
```

### Query-like Interface from Guard

```ts
import { queryFromGuard } from '@pulse-js/tanstack';

const dataGuard = guard('data', async () => fetchData());
const queryLike = queryFromGuard(dataGuard);

// Use like TanStack Query result
if (queryLike.isLoading) return <Spinner />;
if (queryLike.isError) return <Error message={queryLike.error} />;
return <Display data={queryLike.data} />;
```

### Subscribe to Query Cache

```ts
import { QueryClient } from "@tanstack/react-query";
import { guardFromQueryCache } from "@pulse-js/tanstack";

const queryClient = new QueryClient();
const userGuard = guardFromQueryCache(queryClient, ["user"]);

// Guard automatically updates when cache changes
```

## API

| Function                                    | Description                             |
| ------------------------------------------- | --------------------------------------- |
| `guardFromQuery(getQuery, options)`         | Creates Guard from query result         |
| `queryFromGuard(guard)`                     | Creates Query-like interface from Guard |
| `guardFromQueryCache(client, key, options)` | Guards from Query cache                 |
| `syncGuardToCache(client, key, guard)`      | Syncs Guard value to cache              |

## License

MIT
