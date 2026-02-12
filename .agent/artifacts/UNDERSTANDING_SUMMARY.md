# Seatwise v2 - Repository Understanding Summary

> **Generated:** 2026-02-13  
> **Purpose:** Executive summary of the Seatwise v2 codebase analysis

---

## 📋 What is Seatwise?

**Seatwise** is a modern, full-stack venue management and seat reservation system designed for **Bicol University College of Arts and Letters Amphitheater**. It provides a cinema-style booking experience with:

- **Interactive 3D landing page** with scroll-driven animations
- **Visual seatmap builder** for admins to create venue layouts
- **Real-time seat selection** for users
- **GCash payment integration** (planned)
- **Scalable queue system** for high-traffic events (planned)

---

## 🏗️ Technology Stack at a Glance

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4 |
| **3D Graphics** | Three.js, React Three Fiber, GSAP |
| **State** | Redux Toolkit |
| **Backend** | Next.js API Routes, Server Actions |
| **Database** | PostgreSQL (Neon) + Prisma ORM |
| **Auth** | Firebase Auth + Admin SDK |
| **Storage** | Cloudinary (images) |
| **Future** | Upstash Redis (queue), Ably (realtime) |

---

## 📁 Project Structure Overview

```
seatwise_v2/
├── app/                    # Next.js App Router
│   ├── (admin-user)/       # Admin dashboard & seatmap builder
│   ├── (app-user)/         # User portal (events, profile)
│   ├── api/                # API endpoints
│   ├── login/              # Authentication
│   └── page.tsx            # 3D landing page
│
├── components/             # React components
│   ├── ui/                 # Radix UI components
│   └── seatmap/            # Seatmap-specific components
│
├── lib/                    # Core business logic
│   ├── actions/            # Server actions
│   ├── db/                 # Database queries
│   ├── features/           # Redux slices
│   └── auth/               # Authentication utilities
│
├── prisma/                 # Database schema
└── public/                 # Static assets (3D models, images)
```

---

## 🗄️ Database Schema Summary

### Core Entities
- **User** - Authentication, roles (USER/ADMIN), avatars
- **Show** - Events with metadata, dates, status
- **Sched** - Specific date/time instances of shows
- **Seatmap** - Visual layouts stored as JSON
- **Seat** - Physical seats in a seatmap
- **SeatCategory** - Pricing tiers (VIP, Regular, etc.)
- **CategorySet** - Reusable bundles of categories
- **Set** - Per-schedule category assignments
- **SeatAssignment** - Maps seats to schedules with status

### Key Design Patterns
- **Reusable pricing:** CategorySet allows multiple schedules to share pricing structures
- **Flexible pricing:** Set allows per-schedule category customization
- **Status tracking:** SeatAssignment tracks OPEN/RESERVED per seat per schedule

---

## 🎯 Key Features

### 1. **3D Landing Page** (`app/page.tsx`)
- Scroll-driven 3D seat model animation
- GSAP ScrollTrigger integration
- Responsive (desktop/mobile configs)
- Performance-optimized (Draco compression, demand rendering)

### 2. **Seatmap Builder** (`app/(admin-user)/seat-builder`)
- Canvas-based (React Konva)
- Drag-and-drop seat placement
- Category assignment with color coding
- JSON import/export

### 3. **Show Management** (`app/(admin-user)/(dashboard)/shows`)
- CRUD operations
- Multiple schedules per show
- Category set assignment
- Status workflow (DRAFT → UPCOMING → OPEN → CLOSED)

### 4. **Authentication** (`components/login-form.tsx`)
- Firebase Auth (Google OAuth, Email/Password)
- Session cookies + middleware protection
- Role-based access (USER/ADMIN)

### 5. **Queue System** (Planned - `QUEUE_SYSTEM_DESIGN.md`)
- Hybrid pull (heartbeat) + push (realtime)
- Redis for queue state
- Ably for instant notifications
- Fencing tokens for active sessions

---

## 🔐 Authentication Flow

```
User Login → Firebase Auth → Verify Token → Query DB → Set Session Cookie → Redirect
```

**Protection:**
- Middleware checks session cookie on all routes except `/`, `/login`, `/api/*`
- AdminShield component for admin-only pages
- Role-based routing (`(admin-user)` vs `(app-user)`)

---

## 🎨 Development Patterns

### Type Safety
- **Pattern:** Unknown boundary with type guards
- **Anti-pattern:** Avoid `as Type` at API boundaries
- **Validation:** Runtime checks with explicit error handling

### Code Organization
- **Server Components:** Default for data fetching
- **Client Components:** `'use client'` for interactivity
- **Server Actions:** `'use server'` for mutations
- **Redux:** Complex client state (seatmap editor)

### Database Queries
- Type-safe with Prisma
- Use `include` for relations
- Transactions for multi-step operations
- Proper indexing on foreign keys

---

## 📊 Current State

### ✅ Completed Features
- 3D landing page with animations
- Authentication system
- Show CRUD operations
- Seatmap builder with JSON import/export
- Seat numbering and category assignment
- Admin and user dashboards
- Profile management
- Dynamic breadcrumbs

### 🚧 In Progress (from TODO.md)
1. **Create Reservation Flow** (main focus)
2. Prevent DDOS in login + OTP
3. Calendar page (admin + user)
4. Dashboard page (admin)
5. Users page (admin)

### 🐛 Recently Fixed Issues
- Date saving bug (timezone offset)
- Seatmap revert on cancel
- Show creation validation logic
- Profile avatar mobile rendering
- Page scroll issues

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (Neon)
- Firebase project
- Cloudinary account

### Quick Start
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Start development server
npm run dev
```

### Essential Commands
```bash
npm run dev          # Development server
npm run build        # Production build
npx prisma studio    # Database GUI
npx prisma generate  # Regenerate Prisma client
```

---

## 📚 Documentation Artifacts

I've created three comprehensive documents for you:

### 1. **REPOSITORY_OVERVIEW.md**
- Detailed project summary
- Complete tech stack breakdown
- Database schema explanation
- Feature descriptions
- Authentication flow
- Development patterns
- Recent conversation context

### 2. **ARCHITECTURE_DIAGRAM.md**
- ASCII system architecture diagram
- Layer-by-layer breakdown
- Data flow examples (login, show creation, seatmap, queue)
- Key architectural decisions

### 3. **DEVELOPER_QUICK_REFERENCE.md**
- Common file locations
- Database operation patterns
- Component patterns (server/client)
- Authentication patterns
- Redux patterns
- Styling patterns
- Testing patterns
- Debugging tips
- Code examples

---

## 🎯 Key Insights

### Strengths
1. **Modern Stack:** Next.js 16 with App Router, React 19, TypeScript
2. **Type Safety:** Comprehensive type guards and validation
3. **Performance:** Optimized 3D rendering, Draco compression
4. **Scalability:** Designed for queue system with Redis + Ably
5. **Clean Architecture:** Separation of concerns, proper layering

### Areas of Focus
1. **Reservation Flow:** Primary development focus
2. **Queue System:** Architecture designed, implementation pending
3. **Payment Integration:** GCash integration planned
4. **Testing:** Expand test coverage
5. **Performance:** Continue mobile optimization

### Design Philosophy
- **Type safety first:** No `as Type` at boundaries
- **Clean code:** Concise, self-documenting
- **Mobile-first:** Responsive design throughout
- **Performance-conscious:** Optimizations for 3D and mobile

---

## 🔄 Development Workflow

### Adding a New Feature
1. Update database schema (`prisma/schema.prisma`)
2. Create database queries (`lib/db/[Entity].ts`)
3. Add server actions if needed (`lib/actions/[domain].ts`)
4. Create UI components (`components/`)
5. Build pages (`app/(admin-user)/(dashboard)/[page]/page.tsx`)
6. Update navigation (sidebar components)
7. Add tests
8. Update TODO.md

### Code Review Checklist
- [ ] Type safety (no unsafe assertions)
- [ ] Error handling (HTTP, network, validation)
- [ ] Mobile responsiveness
- [ ] Dark mode compatibility
- [ ] Performance impact
- [ ] Tests added/updated

---

## 📞 Next Steps

### Recommended Actions
1. **Review the three documentation files** to deepen understanding
2. **Explore the codebase** using the file locations in the quick reference
3. **Set up local environment** following the getting started guide
4. **Focus on reservation flow** as per TODO.md priority
5. **Study the queue system design** for upcoming implementation

### Questions to Consider
- How should the reservation flow handle concurrent bookings?
- What payment gateway integration is needed for GCash?
- When should the queue system be implemented?
- What analytics/metrics should be tracked?

---

## 🎓 Learning Resources

### Internal Documentation
- `QUEUE_SYSTEM_DESIGN.md` - Queue architecture
- `lib/api-implementation-reasoning.md` - Type safety patterns
- `TODO.md` - Current priorities
- Conversation history (20+ conversations available)

### External Resources
- [Next.js 16 Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## 🤝 Project Context

**Institution:** Bicol University College of Arts and Letters  
**Venue:** Amphitheater  
**Developers:** Cholo Candelaria, Sean Armenta  
**Year:** 2026  
**Status:** Active development, reservation flow in progress

---

## ✨ Summary

Seatwise v2 is a **well-architected, modern full-stack application** with:
- Strong type safety and error handling
- Performance-optimized 3D graphics
- Scalable queue system design
- Clean separation of concerns
- Mobile-first responsive design

The codebase is **production-ready** for current features, with a **clear roadmap** for the reservation flow and queue system implementation.

---

*This summary provides a high-level understanding of the Seatwise v2 repository. For detailed information, refer to the three comprehensive documentation files created in `.agent/artifacts/`.*
