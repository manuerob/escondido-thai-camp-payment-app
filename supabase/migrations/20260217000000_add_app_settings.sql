-- Migration: Add app_settings table
-- Description: Store app-wide settings like currency, expense categories, and enabled payment methods for cross-device sync
-- Created: 2026-02-17

-- Create app_settings table (single row table)
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK(id = 1), -- Single row table
  currency TEXT NOT NULL DEFAULT 'USD',
  expense_categories JSONB NOT NULL DEFAULT '["Equipment","Utilities","Rent","Supplies","Maintenance","Marketing","Staff","Other"]',
  enabled_payment_methods JSONB NOT NULL DEFAULT '["cash","card","bank_transfer","digital_wallet","other"]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced'))
);

-- Insert default settings row
INSERT INTO app_settings (id) VALUES (1);

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE app_settings IS 'Stores app-wide settings that sync across devices';
