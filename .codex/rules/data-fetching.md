# Data Fetching Rules

This document defines the patterns and conventions for fetching data in the Seatwise repository, ensuring consistency between Server Components and Client Components.

---

## 1. Server Components (RSC)

Next.js Server Components have direct access to the backend. Follow these rules to optimize performance and security:

- **Direct Database Access**: 
    - ALWAYS prefer calling repository/helper functions from `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\lib\db\` directly.
    - NEVER use `fetch()` to call internal API routes (`/api/**`) from a Server Component. This adds unnecessary network overhead.
- **Privacy**:
    - Ensure sensitive data (e.g., hashed passwords, internal flags) is filtered out in the DB helper before returning it to the component.
- **Deduplication**:
    - Use React's `cache()` function if the same data is needed in multiple components within a single request tree (e.g., Layout and Page).

### Example (RSC):
```tsx
// Correct: Direct DB call
import { getUserByFirebaseUid } from "@/lib/db/Users";

export default async function ProfilePage() {
  const user = await getUserByFirebaseUid(uid);
  return <ProfileInfo user={user} />;
}
```

---

## 2. Client Components

Client Components must interact with the server through API routes or Server Actions.

- **Redux Toolkit (RTK)**:
    - Use Redux Thunks (located in `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\lib\features\`) for data that needs to be shared across the application or persists across route changes.
    - Use the typed hooks `useAppDispatch` and `useAppSelector` from `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\lib\hooks.ts`.
- **Local Fetch**:
    - For component-specific data that doesn't belong in the global state, use the standard `fetch()` API.
- **Response Handling**:
    - ALWAYS check the `ok` property from the API response envelope (as defined in `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\.codex\rules\api.md`).
    - Handle both `data` (success) and `error` (failure) states.

### Example (Client):
```tsx
"use client";
import { useEffect, useState } from "react";

export function ClientDataComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/some-resource')
      .then(res => res.json())
      .then(json => {
        if (json.ok) setData(json.data);
        else console.error(json.error.message);
      });
  }, []);
}
```

---

## 3. Server Actions

- Use Server Actions (located in `c:\Users\cholo\OneDrive\Desktop\Project Seatwise\seatwise_v2\lib\actions\`) for data mutations (POST, PUT, DELETE) triggered by user interactions.
- Server Actions should also follow the `{ ok, data }` or `{ ok, error }` return pattern for consistency with the API.

---

## 4. Revalidation & Caching

- Use `revalidatePath` or `revalidateTag` after mutations (in API routes or Server Actions) to ensure the client sees up-to-date data.
- Favor `const dynamic = "force-dynamic"` or `revalidate = 0` only on pages that require real-time data to avoid excessive database load.
- Leverage Next.js built-in fetch cache for external API calls when appropriate.

---

## 5. Error Boundaries

- Wrap data-fetching segments in React `Suspense` and `ErrorBoundary` (or Next.js `loading.tsx` and `error.tsx`) to provide a graceful fallback UI.
