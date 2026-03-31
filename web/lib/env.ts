/**
 * Startup environment variable validation.
 * Import this at the top of any server entry point that requires these vars.
 * Throws on missing required vars so the process fails loudly at boot,
 * not silently at the first request.
 */

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  // Supabase
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, description: "Supabase project URL" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, description: "Supabase anon key" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, description: "Supabase service role key (server-only)" },

  // Security
  { name: "CSRF_SECRET", required: true, description: "CSRF token signing secret (min 32 chars)" },
  { name: "CRON_SECRET", required: true, description: "Cron job bearer token" },

  // Email
  { name: "SMTP_HOST", required: true, description: "SMTP server hostname" },
  { name: "SMTP_USER", required: true, description: "SMTP username / from address" },
  { name: "SMTP_PASS", required: true, description: "SMTP password / app password" },
  { name: "CONTACT_EMAIL", required: true, description: "Destination for contact form submissions" },

  // App URL
  { name: "NEXT_PUBLIC_APP_URL", required: true, description: "Public app URL (used in emails)" },

  // Stripe — optional; billing degrades gracefully when absent
  { name: "STRIPE_SECRET_KEY", required: false, description: "Stripe secret key" },
  { name: "STRIPE_WEBHOOK_SECRET", required: false, description: "Stripe webhook signing secret" },
  { name: "STRIPE_PRO_PRICE_ID", required: false, description: "Stripe Pro monthly price ID" },

  // AI
  { name: "GROQ_API_KEY", required: false, description: "Groq API key for NESTAi" },

  // Redis (optional — rate limiter falls back to in-memory when absent)
  { name: "UPSTASH_REDIS_REST_URL", required: false, description: "Upstash Redis REST URL for persistent rate limiting" },
  { name: "UPSTASH_REDIS_REST_TOKEN", required: false, description: "Upstash Redis REST token" },
];

let validated = false;

export function validateEnv(): void {
  // Only validate once per process lifetime
  if (validated) return;
  validated = true;

  if (process.env.NODE_ENV === "test") return;

  const missing: string[] = [];

  for (const { name, required, description } of ENV_VARS) {
    const value = process.env[name];
    if (!value && required) {
      missing.push(`  • ${name} — ${description}`);
    }
  }

  // Warn about weak CSRF secret in production
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CSRF_SECRET &&
    process.env.CSRF_SECRET.length < 32
  ) {
    console.warn("[env] WARNING: CSRF_SECRET is shorter than 32 characters. Generate a stronger secret with: openssl rand -hex 32");
  }

  if (missing.length > 0) {
    const list = missing.join("\n");
    throw new Error(
      `[env] Missing required environment variables:\n${list}\n\nCopy .env.local.example to .env.local and fill in the values.`
    );
  }

  if (process.env.NODE_ENV === "production") {
    console.log("[env] All required environment variables are present.");
  }
}
