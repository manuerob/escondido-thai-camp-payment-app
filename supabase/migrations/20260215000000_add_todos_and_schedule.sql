-- ============================================
-- ADD TODOS AND SCHEDULE_BLOCKS TABLES
-- Migration to add new app features to Supabase
-- ============================================

-- ============================================
-- TODOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS todos (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- SCHEDULE BLOCKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id BIGSERIAL PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
  specific_date DATE,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Todos indexes
CREATE INDEX IF NOT EXISTS idx_todos_checked ON todos(is_checked) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_archived ON todos(is_archived) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_sync_status ON todos(sync_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_deleted ON todos(deleted_at);

-- Schedule blocks indexes
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_day ON schedule_blocks(day_of_week) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_specific_date ON schedule_blocks(specific_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_time ON schedule_blocks(day_of_week, start_time) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_sync_status ON schedule_blocks(sync_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_deleted ON schedule_blocks(deleted_at);

-- ============================================
-- TRIGGERS FOR AUTOMATIC UPDATED_AT
-- ============================================

-- Todos trigger
CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Schedule blocks trigger
CREATE TRIGGER update_schedule_blocks_updated_at
  BEFORE UPDATE ON schedule_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Disable RLS for development (enable for production with proper policies)
ALTER TABLE todos DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks DISABLE ROW LEVEL SECURITY;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE todos IS 'Todo list items that can be checked and archived';
COMMENT ON TABLE schedule_blocks IS 'Weekly schedule blocks with repeat patterns';

COMMENT ON COLUMN todos.is_checked IS 'Whether the todo is marked as complete';
COMMENT ON COLUMN todos.completed_at IS 'Timestamp when todo was completed';
COMMENT ON COLUMN todos.is_archived IS 'Whether the todo is archived (hidden from main view)';

COMMENT ON COLUMN schedule_blocks.day_of_week IS 'Day of week (0=Sunday, 6=Saturday) for recurring blocks';
COMMENT ON COLUMN schedule_blocks.specific_date IS 'Specific date for one-time blocks (overrides day_of_week)';
COMMENT ON COLUMN schedule_blocks.start_time IS 'Start time in HH:MM format';
COMMENT ON COLUMN schedule_blocks.end_time IS 'End time in HH:MM format';
COMMENT ON COLUMN schedule_blocks.color IS 'Color code for visual display';
