import { useState, useEffect, useRef } from 'react'
import {
  CheckCircle, AlertTriangle, Calendar, Loader2,
} from 'lucide-react'
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

// NOTE: Supabase requires unique constraint on
// (profile_id, submission_date) for upsert to work.
// This has been added to the database already.
// If upsert fails, check the constraint exists.

/* ── Helpers ─────────────────────────────────────────────────── */
const TODAY = new Date().toISOString().split('T')[0]

function fmtHistoryDate(d) {
  if (!d) return '—'
  try { return format(new Date(d + 'T00:00:00'), 'EEEE, d MMM yyyy') } catch { return d }
}

function fmtTime(ts) {
  if (!ts) return '—'
  try { return format(parseISO(ts), 'h:mm a') } catch { return '—' }
}
function fmtDate(d) {
  if (!d) return '—'
  try { return format(new Date(d + 'T00:00:00'), 'd MMM yyyy') } catch { return d }
}
function fmtDayName(d) {
  if (!d) return ''
  try { return format(new Date(d + 'T00:00:00'), 'EEEE') } catch { return '' }
}
function fmtShortDate(d) {
  if (!d) return ''
  try { return format(new Date(d + 'T00:00:00'), 'd MMM') } catch { return '' }
}
function fmtFullDate() {
  return format(new Date(), 'EEEE, d MMMM yyyy')
}
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/* Generate last-6-months option list */
function getLast6Months() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    return {
      value: d.toISOString().slice(0, 7), // "yyyy-MM"
      label: format(d, 'MMMM yyyy'),
    }
  })
}


/* ── Main Page ───────────────────────────────────────────────── */
export default function DailyWorkUpdate() {
  const { user } = useAuth()
  const formRef = useRef(null)

  // ── Today's submission state
  const [todaySubmission, setTodaySubmission] = useState(null)
  const [loadingToday, setLoadingToday] = useState(true)

  // ── Form state
  const [summary, setSummary] = useState('')
  const [issuesText, setIssuesText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── History state
  const MONTHS = getLast6Months()
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value)
  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => { if (user) { fetchToday(); fetchHistory() } }, [user])
  useEffect(() => { if (user) fetchHistory() }, [selectedMonth])

  /* ── Fetch today's submission ── */
  async function fetchToday() {
    setLoadingToday(true)
    try {
      const { data } = await supabase
        .from('daily_work_submissions')
        .select('id, work_description, created_at, issues_faced')
        .eq('profile_id', user.id)
        .eq('submission_date', TODAY)
        .maybeSingle()
      setTodaySubmission(data ?? null)
      if (data) {
        setSummary(data.work_description ?? '')
        setIssuesText(data.issues_faced ?? '')
      } else {
        setSummary('')
        setIssuesText('')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingToday(false)
    }
  }

  /* ── Fetch history for selected month ── */
  const fetchHistory = async (monthYear = selectedMonth) => {
    setLoadingHistory(true)
    try {
      const date = new Date(monthYear + '-01')
      const firstDay = new Date(
        date.getFullYear(), 
        date.getMonth(), 
        1
      ).toISOString().split('T')[0]
      
      const lastDay = new Date(
        date.getFullYear(), 
        date.getMonth() + 1, 
        0
      ).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('daily_work_submissions')
        .select('*')
        .eq('profile_id', user.id)
        .gte('submission_date', firstDay)
        .lte('submission_date', lastDay)
        .order('submission_date', { ascending: false })

      if (!error) setHistory(data ?? [])
    } finally {
      setLoadingHistory(false)
    }
  }

  /* ── Submit / Update ── */
  async function handleSubmit(e) {
    e.preventDefault()
    if (!summary.trim()) {
      toast.error('Please describe what you worked on today')
      return
    }

    setSubmitting(true)
    try {
      // Step 3: Upsert daily_work_submissions row
      const { error: upsertErr } = await supabase
        .from('daily_work_submissions')
        .upsert({
          profile_id: user.id,
          submission_date: TODAY,
          work_description: summary.trim(),
          issues_faced: issuesText.trim() || null,
          created_at: new Date().toISOString()
        }, { 
          onConflict: 'profile_id,submission_date'
        })

      if (upsertErr) throw upsertErr

      // Step 4: Toast
      toast.success(
        todaySubmission ? 'Submission updated successfully!' : 'Work submitted successfully!'
      )

      // Step 5 & 6: Refresh
      await fetchToday()
      await fetchHistory()
    } catch (err) {
      console.error(err)
      toast.error(err.message ?? 'Failed to submit work update')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Prefill form from a history row and scroll up ── */
  function prefillFromHistory(row) {
    setSummary(row.work_description ?? '')
    setIssuesText(row.issues_faced ?? '')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* ── Skeleton pulse style ── */
  const skeletonStyle = {
    background: '#E5E7EB', borderRadius: 6,
    animation: 'dwu-pulse 1.5s ease-in-out infinite',
  }

  return (
    <div className="fade-in">
      <style>{`
        @keyframes dwu-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>
          My Progress
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>
          Track and submit your daily work updates
        </p>
      </div>

      {/* ── Section 1: Today's Status Banner ── */}
      {loadingToday ? (
        <div style={{ ...skeletonStyle, height: 68, marginBottom: 20 }} />
      ) : todaySubmission ? (
        <div style={{
          background: '#F0FFF4', border: '1px solid #BBF7D0',
          borderRadius: 12, padding: 16, marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <CheckCircle size={20} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#16A34A', margin: 0 }}>
              Today's work submitted at {fmtTime(todaySubmission.created_at)}
            </p>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '3px 0 0' }}>
              You can update your submission below
            </p>
          </div>
        </div>
      ) : (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A',
          borderRadius: 12, padding: 16, marginBottom: 20,
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <AlertTriangle size={20} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#D97706', margin: 0 }}>
              You haven't submitted today's work yet
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>
              Please submit before logging out
            </p>
          </div>
        </div>
      )}

      {/* ── Section 2: Submit / Update Form ── */}
      <div
        ref={formRef}
        style={{
          background: '#FFFFFF', borderRadius: 16,
          border: '1px solid #DBEAFE',
          boxShadow: '0 2px 8px rgba(0,174,239,0.06)',
          padding: 24, marginBottom: 28,
        }}
      >
        {/* Card title row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 8,
        }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1B3A6B', margin: 0 }}>
              Today's Work Update
            </h2>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>
              {fmtFullDate()}
            </p>
          </div>
          {todaySubmission && (
            <span style={{ fontSize: 12, color: '#00AEEF', fontWeight: 500 }}>
              Update Submission
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Work Summary */}
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="work-summary"
              style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}
            >
              What did you work on today? <span style={{ color: '#E8192C' }}>*</span>
            </label>
            <textarea
              id="work-summary"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Describe your work, tasks completed, progress made..."
              className="input-field"
              rows={4}
              maxLength={1000}
              style={{
                resize: 'vertical', minHeight: 110,
                lineHeight: 1.6, fontFamily: 'Inter, sans-serif',
              }}
            />
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9CA3AF', textAlign: 'right' }}>
              {summary.length} / 1000
            </p>
          </div>

          {/* Issues Faced (optional) */}
          <div style={{ marginBottom: 24 }}>
            <label
              htmlFor="issues-faced"
              style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1B3A6B', marginBottom: 6 }}
            >
              Issues Faced <span style={{ color: '#9CA3AF', fontWeight: 400, fontSize: 12 }}>(optional)</span>
            </label>
            <textarea
              id="issues-faced"
              value={issuesText}
              onChange={e => setIssuesText(e.target.value)}
              placeholder="Any blockers or issues you faced today..."
              className="input-field"
              rows={2}
              style={{
                resize: 'vertical', minHeight: 60,
                lineHeight: 1.6, fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>

          {/* NOTE FOR FUTURE: When logout button is pressed,
              check if today's work has been submitted.
              If not, redirect here before allowing logout.
              This will be implemented in a separate prompt. */}
          <button
            type="submit"
            disabled={submitting || !summary.trim()}
            id="submit-work-btn"
            style={{
              width: '100%', padding: '12px 0',
              background: todaySubmission ? '#1B3A6B' : '#00AEEF',
              color: '#FFFFFF', border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: (!summary.trim() || submitting) ? 0.7 : 1,
              transition: 'opacity 0.15s, background 0.15s',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
                Submitting...
              </>
            ) : todaySubmission ? (
              'Update Submission'
            ) : (
              'Submit Today\'s Work'
            )}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </form>
      </div>

      {/* ── Section 3: History Table ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: 16,
        border: '1px solid #DBEAFE',
        boxShadow: '0 2px 8px rgba(0,174,239,0.06)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #DBEAFE',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>
              My Submission History
            </h2>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: '3px 0 0' }}>
              All your work submissions this month
            </p>
          </div>
          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{
              padding: '7px 12px', fontSize: 13, fontWeight: 500,
              color: '#1B3A6B', border: '1.5px solid #DBEAFE',
              borderRadius: 8, background: '#FFFFFF', outline: 'none',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
            id="history-month-select"
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Table content */}
        {loadingHistory ? (
          <div style={{ padding: '24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ ...skeletonStyle, height: 52 }} />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div style={{
            padding: '60px 24px', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <Calendar size={48} color="#D1D5DB" />
            <p style={{ fontSize: 15, fontWeight: 600, color: '#6B7280', margin: 0 }}>
              No submissions this month
            </p>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              Start by submitting today's work above
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ background: '#F8FBFF' }}>
                  {['DATE', 'WORK DESCRIPTION', 'ISSUES', 'STATUS', 'SUBMITTED AT'].map(h => (
                    <th key={h} style={{
                      padding: '11px 20px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: '#93C5FD',
                      borderBottom: '1px solid #DBEAFE', letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => {
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: i < history.length - 1 ? '1px solid #F0F7FF' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FBFF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Date */}
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1B3A6B' }}>
                          {fmtHistoryDate(row.submission_date)}
                        </span>
                      </td>

                      {/* Work Description */}
                      <td style={{ padding: '14px 20px', maxWidth: 280 }}>
                        {row.work_description ? (
                          <span
                            title={row.work_description}
                            style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}
                          >
                            {row.work_description.length > 100
                              ? row.work_description.slice(0, 100) + '...'
                              : row.work_description}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: '#9CA3AF' }}>—</span>
                        )}
                      </td>

                      {/* Issues Faced */}
                      <td style={{ padding: '14px 20px', maxWidth: 200 }}>
                        {row.issues_faced ? (
                          <span
                            title={row.issues_faced}
                            style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}
                          >
                            {row.issues_faced.length > 60
                              ? row.issues_faced.slice(0, 60) + '...'
                              : row.issues_faced}
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, color: '#9CA3AF' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: '#DCFCE7', color: '#16A34A',
                          fontSize: 12, borderRadius: 9999, padding: '4px 8px', fontWeight: 600,
                        }}>
                          <CheckCircle size={11} />
                          Submitted
                        </span>
                      </td>

                      {/* Submitted At */}
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 14, color: '#6B7280' }}>
                          {fmtTime(row.created_at)}
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
    </div>
  )
}
