import * as SQLite from 'expo-sqlite';
import type {
  BaseEntity,
  Member,
  Package,
  Subscription,
  Payment,
  Expense,
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
      await this.seedDefaultData();
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
          DROP TABLE IF EXISTS app_metadata;
        `);
        
        console.log('✅ Database migration completed');
      }
    } catch (error) {
      // Table doesn't exist yet, that's fine
      console.log('No migration needed');
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
    `);
  }

  async getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // ============================================
  // SEED DEFAULT DATA
  // ============================================

  private async seedDefaultData(): Promise<void> {
    const db = await this.getDatabase();
    
    // Check if seeding has already been done
    const seeded = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_metadata WHERE key = ?',
      ['packages_seeded']
    );

    if (seeded?.value === 'true') {
      console.log('Default packages already seeded');
      return;
    }

    console.log('Seeding default packages...');

    // Seed default packages
    const defaultPackages: CreatePackageInput[] = [
      {
        name: 'Single Entry',
        description: 'One-time gym entry',
        price: 150,
        duration_days: 1, // Valid for 1 day
        sessions_included: 1,
        is_active: true,
      },
      {
        name: 'Week Pass',
        description: '7-day unlimited access',
        price: 800,
        duration_days: 7,
        is_active: true,
      },
      {
        name: 'Monthly Pass',
        description: '30-day unlimited access',
        price: 2500,
        duration_days: 30,
        is_active: true,
      },
    ];

    for (const pkg of defaultPackages) {
      await this.createPackage(pkg);
    }

    // Mark seeding as complete
    await db.runAsync(
      'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
      ['packages_seeded', 'true']
    );

    console.log('Default packages seeded successfully');
  }

  // ============================================
  // MEMBERS METHODS
  // ============================================

  async createMember(input: CreateMemberInput): Promise<Member> {
    const db = await this.getDatabase();
    const result = await db.runAsync(
      `INSERT INTO members (first_name, last_name, phone, email, instagram, address, emergency_contact, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.first_name, input.last_name, input.phone || null, input.email || null,
       input.instagram || null, input.address || null, input.emergency_contact || null, input.notes || null]
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

  async createPackage(input: CreatePackageInput): Promise<Package> {
    const db = await this.getDatabase();
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
    return await db.getFirstAsync<Subscription>(
      'SELECT * FROM subscriptions WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
  }

  async getSubscriptionsByMember(memberId: number): Promise<Subscription[]> {
    const db = await this.getDatabase();
    return await db.getAllAsync<Subscription>(
      `SELECT * FROM subscriptions 
       WHERE member_id = ? AND deleted_at IS NULL 
       ORDER BY start_date DESC`,
      [memberId]
    );
  }

  async getActiveSubscriptions(): Promise<Subscription[]> {
    const db = await this.getDatabase();
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
      `INSERT INTO payments (member_id, subscription_id, amount, payment_date, payment_method, transaction_ref, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.member_id, input.subscription_id || null, input.amount, input.payment_date,
       input.payment_method, input.transaction_ref || null, input.status || 'completed',
       input.notes || null]
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
        m.email as member_email
      FROM payments p
      LEFT JOIN members m ON p.member_id = m.id
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
      LEFT JOIN packages p ON s.package_id = p.id AND p.deleted_at IS NULL
      WHERE m.deleted_at IS NULL ${statusFilter}
      ORDER BY m.first_name ASC, m.last_name ASC`
    );
    
    return members;
  }

  async searchMembers(query: string, filter?: 'active' | 'expired' | 'all'): Promise<MemberWithSubscription[]> {
    const db = await this.getDatabase();
    
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
      LEFT JOIN packages p ON s.package_id = p.id AND p.deleted_at IS NULL
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
    return await db.getAllAsync<T>(
      `SELECT * FROM ${table} WHERE sync_status = 'pending'`
    );
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
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(
      `UPDATE ${table} SET sync_status = 'synced' WHERE id IN (${placeholders})`,
      ids
    );
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
        // Insert new record
        const columns = Object.keys(record).filter(k => k !== 'id');
        const values = columns.map(k => (record as any)[k]);
        const placeholders = columns.map(() => '?').join(',');
        
        await db.runAsync(
          `INSERT OR IGNORE INTO ${table} (id, ${columns.join(', ')}) VALUES (?, ${placeholders})`,
          [record.id, ...values]
        );
        inserted++;
      } else {
        // Compare timestamps for conflict resolution
        const localTime = new Date(existing.updated_at).getTime();
        const remoteTime = new Date(record.updated_at).getTime();

        if (remoteTime > localTime) {
          // Remote is newer, update local
          const columns = Object.keys(record).filter(k => k !== 'id');
          const setClause = columns.map(k => `${k} = ?`).join(', ');
          const values = columns.map(k => (record as any)[k]);

          await db.runAsync(
            `UPDATE ${table} SET ${setClause} WHERE id = ?`,
            [...values, record.id]
          );
          updated++;
        } else {
          // Local is newer or equal, skip update
          skipped++;
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
      DROP TABLE IF EXISTS app_metadata;
    `);
    
    await this.createTables();
    await this.seedDefaultData();
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
