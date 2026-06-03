import { useState, useEffect, useCallback } from 'react'
import { KeyRound, Eye, EyeOff, AlertCircle, Loader2, ShieldOff, Calendar, Clock, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import withTimeout from '../../utils/withTimeout'

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtDateTime(ts) {
  if (!ts) return '—'
  try { return format(parseISO(ts), 'd MMM yyyy, h:mm a') } catch { return ts }
}
function fmtDate(d) {
  if (!d) return '—'
  try { return format(new Date(d + 'T00:00:00'), 'd MMM yyyy') } catch { return d }
}

/* ── Confirm Dialog ──────────────────────────────────────────── */
function ConfirmDialog({ message, onConfirm, onCancel, loading }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 12, padding: 28,
        maxWidth: 420, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <AlertCircle size={22} color="#E8192C" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, fontSize: 14, color: '#1B3A6B', lineHeight: 1.6 }}>{message}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} className="btn-secondary" style={{ fontSize: 13 }}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: '#E8192C', color: '#FFFFFF', border: 'none',
              borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {loading ? <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> : null}
            Deactivate
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DailyCode() {
  const { user, profile } = useAuth()

  const [todayCode,     setTodayCode]     = useState(null)
  const [codeLoading,   setCodeLoading]   = useState(true)
  const [codeRevealed,  setCodeRevealed]  = useState(false)
  const [deactivating,  setDeactivating]  = useState(false)
  const [showConfirm,   setShowConfirm]   = useState(false)

  // Manual entry states
  const [manualCode, setManualCode] = useState('')
  const [settingCode, setSettingCode] = useState(false)

  const [history,        setHistory]        = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [revealedRows,   setRevealedRows]   = useState(new Set())

  const fetchData = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]

    // Today's code
    try {
      const { data } = await withTimeout(
        supabase
          .from('daily_codes')
          .select('*')
          .eq('valid_date', today)
          .order('created_at', { ascending: false })
          .limit(1),
        8000
      )
      setTodayCode(data?.[0] ?? null)
    } catch (err) {
      console.error('Failed to load today\'s code:', err)
      setTodayCode(null)
    } finally {
      setCodeLoading(false)
    }

    // Code history
    try {
      const { data } = await withTimeout(
        supabase
          .from('daily_codes')
          .select('*')
          .order('valid_date', { ascending: false })
          .limit(50),
        8000
      )
      setHistory(data ?? [])
    } catch (err) {
      console.error('Failed to load history:', err)
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSetCode(e) {
    e.preventDefault()
    if (manualCode.length !== 4) {
      toast.error('Code must be exactly 4 digits.')
      return
    }

    setSettingCode(true)
    try {
      if (todayCode) {
        // A daily code record already exists for today. Update and reactivate it directly!
        const { error } = await withTimeout(
          supabase
            .from('daily_codes')
            .update({
              code: manualCode,
              is_active: true,
              created_by_admin_id: profile?.id || user?.id,
              created_by_employee_id: profile?.employee_id || 'ADM001',
              created_at: new Date().toISOString()
            })
            .eq('id', todayCode.id),
          8000
        )
        if (error) throw error
      } else {
        // Today's code doesn't exist yet. Call the RPC to insert a new daily code record!
        const { data, error } = await withTimeout(
          supabase.rpc('set_daily_code', {
            p_code: manualCode,
            p_admin_id: profile?.id || user?.id,
            p_admin_employee_id: profile?.employee_id || 'ADM001'
          }),
          8000
        )
        if (error) throw error
        if (data && data.success === false) {
          throw new Error(data.message)
        }
      }

      // Send email notification to all employees
      try {
        const enteredCode = manualCode
        const { data: { session } } = 
          await supabase.auth.getSession()
        
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-daily-code-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
            },
            body: JSON.stringify({
              code: enteredCode,
              valid_date: new Date().toISOString().split('T')[0]
            })
          }
        )
        toast.success('Code set and email sent to all admins!')
      } catch (emailErr) {
        // Email failed but code is set — show partial success
        console.error('[Email]', emailErr)
        toast.success('Code set successfully.')
        toast.error('Email notification failed. Check edge function deployment.',
                     { duration: 5000 })
      }

      setManualCode('')
      setCodeRevealed(false)
      await fetchData()
    } catch (err) {
      toast.error(err.message || 'Failed to set code.')
    } finally {
      setSettingCode(false)
    }
  }

  /* ── Deactivate code ── */
  async function handleDeactivate() {
    setDeactivating(true)
    try {
      const { error } = await withTimeout(
        supabase
          .from('daily_codes')
          .update({ is_active: false })
          .eq('id', todayCode.id),
        8000
      )
      if (error) throw error

      // Log to audit
      try {
        await withTimeout(
          supabase.from('admin_audit_log').insert({
            admin_id:          user.id,
            admin_employee_id: profile?.employee_id,
            action_type:       'daily_code_deactivated',
            action_details:    { code: todayCode.code, valid_date: todayCode.valid_date },
          }),
          8000
        )
      } catch {
        // Silent fail
      }

      toast.success('Code deactivated')
      setShowConfirm(false)
      setCodeRevealed(false)
      await fetchData()
    } catch (err) {
      toast.error(err.message ?? 'Failed to deactivate code.')
    } finally {
      setDeactivating(false)
    }
  }

  function toggleRowReveal(id) {
    setRevealedRows(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="fade-in">
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Daily Authentication Code</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>Manage the daily employee login code</p>
      </div>

      {/* ── Today's Code Section ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,174,239,0.08)',
        padding: 32, marginBottom: 24,
      }}>
        {codeLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <LoadingSpinner size="md" />
          </div>
        ) : todayCode && todayCode.is_active ? (
          /* ── Code display card ── */
          <div style={{ textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              Today's Active Code
            </p>

            {/* Big code display */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
              <span style={{
                fontSize: 64,
                fontWeight: 700,
                color: '#1B3A6B',
                letterSpacing: '0.3em',
                fontFamily: 'Inter, monospace',
                paddingLeft: '0.3em'
              }}>
                {codeRevealed ? todayCode.code : '••••'}
              </span>
              <button
                type="button"
                onClick={() => setCodeRevealed(p => !p)}
                style={{
                  background: 'rgba(0,174,239,0.08)', border: 'none', borderRadius: 8,
                  padding: 10, cursor: 'pointer', color: '#00AEEF',
                  display: 'flex', alignItems: 'center',
                }}
                title={codeRevealed ? 'Hide code' : 'Reveal code'}
              >
                {codeRevealed ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Code metadata */}
            <div style={{
              background: '#F8FBFF', border: '1px solid #DBEAFE', borderRadius: 8,
              padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#1B3A6B',
              display: 'flex', flexDirection: 'column', gap: 6
            }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                Expires at 11:59 PM today
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                Set by {todayCode.generated_by || 'Admin'} at {fmtDateTime(todayCode.created_at)}
              </p>
            </div>

            {/* Status badge */}
            <div style={{ marginBottom: 24 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 16px', borderRadius: 9999, fontSize: 14, fontWeight: 700,
                background: todayCode.is_active ? 'rgba(22,163,74,0.1)' : 'rgba(232,25,44,0.1)',
                color: todayCode.is_active ? '#16A34A' : '#E8192C',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: todayCode.is_active ? '#16A34A' : '#E8192C' }} />
                {todayCode.is_active ? 'Active' : 'Deactivated'}
              </span>
            </div>

            {/* Deactivate button */}
            {todayCode.is_active && (
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                style={{
                  background: 'transparent', border: '1.5px solid #E8192C',
                  color: '#E8192C', borderRadius: 8, padding: '9px 20px',
                  cursor: 'pointer', fontWeight: 600, fontSize: 14,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  fontFamily: 'Inter, sans-serif', transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,25,44,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                id="deactivate-code-btn"
              >
                <ShieldOff size={16} />
                Deactivate Code
              </button>
            )}
          </div>
        ) : (
          /* ── Manual code entry form ── */
          <div style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
            <KeyRound size={40} color="#00AEEF" style={{ marginBottom: 12 }} />
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1B3A6B', margin: '0 0 6px' }}>
              Set Today's Authentication Code
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 24px' }}>
              Enter a 4-digit code to allow employee logins today.
            </p>

            <form onSubmit={handleSetCode}>
              {/* Progress Indicator */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
                {[0, 1, 2, 3].map(i => {
                  const filled = i < manualCode.length
                  return (
                    <div
                      key={i}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: filled ? '#00AEEF' : 'transparent',
                        border: `2px solid ${filled ? '#00AEEF' : '#D1D5DB'}`,
                        transform: filled ? 'scale(1.2)' : 'scale(1)',
                        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    />
                  )
                })}
              </div>

              {/* 4-digit input */}
              <div style={{ marginBottom: 24 }}>
                <input
                  id="manual-daily-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                  placeholder="Enter 4 digits"
                  value={manualCode}
                  onChange={e => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  disabled={settingCode}
                  className="input-field"
                  style={{
                    letterSpacing: '0.3em',
                    fontSize: 24,
                    fontWeight: 700,
                    textAlign: 'center',
                    maxWidth: 240,
                    margin: '0 auto'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={settingCode || manualCode.length !== 4}
                className="btn-primary"
                id="set-code-submit-btn"
                style={{ width: '100%', maxWidth: 240, margin: '0 auto', fontSize: 14 }}
              >
                {settingCode ? (
                  <><Loader2 size={15} style={{ animation: 'spin 0.7s linear infinite' }} /> Setting Code…</>
                ) : (
                  <><Check size={15} /> Set Today's Code</>
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Code History ── */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #DBEAFE' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Code History</h2>
        </div>

        {historyLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <LoadingSpinner size="md" />
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
            <Clock size={32} color="#DBEAFE" style={{ marginBottom: 8 }} />
            <p style={{ margin: 0 }}>No code history yet</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FBFF' }}>
                  {['Date', 'Code', 'Set By', 'Valid From', 'Valid Until', 'Status'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 12, fontWeight: 600, color: '#6B7280',
                      borderBottom: '1px solid #DBEAFE', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => {
                  const revealed = revealedRows.has(row.id)
                  const isPast = row.valid_date < todayStr
                  const isActive = row.is_active

                  return (
                    <tr
                      key={row.id ?? i}
                      style={{ borderBottom: '1px solid #F0F7FF' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FBFF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#1B3A6B', fontWeight: 500 }}>
                        {fmtDate(row.valid_date)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            fontSize: 16, fontWeight: 700, letterSpacing: '0.15em',
                            color: '#1B3A6B', fontFamily: 'monospace',
                          }}>
                            {revealed ? row.code : '••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleRowReveal(row.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', alignItems: 'center', padding: 2 }}
                          >
                            {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280' }}>
                        {row.generated_by ?? 'system'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {fmtDateTime(row.valid_from)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {fmtDateTime(row.valid_until)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
                          background: isPast 
                            ? 'rgba(107,114,128,0.1)' 
                            : isActive 
                              ? 'rgba(22,163,74,0.1)' 
                              : 'rgba(232,25,44,0.1)',
                          color: isPast 
                            ? '#6B7280' 
                            : isActive 
                              ? '#16A34A' 
                              : '#E8192C',
                        }}>
                          {isPast ? 'Expired' : isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm deactivate dialog */}
      {showConfirm && (
        <ConfirmDialog
          message="Are you sure? Employees will not be able to login until a new code is generated."
          onConfirm={handleDeactivate}
          onCancel={() => setShowConfirm(false)}
          loading={deactivating}
        />
      )}
    </div>
  )
}

