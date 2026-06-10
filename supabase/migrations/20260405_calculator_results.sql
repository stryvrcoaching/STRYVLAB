-- ============================================================
-- MIGRATION: Add calculator_results table with RLS
-- Date: 2026-04-05
-- Purpose: Centralize all calculator results (OneRM, Karvonen, Macros, etc.)
--          Exit from JSON generic storage into typed, queryable table
-- ============================================================

-- ============================================================
-- 1. Create calculator_results table
-- ============================================================

CREATE TABLE IF NOT EXISTS calculator_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  calculator_type TEXT NOT NULL CHECK (
    calculator_type IN (
      'oneRM',
      'hrZones',
      'macros',
      'bodyFat',
      'water',
      'karvonen',
      'bmi'
    )
  ),

  -- Input parameters that drove the calculation
  input JSONB NOT NULL,

  -- Output result (result, confidence_margin, zones, etc.)
  output JSONB NOT NULL,

  -- Formula versioning for audit trail & reproducibility
  formula_version TEXT NOT NULL DEFAULT 'v1.0',

  -- Optional metadata (e.g., equipment type, conditions)
  metadata JSONB DEFAULT NULL,

  -- Timestamp tracking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 2. Create indexes for common queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_calculator_results_client
  ON calculator_results(client_id);

CREATE INDEX IF NOT EXISTS idx_calculator_results_type
  ON calculator_results(calculator_type);

CREATE INDEX IF NOT EXISTS idx_calculator_results_created
  ON calculator_results(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calculator_results_client_type_date
  ON calculator_results(client_id, calculator_type, created_at DESC);

-- ============================================================
-- 3. Enable Row Level Security (RLS)
-- ============================================================

ALTER TABLE calculator_results ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies
-- ============================================================

-- SELECT: Coach can view their own clients' results
CREATE POLICY calculator_results_select_coach ON calculator_results
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT coach_id FROM coach_clients WHERE client_id = calculator_results.client_id
    )
  );

-- SELECT: Client can view their own results
CREATE POLICY calculator_results_select_client ON calculator_results
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM clients WHERE id = calculator_results.client_id
    )
  );

-- INSERT: Only coach or system can create results
CREATE POLICY calculator_results_insert ON calculator_results
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT coach_id FROM coach_clients WHERE client_id = calculator_results.client_id
    )
  );

-- UPDATE: Coach can update their own records
CREATE POLICY calculator_results_update ON calculator_results
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT coach_id FROM coach_clients WHERE client_id = calculator_results.client_id
    )
  );

-- ============================================================
-- 5. Trigger for updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION update_calculator_results_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculator_results_update_timestamp
  BEFORE UPDATE ON calculator_results
  FOR EACH ROW
  EXECUTE FUNCTION update_calculator_results_timestamp();

-- ============================================================
-- Migration complete
-- ============================================================
-- Note: Apply via Supabase dashboard SQL editor or:
--       npx supabase db push
