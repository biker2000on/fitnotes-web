# FitNotes PWA - Implementation Plan (Validated)

## Technology Stack (CONFIRMED)
- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + Tailwind v4 + shadcn/ui
- **Database**: PostgreSQL 17 (Podman for dev)
- **ORM**: Drizzle ORM (NOT Prisma)
- **Auth**: NextAuth.js v5 (Auth.js)
- **Real-time**: Socket.io
- **PWA**: Serwist
- **Testing**: Vitest + Playwright

## Phase 1: Foundation (Detailed)

### 1.1 Project Setup

**Task 1.1.1: Initialize Next.js 16 Project**
- Command: `pnpm create next-app@latest fitnotes-app --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- Files: package.json, tsconfig.json, next.config.ts, src/app/layout.tsx, src/app/page.tsx
- Acceptance: `pnpm dev` runs on localhost:3000, TypeScript strict mode ON

**Task 1.1.2: Configure Tailwind v4 + shadcn/ui**
- Install: `pnpm dlx shadcn@latest init`
- Files: tailwind.config.ts, src/app/globals.css, components.json, src/lib/utils.ts
- Acceptance: Button component renders with correct styles

**Task 1.1.3: Install Core UI Components**
- Components: button, input, card, dialog, dropdown-menu, form, label, sheet, toast
- Acceptance: All components importable and render

### 1.2 Database Setup

**Task 1.2.1: Start Podman PostgreSQL**
- Script: scripts/start-db.sh
- Command: `podman run -d --name fitnotes-db -e POSTGRES_USER=fitnotes -e POSTGRES_PASSWORD=devpassword -e POSTGRES_DB=fitnotes -p 5432:5432 postgres:17-alpine`
- Acceptance: `psql` connects successfully

**Task 1.2.2: Install Drizzle ORM**
- Install: drizzle-orm, drizzle-kit, postgres
- Files: drizzle.config.ts, src/db/index.ts
- Acceptance: `pnpm drizzle-kit studio` opens

**Task 1.2.3: Create Database Schema (Drizzle)**
- Files: src/db/schema/users.ts, categories.ts, exercises.ts, trainingLogs.ts, workoutGroups.ts, comments.ts
- Schema matches DATABASE_SCHEMA.md with Drizzle syntax
- Acceptance: `pnpm drizzle-kit generate` creates valid migration

**Task 1.2.4: Run Migration**
- Command: `pnpm drizzle-kit migrate`
- Acceptance: All tables created in PostgreSQL

**Task 1.2.5: Seed Default Data**
- File: scripts/seed-database.ts
- Data: Default categories (Shoulders, Triceps, Biceps, Chest, Back, Legs, Abs, Cardio)
- Acceptance: `pnpm db:seed` populates categories

### 1.3 Authentication

**Task 1.3.1: Configure NextAuth.js v5**
- Install: next-auth@beta, @auth/drizzle-adapter, bcryptjs
- Files: src/lib/auth.ts, src/app/api/auth/[...nextauth]/route.ts
- Acceptance: Auth config exports auth(), signIn(), signOut()

**Task 1.3.2: Create Auth Middleware**
- File: src/middleware.ts
- Protected: /workout, /exercises, /calendar, /routines, /progress, /settings
- Acceptance: Unauthenticated users redirected to /login

**Task 1.3.3: Create Login Page**
- Files: src/app/(auth)/login/page.tsx, src/components/forms/login-form.tsx
- Acceptance: Login with email/password works, redirects to /workout

**Task 1.3.4: Create Register Page**
- Files: src/app/(auth)/register/page.tsx, src/components/forms/register-form.tsx, src/actions/auth.ts
- Acceptance: New user created, auto-login, default categories seeded

### 1.4 Core Server Actions

**Task 1.4.1: Category CRUD Actions**
- File: src/actions/categories.ts
- Actions: getCategories, createCategory, updateCategory, deleteCategory, reorderCategories
- Acceptance: All CRUD operations work with auth

**Task 1.4.2: Exercise CRUD Actions**
- File: src/actions/exercises.ts
- Actions: getExercises, createExercise, updateExercise, deleteExercise, toggleFavorite
- Acceptance: Filter by category, favorites work

**Task 1.4.3: Training Log Actions**
- File: src/actions/trainingLogs.ts
- Actions: getTrainingLogs, createTrainingLog, updateTrainingLog, deleteTrainingLog
- Acceptance: CRUD works, PR detection placeholder

### 1.5 Basic UI

**Task 1.5.1: App Shell Layout**
- Files: src/app/(app)/layout.tsx, src/components/layout/app-shell.tsx, bottom-nav.tsx
- Features: Bottom nav (Workout, Calendar, Exercises, Progress, More), header
- Acceptance: Mobile-first layout, nav highlights active route

**Task 1.5.2: Exercise List Page**
- Files: src/app/(app)/exercises/page.tsx, src/components/workout/exercise-list.tsx
- Features: List by category, add/edit/delete
- Acceptance: Categories show with colors, CRUD works

**Task 1.5.3: Basic Workout Page**
- Files: src/app/(app)/workout/page.tsx, src/components/workout/workout-view.tsx
- Features: Date selector, add exercise, log sets (weight/reps)
- Acceptance: Sets save to database, display correctly

### 1.6 PWA Setup

**Task 1.6.1: Web Manifest**
- File: src/app/manifest.ts
- Acceptance: Chrome shows install prompt

**Task 1.6.2: Service Worker**
- Install: @serwist/next
- Files: src/app/sw.ts, next.config.ts (add plugin)
- Acceptance: App works offline (cached shell)

### 1.7 Testing Setup

**Task 1.7.1: Configure Vitest**
- Files: vitest.config.ts, tests/setup.ts
- Acceptance: `pnpm test` runs

**Task 1.7.2: Configure Playwright**
- Files: playwright.config.ts, tests/e2e/auth.spec.ts
- Acceptance: `pnpm test:e2e` runs login flow

### 1.8 Git Setup

**Task 1.8.1: Initialize Git**
- Files: .gitignore, README.md
- Acceptance: Initial commit with foundation

---

## Phase 1 Complete Checklist
- [ ] Next.js 16 project initialized
- [ ] Tailwind v4 + shadcn/ui configured
- [ ] PostgreSQL running via Podman
- [ ] Drizzle ORM configured with all schemas
- [ ] NextAuth.js v5 working (login/register)
- [ ] Category and Exercise CRUD working
- [ ] Basic workout logging working
- [ ] PWA installable
- [ ] Tests passing

**PLANNING_COMPLETE**
