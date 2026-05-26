import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, KeyRound, ClipboardList,
  UserCircle, UserPlus, LogOut, Menu, X, Download, Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../shared/Avatar'

/* ── Sidebar nav link with hover state ───────────────────────── */
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
        color: isActive ? '#FFFFFF' : '#93C5FD',
        background: isActive
          ? 'rgba(0,174,239,0.2)'
          : hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
        borderLeft: isActive ? '3px solid #00AEEF' : '3px solid transparent',
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

/* ── AdminLayout ─────────────────────────────────────────────── */
export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const isSuperAdmin = profile?.role === 'super_admin'
  const roleBadge = isSuperAdmin ? 'Super Admin' : 'Admin'

  const navLinks = [
    { to: '/admin',               label: 'Dashboard',       Icon: LayoutDashboard, end: true },
    { to: '/admin/employees',     label: 'Employees',       Icon: Users },
    { to: '/admin/daily-code',    label: 'Daily Code',      Icon: KeyRound },
    { to: '/admin/audit-log',     label: 'Audit Log',       Icon: ClipboardList },
    { to: '/admin/export',        label: 'Export Data',     Icon: Download },
    { to: '/admin/profile',       label: 'My Profile',      Icon: UserCircle },
    { to: '/admin/change-password', label: 'Change Password', Icon: Lock },
    ...(isSuperAdmin
      ? [{ to: '/admin/add-admin', label: 'Add Admin', Icon: UserPlus }]
      : []),
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
      {/* Admin info */}
      <div style={{
        padding: '20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Avatar
            src={profile?.avatar_url}
            name={profile?.full_name ?? ''}
            size="md"
            online={profile?.is_online}
          />
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{
              color: '#FFFFFF', fontSize: 13, fontWeight: 600, margin: 0,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {profile?.full_name ?? 'Admin'}
            </p>
            <p style={{ color: '#93C5FD', fontSize: 11, margin: 0 }}>
              {profile?.employee_id ?? ''}
            </p>
          </div>
        </div>
        <span style={{
          background: '#00AEEF', color: '#FFFFFF', fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 9999, display: 'inline-block',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {roleBadge}
        </span>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {navLinks.map(link => (
          <SidebarLink key={link.to} {...link} />
        ))}
      </nav>

      {/* Logout */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '14px 16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#F87171', fontSize: 14, fontWeight: 500,
            fontFamily: 'Inter, sans-serif', textAlign: 'left',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
          id="admin-logout-btn"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F7FF' }}>

      {/* ── Desktop Sidebar ── */}
      <aside
        className="admin-sidebar-desktop"
        style={{
          position: 'fixed',
          top: 64,
          left: 0,
          width: 240,
          height: 'calc(100vh - 64px)',
          background: '#1B3A6B',
          zIndex: 40,
          overflowY: 'auto',
        }}
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {mobileSidebarOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 45,
            background: 'rgba(0,0,0,0.4)',
          }}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Mobile Sidebar ── */}
      <aside
        style={{
          position: 'fixed',
          top: 64,
          left: mobileSidebarOpen ? 0 : -240,
          width: 240,
          height: 'calc(100vh - 64px)',
          background: '#1B3A6B',
          zIndex: 46,
          overflowY: 'auto',
          transition: 'left 0.25s ease',
          display: 'none', // shown via media query class
        }}
        className="admin-sidebar-mobile"
      >
        {sidebarContent}
      </aside>

      {/* ── Main content ── */}
      <main
        className="admin-main"
        style={{
          marginLeft: 240,
          paddingTop: 88,   // 64px navbar + 24px gap
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 32,
          minHeight: '100vh',
          background: '#F0F7FF',
        }}
      >
        {/* Mobile sidebar toggle */}
        <button
          className="admin-mobile-menu-btn"
          onClick={() => setMobileSidebarOpen(p => !p)}
          style={{
            display: 'none',
            alignItems: 'center', gap: 8,
            marginBottom: 16,
            background: '#FFFFFF', border: '1px solid #DBEAFE',
            borderRadius: 8, padding: '8px 14px',
            cursor: 'pointer', color: '#1B3A6B',
            fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500,
          }}
          aria-label="Toggle sidebar"
        >
          {mobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          Menu
        </button>

        <Outlet />
      </main>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-sidebar-mobile  { display: block !important; }
          .admin-main            { margin-left: 0 !important; }
          .admin-mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
