-- ============================================
-- Add discount fields to members and payments tables
-- ============================================

-- Add discount_type column to members ($ or %)
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK(discount_type IN ('$', '%'));

-- Add discount_amount column to members
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC CHECK(discount_amount >= 0);

-- Add discount_type column to payments ($ or %)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK(discount_type IN ('$', '%'));

-- Add discount_amount column to payments
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC CHECK(discount_amount >= 0);

-- Add comments for clarity
COMMENT ON COLUMN members.discount_type IS 'Type of discount: $ (fixed amount) or % (percentage)';
COMMENT ON COLUMN members.discount_amount IS 'Discount value - either fixed dollar amount or percentage';
COMMENT ON COLUMN payments.discount_type IS 'Type of discount applied to this payment: $ (fixed amount) or % (percentage)';
COMMENT ON COLUMN payments.discount_amount IS 'Discount value applied to this payment';
