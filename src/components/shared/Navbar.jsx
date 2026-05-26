import { useState, useRef, useEffect } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { Menu, X, ChevronDown, LogOut, User, Shield, LayoutDashboard, Users, KeyRound, ScrollText, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Avatar from './Avatar'
import toast from 'react-hot-toast'
import fuelTracksLogo from '../../assets/fuel-tracks-logo.png'

/* ─────────────────── Dropdown ───────────────────────────────── */
function Dropdown({ items, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="fade-in"
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        right: 0,
        background: '#FFFFFF',
        borderRadius: '0.75rem',
        boxShadow: '0 8px 30px rgba(0,174,239,0.15)',
        border: '1px solid #DBEAFE',
        minWidth: 180,
        zIndex: 200,
        overflow: 'hidden',
      }}
    >
      {items.map((item, idx) =>
        item.divider ? (
          <div key={idx} style={{ height: 1, background: '#DBEAFE', margin: '4px 0' }} />
        ) : (
          <button
            key={idx}
            onClick={() => { item.onClick(); onClose() }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              color: item.danger ? '#E8192C' : '#1B3A6B',
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.15s',
              textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(232,25,44,0.06)' : '#F0F7FF'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {item.icon}
            {item.label}
          </button>
        )
      )}
    </div>
  )
}

/* ─────────────────── Nav Link Item ──────────────────────────── */
function NavItem({ to, icon, label, onClick }) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="nav-link"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {icon}
        {label}
      </button>
    )
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      {icon}
      {label}
    </NavLink>
  )
}

/* ─────────────────── Navbar ─────────────────────────────────── */
export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const avatarRef = useRef(null)

  const role = profile?.role

  const isAdmin    = role === 'admin' || role === 'super_admin'
  const isEmployee = role === 'employee'

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/')
      toast.success('Signed out successfully')
    } catch {
      toast.error('Sign out failed')
    }
  }

  /* ── Admin nav items ─── */
  const adminLinks = [
    { to: '/admin',            icon: <LayoutDashboard size={15} />, label: 'Dashboard'  },
    { to: '/admin/employees',  icon: <Users           size={15} />, label: 'Employees'  },
    { to: '/admin/daily-code', icon: <KeyRound        size={15} />, label: 'Daily Code' },
    { to: '/admin/audit-log',  icon: <ScrollText      size={15} />, label: 'Audit Log'  },
  ]

  /* ── Employee nav items ─── */
  const employeeLinks = [
    { to: '/employee',          icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
    { to: '/employee/profile',  icon: <User            size={15} />, label: 'My Profile' },
    { to: '/employee/history',  icon: <ScrollText      size={15} />, label: 'History'   },
  ]

  /* ── Avatar dropdown items ─── */
  const adminDropdown = [
    { icon: <User size={15} />,      label: 'My Profile', onClick: () => navigate('/admin/profile') },
    ...(role === 'super_admin'
      ? [{ icon: <UserPlus size={15} />, label: 'Add Admin', onClick: () => navigate('/admin/add-admin') }]
      : []),
    { divider: true },
    { icon: <LogOut size={15} />,    label: 'Logout',     onClick: handleSignOut, danger: true },
  ]

  const employeeDropdown = [
    { icon: <User   size={15} />, label: 'My Profile', onClick: () => navigate('/employee/profile') },
    { divider: true },
    { icon: <LogOut size={15} />, label: 'Logout',     onClick: handleSignOut, danger: true },
  ]

  const currentLinks   = isAdmin ? adminLinks   : isEmployee ? employeeLinks   : []
  const currentDropdown = isAdmin ? adminDropdown : isEmployee ? employeeDropdown : []

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        background: '#FFFFFF',
        borderBottom: '1px solid #DBEAFE',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* ── Logo ── */}
        <img
          src={fuelTracksLogo}
          alt="Fuel Tracks"
          className="h-10 w-auto object-contain cursor-pointer"
          style={{ maxWidth: '140px' }}
          onClick={() => navigate('/')}
        />

        {/* ── Desktop Nav ── */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }} className="hidden-mobile">
          {currentLinks.map(link => (
            <NavItem key={link.to} to={link.to} icon={link.icon} label={link.label} />
          ))}

          {/* When logged in → avatar + dropdown */}
          {user && (
            <div style={{ position: 'relative' }} ref={avatarRef}>
              <button
                id="navbar-avatar-btn"
                onClick={() => setDropdownOpen(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                }}
                aria-label="Open profile menu"
                aria-expanded={dropdownOpen}
              >
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.full_name ?? profile?.email ?? 'User'}
                  size="md"
                  online={profile?.is_online}
                />
                <ChevronDown
                  size={16}
                  color="#6B7280"
                  style={{ transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>
              {dropdownOpen && (
                <Dropdown items={currentDropdown} onClose={() => setDropdownOpen(false)} />
              )}
            </div>
          )}

          {/* When NOT logged in → login buttons */}
          {!user && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn-secondary" onClick={() => navigate('/login/employee')} style={{ padding: '8px 18px' }}>
                Employee Login
              </button>
              <button className="btn-primary" onClick={() => navigate('/login/admin')} style={{ padding: '8px 18px' }}>
                Admin Login
              </button>
            </div>
          )}
        </nav>

        {/* ── Mobile Hamburger ── */}
        <button
          className="show-mobile"
          onClick={() => setMobileOpen(p => !p)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1B3A6B', display: 'none' }}
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div
          className="fade-in"
          style={{
            position: 'absolute',
            top: 64,
            left: 0,
            right: 0,
            background: '#FFFFFF',
            borderBottom: '1px solid #DBEAFE',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            boxShadow: '0 8px 20px rgba(0,174,239,0.08)',
          }}
        >
          {currentLinks.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}
            >
              {link.icon}
              {link.label}
            </NavLink>
          ))}

          {user && (
            <>
              <div style={{ height: 1, background: '#DBEAFE', margin: '8px 0' }} />
              {currentDropdown.filter(d => !d.divider).map((item, i) => (
                <button
                  key={i}
                  onClick={() => { item.onClick(); setMobileOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 15, fontWeight: 500,
                    color: item.danger ? '#E8192C' : '#1B3A6B',
                    fontFamily: 'Inter, sans-serif', padding: '10px 0', textAlign: 'left',
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </>
          )}

          {!user && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <button className="btn-secondary" onClick={() => { navigate('/login/employee'); setMobileOpen(false) }}>
                Employee Login
              </button>
              <button className="btn-primary" onClick={() => { navigate('/login/admin'); setMobileOpen(false) }}>
                Admin Login
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mobile CSS */}
      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile   { display: flex !important; }
        }
      `}</style>
    </header>
  )
}
