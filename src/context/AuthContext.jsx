import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import withTimeout from '../utils/withTimeout'

const AuthContext = createContext(null)

async function fetchOwnProfile(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const explicitSignOut = useRef(false)
  const isLoggingIn     = useRef(false)
  const currentUserRef  = useRef(null)

  const setIsLoggingIn = (val) => { isLoggingIn.current = val }

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      // Warm up connection
      try {
        await Promise.race([
          supabase.from('profiles').select('id').limit(1),
          new Promise(resolve => setTimeout(resolve, 3000))
        ])
      } catch { /* silent */ }

      try {
        const { data: { session: s } } = await withTimeout(
          supabase.auth.getSession(),
          30000
        )
        if (s && mounted) {
          setSession(s)
          setUser(s.user)
          currentUserRef.current = s.user
          const prof = await withTimeout(fetchOwnProfile(s.user.id))
          if (mounted) setProfile(prof)
        }
      } catch (err) {
        console.error('[AuthContext] Initial session error:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT' && !explicitSignOut.current && currentUserRef.current) {
          toast.error('Your session has expired. Please log in again.')
        }
        explicitSignOut.current = false

        // Check if user session actually changed
        const hasUserChanged = (s?.user?.id !== currentUserRef.current?.id)

        if (isLoggingIn.current) {
          setSession(s)
          setUser(s?.user ?? null)
          currentUserRef.current = s?.user ?? null
          return
        }

        if (hasUserChanged) {
          setLoading(true)
          setSession(s)
          setUser(s?.user ?? null)
          currentUserRef.current = s?.user ?? null

          if (s?.user) {
            try {
              const prof = await withTimeout(fetchOwnProfile(s.user.id))
              if (mounted) setProfile(prof)
            } catch (err) {
              console.error('[AuthContext] Profile fetch failed:', err)
              if (mounted) setProfile(null)
            }
          } else {
            if (mounted) setProfile(null)
          }

          if (mounted) setLoading(false)
        } else {
          // Update session details silently without triggering loading transitions
          setSession(s)
          currentUserRef.current = s?.user ?? null
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (identifier, password) => {
    try {
      const trimmed = identifier.trim()
      const { data: resolvedEmail, error: lookupError } = await supabase
        .rpc('get_email_by_identifier', { identifier: trimmed })

      if (lookupError || !resolvedEmail) {
        return { success: false, error: 'Employee not found or account is disabled.' }
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      })

      if (authError) return { success: false, error: authError.message }

      let prof = null
      try { prof = await fetchOwnProfile(authData.user.id) } catch { /* non-fatal */ }

      return { success: true, error: null, profile: prof, user: authData.user, session: authData.session }
    } catch (err) {
      return { success: false, error: err.message ?? 'An unexpected error occurred.' }
    }
  }, [])

  const signOut = useCallback(async () => {
    explicitSignOut.current = true
    try {
      if (user) {
        // Fetch active login session
        const { data: activeSession, error: fetchErr } = await supabase
          .from('login_history')
          .select('id, login_at')
          .eq('profile_id', user.id)
          .is('logout_at', null)
          .order('login_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!fetchErr && activeSession) {
          const loginTime = new Date(activeSession.login_at).getTime()
          const logoutTime = new Date().getTime()
          const diffMs = logoutTime - loginTime
          const diffMins = Math.max(0, Math.round(diffMs / (1000 * 60)))
          const hrsWorked = parseFloat((diffMins / 60).toFixed(2))

          // 1. Update the login history row with computed session duration & hours
          await supabase.from('login_history')
            .update({
              logout_at: new Date(logoutTime).toISOString(),
              session_duration_minutes: diffMins,
              hours_worked: hrsWorked
            })
            .eq('id', activeSession.id)

          // 2. Fetch past successful history to aggregate statistics and save to employee_details table
          try {
            const { data: allHistory } = await supabase
              .from('login_history')
              .select('login_at, hours_worked')
              .eq('profile_id', user.id)
              .eq('status', 'success')

            const historyList = allHistory ?? []
            const uniqueDays = new Set(historyList.map(r => r.login_at?.split('T')[0]).filter(Boolean))
            // Make sure current login_at is in uniqueDays
            if (activeSession.login_at) {
              uniqueDays.add(activeSession.login_at.split('T')[0])
            }
            const totalDaysCount = uniqueDays.size

            let totalHrs = historyList.reduce((sum, r) => sum + parseFloat(r.hours_worked ?? 0), 0)
            // Add current session's hours worked
            totalHrs += hrsWorked

            await supabase.from('employee_details')
              .update({
                total_working_days: totalDaysCount,
                total_working_hours: parseFloat(totalHrs.toFixed(2))
              })
              .eq('profile_id', user.id)
          } catch (statsErr) {
            console.error('[AuthContext] Failed to recalculate stats on sign out:', statsErr)
          }
        } else {
          // Fallback if no active session is found — only update the single most recent open session
          const { data: latestOpen } = await supabase
            .from('login_history')
            .select('id')
            .eq('profile_id', user.id)
            .is('logout_at', null)
            .order('login_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (latestOpen) {
            await supabase.from('login_history')
              .update({ logout_at: new Date().toISOString() })
              .eq('id', latestOpen.id)
          }
        }

        await supabase.from('profiles')
          .update({ is_online: false }).eq('id', user.id)
      }
    } catch (e) {
      console.error('[AuthContext] Sign out error:', e)
    } finally {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setSession(null)
    }
  }, [user])

  const updateProfile = useCallback(async (fields) => {
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase.from('profiles').update(fields).eq('id', user.id)
    if (error) throw error
    const updated = await fetchOwnProfile(user.id)
    setProfile(updated)
    return updated
  }, [user])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    try {
      const prof = await fetchOwnProfile(user.id)
      setProfile(prof)
      return prof
    } catch (err) {
      console.error('Failed to refresh profile:', err)
    }
  }, [user])

  const value = {
    user, profile, setProfile, session, loading, setLoading,
    setIsLoggingIn, signIn, signOut, updateProfile, refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === null) throw new Error('useAuth must be used within an <AuthProvider>.')
  return ctx
}

export default AuthContext
