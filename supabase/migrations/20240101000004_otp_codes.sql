-- Migration: OTP Codes Table
-- Description: Create otp_codes table for email verification with proper security
-- Created: OTP-based authentication system

-- =============================================
-- OTP CODES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code_hash TEXT NOT NULL, -- Store hashed OTP for security
    purpose VARCHAR(50) NOT NULL DEFAULT 'login', -- 'login', 'signup', 'password_reset'
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT DEFAULT 0 NOT NULL,
    max_attempts INT DEFAULT 5 NOT NULL,
    used BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Prevent brute force by limiting attempts
    CONSTRAINT valid_attempts CHECK (attempts <= max_attempts),
    CONSTRAINT valid_purpose CHECK (purpose IN ('login', 'signup', 'password_reset'))
);

-- =============================================
-- INDEXES
-- =============================================
-- Index for looking up OTP by email and purpose
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_purpose
    ON otp_codes(email, purpose);

-- Index for cleanup of expired OTPs
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at
    ON otp_codes(expires_at);

-- Index for finding unused, valid OTPs
CREATE INDEX IF NOT EXISTS idx_otp_codes_email_used_expires
    ON otp_codes(email, used, expires_at);

-- =============================================
-- CLEANUP FUNCTION
-- =============================================
-- Function to clean up expired OTP codes
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
    DELETE FROM otp_codes
    WHERE expires_at < NOW()
       OR used = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners too
ALTER TABLE otp_codes FORCE ROW LEVEL SECURITY;

-- Only service role can access OTP codes (no direct client access)
-- This ensures OTPs can only be verified through server-side API routes
DROP POLICY IF EXISTS "Service role only" ON otp_codes;
CREATE POLICY "Service role only"
    ON otp_codes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =============================================
-- COMMENTS
-- =============================================
COMMENT ON TABLE otp_codes IS 'Stores OTP codes for email verification with security measures';
COMMENT ON COLUMN otp_codes.code_hash IS 'SHA-256 hash of the OTP code for secure storage';
COMMENT ON COLUMN otp_codes.attempts IS 'Number of verification attempts made';
COMMENT ON COLUMN otp_codes.max_attempts IS 'Maximum allowed verification attempts before lockout';
COMMENT ON COLUMN otp_codes.used IS 'Whether this OTP has been successfully used';
