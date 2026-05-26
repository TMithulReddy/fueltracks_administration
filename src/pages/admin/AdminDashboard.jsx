import { useEffect, useState, useCallback } from 'react'
import { Users, Wifi, LogIn, KeyRound, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import Avatar from '../../components/shared/Avatar'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

/* ── Stat Card ───────────────────────────────────────────────── */
function StatCard({ icon, iconColor, iconBg, value, label, loading, isStatus, statusGreen }) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 12,
      boxShadow: '0 2px 12px rgba(0,174,239,0.08)',
      padding: 24, flex: 1,
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div style={{ height: 36, background: '#F0F7FF', borderRadius: 6, marginBottom: 8, width: '60%' }} />
      ) : isStatus ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 9999, marginBottom: 4,
          fontSize: 15, fontWeight: 700,
          background: statusGreen ? 'rgba(22,163,74,0.1)' : 'rgba(232,25,44,0.1)',
          color: statusGreen ? '#16A34A' : '#E8192C',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusGreen ? '#16A34A' : '#E8192C', display: 'inline-block' }} />
          {value}
        </div>
      ) : (
        <div style={{ fontSize: 32, fontWeight: 700, color: '#1B3A6B', marginBottom: 4 }}>{value}</div>
      )}
      <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{label}</div>
    </div>
  )
}

/* ── Event Badge ─────────────────────────────────────────────── */
function EventBadge({ type }) {
  const map = {
    login:          { label: 'Login',   bg: 'rgba(22,163,74,0.1)',   color: '#16A34A' },
    logout:         { label: 'Logout',  bg: 'rgba(107,114,128,0.1)', color: '#6B7280' },
    failed_attempt: { label: 'Failed',  bg: 'rgba(232,25,44,0.1)',   color: '#E8192C' },
  }
  const style = map[type] ?? { label: type, bg: 'rgba(0,174,239,0.1)', color: '#00AEEF' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 9999,
      fontSize: 12, fontWeight: 600,
      background: style.bg, color: style.color,
    }}>
      {style.label}
    </span>
  )
}

/* ── Status Dot ──────────────────────────────────────────────── */
function StatusDot({ success }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: success ? '#16A34A' : '#E8192C',
    }} />
  )
}

/* ── Format date ─────────────────────────────────────────────── */
function fmtTime(ts) {
  if (!ts) return '—'
  try { return format(parseISO(ts), 'd MMM, h:mm a') } catch { return ts }
}

function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '—'
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return `${mins} mins`
  if (mins === 0) return `${hrs} hrs`
  return `${hrs} hrs ${mins} mins`
}

/* ── AdminDashboard ──────────────────────────────────────────── */
export default function AdminDashboard() {
  const { profile } = useAuth()

  const [stats, setStats]               = useState({ totalEmp: 0, online: 0, todayLogins: 0, codeActive: null, codeLoading: true })
  const [statsLoading, setStatsLoading] = useState(true)
  const [loginHistory, setLoginHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [onlineList, setOnlineList]     = useState([])
  const [onlineLoading, setOnlineLoading] = useState(true)
  const [error, setError]               = useState('')
  const [lastUpdated, setLastUpdated]   = useState(null)

  const fetchAll = useCallback(async () => {
    const today      = new Date().toISOString().split('T')[0]
    const todayStart = `${today}T00:00:00.000Z`
    const todayEnd   = `${today}T23:59:59.999Z`

    try {
      const [
        { count: totalEmp },
        { count: onlineCnt },
        { count: todayLogins },
        { data: codeData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .eq('role', 'employee').eq('is_active', true),

        supabase.from('profiles').select('*', { count: 'exact', head: true })
          .eq('is_online', true).eq('role', 'employee'),

        supabase.from('login_history').select('*', { count: 'exact', head: true })
          .eq('status', 'success').eq('event_type', 'login')
          .gte('login_at', todayStart).lte('login_at', todayEnd),

        supabase.from('daily_codes').select('id, is_active')
          .eq('valid_date', today).eq('is_active', true).limit(1),
      ])

      setStats({
        totalEmp:   totalEmp ?? 0,
        online:     onlineCnt ?? 0,
        todayLogins: todayLogins ?? 0,
        codeActive: codeData && codeData.length > 0,
      })
      setLastUpdated(new Date())
    } catch (e) {
      setError('Failed to load stats.')
    } finally {
      setStatsLoading(false)
    }

    // Recent login history (includes all of today's activities plus recent history)
    try {
      const { data: hist } = await supabase
        .from('login_history')
        .select(`
          id, event_type, login_at, logout_at, status, session_duration_minutes, hours_worked, created_at,
          profile:profiles!profile_id(full_name, employee_id, role, is_online, is_active)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      // Filter to employees only
      const filtered = (hist ?? []).filter(r => r.profile?.role === 'employee')
      setLoginHistory(filtered)
    } catch {
      setLoginHistory([])
    } finally {
      setHistoryLoading(false)
    }

    // Online employees
    try {
      const { data: online } = await supabase
        .from('profiles')
        .select('id, full_name, employee_id, avatar_url, is_online')
        .eq('is_online', true)
        .eq('role', 'employee')
        .eq('is_active', true)

      setOnlineList(online ?? [])
    } catch {
      setOnlineList([])
    } finally {
      setOnlineLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll()
    // Auto-refresh every 60 seconds
    const timer = setInterval(() => fetchAll(), 60_000)
    return () => clearInterval(timer)
  }, [fetchAll])

  // Format last updated as relative time
  function fmtLastUpdated(d) {
    if (!d) return null
    const secs = Math.floor((Date.now() - d.getTime()) / 1000)
    if (secs < 60)  return 'Just now'
    if (secs < 120) return '1 minute ago'
    return `${Math.floor(secs / 60)} minutes ago`
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>
          Welcome back, {profile?.full_name ?? 'Admin'}
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(232,25,44,0.06)', border: '1px solid rgba(232,25,44,0.2)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8, color: '#E8192C', fontSize: 13,
        }}>
          <AlertCircle size={15} />{error}
        </div>
      )}

      {/* ── Stats Row ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        <StatCard
          icon={<Users size={22} color="#00AEEF" />}
          iconBg="rgba(0,174,239,0.1)" iconColor="#00AEEF"
          value={stats.totalEmp} label="Total Employees"
          loading={statsLoading}
        />
        <StatCard
          icon={<Wifi size={22} color="#16A34A" />}
          iconBg="rgba(22,163,74,0.1)" iconColor="#16A34A"
          value={stats.online} label="Currently Online"
          loading={statsLoading}
        />
        <StatCard
          icon={<LogIn size={22} color="#00AEEF" />}
          iconBg="rgba(0,174,239,0.1)" iconColor="#00AEEF"
          value={stats.todayLogins} label="Logins Today"
          loading={statsLoading}
        />
        <StatCard
          icon={<KeyRound size={22} color={stats.codeActive ? '#16A34A' : '#E8192C'} />}
          iconBg={stats.codeActive ? 'rgba(22,163,74,0.1)' : 'rgba(232,25,44,0.1)'}
          value={stats.codeActive ? 'Active' : 'Not Generated'}
          label="Today's Auth Code"
          loading={statsLoading}
          isStatus statusGreen={stats.codeActive}
        />
      </div>
      {/* Last updated */}
      {lastUpdated && (
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 20px', textAlign: 'right' }}>
          Last updated: {fmtLastUpdated(lastUpdated)}
        </p>
      )}

      {/* ── Two-column section ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '60% 1fr', gap: 20 }}>

        {/* Recent Login Activity */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #DBEAFE' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Recent Login Activity</h2>
          </div>

          {historyLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <LoadingSpinner size="md" />
            </div>
          ) : loginHistory.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
              <LogIn size={32} color="#DBEAFE" style={{ marginBottom: 8 }} />
              <p style={{ margin: 0 }}>No login activity found</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FBFF', position: 'sticky', top: 0, zIndex: 10 }}>
                    {['Employee', 'ID', 'Login Time', 'Logout Time', 'Presence', 'Duration', 'Auth Status'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: 12, fontWeight: 600, color: '#6B7280',
                        borderBottom: '1px solid #DBEAFE', whiteSpace: 'nowrap',
                        background: '#F8FBFF',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.map((row, i) => {
                    const isOnline = row.profile?.is_online && row.profile?.is_active
                    const isActiveSession = !row.logout_at && row.status === 'success'
                    return (
                      <tr
                        key={row.id ?? i}
                        style={{ borderBottom: '1px solid #F0F7FF' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FBFF'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Employee Name */}
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: '#1B3A6B' }}>
                          {row.profile?.full_name ?? '—'}
                        </td>
                        {/* ID */}
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280' }}>
                          {row.profile?.employee_id ?? '—'}
                        </td>
                        {/* Login Time */}
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                          {fmtTime(row.login_at)}
                        </td>
                        {/* Logout Time */}
                        <td style={{ padding: '12px 16px', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {isActiveSession ? (
                            <span style={{ color: '#16A34A', fontWeight: 600 }}>Active Session</span>
                          ) : (
                            <span style={{ color: '#6B7280' }}>{fmtTime(row.logout_at)}</span>
                          )}
                        </td>
                        {/* Presence (Online/Offline) */}
                        <td style={{ padding: '12px 16px' }}>
                          {isOnline ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 11, fontWeight: 600, color: '#16A34A',
                              background: 'rgba(22,163,74,0.08)', padding: '2px 8px', borderRadius: 9999,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
                              Online
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 11, fontWeight: 600, color: '#6B7280',
                              background: 'rgba(107,114,128,0.08)', padding: '2px 8px', borderRadius: 9999,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B7280' }} />
                              Offline
                            </span>
                          )}
                        </td>
                        {/* Session Duration */}
                        <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                          {isActiveSession ? (
                            <span style={{ fontStyle: 'italic', color: '#9CA3AF' }}>running</span>
                          ) : (
                            formatDuration(row.session_duration_minutes)
                          )}
                        </td>
                        {/* Auth Status */}
                        <td style={{ padding: '12px 16px' }}>
                          <StatusDot success={row.status === 'success'} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Employees Online */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #DBEAFE' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Employees Online</h2>
              <span style={{
                background: 'rgba(22,163,74,0.1)', color: '#16A34A',
                fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
              }}>
                {onlineLoading ? '…' : onlineList.length}
              </span>
            </div>
          </div>

          <div style={{ padding: '8px 0', maxHeight: 400, overflowY: 'auto' }}>
            {onlineLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <LoadingSpinner size="sm" />
              </div>
            ) : onlineList.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Wifi size={36} color="#DBEAFE" style={{ marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: 14, color: '#6B7280' }}>No employees currently online</p>
              </div>
            ) : (
              onlineList.map(emp => (
                <div
                  key={emp.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px',
                    borderBottom: '1px solid #F0F7FF',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FBFF'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Avatar src={emp.avatar_url} name={emp.full_name} size="sm" online />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1B3A6B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.full_name}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: '#6B7280' }}>{emp.employee_id}</p>
                  </div>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 600, color: '#16A34A',
                    background: 'rgba(22,163,74,0.08)', padding: '2px 8px', borderRadius: 9999,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
                    Online
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Responsive two-column stacking */}
      <style>{`
        @media (max-width: 900px) {
          .admin-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
