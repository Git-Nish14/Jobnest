import { vi } from "vitest";

// Mock Next.js server-only modules so route handlers can be imported in Node.js
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

// Stub env vars used at module load time
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.GROQ_API_KEY = "test-groq-key";
process.env.CRON_SECRET = "test-cron-secret";
process.env.SMTP_HOST = "smtp.test.com";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "test@test.com";
process.env.SMTP_PASS = "test-pass";
process.env.CONTACT_EMAIL = "contact@test.com";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.CSRF_SECRET = "test-csrf-secret-that-is-long-enough-32ch";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
process.env.STRIPE_PRO_PRICE_ID = "price_placeholder";
process.env.STRIPE_PRO_ANNUAL_PRICE_ID = "price_annual_placeholder";
