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

- **Node.js** (v18 or later)
- **npm** (comes with Node.js)
- **Expo Go** app on your iOS/Android device ([iOS App Store](https://apps.apple.com/app/expo-go/id982107779) | [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent))
- **Docker Desktop** (optional, for local Supabase - see [SUPABASE.md](SUPABASE.md))

> **Note**: No need for Xcode, Android Studio, or JDK when using Expo Go for development.

## Installation

### 1. Install Dependencies

```bash
npm install
```

> **Important**: The project includes a `.npmrc` file with `legacy-peer-deps=true` to handle React version compatibility between React Native and Expo Router web dependencies. This is normal and required.

### 2. Verify Package Versions

Check that all packages match Expo SDK 54 requirements:

```bash
npx expo-doctor
```

If there are version mismatches, fix them automatically:

```bash
npx expo install --fix
```

### 3. (Optional) Set Up Supabase

For local development, see [SUPABASE.md](SUPABASE.md) for detailed instructions.

For cloud Supabase:
1. Create a project at [https://supabase.com](https://supabase.com)
2. Copy `.env.example` to `.env`
3. Add your credentials:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=your-project-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

## Running the App

### Start Development Server

```bash
npm start
# or
npx expo start
```

### Test on Your Device (Recommended)

1. Install **Expo Go** on your iOS or Android device
2. Run `npm start` in your terminal
3. **iOS**: Open Camera app and scan the QR code
4. **Android**: Open Expo Go app and scan the QR code
5. The app will load in Expo Go

### Run on Simulators/Emulators

```bash
# iOS Simulator (macOS only, requires Xcode)
npm run ios

# Android Emulator (requires Android Studio)
npm run android

# Web browser
npm run web
```

### Clear Cache (if needed)

If you encounter issues, clear the Metro bundler cache:

```bash
npm start -- --clear
# or
npx expo start -c
```

## Project Structure

```
escondido-thai-camp-payment-app/
├── app/                    # Expo Router screens (file-based routing)
│   ├── _layout.tsx        # Root layout with drawer navigation
│   ├── index.tsx          # Home screen
│   ├── members.tsx        # Members management
│   ├── payments.tsx       # Payments tracking
│   ├── expenses.tsx       # Expenses management
│   ├── finance.tsx        # Financial reports
│   └── settings.tsx       # App settings
├── services/              # Business logic layer
│   ├── database.service.ts    # SQLite database management
│   ├── supabase.service.ts    # Supabase client wrapper
│   └── sync.service.ts        # Local-cloud sync orchestration
├── types/                 # TypeScript type definitions
│   └── database.ts        # Database table interfaces
├── hooks/                 # Custom React hooks
│   └── useDatabase.ts     # Database initialization hook
├── assets/                # Images and fonts
├── .env.example           # Environment variables template
├── .npmrc                 # npm configuration (legacy-peer-deps)
├── app.json               # Expo configuration
├── babel.config.js        # Babel configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Dependencies and scripts
├── README.md              # This file
├── SUPABASE.md            # Supabase setup guide
└── STRUCTURE.md           # Detailed architecture documentation
```

## Adding New Packages

When adding native modules or Expo packages, always use `npx expo install`:

```bash
# ✅ Correct - ensures version compatibility with Expo SDK
npx expo install package-name

# ❌ Avoid - may install incompatible versions
npm install package-name
```

For regular JavaScript packages (no native code), use `npm install` as usual.

## Troubleshooting

### Version Mismatch Errors

If you see errors like "Mismatch between JavaScript and native part", run:

```bash
npx expo-doctor
npx expo install --fix
```

### "Route is missing default export" Warning

This is usually a false positive. Ensure your screen components have:
```typescript
export default function ScreenName() { ... }
```

### SafeAreaView Deprecation Warning

The app uses `react-native-safe-area-context` instead of the deprecated `SafeAreaView` from React Native.

### Metro Bundler Issues

Clear cache and restart:
```bash
npx expo start -c
```

### Database Not Initializing

Make sure to call database initialization in your root component:

```typescript
import { useDatabase } from '@/hooks/useDatabase';

export default function App() {
  useDatabase(); // Initialize database
  // ...
}
```

## Architecture

## Architecture

### Database Strategy

- **Offline-first**: Local SQLite database for all data operations
- **Optional sync**: Background sync to Supabase cloud (when configured)
- **Conflict resolution**: Last-write-wins strategy
- **Auto-schema**: Database tables created automatically on first run

### Navigation

- **Expo Router**: File-based routing system
- **Drawer Navigation**: Side menu with Ionicons
- **Responsive**: 
  - iPad (≥768px): Permanent drawer (280px wide)
  - iPhone (<768px): Collapsible drawer (240px wide)
- **Type-safe**: Full TypeScript support for routing

### Responsive Design

The app adapts to different screen sizes and orientations:
- Device detection via `useWindowDimensions()` hook
- Tablet threshold: 768px width
- Dynamic font sizes and spacing
- Optimized layouts for portrait and landscape

## Database Schema

See [schema.sql](schema.sql) for the complete database schema.

### Tables

- **members**: User profiles and contact information
- **payments**: Payment transactions and history
- **expenses**: Expense tracking and categorization
- **sync_log**: Synchronization metadata (synced flag per record)

All tables include:
- `id`: Unique identifier
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update
- `synced`: Boolean flag for cloud sync status

## Development Workflow

### Making Changes

1. Edit files in `app/`, `services/`, or `types/`
2. Metro bundler auto-reloads changes
3. Test on device via Expo Go

### Adding a New Screen

1. Create `app/your-screen.tsx`:
   ```typescript
   export default function YourScreen() {
     return <View><Text>Your Screen</Text></View>;
   }
   ```

2. Add route to [app/_layout.tsx](app/_layout.tsx):
   ```typescript
   <Drawer.Screen
     name="your-screen"
     options={{
       drawerLabel: 'Your Screen',
       title: 'Your Screen',
       drawerIcon: ({ color, size }) => (
         <Ionicons name="icon-name" size={size} color={color} />
       ),
     }}
   />
   ```

### Modifying Database Schema

1. Update [services/database.service.ts](services/database.service.ts)
2. Update type definitions in [types/database.ts](types/database.ts)
3. Clear app data or uninstall/reinstall to apply schema changes

## Next Steps

- [ ] Implement CRUD operations for members
- [ ] Build payment processing features
- [ ] Add expense tracking functionality
- [ ] Create financial reports dashboard
- [ ] Implement authentication (optional)
- [ ] Set up Supabase tables and sync logic
- [ ] Add form validation
- [ ] Implement search and filtering

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router Guide](https://docs.expo.dev/router/introduction/)
- [React Native Docs](https://reactnative.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Project Structure Guide](STRUCTURE.md)
- [Supabase Setup Guide](SUPABASE.md)

## License

MIT
