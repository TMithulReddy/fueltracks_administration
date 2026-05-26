import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, Info, Eye, EyeOff, RefreshCw, UserPlus,
  CheckCircle, XCircle, AlertCircle, Loader2, Check, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { adminSupabase } from '../../lib/supabaseAdmin'
import { validatePassword } from '../../utils/passwordValidator'

/* ── Password strength pill ───────────────────────────────────── */
function Pill({ met, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 9999,
      fontSize: 11, fontWeight: 600,
      background: met ? 'rgba(22,163,74,0.1)' : 'rgba(107,114,128,0.08)',
      color: met ? '#16A34A' : '#9CA3AF',
      border: `1px solid ${met ? 'rgba(22,163,74,0.25)' : 'rgba(107,114,128,0.15)'}`,
      transition: 'all 0.2s',
    }}>
      {met ? <Check size={9} /> : <X size={9} />}
      {label}
    </span>
  )
}


export default function AddAdmin() {
  const navigate = useNavigate()
  const { user: currentAdminUser, profile: currentAdminProfile } = useAuth()

  // Access gate
  const isSuperAdmin = currentAdminProfile?.role === 'super_admin'

  // Form state
  const [fullName, setFullName]         = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)

  // Auto-assigned ID
  const [nextAdminId, setNextAdminId]       = useState('')
  const [adminIdLoading, setAdminIdLoading] = useState(false)
  const [adminIdError, setAdminIdError]     = useState('')

  // Submission
  const [submitting, setSubmitting]     = useState(false)

  // Success state
  const [successData, setSuccessData]   = useState(null) // { name, email, id }

  // Password strength booleans
  const has8      = password.length >= 8
  const hasUpper  = /[A-Z]/.test(password)
  const hasLower  = /[a-z]/.test(password)
  const hasNum    = /[0-9]/.test(password)
  const hasSpec   = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword

  const fetchNextAdminId = async () => {
    setAdminIdLoading(true)
    setAdminIdError('')
    try {
      const { data, error } = await supabase.rpc('get_next_admin_id')
      if (error) throw error
      setNextAdminId(data)  // data is a plain string like "ADM003"
    } catch (err) {
      console.error('Error fetching admin ID:', err)
      setAdminIdError('Failed to fetch admin ID')
    } finally {
      setAdminIdLoading(false)
    }
  }

  useEffect(() => {
    fetchNextAdminId()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()

    // Step 1: Basic validation
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error('Please fill in all required fields.')
      return
    }

    // Step 2: Password validation
    const { valid, errors } = validatePassword(password)
    if (!valid) {
      toast.error(errors[0])
      return
    }

    // Step 3: Confirm passwords match
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    // Step 4: Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address.')
      return
    }

    setSubmitting(true)

    try {
      // Step 4a: Check email uniqueness in profiles
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .limit(1)

      if (existing && existing.length > 0) {
        toast.error('This email is already registered in the system.')
        setSubmitting(false)
        return
      }

      // Step 5: Re-fetch admin ID via RPC to avoid race conditions
      const { data: finalId, error: idErr } = await supabase.rpc('get_next_admin_id')
      if (idErr || !finalId) throw new Error('Could not assign admin ID. Please try again.')

      // Step 6: Create auth user
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName.trim(),
          role: 'admin',
        },
      })

      if (authError) throw authError
      const newUserId = authData.user.id

      // Step 7: Upsert profile row (Supabase creates it via trigger; we update it)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          employee_id: finalId,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          role: 'admin',
          is_active: true,
          must_change_password: false,
          created_by: currentAdminUser.id,
        })

      if (profileError) {
        // Rollback auth user
        await adminSupabase.auth.admin.deleteUser(newUserId)
        throw profileError
      }

      // Step 8: Audit log
      supabase
        .from('admin_audit_log')
        .insert({
          admin_id: currentAdminUser.id,
          admin_employee_id: currentAdminProfile?.employee_id,
          action_type: 'admin_created',
          target_profile_id: newUserId,
          target_employee_id: finalId,
          action_details: {
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            assigned_id: finalId,
          },
        })
        .then(({ error }) => {
          if (error) console.error('[Audit Log] Failed to write:', error)
        })

      // Step 9: Show success state
      setSuccessData({ name: fullName.trim(), email: email.trim().toLowerCase(), id: finalId })
    } catch (err) {
      toast.error(err.message ?? 'Failed to create admin account.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCreateAnother() {
    setSuccessData(null)
    setFullName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirm(false)
    fetchNextAdminId()
  }

  /* ── Access Denied ──────────────────────────────────────────── */
  if (!isSuperAdmin) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh',
      }}>
        <div style={{
          background: '#FFFFFF', borderRadius: 16, padding: 48,
          boxShadow: '0 2px 12px rgba(0,174,239,0.08)',
          maxWidth: 420, width: '100%', textAlign: 'center',
        }}>
          <Shield size={56} color="#E8192C" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1B3A6B', margin: '0 0 10px' }}>
            Access Denied
          </h2>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 28px', lineHeight: 1.6 }}>
            Only the Super Admin can add new administrators.
          </p>
          <button onClick={() => navigate('/admin')} className="btn-primary">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  /* ── Success State ──────────────────────────────────────────── */
  if (successData) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Add Administrator</h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>Create a new admin account for Fuel Tracks</p>
        </div>

        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, padding: 40,
            boxShadow: '0 2px 12px rgba(0,174,239,0.08)', textAlign: 'center',
          }}>
            <CheckCircle size={64} color="#16A34A" style={{ marginBottom: 20 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1B3A6B', margin: '0 0 8px' }}>
              Admin Account Created!
            </h2>
            <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 28px' }}>
              The new administrator can now sign in with their credentials.
            </p>

            {/* Details card */}
            <div style={{
              background: '#F8FBFF', border: '1px solid #DBEAFE', borderRadius: 12,
              padding: 20, marginBottom: 28, textAlign: 'left',
            }}>
              {[
                { label: 'Full Name', value: successData.name },
                { label: 'Email',     value: successData.email },
                { label: 'Admin ID',  value: successData.id },
                { label: 'Role',      value: 'Admin' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid #DBEAFE',
                }}>
                  <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 13, color: '#1B3A6B', fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={handleCreateAnother} className="btn-secondary" style={{ fontSize: 13 }}>
                Create Another Admin
              </button>
              <button onClick={() => navigate('/admin')} className="btn-primary" style={{ fontSize: 13 }}>
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Main Form ──────────────────────────────────────────────── */
  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Add Administrator</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>Create a new admin account for Fuel Tracks</p>
      </div>

      {/* Info Banner */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 10,
        padding: '12px 16px', marginBottom: 24,
        display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13, color: '#1B3A6B',
      }}>
        <Info size={16} color="#00AEEF" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          New admins will be assigned an ID automatically (ADM003, ADM004…).
          They will have full admin access but <strong>cannot add other admins</strong>.
          Only Super Admin (ADM001) can add administrators.
        </span>
      </div>

      {/* Card */}
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{
          background: '#FFFFFF', borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #DBEAFE' }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1B3A6B' }}>
              New Admin Details
            </h2>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: 24 }}>

            {/* Full Name */}
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="admin-full-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Full Name <span style={{ color: '#E8192C' }}>*</span>
              </label>
              <input
                id="admin-full-name"
                type="text"
                required
                placeholder="Enter full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="input-field"
                autoComplete="off"
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="admin-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Email Address <span style={{ color: '#E8192C' }}>*</span>
              </label>
              <input
                id="admin-email"
                type="email"
                required
                placeholder="Enter email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-field"
                autoComplete="off"
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="admin-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Password <span style={{ color: '#E8192C' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Create a strong password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field"
                  style={{ paddingRight: 44 }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Strength pills */}
            {password.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                <Pill met={has8}     label="8+ chars" />
                <Pill met={hasUpper} label="Uppercase" />
                <Pill met={hasLower} label="Lowercase" />
                <Pill met={hasNum}   label="Number" />
                <Pill met={hasSpec}  label="Special char" />
              </div>
            )}

            {/* Confirm Password */}
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="admin-confirm-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Confirm Password <span style={{ color: '#E8192C' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="admin-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  placeholder="Confirm the password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="input-field"
                  style={{ paddingRight: 44 }}
                  autoComplete="new-password"
                />
                <div style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {confirmPassword.length > 0 && (
                    passwordsMatch
                      ? <CheckCircle size={15} color="#16A34A" />
                      : <XCircle size={15} color="#E8192C" />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirm(p => !p)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center' }}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Auto-assigned Admin ID */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Admin ID (Auto-assigned)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  flex: 1,
                  background: '#F0F7FF', border: '1.5px solid #DBEAFE', borderRadius: 8,
                  padding: '10px 14px', fontSize: 14, fontWeight: 700, color: '#1B3A6B',
                  letterSpacing: '0.05em',
                }}>
                  {adminIdLoading ? (
                    <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite', verticalAlign: 'middle' }} />
                  ) : adminIdError ? (
                    <span style={{ color: '#E8192C', fontWeight: 500, fontSize: 13 }}>{adminIdError}</span>
                  ) : (
                    nextAdminId || '—'
                  )}
                </div>
                <button
                  type="button"
                  onClick={fetchNextAdminId}
                  disabled={adminIdLoading}
                  title="Re-fetch next admin ID"
                  style={{
                    background: '#F0F7FF', border: '1.5px solid #DBEAFE', borderRadius: 8,
                    padding: '10px 12px', cursor: 'pointer', color: '#00AEEF',
                    display: 'flex', alignItems: 'center',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#DBEAFE'}
                  onMouseLeave={e => e.currentTarget.style.background = '#F0F7FF'}
                >
                  <RefreshCw size={15} style={adminIdLoading ? { animation: 'spin 0.7s linear infinite' } : {}} />
                </button>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9CA3AF' }}>
                This ID is assigned automatically and cannot be changed.
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #F0F7FF', paddingTop: 18 }}>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                disabled={submitting}
                className="btn-secondary"
                style={{ fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || adminIdLoading || !nextAdminId}
                style={{
                  background: '#1B3A6B', color: '#FFFFFF', border: 'none',
                  borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  opacity: submitting ? 0.7 : 1,
                  fontFamily: 'Inter, sans-serif',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#0f2447' }}
                onMouseLeave={e => e.currentTarget.style.background = '#1B3A6B'}
                id="create-admin-submit"
              >
                {submitting ? (
                  <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Creating…</>
                ) : (
                  <><UserPlus size={14} /> Create Admin Account</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
