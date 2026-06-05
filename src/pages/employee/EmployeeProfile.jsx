import { useState, useEffect, useRef } from 'react'
import {
  Camera, Lock, Mail, Phone, Briefcase,
  Calendar, Clock, AlertCircle, Loader2, CheckCircle, Save,
  FileText, Eye, Droplets,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Avatar from '../../components/shared/Avatar'
import { getSignedUrl } from '../../utils/storageHelpers'

// Documents visible to employees (offer + joining only — NO PAN, NO Aadhar images)
const EMPLOYEE_VISIBLE_DOCS = [
  { key: 'offer_letter',   label: 'Offer Letter',   filename: 'offer_letter.pdf'   },
  { key: 'joining_letter', label: 'Joining Letter',  filename: 'joining_letter.pdf' },
]

/** Mask aadhar: show only last 4 digits as XXXX-XXXX-1234 */
function maskAadhar(num) {
  if (!num || num.length < 4) return '—'
  const last4 = num.slice(-4)
  return `XXXX-XXXX-${last4}`
}

export default function EmployeeProfile() {
  const { user, profile, refreshProfile } = useAuth()

  const [details, setDetails]             = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(true)

  // Edit form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [saving, setSaving]     = useState(false)

  // Avatar upload
  const [uploading, setUploading]         = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef                      = useRef(null)

  // Documents
  const [docUrls, setDocUrls]     = useState({})
  const [docsLoading, setDocsLoading] = useState(false)
  const [docViewing, setDocViewing] = useState({})

  useEffect(() => {
    if (user) fetchDetails()
  }, [user])

  // Pre-fill form whenever profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setEmail(profile.email ?? '')
      setPhone(profile.phone ?? '')
    }
  }, [profile])

  async function fetchDetails() {
    setDetailsLoading(true)
    const { data } = await supabase
      .from('employee_details')
      .select('*')
      .eq('profile_id', user.id)
      .single()
    setDetails(data ?? null)
    setDetailsLoading(false)

    // Load document signed URLs after details
    fetchDocumentUrls()
  }

  // Fetch signed URLs for employee-visible documents only
  async function fetchDocumentUrls() {
    setDocsLoading(true)
    const urls = {}
    await Promise.all(
      EMPLOYEE_VISIBLE_DOCS.map(async (doc) => {
        const path = `${user.id}/${doc.filename}`
        const { data } = await supabase.storage
          .from('employee-documents')
          .createSignedUrl(path, 3600)
        urls[doc.key] = data?.signedUrl ?? null
      })
    )
    setDocUrls(urls)
    setDocsLoading(false)
  }

  // View document — refresh signed URL first
  async function handleViewDocument(doc) {
    setDocViewing(prev => ({ ...prev, [doc.key]: true }))
    try {
      const path = `${user.id}/${doc.filename}`
      const { data, error } = await supabase.storage
        .from('employee-documents')
        .createSignedUrl(path, 3600)
      
      if (error || !data?.signedUrl) {
        toast.error(`${doc.label} has not been uploaded yet.`)
        return
      }
      window.open(data.signedUrl, '_blank')
    } catch (err) {
      toast.error(`Failed to open ${doc.label}`)
    } finally {
      setDocViewing(prev => ({ ...prev, [doc.key]: false }))
    }
  }

  /* ── Avatar upload ── */
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG, or WebP).')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB.')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setAvatarPreview(previewUrl)
    setUploading(true)

    try {
      const ext  = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = urlData?.publicUrl
      
      if (!publicUrl) throw new Error('Failed to get public URL')
      
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id)
      
      if (updateErr) throw updateErr
      await refreshProfile()
      toast.success('Profile photo updated')
    } catch (err) {
      setAvatarPreview(null)
      toast.error(err.message ?? 'Failed to upload photo.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /* ── Save profile edits ── */
  async function handleSave(e) {
    e.preventDefault()

    if (!fullName.trim() || !email.trim()) {
      toast.error('Full name and email are required.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address.')
      return
    }

    setSaving(true)
    try {
      if (email.trim().toLowerCase() !== profile.email?.toLowerCase()) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email.trim().toLowerCase())
          .neq('id', user.id)
          .limit(1)
        if (existing && existing.length > 0) {
          toast.error('This email is already registered in the system.')
          setSaving(false)
          return
        }
      }

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || null })
        .eq('id', user.id)

      if (updateErr) throw updateErr
      await refreshProfile()
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error(err.message ?? 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const joinedDate   = details?.date_of_joining ? format(parseISO(details.date_of_joining), 'd MMM yyyy') : '—'
  const memberSince  = profile?.created_at ? format(parseISO(profile.created_at), 'd MMM yyyy') : '—'
  const maskedAadhar = maskAadhar(profile?.aadhar_number)

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>My Profile</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>View and manage your personal information</p>
      </div>

      <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>

        {/* ── Left: Profile Card ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 28 }}>
            {/* Avatar with upload overlay */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                {uploading ? (
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: '#F0F7FF', border: '2px solid #DBEAFE',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                  }}>
                    {avatarPreview
                      ? <img src={avatarPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                      : <Loader2 size={24} color="#00AEEF" style={{ animation: 'spin 0.7s linear infinite' }} />
                    }
                  </div>
                ) : (
                  <Avatar src={profile?.avatar_url} name={profile?.full_name ?? ''} size="lg" online={profile?.is_online} />
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#00AEEF', border: '2px solid #FFFFFF',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title="Change photo"
                >
                  <Camera size={11} color="#FFFFFF" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </div>

              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1B3A6B', margin: '0 0 6px', textAlign: 'center' }}>{profile?.full_name}</h2>
              <span style={{
                background: '#EFF6FF', color: '#00AEEF', fontFamily: 'monospace',
                fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 9999, display: 'inline-block', marginBottom: 6,
              }}>
                {profile?.employee_id}
              </span>
              <span style={{ background: '#F0F7FF', color: '#1B3A6B', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999 }}>
                {profile?.role?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </span>
            </div>

            {/* Info list */}
            <div style={{ borderTop: '1px solid #F0F7FF', paddingTop: 16 }}>
              {detailsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <LoadingSpinner size="sm" />
                </div>
              ) : (
                [
                  { icon: <Mail size={14} color="#00AEEF" />,     label: 'Email',           val: profile?.email },
                  { icon: <Phone size={14} color="#00AEEF" />,    label: 'Phone',           val: profile?.phone || 'Not set' },
                  { icon: <Briefcase size={14} color="#00AEEF" />,label: 'Department',      val: details?.department || 'Not set' },
                  { icon: <Briefcase size={14} color="#1B3A6B" />,label: 'Designation',     val: details?.designation || 'Not set' },
                  { icon: <Calendar size={14} color="#00AEEF" />, label: 'Date of Joining', val: joinedDate },
                  { icon: <Clock size={14} color="#6B7280" />,    label: 'Member Since',    val: memberSince },
                  { icon: <Droplets size={14} color="#E8192C" />, label: 'Blood Group',     val: profile?.blood_group || 'Not set' },
                  { icon: <AlertCircle size={14} color="#6B7280" />, label: 'Aadhar No.',   val: maskedAadhar },
                ].map(({ icon, label, val }, i, arr) => (
                  <div
                    key={label}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 0',
                      borderBottom: i < arr.length - 1 ? '1px solid #F0F7FF' : 'none',
                      gap: 8,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280', flexShrink: 0 }}>
                      {icon} {label}
                    </span>
                    <span style={{ fontSize: 12, color: '#1B3A6B', fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>
                      {val}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Documents Card (view-only, offer + joining only) */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color="#00AEEF" /> My Documents
            </h2>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 16px' }}>
              View your official documents uploaded by HR.
            </p>

            {docsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {EMPLOYEE_VISIBLE_DOCS.map(doc => {
                  const exists  = !!docUrls[doc.key]
                  const viewing = !!docViewing[doc.key]
                  return (
                    <div key={doc.key} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px',
                      border: `1.5px solid ${exists ? '#DBEAFE' : '#E5E7EB'}`,
                      borderRadius: 10,
                      background: exists ? '#F8FBFF' : '#FAFAFA',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: exists ? 'rgba(0,174,239,0.1)' : 'rgba(107,114,128,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <FileText size={15} color={exists ? '#00AEEF' : '#9CA3AF'} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1B3A6B' }}>{doc.label}</p>
                          <p style={{ margin: 0, fontSize: 11, color: exists ? '#16A34A' : '#9CA3AF' }}>
                            {exists ? '✓ Available' : 'Not uploaded yet'}
                          </p>
                        </div>
                      </div>

                      {exists ? (
                        <button
                          type="button"
                          onClick={() => handleViewDocument(doc)}
                          disabled={viewing}
                          style={{
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            padding: '6px 12px', borderRadius: 7,
                            border: '1px solid #00AEEF',
                            background: 'rgba(0,174,239,0.08)', color: '#00AEEF',
                            display: 'flex', alignItems: 'center', gap: 5,
                            opacity: viewing ? 0.6 : 1,
                          }}
                        >
                          {viewing ? <Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Eye size={12} />}
                          View
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ marginTop: 12, padding: '8px 12px', background: '#EFF6FF', border: '1px solid #DBEAFE', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={12} color="#00AEEF" />
              <p style={{ margin: 0, fontSize: 11, color: '#1B3A6B' }}>
                Documents open via secure signed links. Links expire after 1 hour.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: Edit Form ── */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 28 }}>
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Edit Profile</h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>Update your personal information</p>
          </div>

          <form onSubmit={handleSave}>
            {/* Full Name */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="emp-full-name" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Full Name <span style={{ color: '#E8192C' }}>*</span>
              </label>
              <input id="emp-full-name" type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="input-field" />
            </div>

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="emp-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Email Address <span style={{ color: '#E8192C' }}>*</span>
              </label>
              <input id="emp-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input-field" />
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="emp-phone" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>
                Phone Number
              </label>
              <input id="emp-phone" type="text" placeholder="Enter phone number" value={phone} onChange={e => setPhone(e.target.value)} className="input-field" />
            </div>

            {/* Employee ID (read-only) */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>Employee ID</label>
              <div style={{ position: 'relative' }}>
                <input type="text" value={profile?.employee_id ?? ''} readOnly className="input-field"
                  style={{ background: '#F3F4F6', cursor: 'not-allowed', color: '#6B7280', paddingRight: 40 }} />
                <Lock size={14} color="#9CA3AF" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              <p style={{ margin: '5px 0 0', fontSize: 11, color: '#9CA3AF' }}>Employee ID can only be changed by your administrator.</p>
            </div>

            {/* Aadhar (read-only, masked) */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}>Aadhar Number</label>
              <div style={{ position: 'relative' }}>
                <input type="text" value={maskedAadhar} readOnly className="input-field"
                  style={{ background: '#F3F4F6', cursor: 'not-allowed', color: '#6B7280', paddingRight: 40, fontFamily: 'monospace' }} />
                <Lock size={14} color="#9CA3AF" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
              </div>
              <p style={{ margin: '5px 0 0', fontSize: 11, color: '#9CA3AF' }}>Aadhar number is masked for security. Contact your administrator to update it.</p>
            </div>

            <button type="submit" disabled={saving} className="btn-primary" style={{ width: '100%', fontSize: 14 }} id="emp-save-profile-btn">
              {saving
                ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</>
                : <><Save size={14} /> Save Changes</>
              }
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
