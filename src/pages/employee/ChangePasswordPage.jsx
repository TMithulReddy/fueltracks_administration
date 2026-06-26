import { useState } from 'react'
import {
  Eye, EyeOff, Lock, Info,
  Loader2, Check, X, CheckCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { validatePassword } from '../../utils/passwordValidator'

/* ── Strength pill ─────────────────────────────────────────────── */
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

/* ── Password field with show/hide toggle ─────────────────────── */
function PwdField({ id, label, value, onChange, show, onToggle, placeholder, extra }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
        {label} <span style={{ color: '#E8192C' }}>*</span>
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          required
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="input-field"
          style={{ paddingRight: 44 }}
          autoComplete="new-password"
        />
        {extra && (
          <div style={{ position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)' }}>
            {extra}
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF',
            display: 'flex', alignItems: 'center',
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}

export default function ChangePasswordPage() {
  const { user, profile } = useAuth()

  const [currentPwd, setCurrentPwd]       = useState('')
  const [newPwd, setNewPwd]               = useState('')
  const [confirmPwd, setConfirmPwd]       = useState('')
  const [showCurrent, setShowCurrent]     = useState(false)
  const [showNew, setShowNew]             = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [success, setSuccess]             = useState(false)

  /* ── Password requirements ── */
  const has8     = newPwd.length >= 8
  const hasUpper = /[A-Z]/.test(newPwd)
  const hasLower = /[a-z]/.test(newPwd)
  const hasNum   = /[0-9]/.test(newPwd)
  const hasSpec  = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(newPwd)
  const pwdMatch = confirmPwd.length > 0 && newPwd === confirmPwd

  async function handleSubmit(e) {
    e.preventDefault()

    if (!currentPwd || !newPwd || !confirmPwd) {
      toast.error('Please fill in all fields.')
      return
    }

    // Step 1: Verify current password
    setSubmitting(true)
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: profile?.email ?? '',
        password: currentPwd,
      })
      if (signInErr) {
        toast.error('Current password is incorrect.')
        setSubmitting(false)
        return
      }
    } catch {
      toast.error('Could not verify current password.')
      setSubmitting(false)
      return
    }

    // Step 2: Validate new password
    const { valid, errors } = validatePassword(newPwd)
    if (!valid) {
      toast.error(errors[0])
      setSubmitting(false)
      return
    }

    // Step 3: Confirm match
    if (newPwd !== confirmPwd) {
      toast.error('Passwords do not match.')
      setSubmitting(false)
      return
    }

    // Step 4: New != current
    if (newPwd === currentPwd) {
      toast.error('New password must be different from current password.')
      setSubmitting(false)
      return
    }

    // Step 5: Update
    try {
      // Refresh session first
      const { error: refreshErr } = await supabase.auth.refreshSession()
      if (refreshErr) {
        toast.error('Your session has expired. Please log in again.')
        await supabase.auth.signOut()
        window.location.href = '/'
        return
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd })
      if (updateErr) throw updateErr

      toast.success('Password changed successfully')
      setCurrentPwd('')
      setNewPwd('')
      setConfirmPwd('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      toast.error(err.message ?? 'Failed to update password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Change Password</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>Update your account password</p>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* Success banner */}
        {success && (
          <div style={{
            background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10,
            color: '#16A34A', fontSize: 13, fontWeight: 600,
          }}>
            <CheckCircle size={16} />
            Password changed successfully!
          </div>
        )}

        {/* Form card */}
        <div style={{
          background: '#FFFFFF', borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 28, marginBottom: 16,
        }}>
          <div style={{ marginBottom: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(0,174,239,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock size={18} color="#00AEEF" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1B3A6B' }}>Update Password</h2>
              <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Choose a strong, unique password</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Current Password */}
            <PwdField
              id="current-password"
              label="Current Password"
              value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              show={showCurrent}
              onToggle={() => setShowCurrent(p => !p)}
              placeholder="Enter your current password"
            />

            {/* New Password */}
            <PwdField
              id="new-password"
              label="New Password"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              show={showNew}
              onToggle={() => setShowNew(p => !p)}
              placeholder="Create a strong new password"
            />

            {/* Strength pills */}
            {newPwd.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18, marginTop: -10 }}>
                <Pill met={has8}     label="8+ chars" />
                <Pill met={hasUpper} label="Uppercase" />
                <Pill met={hasLower} label="Lowercase" />
                <Pill met={hasNum}   label="Number" />
                <Pill met={hasSpec}  label="Special char" />
              </div>
            )}

            {/* Confirm Password */}
            <div style={{ marginBottom: 24 }}>
              <label htmlFor="confirm-new-password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Confirm New Password <span style={{ color: '#E8192C' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirm-new-password"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  placeholder="Confirm your new password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  className="input-field"
                  style={{ paddingRight: 68 }}
                  autoComplete="new-password"
                />
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {confirmPwd.length > 0 && (
                    pwdMatch
                      ? <CheckCircle size={15} color="#16A34A" />
                      : <X size={15} color="#E8192C" />
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

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              style={{ width: '100%', fontSize: 14 }}
              id="change-password-submit"
            >
              {submitting
                ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Updating…</>
                : 'Update Password'
              }
            </button>
          </form>
        </div>

        {/* Security tips */}
        <div style={{
          background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 12, padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Info size={15} color="#00AEEF" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1B3A6B' }}>Password Tips</span>
          </div>
          {[
            'Never share your password with anyone',
            'Use a unique password not used on other sites',
            'Your password is encrypted and never stored in plain text',
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: i < 2 ? 6 : 0 }}>
              <span style={{ color: '#00AEEF', fontSize: 14, lineHeight: 1.4 }}>•</span>
              <span style={{ fontSize: 12, color: '#1B3A6B', lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
