import { createClient } from '@supabase/supabase-js'

/*
 * ⚠️ WARNING: SUPABASE ADMIN CLIENT (SERVICE ROLE BYPASS)
 * 
 * This client uses the Supabase service role key, which bypasses all Row Level Security (RLS) policies.
 * 
 * IMPORTANT RULES FOR DEVELOPERS:
 * 1. ONLY ever import this file in admin-only page components (inside `src/pages/admin/`).
 * 2. NEVER import this file in employee-facing components or shared components (e.g. Navbar, Sidebar, ProtectedRoute).
 * 3. Make sure VITE_SUPABASE_SERVICE_KEY is configured in your local .env file and in production environment variables (e.g., Vercel).
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable.')
}

if (!supabaseServiceKey || supabaseServiceKey === 'your_service_role_key_here') {
  console.warn(
    'VITE_SUPABASE_SERVICE_KEY is missing or using placeholder. Admin operations (creating/editing/deleting users) will fail.'
  )
}

export const adminSupabase = createClient(supabaseUrl, supabaseServiceKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
