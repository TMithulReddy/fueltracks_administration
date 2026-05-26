import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Check, X, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { validatePassword, getPasswordStrength } from '../../utils/passwordValidator'
import fuelTracksLogo from '../../assets/fuel-tracks-logo.png'

/* ── Password requirement pill ──────────────────────────────── */
function ReqPill({ met, label }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 10px',
        borderRadius: 9999,
        fontSize: 11.5,
        fontWeight: 600,
        background: met ? 'rgba(22,163,74,0.1)' : 'rgba(107,114,128,0.08)',
        color: met ? '#16A34A' : '#6B7280',
        border: `1px solid ${met ? 'rgba(22,163,74,0.25)' : 'rgba(107,114,128,0.15)'}`,
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
      }}
    >
      {met ? <Check size={11} /> : <X size={11} />}
      {label}
    </div>
  )
}

export default function ChangePassword() {
  const { user, profile, refreshProfile, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew,         setShowNew]         = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [generalError,    setGeneralError]    = useState('')

  // Redirect if no active session — wait for auth to finish loading first
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/', { replace: true })
    }
  }, [authLoading, user, navigate])

  // Password requirement checks
  const reqs = {
    length:    newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number:    /[0-9]/.test(newPassword),
    special:   /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(newPassword),
  }

  const strength      = getPasswordStrength(newPassword)
  const allMet        = Object.values(reqs).every(Boolean)
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword
  const passwordsDiff  = confirmPassword.length > 0 && newPassword !== confirmPassword

  // Strength bar color
  const strengthColors = ['#E8192C', '#E8192C', '#F59E0B', '#F59E0B', '#10B981', '#16A34A']
  const strengthLabels = ['', 'Very Weak', 'Weak', 'Fair', 'Good', 'Strong']

  async function handleSubmit(e) {
    e.preventDefault()
    setGeneralError('')

    // Step 1: validate
    const { valid, errors: pwErrors } = validatePassword(newPassword)
    if (!valid) {
      setGeneralError(pwErrors[0])
      return
    }

    // Step 2: confirm match
    if (newPassword !== confirmPassword) {
      setGeneralError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      // Step 3: update Supabase auth password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      // Step 4: update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id)
      if (profileError) throw profileError

      // Step 5: refresh context
      await refreshProfile()

      // Step 6: success toast
      toast.success('Password updated successfully!')

      // Step 7: redirect by role
      const role = profile?.role
      if (role === 'admin' || role === 'super_admin') {
        navigate('/admin', { replace: true })
      } else {
        navigate('/employee', { replace: true })
      }
    } catch (err) {
      setGeneralError(err.message ?? 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F0F7FF 0%, #E8F4FD 60%, #F0F7FF 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,174,239,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(27,58,107,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 440, width: '100%', position: 'relative' }}>
        {/* Auth Card */}
        <div
          className="fade-in"
          style={{
            background: '#FFFFFF',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,174,239,0.10)',
            padding: 40,
            border: '1px solid #DBEAFE',
          }}
        >
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src={fuelTracksLogo}
              alt="Fuel Tracks"
              className="h-14 w-auto object-contain"
              style={{ maxWidth: '180px' }}
            />
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1B3A6B', margin: '0 0 6px', textAlign: 'center' }}>
            Set Your Password
          </h1>
          <p style={{ fontSize: 13.5, color: '#6B7280', margin: '0 0 20px', textAlign: 'center' }}>
            You must set a new password before continuing.
          </p>

          {/* Info banner */}
          <div style={{
            background: '#EFF6FF',
            border: '1px solid #DBEAFE',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 24,
            fontSize: 12.5,
            color: '#1B3A6B',
            lineHeight: 1.5,
          }}>
            🔒 Your default password must be changed for security. Please create a strong password below.
          </div>

          {/* General error */}
          {generalError && (
            <div style={{
              background: 'rgba(232,25,44,0.06)', border: '1px solid rgba(232,25,44,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8,
              color: '#E8192C', fontSize: 13, fontWeight: 500,
            }}>
              <AlertCircle size={15} />
              {generalError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* New Password */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  disabled={loading}
                  className="input-field"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(p => !p)}
                  tabIndex={-1}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
                    display: 'flex', alignItems: 'center', padding: 0,
                  }}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Strength bar */}
            {newPassword.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: i <= strength ? strengthColors[strength] : '#DBEAFE',
                        transition: 'background 0.3s ease',
                      }}
                    />
                  ))}
                </div>
                {strength > 0 && (
                  <p style={{ fontSize: 11, color: strengthColors[strength], fontWeight: 600, margin: 0 }}>
                    {strengthLabels[strength]}
                  </p>
                )}
              </div>
            )}

            {/* Requirement pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              <ReqPill met={reqs.length}    label="8+ chars"   />
              <ReqPill met={reqs.uppercase} label="Uppercase"  />
              <ReqPill met={reqs.lowercase} label="Lowercase"  />
              <ReqPill met={reqs.number}    label="Number"     />
              <ReqPill met={reqs.special}   label="Special char" />
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className={`input-field${passwordsDiff ? ' error' : ''}`}
                  style={{ paddingRight: 72 }}
                />
                <div style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {/* Match indicator */}
                  {confirmPassword.length > 0 && (
                    passwordsMatch
                      ? <CheckCircle2 size={16} color="#16A34A" />
                      : <X           size={16} color="#E8192C" />
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirm(p => !p)}
                    tabIndex={-1}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#9CA3AF', display: 'flex', alignItems: 'center', padding: 0,
                    }}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              {passwordsDiff && (
                <p style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#E8192C', fontSize: 13, marginTop: 4 }}>
                  <AlertCircle size={13} />
                  Passwords do not match.
                </p>
              )}
              {passwordsMatch && (
                <p style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16A34A', fontSize: 13, marginTop: 4 }}>
                  <CheckCircle2 size={13} />
                  Passwords match!
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              id="set-password-btn"
              type="submit"
              disabled={loading || !allMet || passwordsDiff}
              className="btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: 15 }}
            >
              {loading
                ? <><Loader2 size={17} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</>
                : 'Set Password & Continue'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
