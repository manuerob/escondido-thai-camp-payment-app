# Escondido Thai Camp Payment App

A React Native app built with Expo and TypeScript that is fully responsive and compatible with both iPad and iPhone devices. Features local SQLite database with optional Supabase cloud sync.

## Features

- ✅ **TypeScript** for type safety
- ✅ **Expo Router** for file-based navigation
- ✅ **Drawer Navigation** with collapsible sidebar
- ✅ **SQLite** local database for offline-first functionality
- ✅ **Supabase** integration for cloud sync (optional)
- ✅ **Responsive design** for iPad and iPhone
- ✅ Support for both portrait and landscape orientations
- ✅ Cross-platform compatibility (iOS, Android, Web)

## Tech Stack

- **React Native** with Expo SDK 54
- **TypeScript** for type safety
- **Expo Router** (file-based routing)
- **Expo SQLite** for local database
- **Supabase** for cloud sync (optional)
- **React Native Reanimated** for animations
- **Expo Vector Icons** for UI icons

## Prerequisites

- Node.js (v18 or later)
- npm or yarn
- Expo Go app on your iOS device (for testing)
- Docker Desktop (optional, for local Supabase)

## Installation

1. Install dependencies:
```bash
npm install
```

2. (Optional) Set up Supabase:
   - For local development, see [SUPABASE.md](SUPABASE.md)
   - For cloud, create a project at [https://supabase.com](https://supabase.com)
   - Copy `.env.example` to `.env`
   - Add your Supabase credentials to `.env`:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your-project-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

## Running the App

### Development Server
```bash
npm start
```

### iOS (requires macOS)
```bash
npm run ios
```

### Android
```bash
npm run android
```

### Web
```bash
npm run web
```

### Using Expo Go
1. Run `npm start`
2. Scan the QR code with your iOS device using the Camera app
3. The app will open in Expo Go

## Project Structure

```
.app/                    # Expo Router pages
│   ├── _layout.tsx        # Drawer navigation layout
│   ├── index.tsx          # Home screen
│   ├── members.tsx        # Members management
│   ├── payments.tsx       # Payments tracking
│   ├── expenses.tsx       # Expenses management
│   ├── finance.tsx        # Financial reports
│   └── settings.tsx       # App settings
├── services/              # Business logic layer
│   ├── database.service.ts    # SQLite database
│  Architecture

### Database

- **Local SQLite**: Offline-first approach with local database
- **Auto-sync**: Automatic background sync to Supabase (when configured)
- **Conflict Resolution**: Last-write-wins strategy

### Navigation

- **Drawer Navigation**: Side menu with icons
- **Responsive**: Permanent drawer on iPad, collapsible on iPhone
- **File-based Routing**: Using Expo Router conventions

### Responsive Design

The app automatically adapts to different screen sizes:
- **iPhone**: Collapsible drawer, optimized layout
- **iPad**: Permanent side drawer, larger fonts and spac
├── assets/                # Images and fonts
├── tsconfig.json          # TypeScript configation
├── assets/                 # Images and fonts
└── package.json           # Dependencies
```

## Responsive Design

The app automatically adapts to different screen sizes:
- **iPhone**: Optimized layout with appropriate font sizes and spacing
- **iPad**: Larger fonts and increased padding for tablet viewing
- **Orientation**: Supports both portrait and landscape modes

## Database & Sync

### Local Database (SQLite)

The app uses SQLite for local storage, providing offline-first functionality:

```typescript
import { databaseService } from '@/services';

// Initialize database
await databaseService.init();

// Get database instance
const db = await databaseService.getDatabase();
```

### Supabase Sync (Optional)

Configure Supabase in `.env` to enable cloud sync:

```typescript
import { syncService } from '@/services';

// Sync all local changes to Supabase
await syncService.syncAll();

// Pull latest data from Supabase
await syncService.pullFromSupabase();
```

## Next Steps

- Add authentication (sign up, sign in, sign out)
- Create database tables in Supabase
- Build payment processing features
- Add navigation between screens
- Implement user profiles

## License

MIT
