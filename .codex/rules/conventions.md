# conventions.md — Repository Conventions

This file defines naming, structure, and style conventions for the Seatwise repository.
Follow these conventions unless an existing module clearly uses a different established pattern.

---

## 1) General Principles
- **Clarity over Cleverness**: Code should be readable and explain itself.
- **Minimalism**: Keep files focused and avoid unnecessary code.
- **Type Safety**: Use TypeScript strictly. Avoid `any` unless absolutely necessary.
- **Consistency**: Follow existing patterns in the codebase (Next.js App Router, Redux Toolkit, shadcn/ui).

---

## 2) Naming Conventions

### Files & Folders
- **Folders**: Use **kebab-case** for all directory names (e.g., `app/admin/`, `lib/features/`).
- **Route Folders**: Use **kebab-case** for App Router folders (e.g., `app/api/auth/`).
- **React Components**:
    - Custom UI components: Use **PascalCase** (e.g., `AdminShield.tsx`, `LoadingScreen.tsx`).
    - shadcn/ui and Radix-based components: Use **kebab-case** (e.g., `button.tsx`, `dropdown-menu.tsx`).
    - Sidebar/Nav components: Use **kebab-case** (e.g., `app-sidebar.tsx`, `nav-main.tsx`).
- **Logic & Services**:
    - Utility files: Use **camelCase** (e.g., `firebaseAdmin.ts`, `prisma.ts`).
    - DB Access/Domain models: Use **PascalCase** for the file if it represents a model helper (e.g., `Users.ts`).
- **Slices**: Use **camelCase** (e.g., `authSlice.ts`, `isLoadingSlice.ts`).
- **Hooks**: Use **kebab-case** (e.g., `use-mobile.ts`).

### Functions & variables
- **Functions**: Use **camelCase** with verb-based names (e.g., `getUsers()`, `toDbUser()`).
- **Variables**: Use **camelCase**.
- **Types/Interfaces**: Use **PascalCase** (e.g., `DbUser`, `UserProfile`).
- **Constants**: Use **UPPER_SNAKE_CASE** for true global constants.

---

## 3) Import Conventions
- **Absolute Imports**: Always use the `@/` alias for internal modules.
    - ✅ `import { prisma } from "@/lib/prisma";`
- **Grouping**:
    1. React and Next.js built-ins.
    2. Third-party libraries (e.g., `firebase`, `lucide-react`).
    3. Internal modules using `@/`.
    4. Relative imports `./` (use only for very local items).

---

## 4) File Placement Conventions

### UI & Presentation
- **Routes**: `app/[route]/page.tsx`
- **Layouts**: `app/[route]/layout.tsx`
- **shadcn Components**: `components/ui/`
- **Shared Components**: `components/`
- **Public Assets**: `public/`

### Shared Logic
- **RTK Slices**: `lib/features/[feature]/`
- **Database Logic**: `lib/db/`
- **Firebase Config**: `lib/firebaseAdmin.ts` and `lib/firebaseClient.ts`
- **Shared Store**: `lib/store.ts` and `lib/hooks.ts`
- **Prisma Client**: `lib/prisma.ts`

---

## 5) React / Next.js Conventions

### Server vs Client
- **Server Components by default**: Keep business logic and DB queries on the server.
- **"use client"**: Required for components using:
    - State or Effects (`useState`, `useEffect`).
    - Redux hooks (`useAppDispatch`, `useAppSelector`).
    - Browser APIs.
    - shadcn components that rely on Radix primitives.

### Style
- **Small Components**: Break down large components into smaller, reusable ones.
- **Early Returns**: Use early returns for conditional rendering (e.g., `if (!user) return null;`).
- **Typed Props**: Use `interface` or `type` for all component props.

---

## 6) Database & State Conventions

### Prisma
- **Server Only**: Never use `prisma` in client components or exposed client code.
- **Central Client**: Always import the singleton from `@/lib/prisma`.

### Redux (RTK)
- **Typed Hooks**: Always use `useAppDispatch` and `useAppSelector` from `@/lib/hooks`.
- **Slices**: Keep state logic contained within slices. Use thunks for complex async operations.
