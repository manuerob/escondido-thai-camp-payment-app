-- Migration: Convert expense categories from JSON to table
-- Description: Create expense_categories table with default data
-- Created: 2026-02-17

-- Create expense_categories table
CREATE TABLE expense_categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
  deleted_at TIMESTAMPTZ
);

-- Add trigger for updated_at
CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default expense categories
INSERT INTO expense_categories (name) VALUES
  ('Equipment'),
  ('Utilities'),
  ('Rent'),
  ('Supplies'),
  ('Maintenance'),
  ('Marketing'),
  ('Staff'),
  ('Other');

-- Drop expense_categories column from app_settings (if it exists)
ALTER TABLE app_settings DROP COLUMN IF EXISTS expense_categories;

-- Add indexes for performance
CREATE INDEX idx_expense_categories_name ON expense_categories(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_expense_categories_sync_status ON expense_categories(sync_status) WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON TABLE expense_categories IS 'Stores expense categories with soft-delete and sync support';
