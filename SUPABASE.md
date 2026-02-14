# Running Supabase Locally

This guide will help you set up and run Supabase locally for development.

## Quick Start Summary

1. Install Docker Desktop and start it
2. Install Supabase CLI:
   - **Scoop (Recommended):** `scoop install supabase`
   - **NPM:** `npm install supabase --save-dev` (then use `npx supabase`)
3. Initialize: `supabase init` (or `npx supabase init`)
4. Start: `npx supabase start --ignore-health-check` (see [Windows troubleshooting](#windows-docker-daemon-error-status-502) if you get errors)
5. Open Studio: [http://localhost:54323](http://localhost:54323)

**Windows Users:** If you encounter a status 502 error, use the `--ignore-health-check` flag or see the troubleshooting section below.

---

## Prerequisites

### 1. Install Docker Desktop

Supabase requires Docker to run locally.

1. Download Docker Desktop for Windows from [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. Install Docker Desktop
3. Start Docker Desktop and wait for it to finish starting
4. Verify Docker is running:
   ```bash
   docker --version
   ```

### 2. Install Supabase CLI

Supabase CLI cannot be installed globally via npm. Choose one of these methods for Windows:

<!-- #### Option A: Using Scoop (Recommended for Windows)

1. Install Scoop if you don't have it: [https://scoop.sh](https://scoop.sh)
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
   ```

2. Install Supabase CLI:
   ```bash
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

#### Option B: Using Chocolatey

If you have Chocolatey installed:
```bash
choco install supabase
``` -->

#### Option C: NPM as Local Dev Dependency

Install as a project dependency and use with npx:
```bash
npm install supabase --save-dev
```

Then use `npx supabase` instead of `supabase` for all commands.

#### Verify Installation

```bash
supabase --version
```

Or if using npx:
```bash
npx supabase --version
```

### Updating Supabase CLI

#### If installed via NPM (local dev dependency):
```bash
npm update supabase
```

Or update to the latest version:
```bash
npm install supabase@latest --save-dev
```

#### If installed via Scoop:
```bash
scoop update supabase
```

#### If installed via Chocolatey:
```bash
choco upgrade supabase
```

## Setup Local Supabase

### 1. Initialize Supabase in Your Project

From your project root directory, run:

```bash
supabase init
```

Or if you installed via npm:
```bash
npx supabase init
```

This creates a `supabase` folder with configuration files.

### 2. Start Supabase

Start all Supabase services locally:

```bash
supabase start
```

Or with npx:
```bash
npx supabase start
```

**Note:** The first time you run this, it will download several Docker images (PostgreSQL, PostgREST, GoTrue, etc.). This may take 5-10 minutes.

### 3. Access Your Local Supabase

Once started, you'll see output with your local credentials:

```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:** Save these values! You'll need them to connect your app.

### 4. Open Supabase Studio

Visit [http://localhost:54323](http://localhost:54323) to access the Supabase Studio dashboard where you can:
- Create tables
- View data
- Run SQL queries
- Manage authentication
- Configure storage

## Connect Your React Native App

### 1. Update Supabase Configuration

Edit `lib/supabase.js` with your local credentials:

```javascript
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Local Supabase credentials
const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_ANON_KEY = 'your-local-anon-key-from-terminal';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

### 2. Important for React Native

When testing on a physical device (iPhone/iPad), you cannot use `localhost`. You need to:

**Option A: Use your computer's IP address**
```javascript
const SUPABASE_URL = 'http://192.168.1.XXX:54321'; // Replace with your IP
```

To find your IP address:
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

**Option B: Use Expo tunnel**
```bash
npx expo start --tunnel
```

## Common Commands

**Note:** If you installed Supabase CLI via npm, prepend all commands with `npx` (e.g., `npx supabase start`)

### Start Supabase
```bash
supabase start
```

### Stop Supabase
```bash
supabase stop
```

### Check Status
```bash
supabase status
```

### Reset Database (delete all data)
```bash
supabase db reset
```

### View Logs
```bash
supabase logs
```

## Database Management

### Create a Migration

When you make schema changes in Studio, generate a migration:

```bash
supabase db diff -f migration_name
```

### Apply Migrations

Migrations are automatically applied on `supabase start`. To manually apply:

```bash
supabase db reset
```

### Create Seed Data

Create or edit `supabase/seed.sql` to add initial data:

```sql
-- Example seed data
INSERT INTO users (id, name, email) VALUES
  ('1', 'John Doe', 'john@example.com'),
  ('2', 'Jane Smith', 'jane@example.com');
```

Seed data is loaded automatically on `supabase db reset`.

## Example: Create Your First Table

1. Open Studio at [http://localhost:54323](http://localhost:54323)
2. Click "Table Editor" in the sidebar
3. Click "New table"
4. Create a simple table (e.g., "payments"):
   - Name: `payments`
   - Columns:
     - `id` (int8, primary key, auto-increment)
     - `created_at` (timestamptz, default: now())
     - `amount` (numeric)
     - `description` (text)
     - `user_id` (uuid, optional)
5. Click "Save"

### Test the Connection in Your App

Add this test to `screens/HomeScreen.js`:

```javascript
import { supabase } from '../lib/supabase';

// Inside your component
useEffect(() => {
  testConnection();
}, []);

const testConnection = async () => {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .limit(10);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data:', data);
  }
};
```

## Troubleshooting

### Docker Not Running
```
Error: Cannot connect to the Docker daemon
```
**Solution:** Start Docker Desktop and wait for it to fully start.

### Windows Docker Daemon Error (Status 502)
```
WARNING: Analytics on Windows requires Docker daemon exposed on tcp://localhost:2375
Error status 502
```

This is a known issue with Supabase CLI on Windows. Try these solutions:

**Solution 1: Disable Analytics (Recommended)**

Run Supabase with the `--ignore-health-check` flag:
```bash
npx supabase start --ignore-health-check
```

**Solution 2: Enable Docker API (Advanced)**

1. Open Docker Desktop
2. Go to Settings → General
3. Check "Expose daemon on tcp://localhost:2375 without TLS"
4. Click "Apply & Restart"
5. Run `npx supabase start` again

**⚠️ Warning:** Option 2 exposes Docker without TLS encryption, which is a security risk. Only use on trusted networks.

**Solution 3: Use WSL2 Backend**

If you're on Windows 11 or Windows 10 (build 19041+):
1. Install WSL2: `wsl --install`
2. In Docker Desktop → Settings → General
3. Ensure "Use WSL 2 based engine" is checked
4. Restart Docker Desktop

**Solution 4: Run with Debug Info**

To get more details about the error:
```bash
npx supabase start --debug
```

### Container Name Conflict
```
failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_vector_..." is already in use
```

This happens when containers from a previous failed start are still present.

**Solution:** Stop all Supabase containers first:
```bash
npx supabase stop
```

Then start again:
```bash
npx supabase start --ignore-health-check
```

**Alternative:** If `supabase stop` doesn't work, clean up manually:
```bash
docker ps -a | findstr supabase
docker rm -f $(docker ps -a -q --filter "name=supabase")
```

Or use Docker Desktop:
1. Open Docker Desktop
2. Go to "Containers" tab
3. Stop and remove all containers starting with "supabase_"

### Port Already in Use
```
Error: port is already allocated
```
**Solution:** Stop other services using the same ports or stop Supabase and restart:
```bash
supabase stop
supabase start
```

### Can't Connect from Phone
**Solution:** Use your computer's IP address instead of `localhost` in the Supabase URL.

### Reset Everything
If something goes wrong, you can completely reset:
```bash
supabase stop
supabase db reset
supabase start
```

## Moving to Production

When you're ready to deploy:

1. Create a project at [https://supabase.com](https://supabase.com)
2. Update `lib/supabase.js` with your production credentials
3. Push your migrations:
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```

## Cloud Sync Integration

The app includes comprehensive cloud sync functionality that keeps local SQLite data synchronized with Supabase while maintaining full offline functionality.

### How It Works

**Local-First Architecture:**
- SQLite is the primary database - all operations work offline
- Sync runs in the background when internet is available
- Bidirectional sync: pushes local changes and pulls remote changes
- Conflict resolution: latest `updated_at` timestamp wins

### Sync Features

✅ **Automatic Background Sync**
- Initial sync when app loads
- Periodic sync every 5 minutes
- Automatic after database initialization

✅ **Smart Conflict Resolution**
- Compares `updated_at` timestamps
- Latest version wins automatically
- Local changes preserved until synced
- Handles soft deletes properly

✅ **Network-Aware**
- Checks connectivity before sync
- Gracefully handles offline mode
- Caches connectivity status to reduce checks
- No disruption to offline functionality

✅ **Comprehensive Sync**
- Members
- Packages
- Subscriptions
- Payments
- Expenses

### Configuration

1. **Set up Supabase credentials:**

Create a `.env` file in the root directory (copy from `.env.example`):
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2. **Create Supabase tables:**

The tables should match the SQLite schema. Use the migration in `schema.sql` or create manually in Supabase Studio:

```sql
-- Example for members table
CREATE TABLE members (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  instagram TEXT,
  address TEXT,
  emergency_contact TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  deleted_at TIMESTAMPTZ
);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

Repeat for all tables: `packages`, `subscriptions`, `payments`, `expenses`.

3. **Enable Row Level Security (RLS):**

For development/testing, you can disable RLS or create permissive policies:

```sql
-- Option 1: Disable RLS (for development only)
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE packages DISABLE ROW LEVEL SECURITY;
-- ... etc

-- Option 2: Create permissive policy (for authenticated users)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users"
  ON members
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

### Using Sync in Your App

**Automatic Sync (Default):**
```typescript
import { useDatabase } from '@/hooks';

function MyComponent() {
  const { isReady, isSyncing, lastSyncResult } = useDatabase();
  
  if (!isReady) return <Loading />;
  
  return (
    <View>
      {isSyncing && <SyncIndicator />}
      {/* Your content */}
    </View>
  );
}
```

**Manual Sync Trigger:**
```typescript
import { useDatabase } from '@/hooks';

function SettingsScreen() {
  const { triggerSync, isSyncing, lastSyncResult } = useDatabase();
  
  return (
    <Button 
      title={isSyncing ? "Syncing..." : "Sync Now"}
      onPress={triggerSync}
      disabled={isSyncing}
    />
  );
}
```

**Push/Pull Separately:**
```typescript
import { useDatabase } from '@/hooks';

function DataManagement() {
  const { pushChanges, pullChanges, isSyncing } = useDatabase();
  
  return (
    <View>
      <Button title="Push Local Changes" onPress={pushChanges} />
      <Button title="Pull Remote Changes" onPress={pullChanges} />
    </View>
  );
}
```

**Direct Service Access:**
```typescript
import { syncService } from '@/services';

// Full bidirectional sync
const result = await syncService.syncAll();
console.log(`Synced: ${result.recordsPushed} pushed, ${result.recordsPulled} pulled`);

// Push only
await syncService.pushChanges();

// Pull only
await syncService.pullChanges();

// Check sync status
if (syncService.isSyncInProgress()) {
  console.log('Sync in progress...');
}

// Listen to sync events
const unsubscribe = syncService.onSyncComplete((result) => {
  if (result.success) {
    console.log('Sync successful!');
  } else {
    console.error('Sync errors:', result.errors);
  }
});
```

### Sync Status & Results

The `SyncResult` object contains:
```typescript
{
  success: boolean;           // Overall success status
  tablesProcessed: string[];  // Tables that were synced
  recordsPushed: number;      // Total records pushed to Supabase
  recordsPulled: number;      // Total records pulled from Supabase
  errors: string[];           // Any errors encountered
  timestamp: string;          // When sync occurred
}
```

### Testing Sync

1. **Test Offline → Online:**
   - Turn off internet
   - Create/update records in the app
   - Turn on internet
   - Wait for sync or trigger manually
   - Verify changes appear in Supabase

2. **Test Online → Offline:**
   - Make changes in Supabase Studio
   - Trigger pull sync in app
   - Verify changes appear locally

3. **Test Conflicts:**
   - Make different changes to same record online and offline
   - Sync
   - Newest change (by `updated_at`) should win

### Troubleshooting

**Sync not happening:**
- Check internet connectivity
- Verify Supabase credentials in `.env`
- Check console for errors
- Ensure Supabase tables exist

**Conflicts not resolving:**
- Verify `updated_at` fields are set correctly
- Check table triggers in Supabase
- Review sync logs in console

**Performance issues:**
- Adjust `SYNC_INTERVAL` in `hooks/useDatabase.ts`
- Consider selective sync for large datasets
- Add indexes to Supabase tables

**Sync disabled:**
If you don't want cloud sync:
- Leave `.env` empty or don't create it
- App works perfectly offline-only
- No functionality is broken

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Local Development Guide](https://supabase.com/docs/guides/cli/local-development)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-react-native)
