# Seatwise v2 - Repository Overview

> **Generated:** 2026-02-13  
> **Purpose:** Comprehensive understanding of the Seatwise v2 codebase

---

## 🎯 Project Summary

**Seatwise** is a modern venue management and seat reservation system built for **Bicol University College of Arts and Letters Amphitheater**. It provides cinema-style seat booking with real-time seat selection, GCash payment integration, and a sophisticated queuing system.

### Core Value Proposition
- **For Users:** Interactive seat selection with instant GCash payment
- **For Admins:** Visual seatmap builder, show management, and real-time analytics
- **For Venue:** Scalable queue system to handle high-traffic booking scenarios

---

## 🏗️ Tech Stack

### Frontend
- **Framework:** Next.js 16.1.1 (App Router)
- **Language:** TypeScript 5 (Strict mode)
- **UI Library:** React 19.2.3
- **Styling:** Tailwind CSS v4 + Custom CSS
- **State Management:** Redux Toolkit (@reduxjs/toolkit)
- **3D Graphics:** Three.js + React Three Fiber + Drei
- **Animations:** GSAP 3.14.2 + Framer Motion
- **Component Library:** Radix UI (headless components)
- **Forms:** React Hook Form (implied from patterns)

### Backend
- **Runtime:** Next.js API Routes (Server Actions enabled)
- **Database:** PostgreSQL (via Neon)
- **ORM:** Prisma 5.22.0
- **Authentication:** Firebase Auth + Firebase Admin
- **File Storage:** Cloudinary (avatars, show images)
- **Real-time:** Ably (planned for queue system)
- **Caching/Queue:** Upstash Redis (planned)

### Development Tools
- **Linting:** ESLint 9
- **Package Manager:** npm
- **Testing:** Node.js experimental test runner
- **3D Optimization:** GLTF Transform, Draco compression

---

## 📁 Project Structure

```
seatwise_v2/
├── .agent/                    # AI agent configuration and workflows
│   ├── agents/                # Specialist agent definitions
│   ├── skills/                # Reusable skill modules
│   ├── scripts/               # Automation scripts
│   └── workflows/             # Workflow definitions
│
├── app/                       # Next.js App Router
│   ├── (admin-user)/          # Admin routes (protected)
│   │   ├── (dashboard)/       # Dashboard pages
│   │   │   ├── dashboard/
│   │   │   ├── shows/         # Show management
│   │   │   ├── seatmaps/      # Seatmap management
│   │   │   └── ...
│   │   └── seat-builder/      # Visual seatmap builder
│   │
│   ├── (app-user)/            # User routes (protected)
│   │   ├── (events)/          # Event browsing
│   │   ├── account/           # Account settings
│   │   └── profile/           # User profile
│   │
│   ├── api/                   # API routes
│   │   ├── auth/              # Authentication endpoints
│   │   ├── shows/             # Show CRUD
│   │   ├── seatmaps/          # Seatmap CRUD
│   │   ├── users/             # User management
│   │   └── uploads/           # File uploads
│   │
│   ├── login/                 # Login page (public)
│   ├── page.tsx               # Landing page with 3D scene
│   ├── layout.tsx             # Root layout
│   └── globals.css            # Global styles
│
├── components/                # React components
│   ├── ui/                    # Shadcn/Radix UI components
│   ├── seatmap/               # Seatmap-specific components
│   ├── admin-sidebar.tsx
│   ├── app-sidebar.tsx
│   ├── login-form.tsx
│   └── ...
│
├── lib/                       # Core libraries
│   ├── actions/               # Server actions
│   ├── auth/                  # Auth utilities
│   ├── db/                    # Database queries
│   ├── features/              # Redux slices
│   │   ├── auth/
│   │   ├── loading/
│   │   └── seatmap/
│   ├── seatmap/               # Seatmap logic
│   ├── types/                 # TypeScript types
│   ├── store.ts               # Redux store
│   ├── prisma.ts              # Prisma client
│   └── utils.ts               # Utility functions
│
├── prisma/
│   └── schema.prisma          # Database schema
│
├── public/                    # Static assets
│   ├── seatwise_final_draco.glb  # 3D seat model
│   ├── bu-logo.png
│   └── icon.png
│
├── hooks/                     # Custom React hooks
├── utils/                     # Utility functions
├── middleware.ts              # Next.js middleware (auth)
├── QUEUE_SYSTEM_DESIGN.md     # Queue architecture doc
└── TODO.md                    # Task tracker
```

---

## 🗄️ Database Schema (Prisma)

### Core Entities

#### **User**
- Authentication via Firebase (firebase_uid)
- Roles: USER, ADMIN
- Status: ACTIVE, INACTIVE
- Avatar stored in Cloudinary (avatar_key)

#### **Show**
- Event metadata (name, description, venue, dates)
- Status: DRAFT, UPCOMING, OPEN, ON_GOING, CLOSED, CANCELLED, POSTPONED
- Links to Seatmap (optional for DRAFT)
- Contains multiple Schedules (Sched)

#### **Sched** (Schedule)
- Specific date/time for a show
- Links to CategorySet (reusable pricing bundles)
- Contains SeatAssignments

#### **Seatmap**
- Visual layout stored as JSON (seatmap_json)
- Contains Seats and SeatCategories
- Status: ACTIVE, DISABLED

#### **Seat**
- Physical seat in a seatmap (seat_number)
- Unique per seatmap

#### **SeatCategory**
- Pricing tier (VIP, Regular, Balcony, etc.)
- Color-coded (GOLD, PINK, BLUE, BURGUNDY, GREEN)
- Scoped to a seatmap

#### **CategorySet**
- Reusable bundle of SeatCategories
- Example: "SET A" = VIP + REGULAR + BALCONY
- Allows schedules to share pricing structures

#### **Set**
- Per-schedule link to a SeatCategory
- Enables different pricing per schedule

#### **SeatAssignment**
- Maps a Seat to a Schedule with a Category (via Set)
- Tracks seat status: OPEN, RESERVED

### Key Relationships
```
Show → Seatmap (optional)
Show → Sched[] (multiple schedules)
Show → CategorySet[] (pricing bundles)

Sched → CategorySet (optional)
Sched → Set[] (schedule-specific categories)
Sched → SeatAssignment[]

Seatmap → Seat[]
Seatmap → SeatCategory[]

SeatAssignment → Seat + Sched + Set
Set → Sched + SeatCategory
```

---

## 🎨 Key Features

### 1. **Landing Page (3D Experience)**
- **File:** `app/page.tsx`
- **Tech:** React Three Fiber, GSAP ScrollTrigger
- **Features:**
  - Scroll-driven 3D seat model animation
  - Responsive (desktop/mobile configurations)
  - Performance-optimized (Draco compression, demand rendering)
  - Dark mode support
  - Bloom effects (desktop only)

### 2. **Seatmap Builder**
- **Location:** `app/(admin-user)/seat-builder`
- **Tech:** React Konva (canvas-based)
- **Features:**
  - Drag-and-drop seat placement
  - Seat numbering (row + number)
  - Category assignment with color coding
  - JSON import/export
  - Snap-to-grid
  - Viewport controls

### 3. **Show Management**
- **Location:** `app/(admin-user)/(dashboard)/shows`
- **Features:**
  - CRUD operations for shows
  - Schedule management (multiple dates/times)
  - Category set assignment
  - Status workflow (DRAFT → UPCOMING → OPEN → CLOSED)
  - Date validation (show_start_date, show_end_date, sched_date)

### 4. **Authentication**
- **File:** `components/login-form.tsx`
- **Flow:**
  - Firebase Auth (Google OAuth, Email/Password)
  - OTP verification
  - Session cookies (httpOnly)
  - Middleware-based route protection
  - Role-based access (USER vs ADMIN)

### 5. **Queue System** (Planned)
- **Design:** `QUEUE_SYSTEM_DESIGN.md`
- **Architecture:**
  - Hybrid Pull (Heartbeat) + Push (Realtime)
  - Redis (Upstash) for queue state
  - Ably for real-time notifications
  - Fencing tokens for active sessions
  - Adaptive polling to prevent thundering herd

---

## 🔐 Authentication & Authorization

### Middleware (`middleware.ts`)
- Protects all routes except `/`, `/login`, and API routes
- Checks for `session` cookie
- Redirects to `/login` with `callbackUrl` if unauthenticated

### Role-Based Access
- **Admin routes:** `app/(admin-user)/*`
- **User routes:** `app/(app-user)/*`
- **AdminShield component:** Verifies admin role on protected pages

### Session Management
- Firebase Admin SDK verifies tokens
- Session cookies set via server actions
- Expiration handled by Firebase

---

## 🎯 Current Focus (from TODO.md)

### High Priority
1. **Create Reservation Flow** (main focus)
2. Prevent DDOS in login + OTP
3. Calendar page (admin + user)
4. Dashboard page (admin)
5. Users page (admin)

### Pending Features
- Admin access page
- Edit thumbnail on show detail
- Seatmap status flag for "all seats assigned"

---

## 🐛 Known Issues (from Conversation History)

### Recently Fixed
1. ✅ Date saving bug (dates shifted by 1 day due to timezone)
2. ✅ Seatmap revert on cancel
3. ✅ Show creation validation (DRAFT status logic)
4. ✅ Profile avatar rendering (mobile squish)
5. ✅ Page scroll issues
6. ✅ Dynamic breadcrumbs
7. ✅ Seat numbering and display

### Performance Considerations
- Mobile 3D performance optimized (reduced materials, no bloom)
- Draco compression for 3D models
- Demand-based rendering (frameloop="demand")

---

## 📊 State Management (Redux)

### Slices
1. **auth** (`lib/features/auth`)
   - User session state
   - Login/logout actions

2. **loading** (`lib/features/loading`)
   - Global loading state
   - Used for page transitions and 3D model loading

3. **seatmap** (`lib/features/seatmap`)
   - Canvas state (nodes, categories, viewport)
   - Undo/redo history

---

## 🔧 Development Patterns

### Type Safety
- **Philosophy:** Documented in `lib/api-implementation-reasoning.md`
- **Pattern:** Unknown boundary with type guards
- **Anti-pattern:** Avoid `as Type` assertions
- **Validation:** Runtime checks at API boundaries

### Code Style
- **Clean Code:** Concise, self-documenting
- **Testing:** AAA pattern (Arrange, Act, Assert)
- **Error Handling:** Explicit HTTP status checks
- **File Dependencies:** Check `CODEBASE.md` before modifying

### API Design
- Server actions for mutations
- Type guards for response validation
- Centralized error handling
- Network retry logic (planned)

---

## 🚀 Deployment

### Environment Variables (Required)
```env
# Database
DATABASE_URL=          # Neon pooled URL
DIRECT_URL=            # Neon direct URL

# Firebase
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Upstash Redis (planned)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Ably (planned)
ABLY_API_KEY=
```

### Build Process
```bash
npm run build  # Runs prisma generate && next build
```

### Scripts
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run start` - Production server
- `npm run lint` - ESLint
- `npm run test` - Run tests

---

## 🎨 Design System

### Colors
- **Primary:** Blue (#3b82f6)
- **Seat Categories:**
  - GOLD: #ffd700
  - PINK: #e005b9
  - BLUE: #111184
  - BURGUNDY: #800020
  - GREEN: #046307

### Typography
- **Brand Font:** Custom (defined in globals.css)
- **Headings:** Extrabold, tight tracking
- **Body:** Medium weight, relaxed leading

### Themes
- Light mode (default)
- Dark mode (next-themes)
- System preference detection

---

## 📚 Key Documentation

1. **QUEUE_SYSTEM_DESIGN.md** - Queue architecture and Redis data structures
2. **lib/api-implementation-reasoning.md** - Type safety patterns
3. **TODO.md** - Current task list
4. **GEMINI.md** - AI agent behavior rules

---

## 🔄 Recent Conversation Context

### Last 5 Major Topics
1. **Date Saving Bug** (2026-02-02) - Fixed timezone issues
2. **Seatmap Revert** (2026-02-01) - Cancel button state restoration
3. **Show Creation Logic** (2026-01-31) - Status validation refinement
4. **Seatmap Import/Export** (2026-01-24) - JSON workflow
5. **Seat Numbering** (2026-01-22) - Display and assignment

---

## 🎓 Learning Resources

### Codebase Patterns
- **Type Guards:** See `lib/api-implementation-reasoning.md`
- **Server Actions:** Check `lib/actions/*`
- **Prisma Queries:** Review `lib/db/*`
- **3D Optimization:** Study `app/page.tsx` (SeatModel component)

### External Dependencies
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [Radix UI](https://www.radix-ui.com/)
- [GSAP ScrollTrigger](https://greensock.com/scrolltrigger/)

---

## 🤝 Contributing

### Before Making Changes
1. Read `GEMINI.md` for agent protocols
2. Check `TODO.md` for current priorities
3. Review relevant conversation history
4. Understand the database schema (`prisma/schema.prisma`)

### Code Review Checklist
- Type safety (no `as Type` at boundaries)
- Error handling (HTTP, network, validation)
- Mobile responsiveness
- Dark mode compatibility
- Performance impact (especially 3D/animations)

---

## 📞 Support

**Project:** Seatwise v2  
**Institution:** Bicol University College of Arts and Letters  
**Developers:** Cholo Candelaria, Sean Armenta  
**Year:** 2026

---

*This overview was generated to provide a comprehensive understanding of the Seatwise v2 repository. For specific implementation details, refer to the source files and documentation mentioned throughout this document.*
