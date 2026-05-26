import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, AlertCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import fuelTracksLogo from '../../assets/fuel-tracks-logo.png'
import withTimeout from '../../utils/withTimeout'

function FieldError({ message }) {
  if (!message) return null
  return (
    <p style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#E8192C', fontSize: 13, marginTop: 4 }}>
      <AlertCircle size={13} />
      {message}
    </p>
  )
}

export default function AdminLogin() {
  const { user, profile: authProfile, setProfile, setIsLoggingIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const handleSessionIsolation = async () => {
      // If already logged in as admin → redirect to admin dashboard
      if (user && authProfile) {
        if (authProfile.role === 'admin' || authProfile.role === 'super_admin') {
          navigate('/admin', { replace: true })
          return
        }
        // If logged in as employee on admin login page
        // → silently sign them out so admin can log in cleanly
        if (authProfile.role === 'employee') {
          await supabase.auth.signOut()
          // Do not navigate — just let the admin login form render
          return
        }
      }
    }
    handleSessionIsolation()
  }, [user, authProfile, navigate])

  const [identifier, setIdentifier] = useState('')
  const [password,   setPassword]   = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [errors, setErrors] = useState({ identifier: '', password: '', general: '' })

  // 125-second safety timer
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => {
      setLoading(false)
      setIsLoggingIn(false)
      setError('Connection is slow. Please wait and try again.')
    }, 125000)
    return () => clearTimeout(timer)
  }, [loading, setIsLoggingIn])

  const [showSlowWarning, setShowSlowWarning] = useState(false)
  useEffect(() => {
    if (!loading) { setShowSlowWarning(false); return }
    const warn = setTimeout(() => setShowSlowWarning(true), 3000)
    return () => clearTimeout(warn)
  }, [loading])

  const setError = (msg) => setErrors(prev => ({ ...prev, general: msg }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setIsLoggingIn(true)

    try {
      let emailToUse = identifier.trim()

      if (!identifier.includes('@')) {
        const { data: resolvedEmail } = await Promise.race([
          supabase.rpc('get_email_by_identifier', { identifier: identifier.trim() }),
          new Promise(resolve => setTimeout(() => resolve({ data: null }), 4000))
        ])
        if (resolvedEmail) {
          emailToUse = resolvedEmail
        } else {
          setError('Admin ID not found. Please try with email.')
          return
        }
      }

      const { data: authData, error: authError } = await withTimeout(
        supabase.auth.signInWithPassword({ email: emailToUse, password }),
        120000
      )

      if (authError) { setError('Invalid credentials. Please try again.'); return }

      await new Promise(r => setTimeout(r, 200))

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, employee_id, role, is_active, must_change_password')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (profileError || !profile) {
        await supabase.auth.signOut()
        setError('Could not load profile. Please try again.')
        return
      }

      if (!['admin', 'super_admin'].includes(profile.role)) {
        await supabase.auth.signOut()
        setError('Access denied. This portal is for admins only.')
        return
      }

      supabase.from('login_history').insert({
        profile_id: profile.id,
        session_id: crypto.randomUUID(),
        event_type: 'login',
        login_at: new Date().toISOString(),
        status: 'success'
      }).then(({ error }) => { if (error) console.error('[Login History]', error) })

      supabase.from('profiles').update({ is_online: true }).eq('id', profile.id)
        .then(({ error }) => { if (error) console.error('[Profiles]', error) })

      toast.success('Welcome back!')
      setProfile(profile)

      if (profile.must_change_password) navigate('/change-password')
      else navigate('/admin')

    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
      setIsLoggingIn(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F0F7FF 0%, #EBF3FA 60%, #F0F7FF 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
        backgroundImage: 'radial-gradient(circle, #DBEAFE 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      <Link to="/" style={{
        position: 'absolute', top: 24, left: 24,
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: '#6B7280', textDecoration: 'none',
        fontWeight: 500, zIndex: 10,
      }}>
        <ArrowLeft size={15} /> Back to Home
      </Link>

      <div style={{ maxWidth: 440, width: '100%', position: 'relative' }}>
        <div
          className="fade-in"
          style={{
            background: '#FFFFFF', borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,174,239,0.10)',
            padding: 40, border: '1px solid #DBEAFE',
          }}
        >
          <div className="flex justify-center mb-6">
            <img src={fuelTracksLogo} alt="Fuel Tracks" className="h-14 w-auto object-contain" style={{ maxWidth: '180px' }} />
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: '0 0 6px', textAlign: 'center' }}>
            Admin Sign In
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 28px', textAlign: 'center' }}>
            Fuel Tracks Administration
          </p>

          {errors.general && (
            <div style={{
              background: 'rgba(232,25,44,0.06)', border: '1px solid rgba(232,25,44,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8, color: '#E8192C', fontSize: 13, fontWeight: 500,
            }}>
              <AlertCircle size={15} />{errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Admin ID or Email
              </label>
              <input
                id="admin-identifier" type="text" autoComplete="username"
                placeholder="Enter Admin ID or Email"
                value={identifier} onChange={e => setIdentifier(e.target.value)}
                disabled={loading}
                className={`input-field${errors.identifier ? ' error' : ''}`}
              />
              <FieldError message={errors.identifier} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="admin-password" type={showPw ? 'text' : 'password'}
                  autoComplete="current-password" placeholder="Enter your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  className={`input-field${errors.password ? ' error' : ''}`}
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center', padding: 0 }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <FieldError message={errors.password} />
            </div>

            <button id="admin-signin-btn" type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px', fontSize: 15, fontWeight: 600,
                color: '#FFFFFF', background: loading ? '#6B7280' : '#1B3A6B',
                border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'Inter, sans-serif', transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#00AEEF' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#1B3A6B' }}
            >
              {loading ? <><Loader2 size={17} style={{ animation: 'spin 0.7s linear infinite' }} /> Signing in…</> : 'Sign In to Admin Panel'}
            </button>

            {showSlowWarning && (
              <p style={{ fontSize: 12, textAlign: 'center', color: '#D97706', marginTop: 8 }}>
                ⏳ Connecting to server, please wait...
              </p>
            )}
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6B7280' }}>
            Not an admin?{' '}
            <Link to="/login/employee" style={{ color: '#00AEEF', textDecoration: 'none', fontWeight: 600 }}>
              Employee login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
