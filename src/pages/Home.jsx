import { useNavigate } from 'react-router-dom'
import { User, Shield, ArrowRight, CheckCircle, Lock, KeyRound, Users, BarChart2 } from 'lucide-react'
import fuelTracksLogo from '../assets/fuel-tracks-logo.png'

export default function Home() {
  const navigate = useNavigate()
  const logo = fuelTracksLogo

  return (
    <div
      className="home-page-container"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #F0F7FF 0%, #E0F0FF 50%, #F0F7FF 100%)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div className="hero-container">
        {/* LEFT COLUMN */}
        <div className="left-column">
          {/* Top badge */}
          <div
            className="pill-badge"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #DBEAFE',
              borderRadius: '9999px',
              padding: '6px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              alignSelf: 'flex-start',
            }}
          >
            <span className="pulse-dot" />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#1B3A6B' }}>
              Fuel Tracks Employee Portal
            </span>
          </div>

          {/* Main heading */}
          <h1 style={{ marginTop: '16px', marginBottom: 0, textAlign: 'inherit' }}>
            <span className="heading-line-1">Welcome to</span>
            <span className="heading-line-2">Fuel Tracks</span>
            <span className="heading-line-3">Employee Portal</span>
          </h1>

          {/* Subtitle */}
          <p className="subtitle">
            Secure, professional attendance management for the Fuel Tracks team.
          </p>

          {/* Two action cards side by side */}
          <div className="cards-grid">
            {/* EMPLOYEE CARD */}
            <div
              className="action-card action-card-employee"
              onClick={() => navigate('/login/employee')}
            >
              <div className="card-top-row">
                <div className="icon-circle icon-circle-employee">
                  <User size={22} color="#00AEEF" />
                </div>
                <ArrowRight size={16} color="#00AEEF" className="arrow-icon arrow-icon-employee" />
              </div>
              <h3 className="card-title">Employee Login</h3>
              <p className="card-desc">Access your dashboard & attendance</p>
              <button
                className="card-button card-button-employee"
                onClick={(e) => { e.stopPropagation(); navigate('/login/employee') }}
              >
                Login as Employee
              </button>
            </div>

            {/* ADMIN CARD */}
            <div
              className="action-card action-card-admin"
              onClick={() => navigate('/login/admin')}
            >
              <div className="card-top-row">
                <div className="icon-circle icon-circle-admin">
                  <Shield size={22} color="#1B3A6B" />
                </div>
                <ArrowRight size={16} color="#1B3A6B" className="arrow-icon arrow-icon-admin" />
              </div>
              <h3 className="card-title">Admin Login</h3>
              <p className="card-desc">Manage employees & system settings</p>
              <button
                className="card-button card-button-admin"
                onClick={(e) => { e.stopPropagation(); navigate('/login/admin') }}
              >
                Login as Admin
              </button>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="trust-strip">
            <div className="trust-item">
              <CheckCircle size={16} color="#16A34A" style={{ flexShrink: 0 }} />
              <span className="trust-text">Secure Authentication</span>
            </div>
            <div className="trust-item">
              <Shield size={16} color="#00AEEF" style={{ flexShrink: 0 }} />
              <span className="trust-text">Role-Based Access</span>
            </div>
            <div className="trust-item">
              <Lock size={16} color="#1B3A6B" style={{ flexShrink: 0 }} />
              <span className="trust-text">Data Protected</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="right-column">
          <div className="visual-card">
            <div style={{ textAlign: 'center' }}>
              <img
                src={logo}
                alt="Fuel Tracks Logo"
                className="visual-card-logo"
                style={{ height: '64px', width: 'auto', objectFit: 'contain', margin: '0 auto', display: 'block' }}
              />
              <p style={{ marginTop: '16px', fontSize: '14px', color: '#6B7280', fontStyle: 'italic', margin: '16px 0 0' }}>
                fuel monitoring now online..
              </p>
            </div>

            <div className="divider" />

            {/* Stats grid */}
            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-value" style={{ color: '#1B3A6B' }}>50+</span>
                <span className="stat-label">Team Members</span>
              </div>
              <div className="stat-box">
                <span className="stat-value" style={{ color: '#00AEEF' }}>100%</span>
                <span className="stat-label">Secure Access</span>
              </div>
              <div className="stat-box">
                <span className="stat-value" style={{ color: '#1B3A6B' }}>24/7</span>
                <span className="stat-label">Availability</span>
              </div>
              <div className="stat-box">
                <span className="stat-value" style={{ color: '#16A34A' }}>Live</span>
                <span className="stat-label">Attendance Track</span>
              </div>
            </div>

            <div className="divider" />

            {/* Bottom feature list */}
            <div className="feature-list">
              <div className="feature-item">
                <div className="feature-circle" style={{ backgroundColor: '#EFF6FF' }}>
                  <KeyRound size={14} color="#00AEEF" />
                </div>
                <span className="feature-text">Daily rotating authentication codes</span>
              </div>
              <div className="feature-item">
                <div className="feature-circle" style={{ backgroundColor: '#F0F4FF' }}>
                  <Users size={14} color="#1B3A6B" />
                </div>
                <span className="feature-text">Real-time employee presence tracking</span>
              </div>
              <div className="feature-item">
                <div className="feature-circle" style={{ backgroundColor: '#F0FFF4' }}>
                  <BarChart2 size={14} color="#16A34A" />
                </div>
                <span className="feature-text">Automated attendance reporting</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER STRIP */}
      <footer className="footer-strip">
        <span className="footer-text">© 2025 Fuel Tracks. All rights reserved.</span>
        <span className="footer-text">Powered by Fuel Tracks TPL</span>
      </footer>

      {/* Embedded CSS Styles */}
      <style>{`
        /* --- General & Pulse --- */
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.95); }
        }
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #00AEEF;
          display: inline-block;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        /* --- Hero Grid --- */
        .hero-container {
          display: grid;
          grid-template-columns: 55fr 45fr;
          min-height: calc(100vh - 53px);
          width: 100%;
          box-sizing: border-box;
        }

        /* --- Left Column --- */
        .left-column {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 80px 32px 80px 64px; /* py-20, pr-8, pl-16 */
          box-sizing: border-box;
        }
        .heading-line-1 {
          font-size: 2.25rem; /* text-4xl */
          font-weight: 300; /* font-light */
          color: #6B7280;
          display: block;
          line-height: 1.2;
        }
        .heading-line-2 {
          font-size: 3.75rem; /* text-6xl */
          font-weight: 900; /* font-black */
          color: #1B3A6B;
          display: block;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin-top: 4px;
        }
        .heading-line-3 {
          font-size: 1.875rem; /* text-3xl */
          font-weight: 600; /* font-semibold */
          color: #00AEEF;
          display: block;
          line-height: 1.2;
          margin-top: 4px;
        }
        .subtitle {
          font-size: 1.125rem; /* text-lg */
          color: #6B7280;
          max-width: 420px;
          line-height: 1.6;
          margin-top: 16px;
          margin-bottom: 40px; /* mt-4, mb-10 */
        }
        
        /* --- Action Cards --- */
        .cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px; /* gap-4 */
          width: 100%;
          max-width: 600px;
        }
        .action-card {
          background: #FFFFFF;
          border-radius: 1rem; /* rounded-2xl */
          padding: 24px; /* p-6 */
          cursor: pointer;
          border: 2px solid transparent;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          box-shadow: 0 4px 12px rgba(27,58,107,0.03);
        }
        .card-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }
        .icon-circle {
          width: 48px;
          height: 48px;
          border-radius: 0.75rem; /* rounded-xl */
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }
        .icon-circle-employee {
          background-color: #EFF6FF;
        }
        .icon-circle-admin {
          background-color: #F0F4FF;
        }
        .arrow-icon {
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .card-title {
          font-weight: 700;
          color: #1B3A6B;
          font-size: 1.125rem; /* text-lg */
          margin: 16px 0 4px; /* mt-4, mb-1 */
          text-align: left;
        }
        .card-desc {
          font-size: 0.875rem; /* text-sm */
          color: #6B7280;
          margin: 0;
          text-align: left;
          flex-grow: 1;
        }
        .card-button {
          margin-top: 16px; /* mt-4 */
          width: 100%;
          color: #FFFFFF;
          border-radius: 0.75rem; /* rounded-xl */
          padding: 10px 0; /* py-2.5 */
          font-weight: 600;
          font-size: 0.875rem; /* text-sm */
          border: none;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        .card-button-employee {
          background-color: #00AEEF;
        }
        .card-button-employee:hover {
          background-color: #008cc0;
        }
        .card-button-admin {
          background-color: #1B3A6B;
        }
        .card-button-admin:hover {
          background-color: #112544;
        }

        /* Hover states for employee card */
        .action-card-employee:hover {
          border-color: #00AEEF;
          box-shadow: 0 8px 32px rgba(0, 174, 239, 0.15);
          transform: translateY(-3px);
        }
        .action-card-employee:hover .arrow-icon-employee {
          opacity: 1;
          transform: translateX(2px);
        }

        /* Hover states for admin card */
        .action-card-admin:hover {
          border-color: #1B3A6B;
          box-shadow: 0 8px 32px rgba(27, 58, 107, 0.12);
          transform: translateY(-3px);
        }
        .action-card-admin:hover .arrow-icon-admin {
          opacity: 1;
          transform: translateX(2px);
        }

        /* --- Trust Strip --- */
        .trust-strip {
          margin-top: 40px; /* mt-10 */
          display: flex;
          align-items: center;
          gap: 24px; /* gap-6 */
        }
        .trust-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .trust-text {
          font-size: 0.75rem; /* text-xs */
          color: #6B7280;
          font-weight: 500;
        }

        /* --- Right Column --- */
        .right-column {
          padding: 80px 64px 80px 0; /* py-20, pr-16 */
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }
        .visual-card {
          background-color: #FFFFFF;
          border-radius: 1.5rem; /* rounded-3xl */
          padding: 32px; /* p-8 */
          box-shadow: 0 20px 60px rgba(0, 174, 239, 0.12);
          border: 1px solid #DBEAFE;
          width: 100%;
          max-width: 480px;
          box-sizing: border-box;
        }
        .divider {
          border-top: 1px solid #DBEAFE;
          margin: 24px 0; /* my-6 */
        }
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px; /* gap-4 */
        }
        .stat-box {
          background-color: #F0F7FF;
          border-radius: 0.75rem; /* rounded-xl */
          padding: 16px; /* p-4 */
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .stat-value {
          font-size: 1.5rem; /* text-2xl */
          font-weight: 700;
        }
        .stat-label {
          font-size: 0.75rem; /* text-xs */
          color: #6B7280;
          margin-top: 4px; /* mt-1 */
        }
        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 12px; /* gap-3 */
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 12px; /* gap-3 */
        }
        .feature-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .feature-text {
          font-size: 0.875rem; /* text-sm */
          color: #1B3A6B;
          font-weight: 500;
          text-align: left;
        }

        /* --- Footer Strip --- */
        .footer-strip {
          background-color: #FFFFFF;
          border-top: 1px solid #DBEAFE;
          padding: 16px 64px; /* py-4, px-16 */
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-sizing: border-box;
          margin-top: auto;
        }
        .footer-text {
          font-size: 0.75rem; /* text-xs */
          color: #9CA3AF;
        }

        /* --- Responsive Styles --- */
        @media (max-width: 992px) {
          .hero-container {
            grid-template-columns: 1fr;
            min-height: auto;
          }
          .left-column {
            padding: 60px 40px;
            align-items: center;
            text-align: center;
          }
          .pill-badge {
            align-self: center !important;
          }
          .subtitle {
            margin-left: auto;
            margin-right: auto;
          }
          .right-column {
            padding: 40px 40px 60px;
          }
          .cards-grid {
            margin-left: auto;
            margin-right: auto;
            max-width: 500px;
          }
        }

        @media (max-width: 768px) {
          .left-column {
            padding: 40px 24px; /* px-6 */
          }
          .heading-line-1 {
            font-size: 1.875rem; /* text-3xl */
          }
          .heading-line-2 {
            font-size: 2.5rem; /* text-4xl */
          }
          .heading-line-3 {
            font-size: 1.5rem; /* text-2xl */
          }
          .right-column {
            padding: 24px;
          }
          .visual-card {
            margin: 0 24px; /* mx-6 */
            max-width: 100%;
          }
          .trust-strip {
            flex-wrap: wrap;
            justify-content: center; /* justify-center */
          }
          .footer-strip {
            flex-direction: column; /* flex-col */
            text-align: center;
            gap: 4px; /* gap-1 */
            padding: 16px 24px;
          }
        }

        @media (max-width: 576px) {
          .cards-grid {
            grid-template-columns: 1fr; /* stacked */
          }
        }
      `}</style>
    </div>
  )
}
