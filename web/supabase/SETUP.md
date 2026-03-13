# Supabase Setup Guide for Jobnest

## Quick Fix for 401 Unauthorized Error

The 401 error occurs because Row Level Security (RLS) policies are not configured. Follow these steps:

### Step 1: Run Database Migration

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the contents of `migrations/001_initial_setup.sql`
6. Click **Run** (or press Ctrl+Enter)

### Step 2: Set Up Storage (Optional - for file uploads)

1. In the SQL Editor, create a new query
2. Copy and paste the contents of `migrations/002_storage_setup.sql`
3. Click **Run**

### Step 3: Verify Setup

Run these queries to verify everything is set up correctly:

```sql
-- Check table exists
SELECT * FROM information_schema.tables WHERE table_name = 'job_applications';

-- Check RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'job_applications';

-- Check policies exist
SELECT * FROM pg_policies WHERE tablename = 'job_applications';
```

## Authentication Settings

### Email Verification (Required for security features)

1. Go to **Authentication** > **Providers** > **Email**
2. Enable **Confirm email**
3. Set up your email templates under **Authentication** > **Email Templates**

### Site URL Configuration

1. Go to **Authentication** > **URL Configuration**
2. Set **Site URL** to your production URL (e.g., `https://jobnest.app`)
3. Add redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`
   - `https://yourdomain.com/auth/callback`
   - `https://yourdomain.com/reset-password`

## Environment Variables

Make sure your `.env.local` file has:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Troubleshooting

### Still getting 401 error?

1. **Check if user is logged in**: Open browser DevTools > Application > Cookies
   - You should see Supabase session cookies

2. **Check RLS policies**: Run this in SQL Editor:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'job_applications';
   ```
   You should see 4 policies (SELECT, INSERT, UPDATE, DELETE)

3. **Test without RLS** (temporarily):
   ```sql
   ALTER TABLE public.job_applications DISABLE ROW LEVEL SECURITY;
   ```
   If this fixes it, the issue is with your policies.

4. **Check auth.uid()**: Run this while logged in:
   ```sql
   SELECT auth.uid();
   ```
   Should return your user's UUID.

### Email not sending?

1. Check **Authentication** > **Email Templates** are configured
2. Check spam folder
3. For development, use Supabase's built-in email (limited to 4/hour)
4. For production, configure a custom SMTP provider

## Database Schema

```
job_applications
├── id (UUID, primary key)
├── user_id (UUID, references auth.users)
├── company (TEXT, required)
├── position (TEXT, required)
├── status (TEXT, default: 'Applied')
├── applied_date (DATE, default: today)
├── job_id (TEXT, optional)
├── job_url (TEXT, optional)
├── salary_range (TEXT, optional)
├── location (TEXT, optional)
├── notes (TEXT, optional)
├── resume_path (TEXT, optional)
├── cover_letter_path (TEXT, optional)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)
```
