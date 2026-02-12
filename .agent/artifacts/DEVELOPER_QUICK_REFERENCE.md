# Seatwise v2 - Developer Quick Reference

> **Quick access guide for common development tasks**

---

## 🚀 Getting Started

### Initial Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Start development server
npm run dev
```

### Environment Variables Checklist
- [ ] `DATABASE_URL` - Neon pooled connection
- [ ] `DIRECT_URL` - Neon direct connection
- [ ] Firebase credentials (8 variables)
- [ ] Cloudinary credentials (3 variables)
- [ ] Upstash Redis (future)
- [ ] Ably API key (future)

---

## 📂 File Locations Quick Reference

### Common Files You'll Edit

| Task | File Path |
|------|-----------|
| **Add new page (admin)** | `app/(admin-user)/(dashboard)/[page-name]/page.tsx` |
| **Add new page (user)** | `app/(app-user)/[page-name]/page.tsx` |
| **Add API endpoint** | `app/api/[endpoint]/route.ts` |
| **Add server action** | `lib/actions/[domain].ts` |
| **Add database query** | `lib/db/[entity].ts` |
| **Add Redux slice** | `lib/features/[feature]/[feature]Slice.ts` |
| **Add UI component** | `components/ui/[component].tsx` |
| **Add domain component** | `components/[component].tsx` |
| **Modify database schema** | `prisma/schema.prisma` |
| **Add global styles** | `app/globals.css` |
| **Add custom hook** | `hooks/[hook-name].ts` |

---

## 🗄️ Database Operations

### Common Prisma Commands
```bash
# Generate Prisma client after schema changes
npx prisma generate

# Push schema changes to database (dev)
npx prisma db push

# Create a migration (production)
npx prisma migrate dev --name [migration-name]

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Query Patterns

#### Fetch with Relations
```typescript
// lib/db/Shows.ts
import { prisma } from '@/lib/prisma';

export async function getShowWithSchedules(showId: string) {
  return await prisma.show.findUnique({
    where: { show_id: showId },
    include: {
      scheds: true,
      seatmap: true,
      categorySets: {
        include: {
          items: {
            include: {
              seatCategory: true
            }
          }
        }
      }
    }
  });
}
```

#### Create with Nested Data
```typescript
export async function createShowWithSchedules(data: ShowCreateInput) {
  return await prisma.show.create({
    data: {
      show_name: data.name,
      show_description: data.description,
      // ... other fields
      scheds: {
        create: data.schedules.map(sched => ({
          sched_date: sched.date,
          sched_start_time: sched.startTime,
          sched_end_time: sched.endTime
        }))
      }
    }
  });
}
```

#### Update with Transaction
```typescript
export async function updateSeatAssignments(
  schedId: string,
  assignments: SeatAssignment[]
) {
  return await prisma.$transaction(async (tx) => {
    // Delete existing assignments
    await tx.seatAssignment.deleteMany({
      where: { sched_id: schedId }
    });
    
    // Create new assignments
    await tx.seatAssignment.createMany({
      data: assignments
    });
  });
}
```

---

## 🎨 Component Patterns

### Server Component (Default)
```typescript
// app/(admin-user)/(dashboard)/shows/page.tsx
import { getShows } from '@/lib/db/Shows';

export default async function ShowsPage() {
  const shows = await getShows();
  
  return (
    <div>
      {shows.map(show => (
        <ShowCard key={show.show_id} show={show} />
      ))}
    </div>
  );
}
```

### Client Component (Interactive)
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ShowForm() {
  const [name, setName] = useState('');
  const router = useRouter();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Call server action or API
    await createShow({ name });
    router.push('/dashboard/shows');
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Server Action Pattern
```typescript
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createShow(data: ShowInput) {
  // Validate input
  if (!data.name) {
    throw new Error('Show name is required');
  }
  
  // Create in database
  const show = await prisma.show.create({
    data: {
      show_name: data.name,
      // ... other fields
    }
  });
  
  // Revalidate cache
  revalidatePath('/dashboard/shows');
  
  return show;
}
```

---

## 🔐 Authentication Patterns

### Protect a Page (Server Component)
```typescript
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth/session';

export default async function ProtectedPage() {
  const session = cookies().get('session')?.value;
  
  if (!session) {
    redirect('/login');
  }
  
  const user = await verifySession(session);
  
  if (!user) {
    redirect('/login');
  }
  
  return <div>Protected content for {user.email}</div>;
}
```

### Admin-Only Page
```typescript
import { AdminShield } from '@/components/AdminShield';

export default function AdminPage() {
  return (
    <AdminShield>
      <div>Admin-only content</div>
    </AdminShield>
  );
}
```

### Get Current User (Client Component)
```typescript
'use client';

import { useAppSelector } from '@/lib/hooks';

export default function UserProfile() {
  const user = useAppSelector(state => state.auth.user);
  
  if (!user) {
    return <div>Not logged in</div>;
  }
  
  return <div>Welcome, {user.first_name}!</div>;
}
```

---

## 🎭 Redux Patterns

### Access State
```typescript
'use client';

import { useAppSelector } from '@/lib/hooks';

export default function MyComponent() {
  const isLoading = useAppSelector(state => state.loading.isLoading);
  const user = useAppSelector(state => state.auth.user);
  
  return <div>{isLoading ? 'Loading...' : `Hello ${user?.first_name}`}</div>;
}
```

### Dispatch Actions
```typescript
'use client';

import { useAppDispatch } from '@/lib/hooks';
import { setLoading } from '@/lib/features/loading/isLoadingSlice';
import { setUser } from '@/lib/features/auth/authSlice';

export default function MyComponent() {
  const dispatch = useAppDispatch();
  
  const handleLogin = async () => {
    dispatch(setLoading(true));
    const user = await loginUser();
    dispatch(setUser(user));
    dispatch(setLoading(false));
  };
  
  return <button onClick={handleLogin}>Login</button>;
}
```

---

## 🎨 Styling Patterns

### Tailwind Classes
```typescript
// Responsive design
<div className="px-4 md:px-8 lg:px-16">

// Dark mode
<div className="bg-white dark:bg-zinc-900">

// Hover states
<button className="hover:bg-blue-500 transition-colors">

// Custom brand colors (defined in globals.css)
<h1 className="text-blue-500">seatwise</h1>
```

### Custom CSS (globals.css)
```css
/* Add custom utilities */
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}

/* Add custom components */
@layer components {
  .btn-primary {
    @apply px-8 py-4 bg-blue-500 text-white font-bold uppercase;
  }
}
```

---

## 🧪 Testing Patterns

### Run Tests
```bash
# Run all tests
npm run test

# Run specific test file
node --experimental-strip-types lib/db/showScheduleGrouping.test.ts
```

### Test Structure (AAA Pattern)
```typescript
// lib/db/__tests__/Shows.test.ts
import { describe, it, expect } from 'node:test';
import { getShowById } from '../Shows';

describe('Shows', () => {
  it('should fetch show by ID', async () => {
    // Arrange
    const showId = 'test-show-id';
    
    // Act
    const show = await getShowById(showId);
    
    // Assert
    expect(show).toBeDefined();
    expect(show.show_id).toBe(showId);
  });
});
```

---

## 🐛 Debugging Tips

### Common Issues & Solutions

#### Issue: "Cannot find module '@/...' "
**Solution:** Check `tsconfig.json` paths configuration
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

#### Issue: Prisma client not found
**Solution:** Regenerate Prisma client
```bash
npx prisma generate
```

#### Issue: Date saving with wrong timezone
**Solution:** Use `@db.Date` for date-only fields in schema
```prisma
model Show {
  show_start_date DateTime @db.Date
}
```

#### Issue: 3D model not loading
**Solution:** Check public folder and GLTF path
```typescript
useGLTF('/seatwise_final_draco.glb', 'https://www.gstatic.com/draco/...')
```

#### Issue: Middleware not protecting routes
**Solution:** Check middleware matcher config
```typescript
export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)']
};
```

---

## 📦 Adding New Features

### Checklist for New Feature

- [ ] **1. Database Schema**
  - Update `prisma/schema.prisma`
  - Run `npx prisma generate`
  - Run `npx prisma db push` (dev) or `npx prisma migrate dev` (prod)

- [ ] **2. Database Queries**
  - Create `lib/db/[Entity].ts`
  - Add type-safe query functions

- [ ] **3. Server Actions** (if needed)
  - Create `lib/actions/[domain].ts`
  - Add `'use server'` directive
  - Implement validation and error handling

- [ ] **4. API Routes** (if needed)
  - Create `app/api/[endpoint]/route.ts`
  - Implement GET, POST, PUT, DELETE handlers

- [ ] **5. Redux State** (if complex client state)
  - Create `lib/features/[feature]/[feature]Slice.ts`
  - Add to store in `lib/store.ts`

- [ ] **6. UI Components**
  - Create components in `components/`
  - Use Radix UI for headless components
  - Apply Tailwind for styling

- [ ] **7. Pages**
  - Create page in `app/(admin-user)/(dashboard)/[page]/page.tsx`
  - Or `app/(app-user)/[page]/page.tsx`

- [ ] **8. Navigation**
  - Update sidebar links in `components/admin-sidebar.tsx` or `components/app-sidebar.tsx`

- [ ] **9. Testing**
  - Add tests for database queries
  - Add tests for server actions
  - Test UI components

- [ ] **10. Documentation**
  - Update TODO.md
  - Add comments for complex logic

---

## 🔧 Useful Scripts

### Custom Scripts (Add to package.json)
```json
{
  "scripts": {
    "db:studio": "npx prisma studio",
    "db:reset": "npx prisma migrate reset",
    "db:seed": "node prisma/seed.ts",
    "type-check": "tsc --noEmit",
    "format": "prettier --write ."
  }
}
```

---

## 📚 Code Examples Repository

### Type Guard Pattern
```typescript
function isShow(data: unknown): data is Show {
  return (
    typeof data === 'object' &&
    data !== null &&
    'show_id' in data &&
    'show_name' in data &&
    typeof (data as any).show_id === 'string' &&
    typeof (data as any).show_name === 'string'
  );
}
```

### Error Handling Pattern
```typescript
export async function fetchShow(id: string) {
  try {
    const res = await fetch(`/api/shows/${id}`);
    
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Show not found: ${id}`);
      }
      throw new Error(`Failed to fetch show: ${res.status}`);
    }
    
    const data: unknown = await res.json();
    
    if (!isShow(data)) {
      throw new Error('Invalid show data received');
    }
    
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: ${error.message}`);
    }
    throw error;
  }
}
```

### Cloudinary Upload Pattern
```typescript
import { v2 as cloudinary } from 'cloudinary';

export async function uploadAvatar(file: File, userId: string) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder: 'avatars',
        public_id: userId,
        overwrite: true
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    ).end(buffer);
  });
}
```

---

## 🎯 Performance Optimization Tips

### 1. Database Queries
- Use `select` to fetch only needed fields
- Use `include` sparingly (N+1 queries)
- Add indexes on frequently queried fields
- Use transactions for multiple related operations

### 2. 3D Graphics
- Use Draco compression for models
- Set `frameloop="demand"` for static scenes
- Reduce material complexity on mobile
- Disable shadows on mobile

### 3. Images
- Use Next.js `<Image>` component
- Set proper width/height
- Use `priority` for above-fold images
- Configure Cloudinary transformations

### 4. Code Splitting
- Use dynamic imports for heavy components
- Lazy load routes
- Split vendor bundles

---

## 📞 Getting Help

### Resources
- **Next.js Docs:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Tailwind Docs:** https://tailwindcss.com/docs
- **Radix UI:** https://www.radix-ui.com/
- **React Three Fiber:** https://docs.pmnd.rs/react-three-fiber

### Internal Documentation
- `REPOSITORY_OVERVIEW.md` - High-level architecture
- `ARCHITECTURE_DIAGRAM.md` - System diagrams and flows
- `QUEUE_SYSTEM_DESIGN.md` - Queue system architecture
- `lib/api-implementation-reasoning.md` - Type safety patterns
- `TODO.md` - Current tasks and priorities

---

*Last updated: 2026-02-13*
