import { useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'
import fuelTracksLogo from '../assets/fuel-tracks-logo.png'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F0F7FF 0%, #E0F0FF 60%, #F0F7FF 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: 24,
        fontFamily: 'Inter, sans-serif',
        textAlign: 'center',
      }}
    >
      {/* Logo */}
      <img
        src={fuelTracksLogo}
        alt="Fuel Tracks"
        style={{ height: 56, width: 'auto', objectFit: 'contain', marginBottom: 40 }}
      />

      {/* 404 */}
      <div
        style={{
          fontSize: 120,
          fontWeight: 900,
          color: '#DBEAFE',
          lineHeight: 1,
          marginBottom: 16,
          letterSpacing: '-0.04em',
          userSelect: 'none',
        }}
      >
        404
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#1B3A6B',
          margin: '0 0 12px',
        }}
      >
        Page Not Found
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 15,
          color: '#6B7280',
          margin: '0 0 40px',
          maxWidth: 360,
          lineHeight: 1.6,
        }}
      >
        The page you're looking for doesn't exist or has been moved.
      </p>

      {/* Go Home button */}
      <button
        onClick={() => navigate('/')}
        style={{
          background: '#00AEEF',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 10,
          padding: '13px 32px',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'Inter, sans-serif',
          transition: 'background 0.2s ease, transform 0.1s ease',
          boxShadow: '0 4px 14px rgba(0,174,239,0.25)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#1B3A6B'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = '#00AEEF'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
        id="go-home-btn"
      >
        <Home size={17} />
        Go Home
      </button>
    </div>
  )
}
