-- ============================================
-- INITIAL SCHEMA FOR SUPABASE
-- Matches SQLite schema for cloud sync
-- ============================================

-- ============================================
-- MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS members (
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
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- PACKAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL CHECK(price >= 0),
  duration_days INTEGER NOT NULL CHECK(duration_days > 0),
  sessions_included INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL,
  package_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'cancelled')),
  sessions_remaining INTEGER,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
  deleted_at TIMESTAMPTZ,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE RESTRICT
);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  member_id BIGINT NOT NULL,
  subscription_id BIGINT,
  amount NUMERIC NOT NULL CHECK(amount >= 0),
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'card', 'bank_transfer', 'digital_wallet', 'other')),
  transaction_ref TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'failed', 'refunded')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
  deleted_at TIMESTAMPTZ,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

-- ============================================
-- EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK(amount >= 0),
  expense_date DATE NOT NULL,
  vendor TEXT,
  description TEXT,
  receipt_url TEXT,
  payment_method TEXT CHECK(payment_method IN ('cash', 'card', 'bank_transfer', 'digital_wallet', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
  deleted_at TIMESTAMPTZ
);

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

-- ============================================
-- TRIGGERS FOR AUTOMATIC UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Members trigger
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Packages trigger
CREATE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Subscriptions trigger
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Payments trigger
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Expenses trigger
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Disable RLS for development (enable for production with proper policies)
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE packages DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE members IS 'Gym members information';
COMMENT ON TABLE packages IS 'Membership packages and pricing';
COMMENT ON TABLE subscriptions IS 'Member subscriptions to packages';
COMMENT ON TABLE payments IS 'Payment records from members';
COMMENT ON TABLE expenses IS 'Business expenses tracking';

COMMENT ON COLUMN members.sync_status IS 'Sync status: pending = needs sync, synced = up to date';
COMMENT ON COLUMN members.deleted_at IS 'Soft delete timestamp - NULL means active record';
