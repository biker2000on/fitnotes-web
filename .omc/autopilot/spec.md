# FitNotes PWA Clone - Technical Specification

## Project Overview

Build a full-featured PWA clone of FitNotes Android app with:
- Full feature parity with FitNotes Android app
- Multi-device sync via WebSockets
- Optional multi-user support
- Offline-first PWA capability
- Import from FitNotes SQLite backups

## Technology Stack (Finalized)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Tailwind v4 + shadcn/ui |
| Database | PostgreSQL 17 (Podman for dev) |
| ORM | Drizzle ORM |
| Auth | NextAuth.js v5 (Auth.js) |
| Real-time | Socket.io (WebSockets) |
| Offline | Serwist (service worker) + Dexie.js (IndexedDB) |
| Testing | Vitest (unit) + Playwright (E2E) |
| Deployment | Docker Compose + Traefik |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (PWA)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   React 19  │  │  Zustand    │  │   TanStack Query        │  │
│  │  Components │  │   Stores    │  │   (Server State)        │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                │
│  ┌──────┴────────────────┴─────────────────────┴──────────────┐ │
│  │                    Service Worker (Serwist)                 │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │ │
│  │  │   Cache     │  │  IndexedDB  │  │   Background Sync   │ │ │
│  │  │  (Assets)   │  │  (Dexie.js) │  │   (Mutation Queue)  │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │ HTTPS         │ WebSocket     │
              ▼               ▼               │
┌─────────────────────────────────────────────┴───────────────────┐
│                       SERVER (Next.js 16)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Server Actions │  │   API Routes    │  │   Socket.io     │  │
│  │  (Mutations)    │  │   (Files/Auth)  │  │   (Real-time)   │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│  ┌────────┴────────────────────┴────────────────────┴────────┐  │
│  │                     Drizzle ORM                           │  │
│  └────────────────────────────┬──────────────────────────────┘  │
└───────────────────────────────┼─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PostgreSQL 17                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Users    │ │ Exercises│ │ Logs     │ │ Settings/Goals   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
fitnotes-web/
├── src/
│   ├── app/
│   │   ├── (app)/                    # Authenticated routes
│   │   │   ├── workout/
│   │   │   │   ├── page.tsx          # Main workout logging
│   │   │   │   └── _components/
│   │   │   ├── calendar/
│   │   │   ├── exercises/
│   │   │   ├── routines/
│   │   │   ├── progress/
│   │   │   ├── analysis/
│   │   │   ├── body-tracker/
│   │   │   ├── goals/
│   │   │   ├── settings/
│   │   │   └── layout.tsx
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── socket/
│   │   │   ├── import/
│   │   │   └── export/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── manifest.ts
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── forms/
│   │   ├── workout/
│   │   ├── calendar/
│   │   ├── charts/
│   │   └── providers/
│   ├── actions/                      # Server actions
│   ├── db/
│   │   ├── schema/
│   │   ├── index.ts
│   │   └── migrations/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── calculations.ts
│   │   └── utils.ts
│   ├── hooks/
│   ├── stores/
│   ├── offline/
│   │   ├── db.ts                     # Dexie IndexedDB
│   │   └── sync.ts
│   ├── socket/
│   └── types/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── public/
├── scripts/
│   ├── seed-database.ts
│   └── import-fitnotes.ts
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## Database Schema (Drizzle)

### Core Tables

```typescript
// Users
users: id, email, name, passwordHash, createdAt, updatedAt
sessions: id, userId, sessionToken, expires
accounts: id, userId, provider, providerAccountId, ...

// Categories
categories: id, userId, name, color, sortOrder

// Exercises
exercises: id, userId, name, categoryId, exerciseTypeId, notes,
           weightIncrement, defaultGraphId, defaultRestTime,
           weightUnitId, isFavorite

// Training Logs
trainingLogs: id, exerciseId, workoutDate, metricWeight, reps,
              unit, distance, durationSeconds, isPersonalRecord,
              isComplete, sortOrder, workoutGroupId

// Routines
routines: id, userId, name, notes
routineSections: id, routineId, name, sortOrder
routineSectionExercises: id, sectionId, exerciseId, sortOrder
routineSectionExerciseSets: id, sectionExerciseId, metricWeight, reps, ...

// Goals
goals: id, userId, exerciseId, typeId, targetValue, startDate, targetDate

// Measurements
measurements: id, userId, name, unitId, goalType, goalValue
measurementRecords: id, measurementId, date, value, comment

// Settings
userSettings: id, userId, metric, firstDayOfWeek, weightIncrement, ...
```

---

## Feature Areas (12 Core)

1. **Exercise Management** - CRUD exercises, categories, favorites
2. **Workout Logging** - Sets, PRs, supersets, comments
3. **Routines** - Templates with sections and predefined sets
4. **Calendar & History** - Month view, filtering, workout operations
5. **Progress Tracking** - 6+ graph types, trend lines, PRs
6. **Analysis** - Breakdown by exercise/category/workout
7. **Body Tracker** - Measurements, goals, graphs
8. **Goals System** - 10+ goal types with tracking
9. **Rest Timer** - Notifications, auto-start, superset awareness
10. **Plate Calculator** - Visual, per-exercise bars
11. **Settings** - 50+ user preferences
12. **Backup & Import** - FitNotes SQLite import, export, backup

---

## Development Infrastructure

### Podman PostgreSQL (Development)
```bash
podman run -d \
  --name fitnotes-db \
  -e POSTGRES_USER=fitnotes \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=fitnotes \
  -p 5432:5432 \
  -v fitnotes-pgdata:/var/lib/postgresql/data \
  postgres:17-alpine
```

### Environment Variables (.env.local)
```
DATABASE_URL=postgresql://fitnotes:devpassword@localhost:5432/fitnotes
AUTH_SECRET=dev-secret-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

---

## Implementation Phases

| Phase | Focus | Priority |
|-------|-------|----------|
| 1 | Foundation (Auth, DB, Basic UI) | Critical |
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

## Testing Strategy

- **Unit Tests (Vitest)**: Calculations, utilities, hooks
- **Integration Tests**: API routes, server actions, database
- **E2E Tests (Playwright)**: User flows, offline support
- **Browser Testing**: agent-browser for visual/interactive testing

---

**EXPANSION_COMPLETE**
