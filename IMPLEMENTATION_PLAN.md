# FitNotes PWA Clone - Implementation Plan

## Project Overview

Create a self-hosted PWA (Progressive Web App) clone of FitNotes with:
- Full feature parity with Android app
- Multi-device sync
- Optional multi-user support
- Offline-first capability
- Import from FitNotes SQLite backups

---

## Technology Stack (Finalized)

### Frontend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | **Next.js 16** (App Router) | Latest version, SSR, API routes, excellent PWA support |
| UI Library | **React 19** | Component-based, large ecosystem |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Rapid development, consistent design, full control |
| State | **TanStack Query + Zustand** | Server state + client state |
| Forms | **React Hook Form + Zod** | Type-safe validation |
| Charts | **Recharts** | Progress graphs, React-native integration |
| Calendar | **Custom component** | Match FitNotes UX exactly |
| PWA | **@serwist/next** | Modern service worker, offline support |
| Real-time | **Socket.io-client** | WebSocket client for sync |

### Backend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | **Node.js 22 LTS** | Latest LTS, native fetch |
| API | **Next.js Server Actions + API Routes** | Type-safe, co-located |
| Database | **PostgreSQL 17** | Multi-user, robust, JSON support |
| ORM | **Drizzle ORM** | Type-safe, SQL-like, lightweight, excellent perf |
| Auth | **NextAuth.js v5 (Auth.js)** | Built for Next.js, credentials + OAuth |
| Real-time | **Socket.io** | WebSocket server for multi-device sync |
| Validation | **Zod** | Schema validation shared frontend/backend |

### Infrastructure
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Hosting | **Docker self-hosted** | Full control, any VPS/home server |
| Container | **Docker Compose** | Easy multi-service deployment |
| Reverse Proxy | **Traefik v3** | Auto SSL via Let's Encrypt, routing |
| Backup | **pg_dump + S3-compatible** | Database dumps to MinIO/Backblaze |

### Development Tools
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Package Manager | **pnpm** | Fast, disk efficient |
| Linting | **ESLint + Prettier** | Code quality |
| Testing | **Vitest + Playwright** | Unit + E2E testing |
| DB Migrations | **Drizzle Kit** | Schema migrations |
| Type Checking | **TypeScript 5.x** | Strict mode |

---

## Phase 1: Foundation (MVP)

### 1.1 Project Setup
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Configure Tailwind CSS and shadcn/ui
- [ ] Set up Prisma with PostgreSQL
- [ ] Configure PWA (manifest, service worker)
- [ ] Docker Compose configuration
- [ ] Environment configuration

### 1.2 Database Schema
Create Prisma schema matching FitNotes structure:

```prisma
// Core entities
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  settings  Settings?
  exercises Exercise[]
  categories Category[]
  // ... other relations
}

model Category {
  id        Int      @id @default(autoincrement())
  name      String
  color     String   // Hex color
  sortOrder Int      @default(0)
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  exercises Exercise[]
}

model Exercise {
  id              Int      @id @default(autoincrement())
  name            String
  categoryId      Int
  exerciseTypeId  Int      @default(0)
  notes           String?
  weightIncrement Int?     // grams
  defaultGraphId  Int?
  defaultRestTime Int?     // seconds
  weightUnitId    Int      @default(0)
  isFavorite      Boolean  @default(false)
  userId          String
  category        Category @relation(fields: [categoryId], references: [id])
  user            User     @relation(fields: [userId], references: [id])
  trainingLogs    TrainingLog[]
  goals           Goal[]
}

model TrainingLog {
  id           Int      @id @default(autoincrement())
  exerciseId   Int
  date         DateTime @db.Date
  metricWeight Int      // grams
  reps         Int
  unit         Int      @default(0)
  distance     Int      @default(0) // meters
  durationSeconds Int   @default(0)
  isPersonalRecord Boolean @default(false)
  isComplete   Boolean  @default(false)
  sortOrder    Int      @default(0)
  workoutGroupId Int?
  exercise     Exercise @relation(fields: [exerciseId], references: [id])
  workoutGroup WorkoutGroup? @relation(fields: [workoutGroupId], references: [id])
  comments     Comment[]
}

// ... additional models
```

### 1.3 Authentication
- [ ] User registration/login
- [ ] Session management
- [ ] Password reset flow
- [ ] Optional: OAuth providers (Google, etc.)

### 1.4 Core API Routes
- [ ] `/api/exercises` - CRUD operations
- [ ] `/api/categories` - CRUD operations
- [ ] `/api/training-logs` - CRUD operations
- [ ] `/api/workouts` - Workout session management

### 1.5 Basic UI Components
- [ ] Navigation/sidebar
- [ ] Exercise list view
- [ ] Category management
- [ ] Basic workout logging screen

**Deliverable**: Users can log in, create exercises, and log basic workouts.

---

## Phase 2: Workout Logging

### 2.1 Workout Log Screen
- [ ] Date selector with calendar
- [ ] Exercise picker (by category, favorites, recent)
- [ ] Set entry form (weight/reps or distance/time)
- [ ] Previous workout reference
- [ ] Copy previous sets
- [ ] Set completion toggle
- [ ] Set order drag-and-drop

### 2.2 Personal Records
- [ ] PR calculation algorithm
- [ ] PR detection on set save
- [ ] PR indicator badges
- [ ] PR history tracking
- [ ] Manual PR recalculation

### 2.3 Supersets
- [ ] Workout group creation
- [ ] Exercise grouping UI
- [ ] Color coding
- [ ] Auto-jump between exercises

### 2.4 Comments
- [ ] Set-level comments
- [ ] Workout-level comments
- [ ] Comment CRUD operations

### 2.5 Workout Timer
- [ ] Workout start/end tracking
- [ ] Auto-start on first set
- [ ] Auto-stop on exit
- [ ] Duration display

**Deliverable**: Full workout logging with PR tracking, supersets, and comments.

---

## Phase 3: Routines

### 3.1 Routine Management
- [ ] Create/edit/delete routines
- [ ] Routine sections (days/splits)
- [ ] Add exercises to sections
- [ ] Reorder sections and exercises

### 3.2 Routine Sets
- [ ] Predefined sets per exercise
- [ ] Set templates (weight/reps)
- [ ] Population options (blank, last, template)

### 3.3 Routine Application
- [ ] Apply routine to workout
- [ ] Populate sets from template
- [ ] Routine switching

**Deliverable**: Users can create workout templates and apply them.

---

## Phase 4: Calendar & History

### 4.1 Calendar View
- [ ] Month calendar component
- [ ] Workout indicators (dots, colors)
- [ ] Category color coding
- [ ] Date navigation (swipe/arrows)
- [ ] Jump to today

### 4.2 History List View
- [ ] Chronological workout list
- [ ] Expandable workout details
- [ ] Filter by date range
- [ ] Filter by category/exercise

### 4.3 Workout Operations
- [ ] Copy workout to date
- [ ] Move workout to date
- [ ] Delete workout
- [ ] Bulk delete with filters

### 4.4 Display Settings
- [ ] Toggle category dots
- [ ] Toggle set details
- [ ] Toggle navigation bar
- [ ] Skip empty dates

**Deliverable**: Visual calendar and searchable workout history.

---

## Phase 5: Progress & Graphs

### 5.1 Exercise Progress Graphs
- [ ] Weight progression chart
- [ ] Volume chart
- [ ] Estimated 1RM chart
- [ ] Max weight for reps chart
- [ ] Cardio charts (distance, time, pace)

### 5.2 Graph Features
- [ ] Time period selector
- [ ] Trend line toggle
- [ ] Data points toggle
- [ ] Y-axis from zero toggle
- [ ] Custom date range
- [ ] Rep count filter

### 5.3 Personal Record View
- [ ] PR history timeline
- [ ] PR by type (weight, reps, volume, 1RM)
- [ ] PR dates and values

### 5.4 Exercise Statistics
- [ ] Total sets/reps/volume
- [ ] Total distance/duration
- [ ] Workout count
- [ ] Last workout date

### 5.5 Rep Max Grid
- [ ] Multi-exercise comparison
- [ ] Configurable rep ranges
- [ ] Favorite configurations

**Deliverable**: Rich visualizations of training progress.

---

## Phase 6: Analysis & Statistics

### 6.1 Breakdown Analysis
- [ ] By exercise breakdown
- [ ] By category breakdown
- [ ] By workout breakdown
- [ ] Pie chart visualization

### 6.2 Metrics
- [ ] Sets, reps, volume calculations
- [ ] Distance, duration aggregation
- [ ] Workout frequency

### 6.3 Time Periods
- [ ] All time
- [ ] This year/month/week
- [ ] Custom date range

### 6.4 Comparison
- [ ] Period over period comparison
- [ ] Exercise comparison

**Deliverable**: Comprehensive training analytics dashboard.

---

## Phase 7: Body Tracker

### 7.1 Measurements
- [ ] Default body weight tracking
- [ ] Custom measurement types
- [ ] Measurement units configuration
- [ ] Measurement CRUD

### 7.2 Recording
- [ ] Value entry with date/time
- [ ] Comments on records
- [ ] Bulk entry

### 7.3 Progress Visualization
- [ ] Measurement graphs
- [ ] Trend lines
- [ ] Goal progress indicators

### 7.4 Goals
- [ ] Increase/decrease/target goals
- [ ] Goal date setting
- [ ] Progress tracking

### 7.5 Integration
- [ ] Show in workout log option
- [ ] Body weight on workout screen

**Deliverable**: Complete body measurement tracking system.

---

## Phase 8: Goals System

### 8.1 Goal Types
- [ ] Max weight goals
- [ ] Max reps goals
- [ ] Volume goals
- [ ] 1RM goals
- [ ] Total distance/duration goals
- [ ] Workout total goals

### 8.2 Goal Management
- [ ] Create/edit/delete goals
- [ ] Date range setting
- [ ] Exercise assignment
- [ ] Goal reordering

### 8.3 Progress Tracking
- [ ] Current vs target display
- [ ] Progress percentage
- [ ] Completion detection
- [ ] Achievement notifications

**Deliverable**: Goal setting and tracking for exercises and measurements.

---

## Phase 9: Tools & Utilities

### 9.1 Rest Timer
- [ ] Configurable duration
- [ ] Per-exercise override
- [ ] Notification support (Web Push)
- [ ] Vibration (where supported)
- [ ] Sound alerts
- [ ] Auto-start after set
- [ ] Superset awareness

### 9.2 Plate Calculator
- [ ] Target weight input
- [ ] Plate configuration (weights, counts, colors)
- [ ] Bar weight setting
- [ ] Per-exercise bar weight
- [ ] Visual plate display
- [ ] Calculation algorithm

### 9.3 Set Calculator
- [ ] Percentage calculations
- [ ] Working weight suggestions
- [ ] 1RM-based calculations

### 9.4 1RM Calculator
- [ ] Multiple formulas (Epley, Brzycki, etc.)
- [ ] Rep limit settings
- [ ] Calculation display

**Deliverable**: Training utility tools.

---

## Phase 10: Data Management

### 10.1 FitNotes Import
- [ ] SQLite file upload
- [ ] Schema mapping
- [ ] Data transformation
- [ ] Conflict resolution
- [ ] Import progress UI

### 10.2 Backup System
- [ ] Manual backup creation
- [ ] Automatic scheduled backups
- [ ] Backup download
- [ ] Backup retention policy

### 10.3 Export
- [ ] Export to CSV
- [ ] Export to JSON
- [ ] Date range filtering
- [ ] Include/exclude options

### 10.4 Restore
- [ ] Restore from backup
- [ ] Selective restore
- [ ] Conflict handling

### 10.5 Data Operations
- [ ] Delete history (with filters)
- [ ] Bulk operations

**Deliverable**: Full data portability and backup system.

---

## Phase 11: Multi-Device Sync (WebSockets)

### 11.1 WebSocket Server
- [ ] Socket.io server integration with Next.js
- [ ] Authentication middleware (verify JWT/session)
- [ ] Room-based architecture (per-user rooms)
- [ ] Connection state management
- [ ] Heartbeat/reconnection handling

### 11.2 Real-time Events
- [ ] `workout:set:added` - New set logged
- [ ] `workout:set:updated` - Set modified
- [ ] `workout:set:deleted` - Set removed
- [ ] `exercise:updated` - Exercise changes
- [ ] `sync:full` - Request full sync
- [ ] Optimistic updates with rollback

### 11.3 Conflict Resolution
- [ ] Last-write-wins with timestamps
- [ ] Version vectors for complex conflicts
- [ ] Conflict notification UI
- [ ] Manual resolution for edge cases

### 11.4 Offline Support
- [ ] Service worker caching (Serwist)
- [ ] IndexedDB local storage (Dexie.js)
- [ ] Offline mutation queue
- [ ] Background sync on reconnect
- [ ] Sync status indicator in UI

### 11.5 Device Management
- [ ] Active sessions list
- [ ] Device naming
- [ ] Remote logout capability
- [ ] Session expiry handling

**Deliverable**: Instant sync across phone, tablet, and desktop with full offline capability.

---

## Phase 12: Multi-User (Optional)

### 12.1 User Management
- [ ] Admin user role
- [ ] User invitation system
- [ ] User quota management

### 12.2 Data Isolation
- [ ] Per-user data segregation
- [ ] Shared exercise library option
- [ ] Category visibility options

### 12.3 Admin Features
- [ ] User listing
- [ ] Usage statistics
- [ ] System settings

**Deliverable**: Multi-tenant support for shared installations.

---

## Phase 13: Settings & Customization

### 13.1 Unit Settings
- [ ] Metric/Imperial toggle
- [ ] First day of week
- [ ] Weight increments

### 13.2 Display Settings
- [ ] Theme selection (light/dark)
- [ ] Home screen configuration
- [ ] Calendar display options
- [ ] Graph defaults

### 13.3 Workout Settings
- [ ] PR tracking toggle
- [ ] Set completion toggle
- [ ] Auto-select next set
- [ ] Keep screen awake

### 13.4 Timer Settings
- [ ] Default duration
- [ ] Notification preferences
- [ ] Auto-start options

**Deliverable**: Comprehensive user preferences system.

---

## Phase 14: Polish & Optimization

### 14.1 Performance
- [ ] Database query optimization
- [ ] Lazy loading
- [ ] Image optimization
- [ ] Bundle optimization

### 14.2 UX Improvements
- [ ] Loading states
- [ ] Error handling
- [ ] Toast notifications
- [ ] Keyboard shortcuts
- [ ] Touch gestures

### 14.3 Accessibility
- [ ] ARIA labels
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Color contrast

### 14.4 Documentation
- [ ] User guide
- [ ] API documentation
- [ ] Deployment guide
- [ ] Contributing guide

**Deliverable**: Production-ready application.

---

## Deployment Architecture

### Docker Compose Setup

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://fitnotes:${DB_PASSWORD}@db:5432/fitnotes
      - AUTH_SECRET=${AUTH_SECRET}
      - AUTH_URL=https://${DOMAIN}
      - NEXTAUTH_URL=https://${DOMAIN}
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backups:/app/backups
      - ./uploads:/app/uploads
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.fitnotes.rule=Host(`${DOMAIN}`)"
      - "traefik.http.routers.fitnotes.tls=true"
      - "traefik.http.routers.fitnotes.tls.certresolver=letsencrypt"
      - "traefik.http.services.fitnotes.loadbalancer.server.port=3000"

  db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER=fitnotes
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=fitnotes
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fitnotes"]
      interval: 5s
      timeout: 5s
      retries: 5

  traefik:
    image: traefik:v3.2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    command:
      - "--api.insecure=false"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt

  # Optional: Backup service
  backup:
    image: prodrigestivill/postgres-backup-local
    restart: unless-stopped
    depends_on:
      - db
    environment:
      - POSTGRES_HOST=db
      - POSTGRES_DB=fitnotes
      - POSTGRES_USER=fitnotes
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - SCHEDULE=@daily
      - BACKUP_KEEP_DAYS=7
      - BACKUP_KEEP_WEEKS=4
      - BACKUP_KEEP_MONTHS=6
    volumes:
      - ./backups/postgres:/backups

volumes:
  postgres_data:
  letsencrypt:
```

### Environment File (.env)
```bash
# Domain
DOMAIN=fitnotes.yourdomain.com
ACME_EMAIL=your@email.com

# Database
DB_PASSWORD=your-secure-password-here

# Auth
AUTH_SECRET=generate-with-openssl-rand-base64-32
```

---

## Milestone Summary

| Phase | Features | Priority |
|-------|----------|----------|
| 1 | Foundation, Auth, Basic CRUD | Critical |
| 2 | Full Workout Logging | Critical |
| 3 | Routines | High |
| 4 | Calendar & History | High |
| 5 | Progress Graphs | High |
| 6 | Analysis | Medium |
| 7 | Body Tracker | Medium |
| 8 | Goals | Medium |
| 9 | Tools (Timer, Calculator) | Medium |
| 10 | Import/Export/Backup | High |
| 11 | Multi-Device Sync | High |
| 12 | Multi-User | Low |
| 13 | Settings | Medium |
| 14 | Polish | Medium |

---

## MVP Definition

For a minimum viable product, complete:
- **Phase 1**: Foundation
- **Phase 2**: Workout Logging
- **Phase 4**: Calendar & History (basic)
- **Phase 10**: FitNotes Import (critical for migration)

This allows users to:
1. Import existing FitNotes data
2. Log workouts with full set tracking
3. View workout history
4. Use as daily workout tracker

---

## Next Steps

1. **Confirm technology choices** - Review stack recommendations
2. **Set up development environment** - Initialize project
3. **Create database schema** - Prisma models
4. **Build Phase 1** - Foundation MVP
5. **Iterate** - Add phases based on priority

---

## Notes

### Weight Storage
FitNotes stores weights in grams (metric_weight field) for precision. Display converts to kg/lbs based on user preference.

### Date Handling
FitNotes uses TEXT dates in YYYY-MM-DD format. Maintain this for import compatibility.

### Color Values
Colors are stored as ARGB integers. Convert to hex for web display:
```javascript
const argbToHex = (argb) => '#' + (argb & 0xFFFFFF).toString(16).padStart(6, '0');
```

### Exercise Types
| ID | Type | Weight | Reps | Distance | Time |
|----|------|--------|------|----------|------|
| 0 | Weight & Reps | Yes | Yes | No | No |
| 1 | Duration Only | No | No | No | Yes |
| 3 | Distance & Time | No | No | Yes | Yes |

### Personal Record Algorithm
PRs are calculated per exercise considering:
- Max weight (any reps)
- Max reps (any weight)
- Max volume (weight × reps)
- Estimated 1RM using Epley formula: `weight × (1 + reps/30)`
