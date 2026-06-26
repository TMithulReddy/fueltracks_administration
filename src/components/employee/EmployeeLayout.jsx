import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, UserCircle, Clock, Lock, LogOut, Menu, X, FileText, ClipboardList,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../shared/Avatar'
import { supabase } from '../../lib/supabase'

function SidebarLink({ to, label, Icon, end = false }) {
  const [hovered, setHovered] = useState(false)
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        textDecoration: 'none',
        fontSize: 14,
        fontWeight: 500,
        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.80)',
        background: isActive
          ? 'rgba(255,255,255,0.25)'
          : hovered ? 'rgba(255,255,255,0.15)' : 'transparent',
        borderLeft: isActive ? '3px solid #FFFFFF' : '3px solid transparent',
        transition: 'all 0.15s ease',
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon size={18} />
      {label}
    </NavLink>
  )
}

export default function EmployeeLayout() {
  const { profile, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const profileDetails = (Array.isArray(profile?.details) ? profile.details[0] : profile?.details) || {}
  const department = profileDetails.department || profile?.department || null

  const [sessionExpired, setSessionExpired] = useState(false)
  const lastOnlineRef = useRef(profile?.is_online)

  useEffect(() => {
    lastOnlineRef.current = profile?.is_online
  }, [profile?.is_online])

  useEffect(() => {
    if (!profile?.id) return

    const checkSession = async () => {
      const refreshed = await refreshProfile()
      if (refreshed && refreshed.is_online === false && lastOnlineRef.current === true) {
        setSessionExpired(true)
      }
    }

    // Check every 2 minutes
    const interval = setInterval(checkSession, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [profile?.id, refreshProfile])

  // Show forced logout screen
  if (sessionExpired) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F0F7FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: '#FFFFFF', borderRadius: 16, padding: 40,
          maxWidth: 400, width: '90%', textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,174,239,0.10)',
          border: '1px solid #DBEAFE',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ color: '#1B3A6B', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Session Ended
          </h2>
          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Your session was automatically ended at 6:30 PM. Please log in again tomorrow with your daily code.
          </p>
          <button
            onClick={() => { signOut(); navigate('/') }}
            style={{
              background: '#00AEEF', color: '#FFFFFF', border: 'none',
              borderRadius: 8, padding: '12px 28px', fontSize: 15,
              fontWeight: 600, cursor: 'pointer', width: '100%',
            }}
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  const navLinks = [
    { to: '/employee',          label: 'Dashboard',       Icon: LayoutDashboard, end: true },
    { to: '/employee/profile',  label: 'My Profile',      Icon: UserCircle },
    { to: '/employee/history',  label: 'History',         Icon: Clock },
    { to: '/employee/work-update', label: 'My Progress',  Icon: ClipboardList },
    { to: '/employee/password', label: 'Change Password', Icon: Lock },
  ]

  async function handleLogout() {
    try {
      await signOut()
      toast.success('Logged out successfully')
      navigate('/')
    } catch {
      toast.error('Logout failed')
    }
  }

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Employee info */}
      <div style={{
        padding: '24px 16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        flexShrink: 0,
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Avatar
            src={profile?.avatar_url}
            name={profile?.full_name ?? ''}
            size="lg"
            online={profile?.is_online}
          />
        </div>
        <p style={{
          color: '#FFFFFF', fontSize: 13, fontWeight: 600, margin: '0 0 2px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {profile?.full_name ?? 'Employee'}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.80)', fontSize: 11, fontFamily: 'monospace', margin: '0 0 8px' }}>
          {profile?.employee_id ?? ''}
        </p>
        {department && (
          <span style={{
            background: 'rgba(255,255,255,0.2)', color: '#FFFFFF',
            fontSize: 10, fontWeight: 600, padding: '2px 10px',
            borderRadius: 9999, display: 'inline-block',
          }}>
            {department}
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {navLinks.map(link => (
          <SidebarLink key={link.to} {...link} />
        ))}
      </nav>

      {/* Logout */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '14px 16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#FFFFFF', fontSize: 14, fontWeight: 500,
            fontFamily: 'Inter, sans-serif', textAlign: 'left',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
          id="employee-logout-btn"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F7FF' }}>

      {/* Desktop Sidebar */}
      <aside
        className="emp-sidebar-desktop"
        style={{
          position: 'fixed', top: 64, left: 0,
          width: 240, height: 'calc(100vh - 64px)',
          background: '#00AEEF', zIndex: 40, overflowY: 'auto',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className="emp-sidebar-mobile"
        style={{
          position: 'fixed', top: 64,
          left: mobileSidebarOpen ? 0 : -240,
          width: 240, height: 'calc(100vh - 64px)',
          background: '#00AEEF', zIndex: 46, overflowY: 'auto',
          transition: 'left 0.25s ease', display: 'none',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main
        className="emp-main"
        style={{
          marginLeft: 240, paddingTop: 88,
          paddingLeft: 24, paddingRight: 24, paddingBottom: 32,
          minHeight: '100vh', background: '#F0F7FF',
        }}
      >
        {/* Mobile toggle */}
        <button
          className="emp-mobile-menu-btn"
          onClick={() => setMobileSidebarOpen(p => !p)}
          style={{
            display: 'none', alignItems: 'center', gap: 8,
            marginBottom: 16, background: '#FFFFFF',
            border: '1px solid #DBEAFE', borderRadius: 8,
            padding: '8px 14px', cursor: 'pointer',
            color: '#1B3A6B', fontFamily: 'Inter, sans-serif',
            fontSize: 14, fontWeight: 500,
          }}
          aria-label="Toggle sidebar"
        >
          {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          Menu
        </button>

        <Outlet />
      </main>

      <style>{`
        @media (max-width: 768px) {
          .emp-sidebar-desktop { display: none !important; }
          .emp-sidebar-mobile  { display: block !important; }
          .emp-main            { margin-left: 0 !important; }
          .emp-mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
