import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarCheck, Clock, Calendar, LogIn,
  Mail, Phone, Briefcase, CalendarDays, CheckCircle, LogOut,
} from 'lucide-react'
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, isBefore } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Avatar from '../../components/shared/Avatar'

/* ── Greeting ─────────────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ── Stat Card ───────────────────────────────────────────────── */
function StatCard({ icon, value, label, sub, loading }) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 12,
      boxShadow: '0 2px 12px rgba(0,174,239,0.08)',
      padding: 20, flex: 1, minWidth: 0,
      borderTop: '3px solid #00AEEF',
      overflow: 'hidden',
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'rgba(0,174,239,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div style={{ height: 32, background: '#F0F7FF', borderRadius: 6, marginBottom: 6, width: '60%' }} />
      ) : (
        <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#1B3A6B', lineHeight: 1 }}>{value}</p>
      )}
      <p style={{ margin: '4px 0 2px', fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>{sub}</p>
    </div>
  )
}

export default function EmployeeDashboard() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [details, setDetails]         = useState(null)
  const [history, setHistory]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [nowTime, setNowTime]         = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  async function handleLogout() {
    try {
      await signOut()
      toast.success('Logged out successfully')
      navigate('/')
    } catch {
      toast.error('Logout failed')
    }
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const todayStr  = format(new Date(), 'EEEE, d MMMM yyyy')

  useEffect(() => {
    if (!user) return
    fetchData(false)
    const timer = setInterval(() => {
      fetchData(true)
    }, 30_000)
    return () => clearInterval(timer)
  }, [user])

  async function fetchData(silent = false) {
    if (!silent) setLoading(true)
    try {
      const [{ data: det }, { data: hist }] = await Promise.all([
        supabase
          .from('employee_details')
          .select('*')
          .eq('profile_id', user.id)
          .single(),
        supabase
          .from('login_history')
          .select('id, login_at, logout_at, hours_worked, session_duration_minutes, status, event_type')
          .eq('profile_id', user.id)
          .eq('status', 'success')
          .in('event_type', ['login', 'qr_scan'])
          .order('login_at', { ascending: false }),
      ])
      setDetails(det ?? null)
      setHistory(hist ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  /* ── Stats ── */
  const totalDays = new Set((history ?? []).map(r => r.login_at?.split('T')[0]).filter(Boolean)).size
  
  const totalHoursValue = (history ?? []).reduce((sum, r) => {
    if (r.logout_at) {
      return sum + parseFloat(r.hours_worked ?? 0)
    } else {
      // Live running active session: live hours worked
      const loginTime = new Date(r.login_at).getTime()
      const now = new Date().getTime()
      const diffMs = now - loginTime
      const diffMins = Math.max(0, Math.round(diffMs / (1000 * 60)))
      const liveHrs = parseFloat((diffMins / 60).toFixed(2))
      return sum + liveHrs
    }
  }, 0)
  const totalHours = totalHoursValue.toFixed(2)

  const thisMonthCount = history.filter(r => {
    try {
      const d = parseISO(r.login_at)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    } catch { return false }
  }).length

  const lastLogin = history[0]?.login_at
    ? format(parseISO(history[0].login_at), 'd MMM, h:mm a')
    : '—'

  /* ── This week attendance ── */
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays  = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const attendedDays = new Set(
    history.map(r => {
      try { return format(parseISO(r.login_at), 'yyyy-MM-dd') }
      catch { return null }
    }).filter(Boolean)
  )

  const weekRangeLabel = `${format(weekStart, 'd MMM')} – ${format(weekEnd, 'd MMM')}`

  /* ── Recent sessions (last 5) ── */
  const recentSessions = history.slice(0, 5)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>
            {getGreeting()}, {firstName}!
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>
            Here's your attendance overview
          </p>
        </div>
        <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500, whiteSpace: 'nowrap', paddingTop: 4 }}>
          <CalendarDays size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />
          {todayStr}
        </span>
      </div>

      {/* Active session banner */}
      {profile?.is_online && history[0]?.login_at && (
        (() => {
          const loginTime = new Date(history[0].login_at).getTime()
          const diffMs = nowTime.getTime() - loginTime
          const diffMins = Math.max(0, Math.round(diffMs / (1000 * 60)))
          const hrs = Math.floor(diffMins / 60)
          const mins = diffMins % 60
          const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`

          return (
            <div style={{
              background: '#F0FFF4',
              border: '1px solid #BBF7D0',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: '#16A34A',
                display: 'inline-block',
                flexShrink: 0,
                animation: 'pulse-green 2s cubic-bezier(0.4,0,0.6,1) infinite',
              }} />
              <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 500 }}>
                Active session started at{' '}
                <strong>{format(parseISO(history[0].login_at), 'h:mm a')}</strong>
                {' · '}
                <span>Duration: <strong>{durationStr}</strong> (live)</span>
              </span>
            </div>
          )
        })()
      )}

      {/* ── Stats Row ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard
          icon={<CalendarCheck size={20} color="#00AEEF" />}
          value={totalDays}
          label="Total Working Days"
          sub="Days attended"
          loading={loading}
        />
        <StatCard
          icon={<Clock size={20} color="#1B3A6B" />}
          value={`${totalHours} hrs`}
          label="Total Working Hours"
          sub="Cumulative hours"
          loading={loading}
        />
        <StatCard
          icon={<Calendar size={20} color="#00AEEF" />}
          value={thisMonthCount}
          label="This Month"
          sub="Days this month"
          loading={loading}
        />
        <StatCard
          icon={<LogIn size={20} color="#16A34A" />}
          value={lastLogin}
          label="Last Login"
          sub="Most recent session"
          loading={loading}
        />
      </div>

      {/* ── Two column ── */}
      <div className="emp-dash-grid" style={{ display: 'grid', gridTemplateColumns: '60% 1fr', gap: 20 }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* This Week Attendance */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1B3A6B' }}>
                This Week's Attendance
              </h2>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{weekRangeLabel}</span>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              {weekDays.map(day => {
                const dayKey   = format(day, 'yyyy-MM-dd')
                const attended = attendedDays.has(dayKey)
                const today    = isToday(day)
                const future   = !today && !isBefore(day, new Date())
                const dayLetter = format(day, 'EEEEE')

                let circleStyle = {}
                let inner = null

                if (attended) {
                  circleStyle = { background: '#00AEEF', border: 'none' }
                  inner = <CheckCircle size={14} color="#FFFFFF" strokeWidth={3} />
                } else if (today) {
                  circleStyle = {
                    background: 'transparent',
                    border: '2px solid #00AEEF',
                    animation: 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
                  }
                  inner = null
                } else if (future) {
                  circleStyle = { background: '#F3F4F6', border: 'none', opacity: 0.5 }
                  inner = null
                } else {
                  circleStyle = { background: '#E5E7EB', border: 'none' }
                  inner = <span style={{ fontSize: 10, color: '#9CA3AF' }}>–</span>
                }

                return (
                  <div key={dayKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: today ? '#00AEEF' : '#6B7280' }}>
                      {dayLetter}
                    </span>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      ...circleStyle,
                    }}>
                      {inner}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent Sessions */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #DBEAFE' }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1B3A6B' }}>Recent Sessions</h2>
            </div>

            {recentSessions.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <LogIn size={32} color="#DBEAFE" style={{ marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>No sessions yet</p>
              </div>
            ) : (
              recentSessions.map((s, i) => {
                const hrs = s.hours_worked != null ? parseFloat(s.hours_worked) : null
                const hrsLabel = hrs !== null
                  ? hrs >= 1 ? `${hrs.toFixed(2)} hrs` : `${(s.session_duration_minutes ?? 0)} mins`
                  : '—'
                const isActive = !s.logout_at

                return (
                  <div
                    key={s.id ?? i}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 20px', borderBottom: i < recentSessions.length - 1 ? '1px solid #F0F7FF' : 'none',
                      gap: 12,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FBFF'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ minWidth: 80 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1B3A6B' }}>
                        {format(parseISO(s.login_at), 'd MMM')}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: '#6B7280' }}>
                        {format(parseISO(s.login_at), 'EEEE')}
                      </p>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#6B7280', flex: 1 }}>
                      {format(parseISO(s.login_at), 'h:mm a')}
                      {' → '}
                      {isActive
                        ? <span style={{ color: '#16A34A', fontWeight: 600 }}>Active</span>
                        : s.logout_at ? format(parseISO(s.logout_at), 'h:mm a') : '—'
                      }
                    </p>
                    <span style={{
                      background: '#EFF6FF', color: '#00AEEF',
                      fontSize: 12, fontWeight: 600,
                      padding: '3px 10px', borderRadius: 9999,
                      whiteSpace: 'nowrap',
                    }}>
                      {hrsLabel}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT — Profile Summary */}
        <div>
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Avatar src={profile?.avatar_url} name={profile?.full_name ?? ''} size="lg" online={profile?.is_online} />
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1B3A6B' }}>
                {profile?.full_name}
              </p>
              <p style={{ margin: '4px 0 8px', fontSize: 11, fontFamily: 'monospace', color: '#00AEEF', fontWeight: 600 }}>
                {profile?.employee_id}
              </p>
              {details?.designation && (
                <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                  {details.designation}
                  {details.department && ` · ${details.department}`}
                </p>
              )}
            </div>

            <div style={{ borderTop: '1px solid #F0F7FF', paddingTop: 16 }}>
              {[
                { icon: <Mail size={13} color="#00AEEF" />, label: 'Email',       val: profile?.email },
                { icon: <Phone size={13} color="#00AEEF" />, label: 'Phone',       val: profile?.phone || '—' },
                { icon: <CalendarDays size={13} color="#00AEEF" />, label: 'Joined', val: details?.date_of_joining ? format(parseISO(details.date_of_joining), 'd MMM yyyy') : '—' },
                { icon: <Briefcase size={13} color="#00AEEF" />, label: 'Type',    val: details?.employment_type || '—' },
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
                    {icon} {label}
                  </span>
                  <span style={{ fontSize: 12, color: '#1B3A6B', fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>
                    {val}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/employee/profile')}
              className="btn-secondary"
              style={{ width: '100%', marginTop: 16, fontSize: 13 }}
              id="emp-edit-profile-btn"
            >
              Edit Profile
            </button>

            <button
              onClick={handleLogout}
              className="btn-danger"
              style={{ width: '100%', marginTop: 10, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              id="emp-dashboard-logout-btn"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .emp-dash-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes pulse-ring {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,174,239,0.4); }
          50%       { box-shadow: 0 0 0 6px rgba(0,174,239,0); }
        }
        @keyframes pulse-green {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
