# Project Structure Overview

## Directory Structure

```
escondido-thai-camp-payment-app/
│
├── app/                          # Expo Router - File-based routing
│   ├── _layout.tsx              # Root layout with drawer navigation
│   ├── index.tsx                # Home screen (default route)
│   ├── members.tsx              # Members management
│   ├── payments.tsx             # Payments tracking
│   ├── expenses.tsx             # Expenses management
│   ├── finance.tsx              # Financial reports
│   └── settings.tsx             # App settings
│
├── services/                     # Business logic layer
│   ├── database.service.ts      # SQLite database management
│   ├── supabase.service.ts      # Supabase client & sync helpers
│   ├── sync.service.ts          # Data synchronization logic
│   └── index.ts                 # Service exports
│
├── hooks/                        # Custom React hooks
│   ├── useDatabase.ts           # Database initialization hook
│   └── index.ts                 # Hook exports
│
├── types/                        # TypeScript type definitions
│   └── database.ts              # Database schema types
│
├── assets/                       # Static assets
│   ├── icon.png
│   ├── splash-icon.png
│   ├── adaptive-icon.png
│   └── favicon.png
│
├── supabase/                     # Supabase local development
│   ├── config.toml              # Supabase configuration
│   ├── seed.sql                 # Database seed data
│   └── migrations/              # Database migrations
│
├── .expo/                        # Expo build artifacts (generated)
├── node_modules/                 # Dependencies (generated)
│
├── .env.example                  # Environment variables template
├── .gitignore                    # Git ignore rules
├── app.json                      # Expo configuration
├── babel.config.js               # Babel configuration
├── package.json                  # NPM dependencies
├── tsconfig.json                 # TypeScript configuration
├── README.md                     # Project documentation
└── SUPABASE.md                   # Supabase setup guide
```

## Key Concepts

### 1. Expo Router (File-based Routing)

The `app/` directory uses Expo Router's file-based routing:
- `_layout.tsx` defines the drawer navigation
- Each `.tsx` file becomes a route automatically
- Files are automatically linked to the drawer menu

### 2. Service Layer

All business logic is in the `services/` folder:
- **database.service.ts**: SQLite operations, schema migrations
- **supabase.service.ts**: Cloud sync, authentication (when needed)
- **sync.service.ts**: Orchestrates local ↔ cloud synchronization

### 3. TypeScript Types

All database schemas and API types are defined in `types/`:
- Ensures type safety across the app
- Auto-completion in IDE
- Compile-time error checking

### 4. SQLite First, Supabase Optional

- App works offline with SQLite
- Supabase sync is optional for cloud backup
- Data is stored locally by default

## Navigation Flow

```
Drawer (Permanent on iPad, Collapsible on iPhone)
├── Home (index.tsx)
├── Members (members.tsx)
├── Payments (payments.tsx)
├── Expenses (expenses.tsx)
├── Finance (finance.tsx)
└── Settings (settings.tsx)
```

## Data Flow

```
User Action
    ↓
Screen Component (app/*.tsx)
    ↓
Service Layer (services/*.ts)
    ↓
SQLite Database (Local)
    ↓
Sync Service (when online)
    ↓
Supabase (Cloud)
```

## Adding New Features

### 1. Add a New Screen

1. Create `app/new-screen.tsx`
2. Add to `app/_layout.tsx` drawer configuration
3. Export default component

### 2. Add Database Table

1. Update `services/database.service.ts` → `createTables()`
2. Add type to `types/database.ts`
3. Create migration in `supabase/migrations/` (if using Supabase)

### 3. Add Business Logic

1. Create new service in `services/`
2. Export from `services/index.ts`
3. Use in components via import

### 4. Add Custom Hook

1. Create hook in `hooks/`
2. Export from `hooks/index.ts`
3. Use in components

## Development Workflow

### 1. Start Development Server
```bash
npm start
```

### 2. Run on Device
- Scan QR code with Expo Go app
- Or press `i` for iOS simulator (macOS only)

### 3. TypeScript Checking
```bash
npx tsc --noEmit
```

### 4. Database Reset (if needed)
```typescript
import { databaseService } from '@/services';
await databaseService.resetDatabase();
```

### 5. Supabase Local (optional)
```bash
npx supabase start --ignore-health-check
```

## Environment Variables

Create `.env` from `.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
```

**Note**: Variables must start with `EXPO_PUBLIC_` to be accessible in the app.

## Best Practices

### 1. Components
- Keep screens simple and focused
- Move business logic to services
- Use TypeScript for all components

### 2. Database
- Always use parameterized queries
- Handle errors gracefully
- Mark records as `synced: false` on modification

### 3. Services
- Keep services single-responsibility
- Export singleton instances
- Use async/await consistently

### 4. Types
- Define types for all data structures
- Use interfaces for objects
- Avoid `any` type

## Common Tasks

### Query Database
```typescript
import { databaseService } from '@/services';

const db = await databaseService.getDatabase();
const members = await db.getAllAsync('SELECT * FROM members');
```

### Insert Data
```typescript
const result = await db.runAsync(
  'INSERT INTO members (name, email) VALUES (?, ?)',
  ['John Doe', 'john@example.com']
);
```

### Sync to Supabase
```typescript
import { syncService } from '@/services';
await syncService.syncAll();
```

### Navigate
```typescript
import { router } from 'expo-router';
router.push('/members');
```

## Troubleshooting

### Clear Cache
```bash
npx expo start -c
```

### Reset Database
Delete the app from device/simulator and reinstall

### TypeScript Errors
```bash
npx tsc --noEmit
```

### Supabase Connection Issues
See [SUPABASE.md](SUPABASE.md) for detailed troubleshooting
