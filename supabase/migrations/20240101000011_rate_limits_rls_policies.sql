-- Migration: RLS Policies for rate_limits table
-- Description: Add RLS policies to rate_limits table.
--              The table is only mutated via SECURITY DEFINER functions (which bypass RLS),
--              so direct user access is read-only for their own rows.

-- Users can view their own rate limit entries (read-only transparency)
CREATE POLICY "Users can view own rate limits"
  ON rate_limits
  FOR SELECT
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies for direct user access.
-- All writes go through SECURITY DEFINER functions that run as the service role.
