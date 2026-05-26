import { supabase } from '../lib/supabase'

let keepAliveInterval = null

export const startKeepAlive = () => {
  if (keepAliveInterval) return
  keepAliveInterval = setInterval(async () => {
    try {
      await supabase.from('profiles').select('id').limit(1)
    } catch { /* silent fail */ }
  }, 240000) // 4 minutes
}
