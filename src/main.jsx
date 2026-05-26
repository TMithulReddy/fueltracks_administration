import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/shared/ErrorBoundary'
import { startKeepAlive } from './utils/keepAlive'

// Start keep-alive ping to prevent Supabase free tier sleeping
startKeepAlive()

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
