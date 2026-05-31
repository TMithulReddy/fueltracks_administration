import { useState, useEffect, useCallback } from 'react'
import {
  Search, ChevronLeft, ChevronRight, FileText, X,
  AlertCircle, Calendar, Clock, Eye, Users, ClipboardCheck, TrendingUp, Paperclip, ChevronDown
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

/* ── Format helpers ──────────────────────────────────────────── */
function fmtDateTime(ts) {
  if (!ts) return '—'
  try { return format(parseISO(ts), 'h:mm a') } catch { return ts }
}
function fmtDate(d) {
  if (!d) return '—'
  try { return format(new Date(d + 'T00:00:00'), 'd MMM yyyy') } catch { return d }
}
function getInitials(name) {
  if (!name) return '??'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

/* ── Detail Modal ────────────────────────────────────────────── */
function DetailModal({ submission, onClose }) {
  if (!submission) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(27, 58, 107, 0.4)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', zIndex: 101,
        background: '#FFFFFF', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(27, 58, 107, 0.15)',
        width: '90%', maxWidth: 600, maxHeight: '85vh',
        overflow: 'hidden', animation: 'fadeIn 0.25s ease',
        border: '1px solid #DBEAFE',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #DBEAFE',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1B3A6B' }}>
              Work Update Details
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>
              {submission.profile?.full_name} · {submission.profile?.employee_id}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid #DBEAFE', background: '#F8FBFF',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            id="close-detail-modal-btn"
          >
            <X size={16} color="#6B7280" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', maxHeight: 'calc(85vh - 80px)' }}>
          <div style={{
            display: 'flex', gap: 16, marginBottom: 20,
            flexWrap: 'wrap',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: '#6B7280', background: '#F0F7FF',
              padding: '4px 10px', borderRadius: 8,
            }}>
              <Calendar size={13} color="#00AEEF" />
              Date: <strong style={{ color: '#1B3A6B' }}>{fmtDate(submission.submission_date)}</strong>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: '#6B7280', background: '#F0F7FF',
              padding: '4px 10px', borderRadius: 8,
            }}>
              <Clock size={13} color="#00AEEF" />
              Submitted: <strong style={{ color: '#1B3A6B' }}>{format(parseISO(submission.created_at), 'd MMM yyyy, h:mm a')}</strong>
            </div>
          </div>

          {/* Work Description */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 8 }}>
              Work Description
            </label>
            <div style={{
              background: '#F8FBFF', borderRadius: 8, padding: '16px 18px',
              fontSize: 14, color: '#1B3A6B', lineHeight: 1.7,
              border: '1px solid #DBEAFE', whiteSpace: 'pre-wrap',
            }}>
              {submission.work_description || '—'}
            </div>
          </div>

          {/* Issues */}
          {submission.issues_faced && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 8 }}>
                Issues / Blockers
              </label>
              <div style={{
                background: '#FFF7ED', borderRadius: 8, padding: '16px 18px',
                fontSize: 14, color: '#92400E', lineHeight: 1.7,
                border: '1px solid #FED7AA', whiteSpace: 'pre-wrap',
              }}>
                {submission.issues_faced}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ── Stat Card Component ──────────────────────────────────────── */
function StatCard({ icon, count, label, borderColor, iconColor, iconBg }) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 16,
      borderTop: `4px solid ${borderColor}`,
      padding: '24px',
      flex: 1,
      minWidth: '220px',
      boxShadow: '0 4px 20px rgba(0, 174, 239, 0.04)',
      borderLeft: '1px solid #F0F7FF',
      borderRight: '1px solid #F0F7FF',
      borderBottom: '1px solid #F0F7FF',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#1B3A6B', lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500, marginTop: 6 }}>{label}</div>
      </div>
    </div>
  )
}

/* ── EmployeeProgress Page ───────────────────────────────────── */
export default function EmployeeProgress() {
  // Filters & State
  const [search, setSearch]     = useState('')
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage]         = useState(0)

  // DB Data
  const [submissions, setSubmissions] = useState([])
  const [employees, setEmployees]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  // Detail Modal
  const [selectedSub, setSelectedSub] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // 1. Fetch active employees to calculate stats properly
      const { data: emps, error: empErr } = await supabase
        .from('profiles')
        .select('id, full_name, employee_id, avatar_url, role')
        .eq('role', 'employee')
        .eq('is_active', true)

      if (empErr) throw empErr
      setEmployees(emps ?? [])

      // 2. Fetch submissions for the selected date
      const { data: subs, error: subsErr } = await supabase
        .from('daily_work_submissions')
        .select(`
          id, work_description, issues_faced, submission_date, created_at,
          profile:profiles!profile_id(id, full_name, employee_id, role, avatar_url)
        `)
        .eq('submission_date', selectedDate)
        .order('created_at', { ascending: false })

      if (subsErr) throw subsErr
      // Filter just in case
      const empSubs = (subs ?? []).filter(s => s.profile?.role === 'employee')
      setSubmissions(empSubs)
    } catch (err) {
      console.error(err)
      setError(err.message ?? 'Failed to load progress data.')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Compute stat counts
  const totalEmployeesCount = employees.length
  
  // Submitted Today: Unique profile_ids that submitted work on selectedDate
  const submittedTodayCount = new Set(submissions.map(s => s.profile?.id)).size
  
  // Pending Today
  const pendingTodayCount = Math.max(0, totalEmployeesCount - submittedTodayCount)

  // Apply search query filter
  const filteredSubmissions = submissions.filter(sub => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      sub.profile?.full_name?.toLowerCase().includes(q) ||
      sub.profile?.employee_id?.toLowerCase().includes(q) ||
      sub.work_description?.toLowerCase().includes(q)
    )
  })

  const filteredCount = filteredSubmissions.length

  // Pagination slicing
  const totalPages = Math.ceil(filteredCount / pageSize)
  const paginatedRows = filteredSubmissions.slice(page * pageSize, (page + 1) * pageSize)

  // Display label for selected date
  const displayDateStr = () => {
    try {
      return format(parseISO(selectedDate), 'MMMM d, yyyy')
    } catch {
      return selectedDate
    }
  }

  return (
    <div className="fade-in">
      {/* ── Page Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>
            Work Submissions
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0', fontWeight: 500 }}>
            Review daily work summaries and attachments submitted by employees
          </p>
        </div>

        {/* Date Selector & Search Input */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Date Picker Input Container */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Calendar size={16} color="#6B7280" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
            <input
              type="date"
              value={selectedDate}
              onChange={e => {
                setSelectedDate(e.target.value)
                setPage(0)
              }}
              style={{
                padding: '10px 14px 10px 36px',
                fontSize: 14,
                fontWeight: 600,
                color: '#1B3A6B',
                border: '1.5px solid #DBEAFE',
                borderRadius: 12,
                background: '#FFFFFF',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 2px 8px rgba(0, 174, 239, 0.02)',
              }}
            />
          </div>

          {/* Search Input Container */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 260 }}>
            <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search name, ID, or description..."
              value={search}
              onChange={e => {
                setSearch(e.target.value)
                setPage(0)
              }}
              style={{
                width: '100%',
                padding: '10px 14px 10px 36px',
                fontSize: 14,
                color: '#1B3A6B',
                border: '1.5px solid #DBEAFE',
                borderRadius: 12,
                background: '#FFFFFF',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 2px 8px rgba(0, 174, 239, 0.02)',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Stat Cards Row ── */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}>
        <StatCard
          icon={<Users size={20} color="#00AEEF" />}
          count={loading ? '…' : totalEmployeesCount}
          label="Total Employees"
          borderColor="#00AEEF"
          iconBg="rgba(0,174,239,0.08)"
        />
        <StatCard
          icon={<ClipboardCheck size={20} color="#16A34A" />}
          count={loading ? '…' : submittedTodayCount}
          label="Submitted Today"
          borderColor="#16A34A"
          iconBg="rgba(22,163,74,0.08)"
        />
        <StatCard
          icon={<AlertCircle size={20} color="#E8192C" />}
          count={loading ? '…' : pendingTodayCount}
          label="Pending Today"
          borderColor="#E8192C"
          iconBg="rgba(232,25,44,0.08)"
        />
        <StatCard
          icon={<TrendingUp size={20} color="#1B3A6B" />}
          count={loading ? '…' : filteredCount}
          label="Filtered Submissions"
          borderColor="#1B3A6B"
          iconBg="rgba(27,58,107,0.08)"
        />
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          background: 'rgba(232,25,44,0.06)', border: '1px solid rgba(232,25,44,0.2)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8, color: '#E8192C', fontSize: 13,
        }}>
          <AlertCircle size={15} />{error}
        </div>
      )}

      {/* ── Main Submissions Table Card ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        boxShadow: '0 4px 20px rgba(0,174,239,0.06)',
        border: '1px solid #DBEAFE',
        overflow: 'hidden',
      }}>
        {/* Table Title and Control Line */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #DBEAFE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>
            Submissions for <span style={{ color: '#00AEEF' }}>{displayDateStr()}</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Rows Select Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Rows:</span>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value))
                    setPage(0)
                  }}
                  style={{
                    appearance: 'none',
                    padding: '6px 28px 6px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1B3A6B',
                    background: '#FFFFFF',
                    border: '1.5px solid #DBEAFE',
                    borderRadius: 8,
                    cursor: 'pointer',
                    outline: 'none',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
                <ChevronDown size={14} color="#1B3A6B" style={{ position: 'absolute', right: 8, pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Record Count Badge */}
            <span style={{
              background: '#E0F2FE',
              color: '#0369A1',
              fontSize: 12,
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 9999,
            }}>
              {filteredCount} {filteredCount === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <LoadingSpinner size="md" />
          </div>
        ) : paginatedRows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <FileText size={44} color="#DBEAFE" style={{ marginBottom: 12, display: 'inline-block' }} />
            <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#1B3A6B' }}>
              No work submissions found
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>
              {hasFilters ? 'Try adjusting your filters' : 'Employee work updates for this day will appear here'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ background: '#F8FBFF' }}>
                  {['EMPLOYEE ID', 'EMPLOYEE NAME', 'DATE', 'WORK DESCRIPTION', 'SUBMITTED TIME', 'FILES', 'STATUS'].map(h => (
                    <th key={h} style={{
                      padding: '12px 24px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: '#93C5FD',
                      borderBottom: '1px solid #DBEAFE', letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, i) => {
                  const initials = getInitials(row.profile?.full_name);
                  // Generate an avatar color based on name length or static list
                  const colors = ['#00AEEF', '#16A34A', '#7C3AED', '#EA580C', '#EC4899', '#14B8A6'];
                  const color = colors[row.profile?.full_name?.length % colors.length] || '#00AEEF';

                  return (
                    <tr
                      key={row.id ?? i}
                      style={{ borderBottom: '1px solid #F0F7FF', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FBFF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Employee ID */}
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600, color: '#1B3A6B',
                          background: '#F0F7FF', padding: '4px 10px', borderRadius: 8,
                          border: '1.5px solid #DBEAFE',
                          fontFamily: 'monospace',
                        }}>
                          {row.profile?.employee_id ?? '—'}
                        </span>
                      </td>

                      {/* Employee Name with Avatar */}
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {row.profile?.avatar_url ? (
                            <img
                              src={row.profile.avatar_url}
                              alt={row.profile.full_name}
                              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: color, color: '#FFFFFF',
                              fontSize: 12, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {initials}
                            </div>
                          )}
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#1B3A6B' }}>
                            {row.profile?.full_name ?? '—'}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '16px 24px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {fmtDate(row.submission_date)}
                      </td>

                      {/* Work Description with Details Button */}
                      <td style={{ padding: '16px 24px', maxWidth: 350 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 13, color: '#4B5563', lineHeight: 1.5,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: 180, display: 'inline-block',
                          }}>
                            {row.work_description || '—'}
                          </span>
                          <button
                            onClick={() => setSelectedSub(row)}
                            style={{
                              border: 'none', background: 'none', padding: 0,
                              color: '#00AEEF', fontSize: 13, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                            }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            id={`view-detail-${row.id}`}
                          >
                            Details
                          </button>
                        </div>
                      </td>

                      {/* Submitted Time */}
                      <td style={{ padding: '16px 24px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} color="#9CA3AF" />
                          <span>{fmtDateTime(row.created_at)}</span>
                        </div>
                      </td>

                      {/* Files */}
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 12, fontWeight: 600, color: '#9CA3AF',
                          background: '#F3F4F6', padding: '4px 10px', borderRadius: 9999,
                        }}>
                          <Paperclip size={12} />
                          0
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 12, fontWeight: 600, color: '#16A34A',
                          background: '#DCFCE7', padding: '4px 12px', borderRadius: 9999,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
                          Submitted
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Table Footer / Pagination ── */}
        {!loading && filteredCount > 0 && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #DBEAFE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280', fontWeight: 500 }}>
              Showing{' '}
              <strong>
                {filteredCount === 0 ? 0 : page * pageSize + 1}-
                {Math.min(filteredCount, (page + 1) * pageSize)}
              </strong>{' '}
              of <strong>{filteredCount}</strong> {filteredCount === 1 ? 'record' : 'records'}
            </p>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-secondary"
                  style={{
                    padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
                    borderColor: '#DBEAFE', color: '#1B3A6B', height: 36, borderRadius: 8,
                  }}
                  id="progress-prev-page"
                >
                  &lt; Prev
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      border: i === page ? 'none' : '1.5px solid #DBEAFE',
                      background: i === page ? '#00AEEF' : '#FFFFFF',
                      color: i === page ? '#FFFFFF' : '#1B3A6B',
                      fontSize: 13, fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Inter, sans-serif',
                      transition: 'all 0.15s',
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="btn-secondary"
                  style={{
                    padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
                    borderColor: '#DBEAFE', color: '#1B3A6B', height: 36, borderRadius: 8,
                  }}
                  id="progress-next-page"
                >
                  Next &gt;
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedSub && (
        <DetailModal submission={selectedSub} onClose={() => setSelectedSub(null)} />
      )}
    </div>
  )
}
