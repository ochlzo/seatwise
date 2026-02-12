# Seatwise v2 - System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER (Browser)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Landing Page    │  │ Admin Dashboard  │  │   User Portal    │          │
│  │  (3D Experience) │  │  (Management)    │  │   (Booking)      │          │
│  │                  │  │                  │  │                  │          │
│  │  • Three.js      │  │  • Show CRUD     │  │  • Browse Shows  │          │
│  │  • GSAP Scroll   │  │  • Seatmap       │  │  • Select Seats  │          │
│  │  • Animations    │  │    Builder       │  │  • GCash Pay     │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                               │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────────────────────┐
│                         FRONTEND FRAMEWORK LAYER                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Next.js 16 (App Router)                         │   │
│  │                                                                       │   │
│  │  • React 19.2.3 + TypeScript 5                                       │   │
│  │  • Server Components + Client Components                             │   │
│  │  • Server Actions (mutations)                                        │   │
│  │  • Middleware (auth protection)                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Redux Toolkit   │  │  Tailwind CSS v4 │  │  Radix UI        │          │
│  │  (State Mgmt)    │  │  (Styling)       │  │  (Components)    │          │
│  │                  │  │                  │  │                  │          │
│  │  • auth          │  │  • Custom theme  │  │  • Dialog        │          │
│  │  • loading       │  │  • Dark mode     │  │  • Dropdown      │          │
│  │  • seatmap       │  │  • Responsive    │  │  • Select        │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                               │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────────────────────┐
│                            API / MIDDLEWARE LAYER                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      middleware.ts (Route Guard)                     │   │
│  │                                                                       │   │
│  │  • Session cookie validation                                         │   │
│  │  • Redirect to /login if unauthenticated                             │   │
│  │  • Public paths: /, /login, /api/*                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Next.js API Routes                            │   │
│  │                                                                       │   │
│  │  /api/auth/*        → Login, Logout, OTP                             │   │
│  │  /api/shows/*       → Show CRUD operations                           │   │
│  │  /api/seatmaps/*    → Seatmap CRUD operations                        │   │
│  │  /api/users/*       → User management                                │   │
│  │  /api/uploads/*     → File uploads (Cloudinary)                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Server Actions                               │   │
│  │                                                                       │   │
│  │  lib/actions/*      → Type-safe mutations with validation            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────────────────────┐
│                          BACKEND SERVICES LAYER                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Firebase Auth   │  │   Prisma ORM     │  │   Cloudinary     │          │
│  │                  │  │                  │  │                  │          │
│  │  • Google OAuth  │  │  • Type-safe     │  │  • Avatar upload │          │
│  │  • Email/Pass    │  │    queries       │  │  • Show images   │          │
│  │  • OTP verify    │  │  • Migrations    │  │  • Thumbnails    │          │
│  │  • Session mgmt  │  │  • Relations     │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    FUTURE: Queue System Services                     │   │
│  │                                                                       │   │
│  │  ┌──────────────────┐              ┌──────────────────┐             │   │
│  │  │ Upstash Redis    │              │  Ably Realtime   │             │   │
│  │  │                  │              │                  │             │   │
│  │  │ • Queue state    │              │ • Push notifs    │             │   │
│  │  │ • Active sessions│              │ • Live counts    │             │   │
│  │  │ • Metrics        │              │ • Private chans  │             │   │
│  │  └──────────────────┘              └──────────────────┘             │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
┌───────────────────────────────┴─────────────────────────────────────────────┐
│                           DATABASE LAYER (Neon)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL Database                             │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │    User     │  │    Show     │  │   Seatmap   │                 │   │
│  │  │             │  │             │  │             │                 │   │
│  │  │ • user_id   │  │ • show_id   │  │ • seatmap_id│                 │   │
│  │  │ • firebase  │  │ • name      │  │ • name      │                 │   │
│  │  │ • email     │  │ • venue     │  │ • json      │                 │   │
│  │  │ • role      │  │ • dates     │  │ • status    │                 │   │
│  │  │ • avatar    │  │ • status    │  │             │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │    Sched    │  │    Seat     │  │ SeatCategory│                 │   │
│  │  │             │  │             │  │             │                 │   │
│  │  │ • sched_id  │  │ • seat_id   │  │ • category  │                 │   │
│  │  │ • date      │  │ • number    │  │ • price     │                 │   │
│  │  │ • times     │  │ • seatmap   │  │ • color     │                 │   │
│  │  │ • show      │  │             │  │ • seatmap   │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │  │CategorySet  │  │     Set     │  │SeatAssignment│                │   │
│  │  │             │  │             │  │             │                 │   │
│  │  │ • set_id    │  │ • set_id    │  │ • assign_id │                 │   │
│  │  │ • name      │  │ • sched     │  │ • seat      │                 │   │
│  │  │ • show      │  │ • category  │  │ • sched     │                 │   │
│  │  │ • items[]   │  │             │  │ • status    │                 │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  │                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                              DATA FLOW EXAMPLES
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. USER LOGIN FLOW                                                           │
└─────────────────────────────────────────────────────────────────────────────┘

  Browser                Next.js              Firebase Auth         Database
     │                      │                       │                   │
     │  POST /api/auth      │                       │                   │
     ├─────────────────────>│                       │                   │
     │                      │  signInWithEmail      │                   │
     │                      ├──────────────────────>│                   │
     │                      │                       │                   │
     │                      │  <── ID Token ────────┤                   │
     │                      │                       │                   │
     │                      │  Verify token         │                   │
     │                      ├──────────────────────>│                   │
     │                      │                       │                   │
     │                      │  Query user by UID    │                   │
     │                      ├───────────────────────────────────────────>│
     │                      │                       │                   │
     │                      │  <── User data ───────────────────────────┤
     │                      │                       │                   │
     │  Set session cookie  │                       │                   │
     │<─────────────────────┤                       │                   │
     │                      │                       │                   │
     │  Redirect /dashboard │                       │                   │
     │<─────────────────────┤                       │                   │


┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. SHOW CREATION FLOW (Admin)                                                │
└─────────────────────────────────────────────────────────────────────────────┘

  Browser                Next.js              Cloudinary            Database
     │                      │                       │                   │
     │  Upload thumbnail    │                       │                   │
     ├─────────────────────>│                       │                   │
     │                      │  Upload image         │                   │
     │                      ├──────────────────────>│                   │
     │                      │                       │                   │
     │                      │  <── image_key ───────┤                   │
     │                      │                       │                   │
     │  Submit show form    │                       │                   │
     ├─────────────────────>│                       │                   │
     │                      │                       │                   │
     │                      │  Validate data        │                   │
     │                      │  (dates, status)      │                   │
     │                      │                       │                   │
     │                      │  Create Show record   │                   │
     │                      ├───────────────────────────────────────────>│
     │                      │                       │                   │
     │                      │  Create Sched records │                   │
     │                      ├───────────────────────────────────────────>│
     │                      │                       │                   │
     │                      │  <── Success ─────────────────────────────┤
     │                      │                       │                   │
     │  Show created        │                       │                   │
     │<─────────────────────┤                       │                   │


┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. SEATMAP BUILDER FLOW                                                      │
└─────────────────────────────────────────────────────────────────────────────┘

  Browser (Konva)        Redux Store           Next.js              Database
     │                      │                      │                   │
     │  Drag seat           │                      │                   │
     ├─────────────────────>│                      │                   │
     │                      │                      │                   │
     │  Update position     │                      │                   │
     │<─────────────────────┤                      │                   │
     │                      │                      │                   │
     │  Assign category     │                      │                   │
     ├─────────────────────>│                      │                   │
     │                      │                      │                   │
     │  Update node color   │                      │                   │
     │<─────────────────────┤                      │                   │
     │                      │                      │                   │
     │  Save seatmap        │                      │                   │
     ├─────────────────────>│                      │                   │
     │                      │                      │                   │
     │                      │  Serialize to JSON   │                   │
     │                      ├─────────────────────>│                   │
     │                      │                      │                   │
     │                      │                      │  Create Seatmap   │
     │                      │                      ├──────────────────>│
     │                      │                      │                   │
     │                      │                      │  Create Seats     │
     │                      │                      ├──────────────────>│
     │                      │                      │                   │
     │                      │                      │  <── Success ─────┤
     │                      │                      │                   │
     │  Success toast       │                      │                   │
     │<─────────────────────┴──────────────────────┤                   │


┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. FUTURE: QUEUE SYSTEM FLOW                                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  Browser               Next.js              Redis                 Ably
     │                     │                    │                    │
     │  Join queue         │                    │                    │
     ├────────────────────>│                    │                    │
     │                     │  ZADD queue        │                    │
     │                     ├───────────────────>│                    │
     │                     │                    │                    │
     │                     │  <── rank ─────────┤                    │
     │                     │                    │                    │
     │  Subscribe private  │                    │                    │
     ├────────────────────────────────────────────────────────────>│
     │                     │                    │                    │
     │  Heartbeat poll     │                    │                    │
     ├────────────────────>│                    │                    │
     │                     │  ZRANK             │                    │
     │                     ├───────────────────>│                    │
     │                     │                    │                    │
     │  <── rank, ETA ─────┤                    │                    │
     │                     │                    │                    │
     │                     │  ZPOPMIN (turn)    │                    │
     │                     ├───────────────────>│                    │
     │                     │                    │                    │
     │                     │  Publish ACTIVE    │                    │
     │                     ├────────────────────────────────────────>│
     │                     │                    │                    │
     │  <── Your turn! ────────────────────────────────────────────┤
     │                     │                    │                    │
     │  Select seats       │                    │                    │
     ├────────────────────>│                    │                    │


═══════════════════════════════════════════════════════════════════════════════
                            KEY ARCHITECTURAL DECISIONS
═══════════════════════════════════════════════════════════════════════════════

1. **Next.js App Router**
   - Server Components for data fetching
   - Client Components for interactivity
   - Server Actions for mutations (type-safe)

2. **Type Safety**
   - Unknown boundary pattern at API edges
   - Type guards for runtime validation
   - No `as Type` assertions at trust boundaries

3. **State Management**
   - Redux for complex client state (seatmap editor)
   - Server state via React Query patterns (future)
   - Session state in cookies (httpOnly)

4. **Database Design**
   - Normalized schema with proper relations
   - CategorySet for reusable pricing bundles
   - Set for per-schedule category instances
   - SeatAssignment for seat-schedule-category mapping

5. **Authentication**
   - Firebase for auth provider
   - Session cookies for Next.js middleware
   - Role-based access control (USER/ADMIN)

6. **Performance**
   - 3D model: Draco compression, demand rendering
   - Mobile: Reduced materials, no bloom effects
   - Database: Proper indexing on foreign keys
   - Future: Redis for queue state, Ably for push

7. **File Storage**
   - Cloudinary for user avatars and show images
   - Future: Consider R2 for cost optimization

8. **Queue System (Planned)**
   - Hybrid pull (heartbeat) + push (realtime)
   - Redis for queue state (single source of truth)
   - Ably for instant notifications
   - Fencing tokens for active sessions

═══════════════════════════════════════════════════════════════════════════════
