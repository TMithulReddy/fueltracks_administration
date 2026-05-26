import { useState, useEffect, useRef } from 'react'
import {
  Mail, Phone, Calendar, Camera, Save, AlertCircle,
  CheckCircle2, Loader2, Clock, LogIn, LogOut as LogOutIcon,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Avatar from '../../components/shared/Avatar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtDate(ts) {
  if (!ts) return '—'
  try { return format(parseISO(ts), 'd MMM yyyy') } catch { return ts }
}

function fmtTime(ts) {
  if (!ts) return '—'
  try { return format(parseISO(ts), 'd MMM yyyy, h:mm a') } catch { return ts }
}

function fmtDuration(mins) {
  if (!mins && mins !== 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} min`
  return `${h} hr ${m > 0 ? `${m} min` : ''}`
}

/* ── InfoRow ─────────────────────────────────────────────────── */
function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid #F0F7FF' }}>
      <span style={{ color: '#00AEEF', flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 14, color: '#1B3A6B', fontWeight: 500 }}>{value || 'Not set'}</p>
      </div>
    </div>
  )
}

export default function AdminProfile() {
  const { user, profile, updateProfile, refreshProfile } = useAuth()
  const fileInputRef = useRef(null)

  // Form state
  const [fullName, setFullName] = useState('')
  const [email,    setEmail]    = useState('')
  const [phone,    setPhone]    = useState('')

  // UI state
  const [saveLoading,   setSaveLoading]   = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [formError,     setFormError]     = useState('')
  const [formSuccess,   setFormSuccess]   = useState(false)

  // Login history
  const [history,        setHistory]        = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setEmail(profile.email ?? '')
      setPhone(profile.phone ?? '')
    }
  }, [profile])

  // Fetch login history
  useEffect(() => {
    if (!user) return
    fetchHistory()
  }, [user])

  async function fetchHistory() {
    try {
      const { data } = await supabase
        .from('login_history')
        .select('id, login_at, logout_at, session_duration_minutes, status, event_type')
        .eq('profile_id', user.id)
        .order('login_at', { ascending: false })
        .limit(20)
      setHistory(data ?? [])
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  /* ── Avatar upload ── */
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG or WebP files allowed.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB.')
      return
    }

    setAvatarLoading(true)
    // Show preview immediately
    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    try {
      const path = `avatars/${user.id}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      await updateProfile({ avatar_url: publicUrl })
      setAvatarPreview(null)
      toast.success('Avatar updated!')
    } catch (err) {
      setAvatarPreview(null)
      toast.error(err.message ?? 'Failed to upload avatar.')
    } finally {
      setAvatarLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /* ── Save profile ── */
  async function handleSave(e) {
    e.preventDefault()
    setFormError('')
    setFormSuccess(false)

    if (!fullName.trim()) { setFormError('Full name is required.'); return }
    if (!email.trim())    { setFormError('Email is required.'); return }

    setSaveLoading(true)
    try {
      await updateProfile({
        full_name: fullName.trim(),
        email:     email.trim(),
        phone:     phone.trim() || null,
      })
      await refreshProfile()
      setFormSuccess(true)
      toast.success('Profile updated successfully')
      setTimeout(() => setFormSuccess(false), 3000)
    } catch (err) {
      setFormError(err.message ?? 'Failed to update profile.')
    } finally {
      setSaveLoading(false)
    }
  }

  const roleBadge = profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>My Profile</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>Manage your account information</p>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start', flexWrap: 'wrap' }}>

        {/* Left — Profile display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Profile card */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 24 }}>

            {/* Avatar with upload overlay */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                {avatarPreview ? (
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
                    border: '3px solid #00AEEF',
                  }}>
                    <img src={avatarPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                  </div>
                ) : (
                  <Avatar
                    src={profile?.avatar_url}
                    name={profile?.full_name ?? ''}
                    size="lg"
                    online={profile?.is_online}
                  />
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarLoading}
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 26, height: 26, borderRadius: '50%',
                    background: '#00AEEF', border: '2px solid #FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#FFFFFF',
                  }}
                  title="Change avatar"
                >
                  {avatarLoading ? <LoadingSpinner size="sm" /> : <Camera size={13} />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                  id="avatar-upload"
                />
              </div>

              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1B3A6B', margin: '14px 0 6px', textAlign: 'center' }}>
                {profile?.full_name ?? '—'}
              </h2>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{
                  background: '#EFF6FF', color: '#00AEEF',
                  fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: 9999,
                }}>
                  {profile?.employee_id ?? '—'}
                </span>
                <span style={{
                  background: 'rgba(27,58,107,0.08)', color: '#1B3A6B',
                  fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: 9999,
                }}>
                  {roleBadge}
                </span>
              </div>
            </div>

            {/* Info rows */}
            <InfoRow icon={<Mail size={15} />}     label="Email"       value={profile?.email} />
            <InfoRow icon={<Phone size={15} />}    label="Phone"       value={profile?.phone} />
            <InfoRow icon={<Calendar size={15} />} label="Member since" value={fmtDate(profile?.created_at)} />
          </div>

          {/* Login History card */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #DBEAFE' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Login History</h3>
            </div>

            {historyLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
                <LoadingSpinner size="sm" />
              </div>
            ) : history.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
                <Clock size={28} color="#DBEAFE" style={{ marginBottom: 8 }} />
                <p style={{ margin: 0 }}>No login history yet</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FBFF' }}>
                      {['Date', 'Login', 'Logout', 'Duration', 'Status'].map(h => (
                        <th key={h} style={{
                          padding: '8px 12px', textAlign: 'left',
                          fontSize: 11, fontWeight: 600, color: '#6B7280',
                          borderBottom: '1px solid #DBEAFE', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row, i) => (
                      <tr key={row.id ?? i} style={{ borderBottom: '1px solid #F0F7FF' }}>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
                          {row.login_at ? format(parseISO(row.login_at), 'd MMM yyyy') : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#1B3A6B', whiteSpace: 'nowrap' }}>
                          {row.login_at ? format(parseISO(row.login_at), 'h:mm a') : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
                          {row.logout_at ? format(parseISO(row.logout_at), 'h:mm a') : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
                          {fmtDuration(row.session_duration_minutes)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: row.status === 'success' ? '#16A34A' : '#E8192C',
                            background: row.status === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(232,25,44,0.1)',
                            padding: '2px 8px', borderRadius: 9999,
                          }}>
                            {row.status === 'success' ? 'OK' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right — Edit form */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B', margin: '0 0 20px' }}>Edit Profile</h3>

          {formError && (
            <div style={{
              background: 'rgba(232,25,44,0.06)', border: '1px solid rgba(232,25,44,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8, color: '#E8192C', fontSize: 13,
            }}>
              <AlertCircle size={14} />{formError}
            </div>
          )}

          {formSuccess && (
            <div style={{
              background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8, color: '#16A34A', fontSize: 13,
            }}>
              <CheckCircle2 size={14} />Profile updated successfully
            </div>
          )}

          <form onSubmit={handleSave} noValidate>
            {[
              { label: 'Full Name', value: fullName, setter: setFullName, type: 'text', id: 'profile-name' },
              { label: 'Email',     value: email,    setter: setEmail,    type: 'email', id: 'profile-email' },
              { label: 'Phone',     value: phone,    setter: setPhone,    type: 'tel',  id: 'profile-phone', optional: true },
            ].map(field => (
              <div key={field.id} style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                  {field.label}
                  {field.optional && <span style={{ color: '#9CA3AF', fontWeight: 400 }}> (optional)</span>}
                </label>
                <input
                  id={field.id}
                  type={field.type}
                  value={field.value}
                  onChange={e => field.setter(e.target.value)}
                  disabled={saveLoading}
                  className="input-field"
                />
              </div>
            ))}

            <button
              id="save-profile-btn"
              type="submit"
              disabled={saveLoading}
              className="btn-primary"
              style={{ marginTop: 8 }}
            >
              {saveLoading
                ? <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</>
                : <><Save size={15} /> Save Changes</>
              }
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
