# Supabase Database Setup

This folder contains all the database migrations for the Job Application Tracker.

## Quick Setup

### Option 1: Using Supabase Dashboard (Recommended for beginners)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in the dashboard
3. Run each migration file in order:
   - `migrations/20240101000000_initial_schema.sql`
   - `migrations/20240101000001_storage_setup.sql`
   - `migrations/20240101000002_security_functions.sql`

4. Create the storage bucket:
   - Go to **Storage** in the dashboard
   - Click **New bucket**
   - Name: `documents`
   - Set to **Private**

### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

## Migration Files

| File | Description |
|------|-------------|
| `20240101000000_initial_schema.sql` | Creates the `job_applications` table with RLS policies |
| `20240101000001_storage_setup.sql` | Sets up the `documents` storage bucket and policies |
| `20240101000002_security_functions.sql` | Helper functions for stats and security |

## Security Features

### Row Level Security (RLS)
All tables have RLS enabled with strict policies:
- Users can only access their own data
- `FORCE ROW LEVEL SECURITY` is enabled (applies to table owners too)

### Storage Security
- Files are stored in user-specific folders: `{user_id}/{application_id}/{filename}`
- Only PDF files are allowed (5MB max)
- Signed URLs expire after 1 hour

### Data Validation
- `company` and `position` fields cannot be empty
- `job_url` must be a valid HTTP/HTTPS URL if provided
- Rate limiting: 100 applications per day per user

## Environment Variables

Add these to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Database Schema

```
job_applications
├── id (UUID, PK)
├── user_id (UUID, FK -> auth.users)
├── company (VARCHAR 255, NOT NULL)
├── position (VARCHAR 255, NOT NULL)
├── status (ENUM: Applied, Phone Screen, Interview, Offer, Rejected)
├── applied_date (DATE)
├── job_id (VARCHAR 100, optional)
├── job_url (TEXT, optional, validated)
├── salary_range (VARCHAR 100, optional)
├── location (VARCHAR 255, optional)
├── notes (TEXT, optional)
├── resume_path (TEXT, optional)
├── cover_letter_path (TEXT, optional)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ, auto-updated)
```

## Helper Functions

### `get_user_application_stats()`
Returns aggregated stats for the current user:
- Total count
- Count by status
- This week count
- This month count

Usage in your app:
```typescript
const { data } = await supabase.rpc('get_user_application_stats');
```
