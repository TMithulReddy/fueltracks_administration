import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * ErrorBoundary — catches unexpected render errors anywhere in the tree.
 * Wrap the entire app (in main.jsx) so no crash is ever unhandled.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#F0F7FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(0,174,239,0.10)',
            border: '1px solid #DBEAFE',
            padding: 48,
            maxWidth: 440,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(232,25,44,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}
          >
            <AlertTriangle size={36} color="#E8192C" />
          </div>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#1B3A6B',
              margin: '0 0 12px',
            }}
          >
            Something went wrong
          </h1>

          <p
            style={{
              fontSize: 14,
              color: '#6B7280',
              margin: '0 0 32px',
              lineHeight: 1.6,
            }}
          >
            An unexpected error occurred.
            <br />
            Please refresh the page to continue.
          </p>

          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#00AEEF',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '12px 28px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1B3A6B')}
            onMouseLeave={e => (e.currentTarget.style.background = '#00AEEF')}
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }
}
