-- Gym Money Tracking App - SQLite Schema
-- Created: 2026-02-13

-- ============================================
-- MEMBERS TABLE
-- ============================================
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

-- ============================================
-- PACKAGES TABLE
-- ============================================
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

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
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

-- ============================================
-- PAYMENTS TABLE
-- ============================================
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

-- ============================================
-- EXPENSES TABLE
-- ============================================
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

-- ============================================
-- TODOS TABLE
-- ============================================
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

-- ============================================
-- SCHEDULE BLOCKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
  specific_date TEXT, -- For one-time blocks (e.g., "daily this week only")
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

-- ============================================
-- PARTICIPATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS participations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_block_id INTEGER NOT NULL,
  participation_date TEXT NOT NULL, -- Format: YYYY-MM-DD
  participants_count INTEGER NOT NULL DEFAULT 0 CHECK(participants_count >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
  deleted_at TEXT,
  FOREIGN KEY (schedule_block_id) REFERENCES schedule_blocks(id) ON DELETE CASCADE,
  UNIQUE(schedule_block_id, participation_date)
);

-- ============================================
-- APP SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1), -- Single row table
  currency TEXT NOT NULL DEFAULT 'USD',
  expense_categories TEXT NOT NULL DEFAULT '["Equipment","Utilities","Rent","Supplies","Maintenance","Marketing","Staff","Other"]',
  enabled_payment_methods TEXT NOT NULL DEFAULT '["cash","card","bank_transfer","digital_wallet","other"]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced'))
);

-- Insert default settings row
INSERT OR IGNORE INTO app_settings (id) VALUES (1);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Members indexes
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_members_sync_status ON members(sync_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_members_deleted ON members(deleted_at);

-- Packages indexes
CREATE INDEX IF NOT EXISTS idx_packages_active ON packages(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_packages_sync_status ON packages(sync_status) WHERE deleted_at IS NULL;

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON subscriptions(member_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_package ON subscriptions(package_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON subscriptions(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_sync_status ON subscriptions(sync_status) WHERE deleted_at IS NULL;

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_sync_status ON payments(sync_status) WHERE deleted_at IS NULL;

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_sync_status ON expenses(sync_status) WHERE deleted_at IS NULL;

-- Todos indexes
CREATE INDEX IF NOT EXISTS idx_todos_checked ON todos(is_checked) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_archived ON todos(is_archived) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_sync_status ON todos(sync_status) WHERE deleted_at IS NULL;

-- Schedule blocks indexes
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_day ON schedule_blocks(day_of_week) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_time ON schedule_blocks(day_of_week, start_time) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_sync_status ON schedule_blocks(sync_status) WHERE deleted_at IS NULL;

-- ============================================
-- APP METADATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Members trigger
CREATE TRIGGER IF NOT EXISTS update_members_updated_at
  AFTER UPDATE ON members
  FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
BEGIN
  UPDATE members SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Packages trigger
CREATE TRIGGER IF NOT EXISTS update_packages_updated_at
  AFTER UPDATE ON packages
  FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
BEGIN
  UPDATE packages SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Subscriptions trigger
CREATE TRIGGER IF NOT EXISTS update_subscriptions_updated_at
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
BEGIN
  UPDATE subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Payments trigger
CREATE TRIGGER IF NOT EXISTS update_payments_updated_at
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
BEGIN
  UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Expenses trigger
CREATE TRIGGER IF NOT EXISTS update_expenses_updated_at
  AFTER UPDATE ON expenses
  FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
BEGIN
  UPDATE expenses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Todos trigger
CREATE TRIGGER IF NOT EXISTS update_todos_updated_at
  AFTER UPDATE ON todos
  FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
BEGIN
  UPDATE todos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Schedule blocks trigger
CREATE TRIGGER IF NOT EXISTS update_schedule_blocks_updated_at
  AFTER UPDATE ON schedule_blocks
  FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
BEGIN
  UPDATE schedule_blocks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- App settings trigger
CREATE TRIGGER IF NOT EXISTS update_app_settings_updated_at
  AFTER UPDATE ON app_settings
  FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at OR OLD.updated_at IS NULL
BEGIN
  UPDATE app_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- TRIGGER FOR AUTO-SETTING SYNC_STATUS
-- ============================================

-- When a record is updated, reset sync_status to 'pending'
CREATE TRIGGER IF NOT EXISTS reset_members_sync_status
  AFTER UPDATE ON members
  FOR EACH ROW
  WHEN NEW.sync_status = 'synced' AND (
    OLD.name != NEW.name OR
    OLD.email != NEW.email OR
    OLD.phone != NEW.phone OR
    OLD.address != NEW.address OR
    OLD.emergency_contact != NEW.emergency_contact OR
    OLD.notes != NEW.notes OR
    OLD.deleted_at != NEW.deleted_at
  )
BEGIN
  UPDATE members SET sync_status = 'pending' WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS reset_packages_sync_status
  AFTER UPDATE ON packages
  FOR EACH ROW
  WHEN NEW.sync_status = 'synced' AND (
    OLD.name != NEW.name OR
    OLD.description != NEW.description OR
    OLD.price != NEW.price OR
    OLD.duration_days != NEW.duration_days OR
    OLD.sessions_included != NEW.sessions_included OR
    OLD.is_active != NEW.is_active OR
    OLD.deleted_at != NEW.deleted_at
  )
BEGIN
  UPDATE packages SET sync_status = 'pending' WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS reset_subscriptions_sync_status
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  WHEN NEW.sync_status = 'synced' AND (
    OLD.member_id != NEW.member_id OR
    OLD.package_id != NEW.package_id OR
    OLD.start_date != NEW.start_date OR
    OLD.end_date != NEW.end_date OR
    OLD.status != NEW.status OR
    OLD.sessions_remaining != NEW.sessions_remaining OR
    OLD.auto_renew != NEW.auto_renew OR
    OLD.notes != NEW.notes OR
    OLD.deleted_at != NEW.deleted_at
  )
BEGIN
  UPDATE subscriptions SET sync_status = 'pending' WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS reset_payments_sync_status
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN NEW.sync_status = 'synced' AND (
    OLD.member_id != NEW.member_id OR
    OLD.subscription_id != NEW.subscription_id OR
    OLD.amount != NEW.amount OR
    OLD.payment_date != NEW.payment_date OR
    OLD.payment_method != NEW.payment_method OR
    OLD.transaction_ref != NEW.transaction_ref OR
    OLD.status != NEW.status OR
    OLD.notes != NEW.notes OR
    OLD.deleted_at != NEW.deleted_at
  )
BEGIN
  UPDATE payments SET sync_status = 'pending' WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS reset_expenses_sync_status
  AFTER UPDATE ON expenses
  FOR EACH ROW
  WHEN NEW.sync_status = 'synced' AND (
    OLD.category != NEW.category OR
    OLD.amount != NEW.amount OR
    OLD.expense_date != NEW.expense_date OR
    OLD.vendor != NEW.vendor OR
    OLD.description != NEW.description OR
    OLD.receipt_url != NEW.receipt_url OR
    OLD.payment_method != NEW.payment_method OR
    OLD.deleted_at != NEW.deleted_at
  )
BEGIN
  UPDATE expenses SET sync_status = 'pending' WHERE id = NEW.id;
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

CREATE TRIGGER IF NOT EXISTS reset_app_settings_sync_status
  AFTER UPDATE ON app_settings
  FOR EACH ROW
  WHEN NEW.sync_status = 'synced' AND (
    OLD.currency != NEW.currency OR
    OLD.expense_categories != NEW.expense_categories OR
    OLD.enabled_payment_methods != NEW.enabled_payment_methods
  )
BEGIN
  UPDATE app_settings SET sync_status = 'pending' WHERE id = NEW.id;
END;
