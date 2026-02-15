-- Migration: Add participations table
-- Description: Track how many members participated in each schedule block on specific dates for busy hours analysis
-- Created: 2026-02-16

-- Create participations table
CREATE TABLE participations (
  id BIGSERIAL PRIMARY KEY,
  schedule_block_id BIGINT NOT NULL REFERENCES schedule_blocks(id) ON DELETE CASCADE,
  participation_date DATE NOT NULL,
  participants_count INTEGER NOT NULL DEFAULT 0 CHECK(participants_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced')),
  deleted_at TIMESTAMPTZ,
  UNIQUE(schedule_block_id, participation_date) -- One record per block per date
);

-- Add indexes for performance
CREATE INDEX idx_participations_block_id ON participations(schedule_block_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_participations_date ON participations(participation_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_participations_sync_status ON participations(sync_status) WHERE deleted_at IS NULL;

-- Add trigger for updated_at
CREATE TRIGGER update_participations_updated_at
  BEFORE UPDATE ON participations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE participations IS 'Tracks the number of members who participated in each schedule block on specific dates';
