import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight, ClipboardList, X, AlertCircle, Info } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

const PAGE_SIZE = 20

/* ── Action badge config ─────────────────────────────────────── */
const ACTION_STYLES = {
  employee_created:       { label: 'Employee Created',    bg: 'rgba(0,174,239,0.1)',    color: '#00AEEF' },
  employee_deleted:       { label: 'Employee Deleted',    bg: 'rgba(232,25,44,0.1)',    color: '#E8192C' },
  employee_updated:       { label: 'Employee Updated',    bg: 'rgba(245,158,11,0.1)',   color: '#D97706' },
  password_reset:         { label: 'Password Reset',      bg: 'rgba(249,115,22,0.1)',   color: '#EA580C' },
  daily_code_generated:   { label: 'Code Generated',      bg: 'rgba(22,163,74,0.1)',    color: '#16A34A' },
  daily_code_deactivated: { label: 'Code Deactivated',    bg: 'rgba(107,114,128,0.12)', color: '#6B7280' },
  export_generated:       { label: 'Export Generated',    bg: 'rgba(139,92,246,0.1)',   color: '#7C3AED' },
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  ...Object.entries(ACTION_STYLES).map(([v, s]) => ({ value: v, label: s.label })),
]

function ActionBadge({ type }) {
  const s = ACTION_STYLES[type] ?? { label: type, bg: 'rgba(0,174,239,0.1)', color: '#00AEEF' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 9999,
      fontSize: 12, fontWeight: 600, background: s.bg, color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

/* ── Parse JSONB details into readable text ──────────────────── */
function DetailsCell({ details }) {
  if (!details || typeof details !== 'object') return <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>

  const entries = Object.entries(details).slice(0, 4)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {entries.map(([k, v]) => (
        <span key={k} style={{ fontSize: 11, color: '#6B7280' }}>
          <span style={{ fontWeight: 600, color: '#1B3A6B', textTransform: 'capitalize' }}>
            {k.replace(/_/g, ' ')}:
          </span>{' '}
          {String(v ?? '—')}
        </span>
      ))}
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────────────── */
function fmtDateTime(ts) {
  if (!ts) return '—'
  try { return format(parseISO(ts), 'd MMM yyyy, h:mm a') } catch { return ts }
}

export default function AuditLog() {
  const [rows,        setRows]        = useState([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  // Filters
  const [search,      setSearch]      = useState('')
  const [actionType,  setActionType]  = useState('')
  const [fromDate,    setFromDate]    = useState('')
  const [toDate,      setToDate]      = useState('')

  const fetchLogs = useCallback(async (pg = 0) => {
    setLoading(true)
    setError('')
    try {
      let query = supabase
        .from('admin_audit_log')
        .select(`
          id, action_type, action_details, created_at,
          admin_employee_id,
          admin:profiles!admin_id(full_name, employee_id),
          target:profiles!target_profile_id(full_name, employee_id)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1)

      if (actionType)  query = query.eq('action_type', actionType)
      if (fromDate)    query = query.gte('created_at', `${fromDate}T00:00:00.000Z`)
      if (toDate)      query = query.lte('created_at', `${toDate}T23:59:59.999Z`)
      if (search.trim()) {
        query = query.or(
          `target_employee_id.ilike.%${search.trim()}%,admin_employee_id.ilike.%${search.trim()}%`
        )
      }

      const { data, count, error: fetchErr } = await query
      if (fetchErr) throw fetchErr

      setRows(data ?? [])
      setTotal(count ?? 0)
      setPage(pg)
    } catch (err) {
      setError(err.message ?? 'Failed to load audit log.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search, actionType, fromDate, toDate])

  useEffect(() => { fetchLogs(0) }, [fetchLogs])

  function handleClearFilters() {
    setSearch('')
    setActionType('')
    setFromDate('')
    setToDate('')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const hasFilters = search || actionType || fromDate || toDate

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Admin Audit Log</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>
          Complete record of all admin actions
        </p>
      </div>

      {/* Info banner */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #DBEAFE',
        borderRadius: 8, padding: '10px 14px', marginBottom: 20,
        display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#1B3A6B',
      }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 1, color: '#00AEEF' }} />
        This log is read-only and cannot be modified. All admin actions are recorded automatically.
      </div>

      {/* ── Filters ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,174,239,0.08)',
        padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Search */}
          <div style={{ flex: '1 1 200px', position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                id="audit-search"
                type="text"
                placeholder="Employee ID or Admin ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field"
                style={{ paddingLeft: 32, fontSize: 13 }}
              />
            </div>
          </div>

          {/* Action type */}
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>Action Type</label>
            <select
              id="audit-action-filter"
              value={actionType}
              onChange={e => setActionType(e.target.value)}
              className="input-field"
              style={{ fontSize: 13 }}
            >
              {ACTION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* From date */}
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>From Date</label>
            <input
              id="audit-from-date"
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="input-field"
              style={{ fontSize: 13 }}
            />
          </div>

          {/* To date */}
          <div style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>To Date</label>
            <input
              id="audit-to-date"
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="input-field"
              style={{ fontSize: 13 }}
            />
          </div>

          {/* Clear */}
          {hasFilters && (
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 5, opacity: 0 }}>x</label>
              <button
                onClick={handleClearFilters}
                className="btn-secondary"
                style={{ fontSize: 13, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                id="clear-filters-btn"
              >
                <X size={13} />
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: 'rgba(232,25,44,0.06)', border: '1px solid rgba(232,25,44,0.2)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8, color: '#E8192C', fontSize: 13,
        }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>
            Audit Entries{!loading && <span style={{ fontWeight: 400, color: '#6B7280', fontSize: 13 }}> — {total} records</span>}
          </h2>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <LoadingSpinner size="md" />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center' }}>
            <ClipboardList size={40} color="#DBEAFE" style={{ marginBottom: 12 }} />
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#1B3A6B' }}>
              No audit log entries found
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>
              {hasFilters ? 'Try adjusting your filters' : 'Admin actions will appear here'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FBFF' }}>
                  {['Timestamp', 'Admin', 'Action', 'Target Employee', 'Details'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 12, fontWeight: 600, color: '#6B7280',
                      borderBottom: '1px solid #DBEAFE', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id ?? i}
                    style={{ borderBottom: '1px solid #F0F7FF' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FBFF'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                      {fmtDateTime(row.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1B3A6B' }}>
                        {row.admin?.full_name ?? 'Unknown Admin'}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>
                        {row.admin_employee_id ?? row.admin?.employee_id ?? '—'}
                      </p>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <ActionBadge type={row.action_type} />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {row.target ? (
                        <>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1B3A6B' }}>
                            {row.target.full_name}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>
                            {row.target.employee_id}
                          </p>
                        </>
                      ) : (
                        <span style={{ color: '#9CA3AF', fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', maxWidth: 280 }}>
                      <DetailsCell details={row.action_details} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid #DBEAFE',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
              Page {page + 1} of {totalPages} ({total} total)
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => fetchLogs(page - 1)}
                disabled={page === 0 || loading}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                id="audit-prev-page"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => fetchLogs(page + 1)}
                disabled={page >= totalPages - 1 || loading}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                id="audit-next-page"
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
