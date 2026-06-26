import { useState, useEffect, useCallback } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Filter,
  X, AlertCircle, History,
} from 'lucide-react'
import { format, parseISO, getMonth, getYear } from 'date-fns'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

const PAGE_SIZE = 15

/* ── build last-12-months options ─────────────────────────────── */
function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    options.push({
      label: format(d, 'MMMM yyyy'),
      month: d.getMonth(),
      year:  d.getFullYear(),
    })
  }
  return options
}

/* ── format duration from minutes ────────────────────────────── */
function fmtDuration(mins) {
  if (mins == null) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} mins`
  if (m === 0) return `${h} hrs`
  return `${h} hrs ${m} mins`
}

function fmtTime(ts) {
  if (!ts) return '—'
  try { return format(parseISO(ts), 'h:mm a') } catch { return ts }
}

// Create this ONCE, outside the component
const MONTH_OPTIONS = getMonthOptions()

export default function EmployeeHistory() {
  const { user } = useAuth()
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0)
  const [statusFilter, setStatusFilter]         = useState('')
  const [page, setPage]                         = useState(0)

  const [rows, setRows]                 = useState([])
  const [total, setTotal]               = useState(0)
  const [loading, setLoading]           = useState(true)

  // Summary stats (all-time, unfiltered by month)
  const [summary, setSummary]           = useState({ sessions: 0, days: 0, hours: 0 })
  const [summaryLoading, setSummaryLoading] = useState(true)

  const selectedMonth = MONTH_OPTIONS[selectedMonthIdx].month
  const selectedYear = MONTH_OPTIONS[selectedMonthIdx].year

  /* ── Fetch summary stats (all-time) ── */
  useEffect(() => {
    if (!user) return
    async function fetchSummary() {
      setSummaryLoading(true)
      const { data } = await supabase
        .from('login_history')
        .select('id, login_at, hours_worked, status, event_type')
        .eq('profile_id', user.id)
        .eq('status', 'success')
        .in('event_type', ['login', 'qr_scan'])

      const sessions = data?.length ?? 0
      const uniqueDays = new Set((data ?? []).map(r => {
        try { return format(parseISO(r.login_at), 'yyyy-MM-dd') } catch { return null }
      }).filter(Boolean)).size
      const hours = (data ?? []).reduce((acc, r) => acc + parseFloat(r.hours_worked ?? 0), 0)

      setSummary({ sessions, days: uniqueDays, hours: hours.toFixed(2) })
      setSummaryLoading(false)
    }
    fetchSummary()
  }, [user])

  /* ── Fetch paginated rows with filters ── */
  const fetchRows = useCallback(async (pg = 0) => {
    if (!user) return
    setLoading(true)

    const fromDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01T00:00:00.000Z`
    const toMonth  = new Date(selectedYear, selectedMonth + 1, 0)
    const toDate   = `${format(toMonth, 'yyyy-MM-dd')}T23:59:59.999Z`

    let q = supabase
      .from('login_history')
      .select('id, login_at, logout_at, session_duration_minutes, hours_worked, status, event_type', { count: 'exact' })
      .eq('profile_id', user.id)
      .gte('login_at', fromDate)
      .lte('login_at', toDate)
      .order('login_at', { ascending: false })
      .range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1)

    if (statusFilter) q = q.eq('status', statusFilter)

    const { data, count, error } = await q
    if (error) console.error(error)

    setRows(data ?? [])
    setTotal(count ?? 0)
    setPage(pg)
    setLoading(false)
  }, [user, selectedMonth, selectedYear, statusFilter])

  useEffect(() => { fetchRows(0) }, [fetchRows])

  const hasFilters  = statusFilter !== ''
  const totalPages  = Math.ceil(total / PAGE_SIZE)
  const startRecord = page * PAGE_SIZE + 1
  const endRecord   = Math.min((page + 1) * PAGE_SIZE, total)

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Login History</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>
          Your complete attendance and session records
        </p>
      </div>

      {/* ── Summary strip ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,174,239,0.08)',
        padding: '16px 24px', marginBottom: 16,
        display: 'flex', gap: 0, flexWrap: 'wrap',
      }}>
        {[
          { label: 'Total Sessions',    val: summaryLoading ? '…' : summary.sessions },
          { label: 'Total Days Present',val: summaryLoading ? '…' : summary.days },
          { label: 'Total Hours Logged',val: summaryLoading ? '…' : `${summary.hours} hrs` },
        ].map(({ label, val }, i, arr) => (
          <div
            key={label}
            style={{
              flex: 1, minWidth: 120, textAlign: 'center',
              padding: '4px 16px',
              borderRight: i < arr.length - 1 ? '1px solid #DBEAFE' : 'none',
            }}
          >
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1B3A6B' }}>{val}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,174,239,0.08)',
        padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>Month</label>
            <select
              id="history-month-filter"
              value={selectedMonthIdx}
              onChange={e => setSelectedMonthIdx(Number(e.target.value))}
              className="input-field"
              style={{ fontSize: 13 }}
            >
              {MONTH_OPTIONS.map((opt, i) => (
                <option key={i} value={i}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>Status</label>
            <select
              id="history-status-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input-field"
              style={{ fontSize: 13 }}
            >
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {hasFilters && (
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 5, opacity: 0 }}>x</label>
              <button
                onClick={() => setStatusFilter('')}
                className="btn-secondary"
                style={{ fontSize: 13, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                id="clear-history-filter"
              >
                <X size={13} /> Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1B3A6B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={15} color="#00AEEF" />
            {MONTH_OPTIONS[selectedMonthIdx].label}
          </h2>
          {!loading && total > 0 && (
            <span style={{ fontSize: 12, color: '#6B7280' }}>
              Showing {startRecord}–{endRecord} of {total} records
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <LoadingSpinner size="md" />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Calendar size={48} color="#DBEAFE" style={{ marginBottom: 16 }} />
            <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: '#1B3A6B' }}>
              No records found
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>
              Your login history will appear here once you start logging in
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FBFF' }}>
                  {['Date', 'Login Time', 'Logout Time', 'Duration', 'Hours Worked', 'Status'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 12, fontWeight: 600, color: '#6B7280',
                      borderBottom: '1px solid #DBEAFE', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isActive = !row.logout_at
                  return (
                    <tr
                      key={row.id ?? i}
                      style={{ borderBottom: '1px solid #F0F7FF', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Date */}
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 500, color: '#1B3A6B', whiteSpace: 'nowrap' }}>
                        {row.login_at ? format(parseISO(row.login_at), 'EEEE, d MMM yyyy') : '—'}
                      </td>

                      {/* Login Time */}
                      <td style={{ padding: '13px 16px', fontSize: 12, color: '#6B7280' }}>
                        {fmtTime(row.login_at)}
                      </td>

                      {/* Logout Time */}
                      <td style={{ padding: '13px 16px', fontSize: 12 }}>
                        {isActive
                          ? <span style={{
                              background: 'rgba(22,163,74,0.1)', color: '#16A34A',
                              padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                            }}>Active Session</span>
                          : <span style={{ color: '#6B7280' }}>{fmtTime(row.logout_at)}</span>
                        }
                      </td>

                      {/* Duration */}
                      <td style={{ padding: '13px 16px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {fmtDuration(row.session_duration_minutes)}
                      </td>

                      {/* Hours */}
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 600, color: '#1B3A6B', whiteSpace: 'nowrap' }}>
                        {row.hours_worked != null ? `${parseFloat(row.hours_worked).toFixed(2)} hrs` : '—'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '13px 16px' }}>
                        {row.status === 'success'
                          ? <span className="badge badge-green">Success</span>
                          : row.status === 'expired'
                          ? <span className="badge" style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316', fontWeight: 600, padding: '0.2rem 0.625rem', borderRadius: 9999, fontSize: 12 }}>Expired</span>
                          : <span className="badge badge-red">Failed</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid #DBEAFE',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              {total > 0 ? `Showing ${startRecord}–${endRecord} of ${total} records` : ''}
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => fetchRows(page - 1)}
                disabled={page === 0 || loading}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                id="history-prev-page"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pg = page < 3 ? i : Math.min(page - 2 + i, totalPages - 1)
                return (
                  <button
                    key={pg}
                    onClick={() => fetchRows(pg)}
                    disabled={loading}
                    style={{
                      padding: '6px 10px', fontSize: 13, fontWeight: 600,
                      border: '1.5px solid', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      background: pg === page ? '#00AEEF' : 'transparent',
                      color:      pg === page ? '#FFFFFF'  : '#00AEEF',
                      borderColor: '#00AEEF',
                    }}
                  >
                    {pg + 1}
                  </button>
                )
              })}
              <button
                onClick={() => fetchRows(page + 1)}
                disabled={page >= totalPages - 1 || loading}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                id="history-next-page"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
