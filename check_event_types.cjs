const { createClient } = require('./node_modules/@supabase/supabase-js')

const supabase = createClient(
  'https://fnlvfdwphffgcpqufocs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZubHZmZHdwaGZmZ2NwcXVmb2NzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM0MTYwOCwiZXhwIjoyMDk0OTE3NjA4fQ.XOpr25v2IeGj1VQ8N1fUgoqzfMLEPtsmuckeSZZ69tU'
)

async function main() {
  const { data, error } = await supabase
    .from('login_history')
    .select('event_type, login_at, logout_at, status')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error(error)
    return
  }

  console.log('Recent 30 rows in login_history:')
  data.forEach((row, index) => {
    console.log(`${index + 1}. EventType: ${row.event_type}, LoginAt: ${row.login_at}, LogoutAt: ${row.logout_at}, Status: ${row.status}`)
  })
}

main().catch(console.error)
