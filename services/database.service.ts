import * as SQLite from 'expo-sqlite';
import type {
  BaseEntity,
  Member,
  Package,
  Subscription,
  Payment,
  Expense,
  ExpenseCategory,
  Todo,
  ScheduleBlock,
  Participation,
  AppSettings,
  CreateMemberInput,
  UpdateMemberInput,
  CreatePackageInput,
  UpdatePackageInput,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  CreatePaymentInput,
  UpdatePaymentInput,
  CreateExpenseInput,
  UpdateExpenseInput,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  CreateTodoInput,
  UpdateTodoInput,
  CreateScheduleBlockInput,
  UpdateScheduleBlockInput,
  CreateParticipationInput,
  UpdateParticipationInput,
  UpdateAppSettingsInput,
  PaginationParams,
  DateRangeFilter,
  MemberWithSubscription,
  PaymentWithDetails,
} from '../types/database';

const DB_NAME = 'gym_tracker.db';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    // If already initialized, return immediately
    if (this.db) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = this.initializeDatabase();
    
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.checkAndMigrate();
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      this.db = null; // Reset on error
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async checkAndMigrate(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      let needsMigration = false;

      // Check if old members schema exists (has 'name' column instead of 'first_name')
      const membersResult = await this.db.getFirstAsync<any>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='members'"
      );

      if (membersResult?.sql && membersResult.sql.includes('name TEXT NOT NULL') && !membersResult.sql.includes('first_name')) {
        needsMigration = true;
      }

      // Check if expenses table has incorrect payment_method definition (nullable instead of NOT NULL)
      const expensesResult = await this.db.getFirstAsync<any>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='expenses'"
      );

      if (expensesResult?.sql) {
        // Old schema had: payment_method TEXT CHECK(...)
        // New schema has: payment_method TEXT NOT NULL CHECK(...)
        if (expensesResult.sql.includes('payment_method TEXT CHECK') && 
            !expensesResult.sql.includes('payment_method TEXT NOT NULL')) {
          console.log('Detected old expenses schema with nullable payment_method');
          needsMigration = true;
        }
      }

      // If migration needed, drop and recreate
      if (needsMigration) {
        console.log('🔄 Migrating database schema...');
        
        // Drop all tables
        await this.db.execAsync(`
          DROP TABLE IF EXISTS members;
          DROP TABLE IF EXISTS packages;
          DROP TABLE IF EXISTS subscriptions;
          DROP TABLE IF EXISTS payments;
          DROP TABLE IF EXISTS expenses;
          DROP TABLE IF EXISTS todos;
          DROP TABLE IF EXISTS app_metadata;
        `);
        
        console.log('✅ Database migration completed');
      }

      // Check if todos table exists, create it if it doesn't (additive migration)
      const todosResult = await this.db.getFirstAsync<any>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='todos'"
      );

      if (!todosResult) {
        console.log('📝 Creating todos table...');
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            is_checked INTEGER NOT NULL DEFAULT 0 CHECK(is_checked IN (0, 1)),
            completed_at TEXT,
            is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1)),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
            deleted_at TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_todos_checked ON todos(is_checked) WHERE deleted_at IS NULL;
          CREATE INDEX IF NOT EXISTS idx_todos_archived ON todos(is_archived) WHERE deleted_at IS NULL;
          CREATE INDEX IF NOT EXISTS idx_todos_sync_status ON todos(sync_status) WHERE deleted_at IS NULL;

          CREATE TRIGGER IF NOT EXISTS update_todos_updated_at
            AFTER UPDATE ON todos
            FOR EACH ROW
            WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
          BEGIN
            UPDATE todos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END;

          CREATE TRIGGER IF NOT EXISTS reset_todos_sync_status
            AFTER UPDATE ON todos
            FOR EACH ROW
            WHEN NEW.sync_status = 'synced' AND (
              OLD.title != NEW.title OR
              OLD.is_checked != NEW.is_checked OR
              OLD.completed_at != NEW.completed_at OR
              OLD.is_archived != NEW.is_archived OR
              OLD.deleted_at != NEW.deleted_at
            )
          BEGIN
            UPDATE todos SET sync_status = 'pending' WHERE id = NEW.id;
          END;
        `);
        console.log('✅ Todos table created successfully');
      } else {
        // Check if completed_at column exists
        const tableInfo = await this.db.getFirstAsync<any>(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name='todos'"
        );
        
        if (tableInfo?.sql && !tableInfo.sql.includes('completed_at')) {
          console.log('📝 Adding completed_at column to todos table...');
          await this.db.execAsync('ALTER TABLE todos ADD COLUMN completed_at TEXT');
          console.log('✅ completed_at column added');
        }
      }

      // Check if schedule_blocks table exists, create it if it doesn't (additive migration)
      const scheduleBlocksResult = await this.db.getFirstAsync<any>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schedule_blocks'"
      );

      if (!scheduleBlocksResult) {
        console.log('📝 Creating schedule_blocks table...');
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS schedule_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
            specific_date TEXT,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            color TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
            deleted_at TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_schedule_blocks_day ON schedule_blocks(day_of_week) WHERE deleted_at IS NULL;
          CREATE INDEX IF NOT EXISTS idx_schedule_blocks_time ON schedule_blocks(day_of_week, start_time) WHERE deleted_at IS NULL;
          CREATE INDEX IF NOT EXISTS idx_schedule_blocks_sync_status ON schedule_blocks(sync_status) WHERE deleted_at IS NULL;

          CREATE TRIGGER IF NOT EXISTS update_schedule_blocks_updated_at
            AFTER UPDATE ON schedule_blocks
            FOR EACH ROW
            WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
          BEGIN
            UPDATE schedule_blocks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END;

          CREATE TRIGGER IF NOT EXISTS reset_schedule_blocks_sync_status
            AFTER UPDATE ON schedule_blocks
            FOR EACH ROW
            WHEN NEW.sync_status = 'synced' AND (
              OLD.day_of_week != NEW.day_of_week OR
              OLD.specific_date != NEW.specific_date OR
              OLD.start_time != NEW.start_time OR
              OLD.end_time != NEW.end_time OR
              OLD.title != NEW.title OR
              OLD.description != NEW.description OR
              OLD.color != NEW.color OR
              OLD.deleted_at != NEW.deleted_at
            )
          BEGIN
            UPDATE schedule_blocks SET sync_status = 'pending' WHERE id = NEW.id;
          END;
        `);
        console.log('✅ Schedule blocks table created successfully');
      } else {
        // Additive migration: Add specific_date column if it doesn't exist
        const columnCheck = await this.db.getFirstAsync<any>(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name='schedule_blocks'"
        );
        if (columnCheck && !columnCheck.sql.includes('specific_date')) {
          console.log('📝 Adding specific_date column to schedule_blocks...');
          await this.db.execAsync(`
            ALTER TABLE schedule_blocks ADD COLUMN specific_date TEXT;
          `);
          console.log('✅ specific_date column added successfully');
        }

        // Fix old trigger that references non-existent participants_count column
        const triggerCheck = await this.db.getFirstAsync<any>(
          "SELECT sql FROM sqlite_master WHERE type='trigger' AND name='reset_schedule_blocks_sync_status'"
        );
        if (triggerCheck?.sql && triggerCheck.sql.includes('participants_count')) {
          console.log('📝 Fixing schedule_blocks trigger (removing participants_count reference)...');
          await this.db.execAsync(`
            DROP TRIGGER IF EXISTS reset_schedule_blocks_sync_status;
            
            CREATE TRIGGER reset_schedule_blocks_sync_status
              AFTER UPDATE ON schedule_blocks
              FOR EACH ROW
              WHEN NEW.sync_status = 'synced' AND (
                OLD.day_of_week != NEW.day_of_week OR
                OLD.specific_date != NEW.specific_date OR
                OLD.start_time != NEW.start_time OR
                OLD.end_time != NEW.end_time OR
                OLD.title != NEW.title OR
                OLD.description != NEW.description OR
                OLD.color != NEW.color OR
                OLD.deleted_at != NEW.deleted_at
              )
            BEGIN
              UPDATE schedule_blocks SET sync_status = 'pending' WHERE id = NEW.id;
            END;
          `);
          console.log('✅ Schedule blocks trigger fixed successfully');
        }
      }
    } catch (error) {
      // Table doesn't exist yet, that's fine
      console.log('No migration needed');
    }

    // Check if participations table exists, create it if it doesn't (additive migration)
    try {
      const tableExists = await this.db.getFirstAsync<any>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='participations'"
      );

      if (!tableExists) {
        console.log('📝 Creating participations table...');
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS participations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            schedule_block_id INTEGER NOT NULL,
            participation_date TEXT NOT NULL,
            participants_count INTEGER NOT NULL DEFAULT 0 CHECK(participants_count >= 0),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
            deleted_at TEXT,
            FOREIGN KEY (schedule_block_id) REFERENCES schedule_blocks(id) ON DELETE CASCADE,
            UNIQUE(schedule_block_id, participation_date)
          );

          CREATE INDEX IF NOT EXISTS idx_participations_block_id ON participations(schedule_block_id) WHERE deleted_at IS NULL;
          CREATE INDEX IF NOT EXISTS idx_participations_date ON participations(participation_date) WHERE deleted_at IS NULL;
          CREATE INDEX IF NOT EXISTS idx_participations_sync_status ON participations(sync_status) WHERE deleted_at IS NULL;

          CREATE TRIGGER IF NOT EXISTS update_participations_updated_at
            AFTER UPDATE ON participations
            FOR EACH ROW
            WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
          BEGIN
            UPDATE participations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END;

          CREATE TRIGGER IF NOT EXISTS reset_participations_sync_status
            AFTER UPDATE ON participations
            FOR EACH ROW
            WHEN NEW.sync_status = 'synced' AND (
              OLD.participants_count != NEW.participants_count OR
              OLD.deleted_at != NEW.deleted_at
            )
          BEGIN
            UPDATE participations SET sync_status = 'pending' WHERE id = NEW.id;
          END;
        `);
        console.log('✅ Participations table created successfully');
      }
    } catch (error) {
      console.log('No participations migration needed');
    }

    // Check and add discount columns to members table (additive migration)
    try {
      const membersTableInfo = await this.db.getFirstAsync<any>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='members'"
      );
      
      if (membersTableInfo?.sql && !membersTableInfo.sql.includes('discount_type')) {
        console.log('📝 Adding discount columns to members table...');
        await this.db.execAsync(`
          ALTER TABLE members ADD COLUMN discount_type TEXT CHECK(discount_type IN ('$', '%'));
          ALTER TABLE members ADD COLUMN discount_amount REAL CHECK(discount_amount >= 0);
        `);
        console.log('✅ Discount columns added to members table');
      }
    } catch (error) {
      console.log('No members discount migration needed');
    }

    // Check and add discount columns to payments table (additive migration)
    try {
      const paymentsTableInfo = await this.db.getFirstAsync<any>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='payments'"
      );
      
      if (paymentsTableInfo?.sql && !paymentsTableInfo.sql.includes('discount_type')) {
        console.log('📝 Adding discount columns to payments table...');
        await this.db.execAsync(`
          ALTER TABLE payments ADD COLUMN discount_type TEXT CHECK(discount_type IN ('$', '%'));
          ALTER TABLE payments ADD COLUMN discount_amount REAL CHECK(discount_amount >= 0);
        `);
        console.log('✅ Discount columns added to payments table');
      }
    } catch (error) {
      console.log('No payments discount migration needed');
    }

    // Migrate app_settings to remove expense_categories column if it exists
    try {
      const appSettingsTableInfo = await this.db.getFirstAsync<any>(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='app_settings'"
      );
      
      if (appSettingsTableInfo?.sql && appSettingsTableInfo.sql.includes('expense_categories')) {
        console.log('📝 Migrating app_settings table to remove expense_categories column...');
        
        // Save existing data
        const existingSettings = await this.db.getFirstAsync<any>(
          "SELECT currency, enabled_payment_methods FROM app_settings WHERE id = 1"
        );
        
        // Drop and recreate table without expense_categories
        await this.db.execAsync(`
          DROP TABLE IF EXISTS app_settings;
          
          CREATE TABLE app_settings (
            id INTEGER PRIMARY KEY CHECK(id = 1),
            currency TEXT NOT NULL DEFAULT 'USD',
            enabled_payment_methods TEXT NOT NULL DEFAULT '["cash","card","bank_transfer","digital_wallet","other"]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced'))
          );
        `);
        
        // Restore data if it existed
        if (existingSettings) {
          await this.db.runAsync(
            `INSERT INTO app_settings (id, currency, enabled_payment_methods) VALUES (1, ?, ?)`,
            [existingSettings.currency, existingSettings.enabled_payment_methods]
          );
        } else {
          await this.db.runAsync(`INSERT INTO app_settings (id) VALUES (1)`);
        }
        
        console.log('✅ app_settings table migrated successfully');
      }
    } catch (error) {
      console.log('No app_settings migration needed');
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      -- Members table
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        instagram TEXT,
        address TEXT,
        emergency_contact TEXT,
        notes TEXT,
        discount_type TEXT CHECK(discount_type IN ('$', '%')),
        discount_amount REAL CHECK(discount_amount >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
        deleted_at TEXT
      );

      -- Packages table
      CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL CHECK(price >= 0),
        duration_days INTEGER NOT NULL CHECK(duration_days > 0),
        sessions_included INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
        deleted_at TEXT
      );

      -- Subscriptions table
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        package_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'cancelled')),
        sessions_remaining INTEGER,
        auto_renew INTEGER NOT NULL DEFAULT 0 CHECK(auto_renew IN (0, 1)),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
        deleted_at TEXT,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE RESTRICT
      );

      -- Payments table
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL,
        subscription_id INTEGER,
        amount REAL NOT NULL CHECK(amount >= 0),
        payment_date TEXT NOT NULL,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'card', 'bank_transfer', 'digital_wallet', 'other')),
        transaction_ref TEXT,
        status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
        notes TEXT,
        discount_type TEXT CHECK(discount_type IN ('$', '%')),
        discount_amount REAL CHECK(discount_amount >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
        deleted_at TEXT,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
      );

      -- Expenses table
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL CHECK(amount >= 0),
        expense_date TEXT NOT NULL,
        vendor TEXT,
        description TEXT,
        receipt_url TEXT,
        payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'card', 'bank_transfer', 'digital_wallet', 'other')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
        deleted_at TEXT
      );

      -- Metadata table for tracking app state
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- App settings table (single row)
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        currency TEXT NOT NULL DEFAULT 'USD',
        enabled_payment_methods TEXT NOT NULL DEFAULT '["cash","card","bank_transfer","digital_wallet","other"]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced'))
      );
      
      -- Insert default settings row
      INSERT OR IGNORE INTO app_settings (id) VALUES (1);

      -- Expense categories table
      CREATE TABLE IF NOT EXISTS expense_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
        deleted_at TEXT
      );

      -- Insert default expense categories
      INSERT OR IGNORE INTO expense_categories (name) VALUES
        ('Equipment'),
        ('Utilities'),
        ('Rent'),
        ('Supplies'),
        ('Maintenance'),
        ('Marketing'),
        ('Staff'),
        ('Other');

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_members_first_name ON members(first_name) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_members_last_name ON members(last_name) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_members_sync_status ON members(sync_status) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_packages_active ON packages(is_active) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON subscriptions(member_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_expense_categories_name ON expense_categories(name) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_expense_categories_sync_status ON expense_categories(sync_status) WHERE deleted_at IS NULL;

      -- Triggers for updated_at
      CREATE TRIGGER IF NOT EXISTS update_members_updated_at
        AFTER UPDATE ON members FOR EACH ROW
        WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
        UPDATE members SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_packages_updated_at
        AFTER UPDATE ON packages FOR EACH ROW
        WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
        UPDATE packages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_subscriptions_updated_at
        AFTER UPDATE ON subscriptions FOR EACH ROW
        WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
        UPDATE subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_payments_updated_at
        AFTER UPDATE ON payments FOR EACH ROW
        WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
        UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_expenses_updated_at
        AFTER UPDATE ON expenses FOR EACH ROW
        WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
        UPDATE expenses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_app_settings_updated_at
        AFTER UPDATE ON app_settings FOR EACH ROW
        WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
        UPDATE app_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS update_expense_categories_updated_at
        AFTER UPDATE ON expense_categories FOR EACH ROW
        WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
        UPDATE expense_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS reset_app_settings_sync_status
        AFTER UPDATE ON app_settings FOR EACH ROW
        WHEN NEW.sync_status = 'synced' AND (
          OLD.currency != NEW.currency OR
          OLD.enabled_payment_methods != NEW.enabled_payment_methods
        )
      BEGIN
        UPDATE app_settings SET sync_status = 'pending' WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS reset_expense_categories_sync_status
        AFTER UPDATE ON expense_categories FOR EACH ROW
        WHEN NEW.sync_status = 'synced' AND (
          OLD.name != NEW.name OR
          OLD.deleted_at != NEW.deleted_at
        )
      BEGIN
        UPDATE expense_categories SET sync_status = 'pending' WHERE id = NEW.id;
      END;

      -- Todos table
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        is_checked INTEGER NOT NULL DEFAULT 0 CHECK(is_checked IN (0, 1)),
        completed_at TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
        deleted_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_todos_checked ON todos(is_checked) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_todos_archived ON todos(is_archived) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_todos_sync_status ON todos(sync_status) WHERE deleted_at IS NULL;

      CREATE TRIGGER IF NOT EXISTS update_todos_updated_at
        AFTER UPDATE ON todos
        FOR EACH ROW
        WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
        UPDATE todos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS reset_todos_sync_status
        AFTER UPDATE ON todos
        FOR EACH ROW
        WHEN NEW.sync_status = 'synced' AND (
          OLD.title != NEW.title OR
          OLD.is_checked != NEW.is_checked OR
          OLD.completed_at != NEW.completed_at OR
          OLD.is_archived != NEW.is_archived OR
          OLD.deleted_at != NEW.deleted_at
        )
      BEGIN
        UPDATE todos SET sync_status = 'pending' WHERE id = NEW.id;
      END;

      -- Schedule blocks table
      CREATE TABLE IF NOT EXISTS schedule_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
        specific_date TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        color TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
        deleted_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_schedule_blocks_day ON schedule_blocks(day_of_week) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_schedule_blocks_time ON schedule_blocks(day_of_week, start_time) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_schedule_blocks_sync_status ON schedule_blocks(sync_status) WHERE deleted_at IS NULL;

      CREATE TRIGGER IF NOT EXISTS update_schedule_blocks_updated_at
        AFTER UPDATE ON schedule_blocks
        FOR EACH ROW
        WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
        UPDATE schedule_blocks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS reset_schedule_blocks_sync_status
        AFTER UPDATE ON schedule_blocks
        FOR EACH ROW
        WHEN NEW.sync_status = 'synced' AND (
          OLD.day_of_week != NEW.day_of_week OR
          OLD.specific_date != NEW.specific_date OR
          OLD.start_time != NEW.start_time OR
          OLD.end_time != NEW.end_time OR
          OLD.title != NEW.title OR
          OLD.description != NEW.description OR
          OLD.color != NEW.color OR
          OLD.deleted_at != NEW.deleted_at
        )
      BEGIN
        UPDATE schedule_blocks SET sync_status = 'pending' WHERE id = NEW.id;
      END;

      -- Participations table
      CREATE TABLE IF NOT EXISTS participations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_block_id INTEGER NOT NULL,
        participation_date TEXT NOT NULL,
        participants_count INTEGER NOT NULL DEFAULT 0 CHECK(participants_count >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
        deleted_at TEXT,
        FOREIGN KEY (schedule_block_id) REFERENCES schedule_blocks(id) ON DELETE CASCADE,
        UNIQUE(schedule_block_id, participation_date)
      );

      CREATE INDEX IF NOT EXISTS idx_participations_block_id ON participations(schedule_block_id) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_participations_date ON participations(participation_date) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_participations_sync_status ON participations(sync_status) WHERE deleted_at IS NULL;

      CREATE TRIGGER IF NOT EXISTS update_participations_updated_at
        AFTER UPDATE ON participations
        FOR EACH ROW
        WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
      BEGIN
        UPDATE participations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;

      CREATE TRIGGER IF NOT EXISTS reset_participations_sync_status
        AFTER UPDATE ON participations
        FOR EACH ROW
        WHEN NEW.sync_status = 'synced' AND (
          OLD.participants_count != NEW.participants_count OR
          OLD.deleted_at != NEW.deleted_at
        )
      BEGIN
        UPDATE participations SET sync_status = 'pending' WHERE id = NEW.id;
      END;
    `);
  }

  async getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // ============================================
  // MEMBERS METHODS
  // ============================================

  async createMember(input: CreateMemberInput): Promise<Member> {
    const db = await this.getDatabase();
    const result = await db.runAsync(
      `INSERT INTO members (first_name, last_name, phone, email, instagram, address, emergency_contact, notes, discount_type, discount_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.first_name, input.last_name, input.phone || null, input.email || null,
       input.instagram || null, input.address || null, input.emergency_contact || null, input.notes || null,
       input.discount_type || null, input.discount_amount || null]
    );
    
    const member = await db.getFirstAsync<Member>(
      'SELECT * FROM members WHERE id = ?',
      [result.lastInsertRowId]
    );
    
    if (!member) throw new Error('Failed to create member');
    return member;
  }

  async getMemberById(id: number): Promise<Member | null> {
    const db = await this.getDatabase();
    return await db.getFirstAsync<Member>(
      'SELECT * FROM members WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
  }

  async getAllMembers(params?: PaginationParams): Promise<Member[]> {
    const db = await this.getDatabase();
    const limit = params?.limit || 100;
    const offset = params?.offset || 0;
    
    return await db.getAllAsync<Member>(
      `SELECT * FROM members 
       WHERE deleted_at IS NULL 
       ORDER BY name ASC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  async updateMember(id: number, input: UpdateMemberInput): Promise<Member> {
    const db = await this.getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (input.first_name !== undefined) {
      fields.push('first_name = ?');
      values.push(input.first_name);
    }
    if (input.last_name !== undefined) {
      fields.push('last_name = ?');
      values.push(input.last_name);
    }
    if (input.email !== undefined) {
      fields.push('email = ?');
      values.push(input.email || null);
    }
    if (input.instagram !== undefined) {
      fields.push('instagram = ?');
      values.push(input.instagram || null);
    }
    if (input.phone !== undefined) {
      fields.push('phone = ?');
      values.push(input.phone || null);
    }
    if (input.address !== undefined) {
      fields.push('address = ?');
      values.push(input.address || null);
    }
    if (input.emergency_contact !== undefined) {
      fields.push('emergency_contact = ?');
      values.push(input.emergency_contact || null);
    }
    if (input.notes !== undefined) {
      fields.push('notes = ?');
      values.push(input.notes || null);
    }
    if (input.discount_type !== undefined) {
      fields.push('discount_type = ?');
      values.push(input.discount_type || null);
    }
    if (input.discount_amount !== undefined) {
      fields.push('discount_amount = ?');
      values.push(input.discount_amount || null);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    await db.runAsync(
      `UPDATE members SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const member = await this.getMemberById(id);
    if (!member) throw new Error('Member not found');
    return member;
  }

  async deleteMember(id: number): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(
      'UPDATE members SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  // ============================================
  // PACKAGES METHODS
  // ============================================

  async findSoftDeletedPackage(name: string, price: number, durationDays: number): Promise<Package | null> {
    const db = await this.getDatabase();
    return await db.getFirstAsync<Package>(
      `SELECT * FROM packages 
       WHERE name = ? AND price = ? AND duration_days = ? AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC LIMIT 1`,
      [name, price, durationDays]
    );
  }

  async reactivatePackage(id: number, input: CreatePackageInput): Promise<Package> {
    const db = await this.getDatabase();
    
    // Update the soft-deleted package with new values and reactivate it
    await db.runAsync(
      `UPDATE packages 
       SET description = ?, sessions_included = ?, is_active = ?, deleted_at = NULL, sync_status = 'pending'
       WHERE id = ?`,
      [input.description || null, input.sessions_included || null, input.is_active !== false ? 1 : 0, id]
    );
    
    const pkg = await db.getFirstAsync<Package>(
      'SELECT * FROM packages WHERE id = ?',
      [id]
    );
    
    if (!pkg) throw new Error('Failed to reactivate package');
    console.log(`Reactivated soft-deleted package: ${pkg.name} (ID: ${pkg.id})`);
    return pkg;
  }

  async createPackage(input: CreatePackageInput): Promise<Package> {
    const db = await this.getDatabase();
    
    // Check if a soft-deleted package with the same name, price, and duration exists
    const softDeleted = await this.findSoftDeletedPackage(
      input.name,
      input.price,
      input.duration_days
    );
    
    if (softDeleted) {
      // Reactivate the soft-deleted package instead of creating a new one
      return await this.reactivatePackage(softDeleted.id, input);
    }
    
    // No soft-deleted package found, create a new one
    const result = await db.runAsync(
      `INSERT INTO packages (name, description, price, duration_days, sessions_included, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.name, input.description || null, input.price, input.duration_days,
       input.sessions_included || null, input.is_active !== false ? 1 : 0]
    );
    
    const pkg = await db.getFirstAsync<Package>(
      'SELECT * FROM packages WHERE id = ?',
      [result.lastInsertRowId]
    );
    
    if (!pkg) throw new Error('Failed to create package');
    return pkg;
  }

  async getPackageById(id: number): Promise<Package | null> {
    const db = await this.getDatabase();
    return await db.getFirstAsync<Package>(
      'SELECT * FROM packages WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
  }

  async getAllPackages(activeOnly = false): Promise<Package[]> {
    const db = await this.getDatabase();
    const query = activeOnly
      ? 'SELECT * FROM packages WHERE deleted_at IS NULL AND is_active = 1 ORDER BY name ASC'
      : 'SELECT * FROM packages WHERE deleted_at IS NULL ORDER BY name ASC';
    
    return await db.getAllAsync<Package>(query);
  }

  async getActivePackages(): Promise<Package[]> {
    return this.getAllPackages(true);
  }

  async updatePackage(id: number, input: UpdatePackageInput): Promise<Package> {
    const db = await this.getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      values.push(input.description || null);
    }
    if (input.price !== undefined) {
      fields.push('price = ?');
      values.push(input.price);
    }
    if (input.duration_days !== undefined) {
      fields.push('duration_days = ?');
      values.push(input.duration_days);
    }
    if (input.sessions_included !== undefined) {
      fields.push('sessions_included = ?');
      values.push(input.sessions_included || null);
    }
    if (input.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(input.is_active ? 1 : 0);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    await db.runAsync(
      `UPDATE packages SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const pkg = await this.getPackageById(id);
    if (!pkg) throw new Error('Package not found');
    return pkg;
  }

  async deletePackage(id: number): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(
      'UPDATE packages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  // ============================================
  // SUBSCRIPTIONS METHODS
  // ============================================

  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const db = await this.getDatabase();
    const result = await db.runAsync(
      `INSERT INTO subscriptions (member_id, package_id, start_date, end_date, status, sessions_remaining, auto_renew, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.member_id, input.package_id, input.start_date, input.end_date,
       input.status || 'active', input.sessions_remaining || null,
       input.auto_renew ? 1 : 0, input.notes || null]
    );
    
    const subscription = await db.getFirstAsync<Subscription>(
      'SELECT * FROM subscriptions WHERE id = ?',
      [result.lastInsertRowId]
    );
    
    if (!subscription) throw new Error('Failed to create subscription');
    return subscription;
  }

  async getSubscriptionById(id: number): Promise<Subscription | null> {
    const db = await this.getDatabase();
    
    // Auto-update expired subscriptions
    await this.updateExpiredSubscriptions();
    
    return await db.getFirstAsync<Subscription>(
      'SELECT * FROM subscriptions WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
  }

  async getSubscriptionsByMember(memberId: number): Promise<Subscription[]> {
    const db = await this.getDatabase();
    
    // Auto-update expired subscriptions
    await this.updateExpiredSubscriptions();
    
    return await db.getAllAsync<Subscription>(
      `SELECT s.*, p.name as package_name, p.price as package_price
       FROM subscriptions s
       LEFT JOIN packages p ON s.package_id = p.id
       WHERE s.member_id = ? AND s.deleted_at IS NULL 
       ORDER BY s.start_date DESC`,
      [memberId]
    );
  }

  async updateExpiredSubscriptions(): Promise<void> {
    const db = await this.getDatabase();
    const now = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format
    
    // Update subscriptions where end_date has passed and status is still 'active'
    await db.runAsync(
      `UPDATE subscriptions 
       SET status = 'expired', sync_status = 'pending'
       WHERE end_date < ? AND status = 'active' AND deleted_at IS NULL`,
      [now]
    );
  }

  async getActiveSubscriptions(): Promise<Subscription[]> {
    const db = await this.getDatabase();
    
    // Auto-update expired subscriptions
    await this.updateExpiredSubscriptions();
    
    return await db.getAllAsync<Subscription>(
      `SELECT * FROM subscriptions 
       WHERE status = 'active' AND deleted_at IS NULL 
       ORDER BY end_date ASC`
    );
  }

  async updateSubscription(id: number, input: UpdateSubscriptionInput): Promise<Subscription> {
    const db = await this.getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (input.member_id !== undefined) {
      fields.push('member_id = ?');
      values.push(input.member_id);
    }
    if (input.package_id !== undefined) {
      fields.push('package_id = ?');
      values.push(input.package_id);
    }
    if (input.start_date !== undefined) {
      fields.push('start_date = ?');
      values.push(input.start_date);
    }
    if (input.end_date !== undefined) {
      fields.push('end_date = ?');
      values.push(input.end_date);
    }
    if (input.status !== undefined) {
      fields.push('status = ?');
      values.push(input.status);
    }
    if (input.sessions_remaining !== undefined) {
      fields.push('sessions_remaining = ?');
      values.push(input.sessions_remaining || null);
    }
    if (input.auto_renew !== undefined) {
      fields.push('auto_renew = ?');
      values.push(input.auto_renew ? 1 : 0);
    }
    if (input.notes !== undefined) {
      fields.push('notes = ?');
      values.push(input.notes || null);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    await db.runAsync(
      `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const subscription = await this.getSubscriptionById(id);
    if (!subscription) throw new Error('Subscription not found');
    return subscription;
  }

  async deleteSubscription(id: number): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(
      'UPDATE subscriptions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  // ============================================
  // PAYMENTS METHODS
  // ============================================

  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    const db = await this.getDatabase();
    const result = await db.runAsync(
      `INSERT INTO payments (member_id, subscription_id, amount, payment_date, payment_method, transaction_ref, status, notes, discount_type, discount_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.member_id, input.subscription_id || null, input.amount, input.payment_date,
       input.payment_method, input.transaction_ref || null, input.status || 'completed',
       input.notes || null, input.discount_type || null, input.discount_amount || null]
    );
    
    const payment = await db.getFirstAsync<Payment>(
      'SELECT * FROM payments WHERE id = ?',
      [result.lastInsertRowId]
    );
    
    if (!payment) throw new Error('Failed to create payment');
    return payment;
  }

  async getPaymentById(id: number): Promise<Payment | null> {
    const db = await this.getDatabase();
    return await db.getFirstAsync<Payment>(
      'SELECT * FROM payments WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
  }

  async getPaymentsByMember(memberId: number): Promise<Payment[]> {
    const db = await this.getDatabase();
    return await db.getAllAsync<Payment>(
      `SELECT * FROM payments 
       WHERE member_id = ? AND deleted_at IS NULL 
       ORDER BY payment_date DESC`,
      [memberId]
    );
  }

  async getPaymentsByDateRange(filter: DateRangeFilter & PaginationParams): Promise<Payment[]> {
    const db = await this.getDatabase();
    const limit = filter.limit || 100;
    const offset = filter.offset || 0;

    if (filter.start_date && filter.end_date) {
      return await db.getAllAsync<Payment>(
        `SELECT * FROM payments 
         WHERE payment_date BETWEEN ? AND ? AND deleted_at IS NULL 
         ORDER BY payment_date DESC 
         LIMIT ? OFFSET ?`,
        [filter.start_date, filter.end_date, limit, offset]
      );
    }

    return await db.getAllAsync<Payment>(
      `SELECT * FROM payments 
       WHERE deleted_at IS NULL 
       ORDER BY payment_date DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  async updatePayment(id: number, input: UpdatePaymentInput): Promise<Payment> {
    const db = await this.getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (input.member_id !== undefined) {
      fields.push('member_id = ?');
      values.push(input.member_id);
    }
    if (input.subscription_id !== undefined) {
      fields.push('subscription_id = ?');
      values.push(input.subscription_id || null);
    }
    if (input.amount !== undefined) {
      fields.push('amount = ?');
      values.push(input.amount);
    }
    if (input.payment_date !== undefined) {
      fields.push('payment_date = ?');
      values.push(input.payment_date);
    }
    if (input.payment_method !== undefined) {
      fields.push('payment_method = ?');
      values.push(input.payment_method);
    }
    if (input.transaction_ref !== undefined) {
      fields.push('transaction_ref = ?');
      values.push(input.transaction_ref || null);
    }
    if (input.status !== undefined) {
      fields.push('status = ?');
      values.push(input.status);
    }
    if (input.notes !== undefined) {
      fields.push('notes = ?');
      values.push(input.notes || null);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    await db.runAsync(
      `UPDATE payments SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const payment = await this.getPaymentById(id);
    if (!payment) throw new Error('Payment not found');
    return payment;
  }

  async deletePayment(id: number): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(
      'UPDATE payments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  async getPaymentsWithDetails(filter?: {
    dateFilter?: 'today' | 'this_month';
    statusFilter?: 'completed' | 'pending';
  }): Promise<PaymentWithDetails[]> {
    const db = await this.getDatabase();
    let query = `
      SELECT 
        p.*,
        (m.first_name || ' ' || m.last_name) as member_name,
        m.email as member_email,
        pkg.name as package_name
      FROM payments p
      LEFT JOIN members m ON p.member_id = m.id
      LEFT JOIN subscriptions s ON p.subscription_id = s.id
      LEFT JOIN packages pkg ON s.package_id = pkg.id
      WHERE p.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (filter?.dateFilter === 'today') {
      query += ' AND DATE(p.payment_date) = DATE("now")';
    } else if (filter?.dateFilter === 'this_month') {
      query += ' AND strftime("%Y-%m", p.payment_date) = strftime("%Y-%m", "now")';
    }

    if (filter?.statusFilter) {
      query += ' AND p.status = ?';
      params.push(filter.statusFilter);
    }

    query += ' ORDER BY p.payment_date DESC, p.created_at DESC';

    return await db.getAllAsync<PaymentWithDetails>(query, params);
  }

  // ============================================
  // EXPENSES METHODS
  // ============================================

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    const db = await this.getDatabase();
    console.log('Creating expense with data:', input);
    const result = await db.runAsync(
      `INSERT INTO expenses (category, amount, expense_date, vendor, description, receipt_url, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.category, input.amount, input.expense_date, input.vendor || null,
       input.description || null, input.receipt_url || null, input.payment_method]
    );
    
    console.log('Expense inserted with ID:', result.lastInsertRowId);
    
    const expense = await db.getFirstAsync<Expense>(
      'SELECT * FROM expenses WHERE id = ?',
      [result.lastInsertRowId]
    );
    
    if (!expense) throw new Error('Failed to create expense');
    console.log('Expense retrieved from DB:', expense);
    return expense;
  }

  async getExpenseById(id: number): Promise<Expense | null> {
    const db = await this.getDatabase();
    return await db.getFirstAsync<Expense>(
      'SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
  }

  async getExpensesByDateRange(filter: DateRangeFilter & PaginationParams): Promise<Expense[]> {
    const db = await this.getDatabase();
    const limit = filter.limit || 100;
    const offset = filter.offset || 0;

    if (filter.start_date && filter.end_date) {
      console.log('Fetching expenses with date range:', filter.start_date, 'to', filter.end_date);
      return await db.getAllAsync<Expense>(
        `SELECT * FROM expenses 
         WHERE expense_date BETWEEN ? AND ? AND deleted_at IS NULL 
         ORDER BY expense_date DESC 
         LIMIT ? OFFSET ?`,
        [filter.start_date, filter.end_date, limit, offset]
      );
    }

    console.log('Fetching all expenses (no date filter)');
    const expenses = await db.getAllAsync<Expense>(
      `SELECT * FROM expenses 
       WHERE deleted_at IS NULL 
       ORDER BY expense_date DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    console.log(`Found ${expenses.length} expenses in database`);
    return expenses;
  }

  async getExpensesByCategory(category: string): Promise<Expense[]> {
    const db = await this.getDatabase();
    return await db.getAllAsync<Expense>(
      `SELECT * FROM expenses 
       WHERE category = ? AND deleted_at IS NULL 
       ORDER BY expense_date DESC`,
      [category]
    );
  }

  async updateExpense(id: number, input: UpdateExpenseInput): Promise<Expense> {
    const db = await this.getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (input.category !== undefined) {
      fields.push('category = ?');
      values.push(input.category);
    }
    if (input.amount !== undefined) {
      fields.push('amount = ?');
      values.push(input.amount);
    }
    if (input.expense_date !== undefined) {
      fields.push('expense_date = ?');
      values.push(input.expense_date);
    }
    if (input.vendor !== undefined) {
      fields.push('vendor = ?');
      values.push(input.vendor || null);
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      values.push(input.description || null);
    }
    if (input.receipt_url !== undefined) {
      fields.push('receipt_url = ?');
      values.push(input.receipt_url || null);
    }
    if (input.payment_method !== undefined) {
      fields.push('payment_method = ?');
      values.push(input.payment_method || null);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    await db.runAsync(
      `UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const expense = await this.getExpenseById(id);
    if (!expense) throw new Error('Expense not found');
    return expense;
  }

  async deleteExpense(id: number): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(
      'UPDATE expenses SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  // ============================================
  // TODO METHODS
  // ============================================

  async createTodo(input: CreateTodoInput): Promise<Todo> {
    const db = await this.getDatabase();
    const result = await db.runAsync(
      `INSERT INTO todos (title, is_checked, is_archived)
       VALUES (?, ?, ?)`,
      [
        input.title,
        input.is_checked ? 1 : 0,
        input.is_archived ? 1 : 0,
      ]
    );

    const todo = await this.getTodoById(result.lastInsertRowId);
    if (!todo) throw new Error('Failed to create todo');
    return todo;
  }

  async getTodos(includeArchived: boolean = false): Promise<Todo[]> {
    const db = await this.getDatabase();
    
    // Auto-archive completed todos older than 7 days
    await db.runAsync(`
      UPDATE todos 
      SET is_archived = 1 
      WHERE is_checked = 1 
        AND completed_at IS NOT NULL 
        AND is_archived = 0 
        AND deleted_at IS NULL
        AND DATE(completed_at) <= DATE('now', '-7 days')
    `);

    const query = includeArchived
      ? `SELECT * FROM todos WHERE is_archived = 1 AND deleted_at IS NULL ORDER BY created_at DESC`
      : `SELECT * FROM todos WHERE is_archived = 0 AND deleted_at IS NULL ORDER BY is_checked ASC, created_at DESC`;

    const rows = await db.getAllAsync<any>(query);
    return rows.map(row => ({
      ...row,
      is_checked: Boolean(row.is_checked),
      is_archived: Boolean(row.is_archived),
    }));
  }

  async getTodoById(id: number): Promise<Todo | null> {
    const db = await this.getDatabase();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM todos WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!row) return null;
    return {
      ...row,
      is_checked: Boolean(row.is_checked),
      is_archived: Boolean(row.is_archived),
      completed_at: row.completed_at || null,
    };
  }

  async updateTodo(id: number, input: UpdateTodoInput): Promise<Todo> {
    const db = await this.getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (input.title !== undefined) {
      fields.push('title = ?');
      values.push(input.title);
    }
    if (input.is_checked !== undefined) {
      fields.push('is_checked = ?');
      values.push(input.is_checked ? 1 : 0);
    }
    if (input.is_archived !== undefined) {
      fields.push('is_archived = ?');
      values.push(input.is_archived ? 1 : 0);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    await db.runAsync(
      `UPDATE todos SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const todo = await this.getTodoById(id);
    if (!todo) throw new Error('Todo not found');
    return todo;
  }

  async deleteTodo(id: number): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(
      'UPDATE todos SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  }

  async toggleTodoCheck(id: number): Promise<Todo> {
    const todo = await this.getTodoById(id);
    if (!todo) throw new Error('Todo not found');
    
    const db = await this.getDatabase();
    
    // If checking the todo, set completed_at; if unchecking, clear it
    if (!todo.is_checked) {
      await db.runAsync(
        'UPDATE todos SET is_checked = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
    } else {
      await db.runAsync(
        'UPDATE todos SET is_checked = 0, completed_at = NULL WHERE id = ?',
        [id]
      );
    }
    
    const updatedTodo = await this.getTodoById(id);
    if (!updatedTodo) throw new Error('Todo not found');
    return updatedTodo;
  }

  async archiveTodo(id: number): Promise<Todo> {
    return this.updateTodo(id, { is_archived: true });
  }

  // ============================================
  // SCHEDULE BLOCK METHODS
  // ============================================

  async createScheduleBlock(input: CreateScheduleBlockInput): Promise<ScheduleBlock> {
    const db = await this.getDatabase();
    const result = await db.runAsync(
      `INSERT INTO schedule_blocks (day_of_week, specific_date, start_time, end_time, title, description, color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.day_of_week,
        input.specific_date || null,
        input.start_time,
        input.end_time,
        input.title,
        input.description || null,
        input.color || null,
      ]
    );

    const block = await this.getScheduleBlockById(result.lastInsertRowId);
    if (!block) throw new Error('Failed to create schedule block');
    return block;
  }

  async getScheduleBlocks(): Promise<ScheduleBlock[]> {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<ScheduleBlock>(
      `SELECT * FROM schedule_blocks 
       WHERE deleted_at IS NULL 
       ORDER BY day_of_week ASC, start_time ASC`
    );
    return rows;
  }

  async getScheduleBlocksByDay(dayOfWeek: number): Promise<ScheduleBlock[]> {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<ScheduleBlock>(
      `SELECT * FROM schedule_blocks 
       WHERE day_of_week = ? AND deleted_at IS NULL 
       ORDER BY start_time ASC`,
      [dayOfWeek]
    );
    return rows;
  }

  async getScheduleBlockById(id: number): Promise<ScheduleBlock | null> {
    const db = await this.getDatabase();
    const row = await db.getFirstAsync<ScheduleBlock>(
      'SELECT * FROM schedule_blocks WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row || null;
  }

  async updateScheduleBlock(id: number, input: UpdateScheduleBlockInput): Promise<ScheduleBlock> {
    const db = await this.getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    if (input.day_of_week !== undefined) {
      fields.push('day_of_week = ?');
      values.push(input.day_of_week);
    }
    if (input.specific_date !== undefined) {
      fields.push('specific_date = ?');
      values.push(input.specific_date || null);
    }
    if (input.start_time !== undefined) {
      fields.push('start_time = ?');
      values.push(input.start_time);
    }
    if (input.end_time !== undefined) {
      fields.push('end_time = ?');
      values.push(input.end_time);
    }
    if (input.title !== undefined) {
      fields.push('title = ?');
      values.push(input.title);
    }
    if (input.description !== undefined) {
      fields.push('description = ?');
      values.push(input.description || null);
    }
    if (input.color !== undefined) {
      fields.push('color = ?');
      values.push(input.color || null);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);
    await db.runAsync(
      `UPDATE schedule_blocks SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const block = await this.getScheduleBlockById(id);
    if (!block) throw new Error('Schedule block not found');
    return block;
  }

  async deleteScheduleBlock(id: number): Promise<void> {
    const db = await this.getDatabase();
    // Soft delete the schedule block
    await db.runAsync(
      'UPDATE schedule_blocks SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    // Also soft delete all participations for this block
    await db.runAsync(
      'UPDATE participations SET deleted_at = CURRENT_TIMESTAMP WHERE schedule_block_id = ? AND deleted_at IS NULL',
      [id]
    );
  }

  async findSeriesBlocks(baseBlockId: number): Promise<ScheduleBlock[]> {
    const db = await this.getDatabase();
    
    // Get the base block
    const baseBlock = await this.getScheduleBlockById(baseBlockId);
    if (!baseBlock) return [];
    
    // Find all blocks that match the series criteria
    // (same start_time, end_time, title, color, and either all recurring or all one-time)
    const rows = await db.getAllAsync<ScheduleBlock>(
      `SELECT * FROM schedule_blocks 
       WHERE deleted_at IS NULL 
         AND start_time = ? 
         AND end_time = ? 
         AND title = ?
         AND COALESCE(color, '') = COALESCE(?, '')
         AND (
           (specific_date IS NULL AND ? IS NULL) OR 
           (specific_date IS NOT NULL AND ? IS NOT NULL)
         )
       ORDER BY day_of_week ASC`,
      [
        baseBlock.start_time,
        baseBlock.end_time,
        baseBlock.title,
        baseBlock.color || '',
        baseBlock.specific_date,
        baseBlock.specific_date,
      ]
    );
    
    return rows;
  }

  async deleteScheduleBlockSeries(baseBlockId: number): Promise<void> {
    const db = await this.getDatabase();
    
    // Get all blocks in the series
    const seriesBlocks = await this.findSeriesBlocks(baseBlockId);
    
    // Delete all blocks in the series
    const ids = seriesBlocks.map(b => b.id);
    if (ids.length === 0) return;
    
    const placeholders = ids.map(() => '?').join(',');
    // Soft delete all blocks in the series
    await db.runAsync(
      `UPDATE schedule_blocks SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      ids
    );
    // Also soft delete all participations for these blocks
    await db.runAsync(
      `UPDATE participations SET deleted_at = CURRENT_TIMESTAMP WHERE schedule_block_id IN (${placeholders}) AND deleted_at IS NULL`,
      ids
    );
  }

  async getTodaysScheduleBlocks(): Promise<ScheduleBlock[]> {
    const db = await this.getDatabase();
    const now = new Date();
    const dayOfWeek = now.getDay();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get all blocks for today (both past and upcoming)
    const rows = await db.getAllAsync<ScheduleBlock>(
      `SELECT * FROM schedule_blocks 
       WHERE deleted_at IS NULL 
       AND (
         (day_of_week = ? AND specific_date IS NULL) OR
         (specific_date = ?)
       )
       ORDER BY start_time ASC`,
      [dayOfWeek, today]
    );
    return rows;
  }

  async getScheduleBlocksForDate(date: Date): Promise<ScheduleBlock[]> {
    const db = await this.getDatabase();
    const dayOfWeek = date.getDay();
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get all blocks for the specified date (both recurring and specific)
    const rows = await db.getAllAsync<ScheduleBlock>(
      `SELECT * FROM schedule_blocks 
       WHERE deleted_at IS NULL 
       AND (
         (day_of_week = ? AND specific_date IS NULL) OR
         (specific_date = ?)
       )
       ORDER BY start_time ASC`,
      [dayOfWeek, dateString]
    );
    return rows;
  }


  // ============================================
  // PARTICIPATION METHODS
  // ============================================

  async saveParticipation(input: CreateParticipationInput): Promise<Participation> {
    const db = await this.getDatabase();
    
    // Verify the schedule block exists and is not deleted
    const block = await this.getScheduleBlockById(input.schedule_block_id);
    if (!block) {
      throw new Error('Cannot save participation for deleted or non-existent schedule block');
    }
    
    // Check if participation already exists for this block and date
    const existing = await db.getFirstAsync<Participation>(
      `SELECT * FROM participations 
       WHERE schedule_block_id = ? 
       AND participation_date = ? 
       AND deleted_at IS NULL`,
      [input.schedule_block_id, input.participation_date]
    );

    if (existing) {
      // Update existing participation
      await db.runAsync(
        `UPDATE participations 
         SET participants_count = ?, 
             updated_at = CURRENT_TIMESTAMP,
             sync_status = 'pending'
         WHERE id = ?`,
        [input.participants_count, existing.id]
      );
      return this.getParticipationById(existing.id) as Promise<Participation>;
    } else {
      // Create new participation
      const result = await db.runAsync(
        `INSERT INTO participations (schedule_block_id, participation_date, participants_count)
         VALUES (?, ?, ?)`,
        [input.schedule_block_id, input.participation_date, input.participants_count]
      );
      return this.getParticipationById(result.lastInsertRowId!) as Promise<Participation>;
    }
  }

  async getParticipationById(id: number): Promise<Participation | null> {
    const db = await this.getDatabase();
    const row = await db.getFirstAsync<Participation>(
      'SELECT * FROM participations WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return row || null;
  }

  async getParticipation(blockId: number, date: string): Promise<Participation | null> {
    const db = await this.getDatabase();
    const row = await db.getFirstAsync<Participation>(
      `SELECT p.* FROM participations p
       INNER JOIN schedule_blocks sb ON p.schedule_block_id = sb.id
       WHERE p.schedule_block_id = ? 
       AND p.participation_date = ? 
       AND p.deleted_at IS NULL
       AND sb.deleted_at IS NULL`,
      [blockId, date]
    );
    return row || null;
  }

  async getParticipations(): Promise<Participation[]> {
    const db = await this.getDatabase();
    const rows = await db.getAllAsync<Participation>(
      `SELECT p.* FROM participations p
       INNER JOIN schedule_blocks sb ON p.schedule_block_id = sb.id
       WHERE p.deleted_at IS NULL
       AND sb.deleted_at IS NULL
       ORDER BY p.participation_date DESC`
    );
    return rows;
  }


  // ============================================
  // DASHBOARD STATS METHODS
  // ============================================

  async getActiveMembersCount(): Promise<number> {
    const db = await this.getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(DISTINCT s.member_id) as count
       FROM subscriptions s
       WHERE s.status = 'active' AND s.deleted_at IS NULL`
    );
    return result?.count || 0;
  }

  async getExpiringSoonCount(days: number = 7): Promise<number> {
    const db = await this.getDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM subscriptions
       WHERE status = 'active' 
       AND deleted_at IS NULL
       AND DATE(end_date) <= DATE('now', '+' || ? || ' days')
       AND DATE(end_date) >= DATE('now')`,
      [days]
    );
    return result?.count || 0;
  }

  async getDashboardStats(): Promise<{
    activeMembersCount: number;
    expiringSoonCount: number;
    pendingSyncCount: number;
  }> {
    const [activeMembersCount, expiringSoonCount] = await Promise.all([
      this.getActiveMembersCount(),
      this.getExpiringSoonCount(7),
    ]);

    const db = await this.getDatabase();
    
    // Count all pending records across all tables
    const pendingResult = await db.getFirstAsync<{ count: number }>(
      `SELECT 
        (SELECT COUNT(*) FROM members WHERE sync_status = 'pending' AND deleted_at IS NULL) +
        (SELECT COUNT(*) FROM subscriptions WHERE sync_status = 'pending' AND deleted_at IS NULL) +
        (SELECT COUNT(*) FROM payments WHERE sync_status = 'pending' AND deleted_at IS NULL) +
        (SELECT COUNT(*) FROM expenses WHERE sync_status = 'pending' AND deleted_at IS NULL)
        as count`
    );

    return {
      activeMembersCount,
      expiringSoonCount,
      pendingSyncCount: pendingResult?.count || 0,
    };
  }

  // ============================================
  // FINANCE STATS METHODS
  // ============================================

  async getFinanceStats(): Promise<{
    todayRevenue: number;
    monthlyRevenue: number;
    monthlyExpenses: number;
    netProfit: number;
  }> {
    const db = await this.getDatabase();

    // Today's revenue (completed payments only)
    const todayResult = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE DATE(payment_date) = DATE('now')
       AND status = 'completed'
       AND deleted_at IS NULL`
    );

    // Monthly revenue (completed payments only)
    const monthlyRevenueResult = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM payments
       WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')
       AND status = 'completed'
       AND deleted_at IS NULL`
    );

    // Monthly expenses
    const monthlyExpensesResult = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')
       AND deleted_at IS NULL`
    );

    const todayRevenue = todayResult?.total || 0;
    const monthlyRevenue = monthlyRevenueResult?.total || 0;
    const monthlyExpenses = monthlyExpensesResult?.total || 0;
    const netProfit = monthlyRevenue - monthlyExpenses;

    return {
      todayRevenue,
      monthlyRevenue,
      monthlyExpenses,
      netProfit,
    };
  }

  async getMembersWithSubscriptions(filter?: 'active' | 'expired' | 'all'): Promise<MemberWithSubscription[]> {
    const db = await this.getDatabase();
    
    // Auto-update expired subscriptions
    await this.updateExpiredSubscriptions();
    
    let statusFilter = '';
    if (filter === 'active') {
      statusFilter = "AND s.status = 'active'";
    } else if (filter === 'expired') {
      statusFilter = "AND s.status = 'expired'";
    }
    
    const members = await db.getAllAsync<MemberWithSubscription>(
      `SELECT 
        m.*,
        s.id as subscription_id,
        s.status as subscription_status,
        s.start_date as subscription_start_date,
        s.end_date as subscription_end_date,
        p.id as package_id,
        p.name as package_name,
        p.price as package_price
      FROM members m
      LEFT JOIN subscriptions s ON m.id = s.member_id 
        AND s.deleted_at IS NULL
        AND s.id = (
          SELECT id FROM subscriptions 
          WHERE member_id = m.id AND deleted_at IS NULL 
          ORDER BY created_at DESC 
          LIMIT 1
        )
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE m.deleted_at IS NULL ${statusFilter}
      ORDER BY m.first_name ASC, m.last_name ASC`
    );
    
    return members;
  }

  async searchMembers(query: string, filter?: 'active' | 'expired' | 'all'): Promise<MemberWithSubscription[]> {
    const db = await this.getDatabase();
    
    // Auto-update expired subscriptions
    await this.updateExpiredSubscriptions();
    
    let statusFilter = '';
    if (filter === 'active') {
      statusFilter = "AND s.status = 'active'";
    } else if (filter === 'expired') {
      statusFilter = "AND s.status = 'expired'";
    }
    
    const searchPattern = `%${query}%`;
    
    const members = await db.getAllAsync<MemberWithSubscription>(
      `SELECT 
        m.*,
        s.id as subscription_id,
        s.status as subscription_status,
        s.start_date as subscription_start_date,
        s.end_date as subscription_end_date,
        p.id as package_id,
        p.name as package_name,
        p.price as package_price
      FROM members m
      LEFT JOIN subscriptions s ON m.id = s.member_id 
        AND s.deleted_at IS NULL
        AND s.id = (
          SELECT id FROM subscriptions 
          WHERE member_id = m.id AND deleted_at IS NULL 
          ORDER BY created_at DESC 
          LIMIT 1
        )
      LEFT JOIN packages p ON s.package_id = p.id
      WHERE m.deleted_at IS NULL 
        AND (m.first_name LIKE ? OR m.last_name LIKE ? OR m.email LIKE ? OR m.phone LIKE ? OR m.instagram LIKE ?)
        ${statusFilter}
      ORDER BY m.first_name ASC, m.last_name ASC`,
      [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
    );
    
    return members;
  }

  // ============================================
  // SYNC METHODS
  // ============================================

  async getPendingRecords<T = any>(table: string): Promise<T[]> {
    const db = await this.getDatabase();
    return await db.getAllAsync<T>(
      `SELECT * FROM ${table} WHERE sync_status = 'pending' AND deleted_at IS NULL`
    );
  }

  async getAllPendingRecordsIncludingDeleted<T = any>(table: string): Promise<T[]> {
    const db = await this.getDatabase();
    
    // For tables with foreign keys, filter out records that reference deleted/non-existent entities
    if (table === 'subscriptions') {
      // Only sync subscriptions that have valid member_id and package_id
      return await db.getAllAsync<T>(
        `SELECT s.* FROM ${table} s
         INNER JOIN members m ON s.member_id = m.id
         INNER JOIN packages p ON s.package_id = p.id
         WHERE s.sync_status = 'pending'
         AND m.deleted_at IS NULL
         AND p.deleted_at IS NULL`
      );
    } else if (table === 'payments') {
      // Only sync payments that have valid member_id and (no subscription OR valid subscription_id)
      return await db.getAllAsync<T>(
        `SELECT pay.* FROM ${table} pay
         INNER JOIN members m ON pay.member_id = m.id
         LEFT JOIN subscriptions s ON pay.subscription_id = s.id
         WHERE pay.sync_status = 'pending'
         AND m.deleted_at IS NULL
         AND (pay.subscription_id IS NULL OR s.deleted_at IS NULL)`
      );
    } else if (table === 'participations') {
      // Only sync participations that have valid schedule_block_id
      return await db.getAllAsync<T>(
        `SELECT p.* FROM ${table} p
         INNER JOIN schedule_blocks sb ON p.schedule_block_id = sb.id
         WHERE p.sync_status = 'pending'
         AND sb.deleted_at IS NULL`
      );
    } else if (table === 'app_settings') {
      // Single row table without deleted_at
      return await db.getAllAsync<T>(
        `SELECT * FROM ${table} WHERE sync_status = 'pending'`
      );
    } else {
      // For other tables, just get all pending records (those with deleted_at support)
      return await db.getAllAsync<T>(
        `SELECT * FROM ${table} WHERE sync_status = 'pending'`
      );
    }
  }

  async markAsSynced(table: string, id: number): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(
      `UPDATE ${table} SET sync_status = 'synced' WHERE id = ?`,
      [id]
    );
  }

  async markMultipleAsSynced(table: string, ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    
    const db = await this.getDatabase();
    
    // Mark each record individually to preserve updated_at
    // We need to get the current updated_at first to prevent the trigger from firing
    for (const id of ids) {
      const record = await db.getFirstAsync<{ updated_at: string }>(
        `SELECT updated_at FROM ${table} WHERE id = ?`,
        [id]
      );
      
      if (record) {
        // Explicitly set updated_at to its current value to prevent the auto-update trigger
        // from firing and changing it to CURRENT_TIMESTAMP
        await db.runAsync(
          `UPDATE ${table} SET sync_status = 'synced', updated_at = ? WHERE id = ?`,
          [record.updated_at, id]
        );
      }
    }
  }

  /**
   * Upsert records from remote with conflict resolution
   * If local record is newer (based on updated_at), keep local version
   * Otherwise, update with remote version
   */
  async upsertFromRemote<T extends BaseEntity>(
    table: string,
    records: T[]
  ): Promise<{ inserted: number; updated: number; skipped: number }> {
    if (records.length === 0) {
      return { inserted: 0, updated: 0, skipped: 0 };
    }

    const db = await this.getDatabase();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const record of records) {
      // Check if record exists locally
      const existing = await db.getFirstAsync<BaseEntity>(
        `SELECT id, updated_at FROM ${table} WHERE id = ?`,
        [record.id]
      );

      if (!existing) {
        // Insert new record (mark as synced since it came from remote)
        const columns = Object.keys(record).filter(k => k !== 'id' && k !== 'sync_status');
        const values = columns.map(k => (record as any)[k]);
        const placeholders = columns.map(() => '?').join(',');
        
        await db.runAsync(
          `INSERT OR IGNORE INTO ${table} (id, ${columns.join(', ')}, sync_status) VALUES (?, ${placeholders}, 'synced')`,
          [record.id, ...values]
        );
        inserted++;
      } else {
        // Compare timestamps for conflict resolution
        // SQLite stores timestamps as 'YYYY-MM-DD HH:MM:SS' in UTC (no timezone marker)
        // We need to ensure both are parsed as UTC for accurate comparison
        const localTimeStr = existing.updated_at;
        const remoteTimeStr = record.updated_at;
        
        // Parse local timestamp as UTC by adding 'Z' or converting format
        const localTime = localTimeStr.includes('T') 
          ? new Date(localTimeStr).getTime()
          : new Date(localTimeStr.replace(' ', 'T') + 'Z').getTime();
        const remoteTime = new Date(remoteTimeStr).getTime();

        console.log(`Comparing ${table} #${record.id}: local=${localTimeStr} (${localTime}) vs remote=${remoteTimeStr} (${remoteTime})`);

        if (remoteTime > localTime) {
          // Remote is newer, update local (mark as synced since it came from remote)
          const columns = Object.keys(record).filter(k => k !== 'id' && k !== 'sync_status');
          const setClause = columns.map(k => `${k} = ?`).join(', ') + ', sync_status = ?';
          const values = columns.map(k => (record as any)[k]);

          await db.runAsync(
            `UPDATE ${table} SET ${setClause} WHERE id = ?`,
            [...values, 'synced', record.id]
          );
          updated++;
          console.log(`  → Updated (remote is ${remoteTime - localTime}ms newer)`);
        } else if (remoteTime === localTime) {
          // Same timestamp, just mark as synced if it isn't already
          skipped++;
          console.log(`  → Skipped (timestamps equal, already in sync)`);
        } else {
          // Local is newer, skip update
          skipped++;
          console.log(`  → Skipped (local is ${localTime - remoteTime}ms newer)`);
        }
      }
    }

    return { inserted, updated, skipped };
  }

  /**
   * Get the last sync timestamp for a table
   */
  async getLastSyncTime(table: string): Promise<string | null> {
    const db = await this.getDatabase();
    const result = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_metadata WHERE key = ?`,
      [`last_sync_${table}`]
    );
    return result?.value || null;
  }

  /**
   * Set the last sync timestamp for a table
   */
  async setLastSyncTime(table: string, timestamp: string): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO app_metadata (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [`last_sync_${table}`, timestamp]
    );
  }

  // ============================================
  // APP SETTINGS METHODS
  // ============================================

  /**
   * Get app settings
   */
  async getAppSettings(): Promise<AppSettings | null> {
    const db = await this.getDatabase();
    const result = await db.getFirstAsync<AppSettings>(
      `SELECT * FROM app_settings WHERE id = 1`
    );
    return result || null;
  }

  /**
   * Update app settings
   */
  async updateAppSettings(input: UpdateAppSettingsInput): Promise<void> {
    const db = await this.getDatabase();
    
    const updates: string[] = [];
    const values: any[] = [];

    if (input.currency !== undefined) {
      updates.push('currency = ?');
      values.push(input.currency);
    }

    if (input.enabled_payment_methods !== undefined) {
      updates.push('enabled_payment_methods = ?');
      values.push(JSON.stringify(input.enabled_payment_methods));
    }

    if (updates.length === 0) return;

    updates.push('sync_status = ?');
    values.push('pending');
    values.push(1); // id

    await db.runAsync(
      `UPDATE app_settings SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Upsert settings from remote source (Supabase)
   */
  async upsertSettingsFromRemote(remoteSettings: any): Promise<void> {
    const db = await this.getDatabase();

    // Parse JSON fields if they're strings
    const enabledPaymentMethods = typeof remoteSettings.enabled_payment_methods === 'string'
      ? remoteSettings.enabled_payment_methods
      : JSON.stringify(remoteSettings.enabled_payment_methods);

    // Check if local settings exist
    const localSettings = await this.getAppSettings();
    
    if (!localSettings) {
      // Insert new settings
      await db.runAsync(
        `INSERT INTO app_settings (id, currency, enabled_payment_methods, created_at, updated_at, sync_status)
         VALUES (1, ?, ?, ?, ?, 'synced')`,
        [
          remoteSettings.currency,
          enabledPaymentMethods,
          remoteSettings.created_at,
          remoteSettings.updated_at
        ]
      );
      return;
    }

    // Parse timestamps for comparison
    const localTimeStr = localSettings.updated_at;
    const remoteTimeStr = remoteSettings.updated_at;

    // Parse local timestamp as UTC
    const localTime = localTimeStr.includes('T') 
      ? new Date(localTimeStr).getTime()
      : new Date(localTimeStr.replace(' ', 'T') + 'Z').getTime();
    const remoteTime = new Date(remoteTimeStr).getTime();

    console.log(`Comparing app_settings: local=${localTimeStr} (${localTime}ms) vs remote=${remoteTimeStr} (${remoteTime}ms), diff=${remoteTime - localTime}ms`);

    // Only update if remote is newer
    if (remoteTime > localTime) {
      console.log('Remote app_settings is newer, updating local');
      await db.runAsync(
        `UPDATE app_settings 
         SET currency = ?, enabled_payment_methods = ?, updated_at = ?, sync_status = 'synced'
         WHERE id = 1`,
        [
          remoteSettings.currency,
          enabledPaymentMethods,
          remoteSettings.updated_at
        ]
      );
    } else {
      console.log('Local app_settings is up to date or newer, marking as synced');
      // Just mark as synced without changing updated_at
      await db.runAsync(
        `UPDATE app_settings SET sync_status = 'synced' WHERE id = 1 AND sync_status != 'synced'`
      );
    }
  }

  /**
   * Get pending settings changes
   */
  async getPendingSettings(): Promise<AppSettings | null> {
    const db = await this.getDatabase();
    const result = await db.getFirstAsync<AppSettings>(
      `SELECT * FROM app_settings WHERE id = 1 AND sync_status = 'pending'`
    );
    return result || null;
  }

  /**
   * Mark settings as synced
   */
  async markSettingsAsSynced(): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(
      `UPDATE app_settings SET sync_status = 'synced' WHERE id = 1 AND sync_status = 'pending'`
    );
  }

  // ============================================
  // EXPENSE CATEGORIES METHODS
  // ============================================

  async findSoftDeletedExpenseCategory(name: string): Promise<ExpenseCategory | null> {
    const db = await this.getDatabase();
    return await db.getFirstAsync<ExpenseCategory>(
      `SELECT * FROM expense_categories 
       WHERE name = ? AND deleted_at IS NOT NULL
       ORDER BY deleted_at DESC LIMIT 1`,
      [name]
    );
  }

  async reactivateExpenseCategory(id: number): Promise<ExpenseCategory> {
    const db = await this.getDatabase();
    
    // Reactivate the soft-deleted category
    await db.runAsync(
      `UPDATE expense_categories 
       SET deleted_at = NULL, sync_status = 'pending'
       WHERE id = ?`,
      [id]
    );
    
    const category = await db.getFirstAsync<ExpenseCategory>(
      'SELECT * FROM expense_categories WHERE id = ?',
      [id]
    );
    
    if (!category) throw new Error('Failed to reactivate expense category');
    console.log(`Reactivated soft-deleted expense category: ${category.name} (ID: ${category.id})`);
    return category;
  }

  async createExpenseCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategory> {
    const db = await this.getDatabase();
    
    // Check if a soft-deleted category with the same name exists
    const softDeleted = await this.findSoftDeletedExpenseCategory(input.name);
    
    if (softDeleted) {
      // Reactivate the soft-deleted category instead of creating a new one
      return await this.reactivateExpenseCategory(softDeleted.id);
    }
    
    // No soft-deleted category found, create a new one
    const result = await db.runAsync(
      `INSERT INTO expense_categories (name) VALUES (?)`,
      [input.name]
    );
    
    const category = await db.getFirstAsync<ExpenseCategory>(
      'SELECT * FROM expense_categories WHERE id = ?',
      [result.lastInsertRowId]
    );
    
    if (!category) throw new Error('Failed to create expense category');
    return category;
  }

  async getAllExpenseCategories(includeDeleted = false): Promise<ExpenseCategory[]> {
    const db = await this.getDatabase();
    const query = includeDeleted
      ? 'SELECT * FROM expense_categories ORDER BY name ASC'
      : 'SELECT * FROM expense_categories WHERE deleted_at IS NULL ORDER BY name ASC';
    
    return await db.getAllAsync<ExpenseCategory>(query);
  }

  async updateExpenseCategory(id: number, input: UpdateExpenseCategoryInput): Promise<ExpenseCategory> {
    const db = await this.getDatabase();
    
    if (input.name === undefined) {
      throw new Error('No fields to update');
    }

    await db.runAsync(
      `UPDATE expense_categories SET name = ?, sync_status = ? WHERE id = ?`,
      [input.name, 'pending', id]
    );

    const category = await db.getFirstAsync<ExpenseCategory>(
      'SELECT * FROM expense_categories WHERE id = ?',
      [id]
    );
    
    if (!category) throw new Error('Expense category not found');
    return category;
  }

  async deleteExpenseCategory(id: number): Promise<void> {
    const db = await this.getDatabase();
    await db.runAsync(
      'UPDATE expense_categories SET deleted_at = CURRENT_TIMESTAMP, sync_status = ? WHERE id = ?',
      ['pending', id]
    );
  }


  // ============================================
  // UTILITY METHODS
  // ============================================

  async resetDatabase(): Promise<void> {
    if (!this.db) return;
    
    await this.db.execAsync(`
      DROP TABLE IF EXISTS members;
      DROP TABLE IF EXISTS packages;
      DROP TABLE IF EXISTS subscriptions;
      DROP TABLE IF EXISTS payments;
      DROP TABLE IF EXISTS expenses;
      DROP TABLE IF EXISTS todos;
      DROP TABLE IF EXISTS schedule_blocks;
      DROP TABLE IF EXISTS participations;
      DROP TABLE IF EXISTS app_settings;
      DROP TABLE IF EXISTS app_metadata;
    `);
    
    await this.createTables();
    console.log('Database reset successfully');
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export const databaseService = new DatabaseService();
