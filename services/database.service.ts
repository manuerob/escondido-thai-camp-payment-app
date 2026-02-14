import * as SQLite from 'expo-sqlite';
import type {
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
} from '../types/database';

const DB_NAME = 'gym_tracker.db';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
      await this.createTables();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      -- Members table
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
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
        payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'bank_transfer', 'digital_wallet', 'other')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
        deleted_at TEXT
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_members_email ON members(email) WHERE deleted_at IS NULL;
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
  // MEMBERS METHODS
  // ============================================

  async createMember(input: CreateMemberInput): Promise<Member> {
    const db = await this.getDatabase();
    const result = await db.runAsync(
      `INSERT INTO members (name, email, phone, address, emergency_contact, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.name, input.email, input.phone || null, input.address || null, 
       input.emergency_contact || null, input.notes || null]
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

    if (input.name !== undefined) {
      fields.push('name = ?');
      values.push(input.name);
    }
    if (input.email !== undefined) {
      fields.push('email = ?');
      values.push(input.email);
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

  // ============================================
  // EXPENSES METHODS
  // ============================================

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    const db = await this.getDatabase();
    const result = await db.runAsync(
      `INSERT INTO expenses (category, amount, expense_date, vendor, description, receipt_url, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.category, input.amount, input.expense_date, input.vendor || null,
       input.description || null, input.receipt_url || null, input.payment_method || null]
    );
    
    const expense = await db.getFirstAsync<Expense>(
      'SELECT * FROM expenses WHERE id = ?',
      [result.lastInsertRowId]
    );
    
    if (!expense) throw new Error('Failed to create expense');
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
      return await db.getAllAsync<Expense>(
        `SELECT * FROM expenses 
         WHERE expense_date BETWEEN ? AND ? AND deleted_at IS NULL 
         ORDER BY expense_date DESC 
         LIMIT ? OFFSET ?`,
        [filter.start_date, filter.end_date, limit, offset]
      );
    }

    return await db.getAllAsync<Expense>(
      `SELECT * FROM expenses 
       WHERE deleted_at IS NULL 
       ORDER BY expense_date DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
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
  // SYNC METHODS
  // ============================================

  async getPendingRecords<T = any>(table: string): Promise<T[]> {
    const db = await this.getDatabase();
    return await db.getAllAsync<T>(
      `SELECT * FROM ${table} WHERE sync_status = 'pending' AND deleted_at IS NULL`
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
