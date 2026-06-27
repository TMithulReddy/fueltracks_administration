import { useEffect, useState, useCallback, useRef } from 'react'
import { Users, Wifi, LogIn, KeyRound, AlertCircle, ScanLine, Coffee, X, Undo2, RefreshCw } from 'lucide-react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import toast from 'react-hot-toast'
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
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cameras, setCameras] = useState([])
  const [cameraIndex, setCameraIndex] = useState(0)
  const [selectedCameraId, setSelectedCameraId] = useState(null)
  const [scanMode, setScanMode] = useState(null) // 'attendance' or 'break'
  const [lastScanResult, setLastScanResult] = useState(null)
  const [lastScanAction, setLastScanAction] = useState(null) // for undo
  const [cooldownIds, setCooldownIds] = useState({}) // { profile_id: timestamp }
  const [isProcessingScan, setIsProcessingScan] = useState(false)
  const html5QrRef = useRef(null)
  const isProcessingScanRef = useRef(false)
  const scannerDivId = 'qr-reader-box'

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
          .eq('status', 'success').in('event_type', ['login', 'qr_scan'])
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

  async function startStream(qr, cameraId, mode) {
    const config = {
      fps: 15,
      qrbox: function(viewfinderWidth, viewfinderHeight) {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
        const boxSize = Math.floor(minEdge * 0.85)
        return { width: boxSize, height: boxSize }
      },
      aspectRatio: 1.0,
      disableFlip: false,
      videoConstraints: {
        width: { min: 640, ideal: 1280, max: 1920 },
        height: { min: 480, ideal: 720, max: 1080 }
      },
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      },
      formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
    }

    await qr.start(
      cameraId,
      config,
      (decodedText) => handleScanSuccess(decodedText, mode),
      () => {}
    )
  }

  async function handleCameraSelect(cameraId, index) {
    if (!html5QrRef.current) return
    localStorage.setItem('fueltracks_preferred_camera_id', cameraId)
    setSelectedCameraId(cameraId)
    setCameraIndex(index)
    try {
      await startStream(html5QrRef.current, cameraId, scanMode)
    } catch (err) {
      console.error('Failed to start stream with selected camera:', err)
      toast.error('Failed to start camera: ' + (err.message || err))
      setSelectedCameraId(null)
    }
  }

  async function startScanner(mode) {
    setScanMode(mode)
    setScannerOpen(true)
    setTimeout(async () => {
      try {
        const qr = new Html5Qrcode(scannerDivId, { verbose: false })
        html5QrRef.current = qr

        const deviceCameras = await Html5Qrcode.getCameras()
        if (!deviceCameras || deviceCameras.length === 0) {
          throw new Error("No cameras found on this device.")
        }
        setCameras(deviceCameras)

        // Check if there is a saved camera preference
        const preferredId = localStorage.getItem('fueltracks_preferred_camera_id')
        const hasPreferred = preferredId && deviceCameras.some(c => c.id === preferredId)

        if (hasPreferred) {
          const prefIndex = deviceCameras.findIndex(c => c.id === preferredId)
          setSelectedCameraId(preferredId)
          setCameraIndex(prefIndex)
          await startStream(qr, preferredId, mode)
        } else if (deviceCameras.length === 1) {
          const singleId = deviceCameras[0].id
          setSelectedCameraId(singleId)
          setCameraIndex(0)
          await startStream(qr, singleId, mode)
        } else {
          // Try to auto-select a camera labeled as facing back
          const backCamera = deviceCameras.find(c => /back/i.test(c.label))
          if (backCamera) {
            const backIndex = deviceCameras.findIndex(c => c.id === backCamera.id)
            setSelectedCameraId(backCamera.id)
            setCameraIndex(backIndex)
            localStorage.setItem('fueltracks_preferred_camera_id', backCamera.id)
            await startStream(qr, backCamera.id, mode)
          } else {
            // No back camera label found — show manual picker as fallback
            setSelectedCameraId(null)
          }
        }

      } catch (err) {
        console.error('Camera scan error:', err)
        let message = 'Unknown error'
        if (err?.message) message = err.message
        else if (typeof err === 'string') message = err
        else if (err?.name) message = err.name

        if (message.includes('NotAllowedError') || err?.name === 'NotAllowedError') {
          message = 'Camera permission denied. Please allow camera access in browser settings.'
        } else if (message.includes('NotFoundError') || err?.name === 'NotFoundError') {
          message = 'No camera found on this device.'
        } else if (message.includes('NotReadableError') || err?.name === 'NotReadableError') {
          message = 'Camera is already in use by another app.'
        } else if (!window.isSecureContext) {
          message = 'Camera requires HTTPS. This page is not secure.'
        }

        toast.error('Camera access failed: ' + message)
        setScannerOpen(false)
      }
    }, 300)
  }

  async function stopScanner() {
    if (html5QrRef.current) {
      try {
        if (html5QrRef.current.isScanning) {
          await html5QrRef.current.stop()
        }
        await html5QrRef.current.clear()
      } catch {}
      html5QrRef.current = null
    }
    setScannerOpen(false)
    setScanMode(null)
    setCameras([])
    setCameraIndex(0)
    setSelectedCameraId(null)
  }

  async function switchCamera() {
    if (!html5QrRef.current || cameras.length <= 1) return

    const nextIndex = (cameraIndex + 1) % cameras.length
    const nextCameraId = cameras[nextIndex]?.id

    // Update state and storage
    setCameraIndex(nextIndex)
    setSelectedCameraId(nextCameraId)
    localStorage.setItem('fueltracks_preferred_camera_id', nextCameraId)

    try {
      if (html5QrRef.current.isScanning) {
        await html5QrRef.current.stop()
      }
    } catch (err) {
      console.error('Error stopping scanner during switch:', err)
    }

    try {
      await startStream(html5QrRef.current, nextCameraId, scanMode)
    } catch (err) {
      console.error('Error restarting scanner with next camera:', err)
      toast.error('Failed to switch camera: ' + (err.message || err))
    }
  }

  async function handleScanSuccess(decodedText, mode) {
    if (isProcessingScanRef.current) return  // ignore while a scan is being processed
    isProcessingScanRef.current = true

    if (html5QrRef.current) {
      try { await html5QrRef.current.pause(true) } catch {}
    }

    let parsed
    try {
      parsed = JSON.parse(decodedText)
    } catch {
      toast.error('QR not recognized')
      if (html5QrRef.current) {
        setTimeout(async () => {
          try { await html5QrRef.current?.resume() } catch {}
          isProcessingScanRef.current = false
        }, 2000)
      } else {
        isProcessingScanRef.current = false
      }
      return
    }

    if (parsed.type !== 'fueltracks_employee' || !parsed.id) {
      toast.error('QR not recognized')
      if (html5QrRef.current) {
        setTimeout(async () => {
          try { await html5QrRef.current?.resume() } catch {}
          isProcessingScanRef.current = false
        }, 2000)
      } else {
        isProcessingScanRef.current = false
      }
      return
    }

    const now = Date.now()
    const lastScan = cooldownIds[parsed.id]
    if (lastScan && now - lastScan < 60000) {
      toast('Already scanned — wait 1 minute before scanning again', { icon: '⏳' })
      if (html5QrRef.current) {
        setTimeout(async () => {
          try { await html5QrRef.current?.resume() } catch {}
          isProcessingScanRef.current = false
        }, 2000)
      } else {
        isProcessingScanRef.current = false
      }
      return
    }
    setCooldownIds(prev => ({ ...prev, [parsed.id]: now }))

    try {
      const rpcName = mode === 'break' ? 'toggle_break_by_qr' : 'toggle_attendance_by_qr'
      
      console.log('Calling RPC', rpcName, 'for profile', parsed.id)
      const { data, error } = await supabase.rpc(rpcName, { p_profile_id: parsed.id })
      console.log('RPC response:', { data, error })

      if (error) throw error
      if (!data) throw new Error('RPC returned no data')

      if (!data.success) {
        toast.error(data.message)
        if (html5QrRef.current) {
          setTimeout(async () => {
            try { await html5QrRef.current?.resume() } catch {}
            isProcessingScanRef.current = false
          }, 2000)
        } else {
          isProcessingScanRef.current = false
        }
        return
      }

      const actionLabels = {
        login: 'Logged IN',
        logout: 'Logged OUT',
        break_start: 'Break STARTED',
        break_end: 'Break ENDED',
      }

      setLastScanResult({
        name: data.full_name,
        action: actionLabels[data.action],
        time: new Date(data.time).toLocaleTimeString(),
        hours: data.hours_worked,
      })

      toast.success(
        `${data.full_name} — ${actionLabels[data.action]} at ${new Date(data.time).toLocaleTimeString()}`,
        { duration: 5000 }
      )

      setLastScanAction({ rpcName, profileId: parsed.id, action: data.action })

      if (rpcName === 'toggle_attendance_by_qr') {
        await recalculateEmployeeStats(parsed.id)
      }

      // Refresh dashboard data after successful scan
      await fetchAll()

      // Pause scanner for 2 seconds after a successful scan before allowing next
      if (html5QrRef.current) {
        setTimeout(async () => {
          try { await html5QrRef.current?.resume() } catch {}
          isProcessingScanRef.current = false
        }, 2000)
      } else {
        isProcessingScanRef.current = false
      }

    } catch (err) {
      console.error('Scan RPC failed:', err)
      toast.error('Failed to mark attendance — check internet connection')
      if (html5QrRef.current) {
        setTimeout(async () => {
          try { await html5QrRef.current?.resume() } catch {}
          isProcessingScanRef.current = false
        }, 2000)
      } else {
        isProcessingScanRef.current = false
      }
    }
  }

  async function recalculateEmployeeStats(profileId) {
    try {
      const { data: history, error: fetchError } = await supabase
        .from('login_history')
        .select('login_at, hours_worked')
        .eq('profile_id', profileId)
        .eq('status', 'success')
        .not('logout_at', 'is', null)

      if (fetchError) throw fetchError

      const historyList = history ?? []
      const uniqueDays = new Set(historyList.map(r => r.login_at?.split('T')[0]).filter(Boolean))
      const totalDaysCount = uniqueDays.size
      const totalHrs = historyList.reduce((sum, r) => sum + parseFloat(r.hours_worked ?? 0), 0)

      const { error: updateError } = await supabase
        .from('employee_details')
        .update({
          total_working_days: totalDaysCount,
          total_working_hours: parseFloat(totalHrs.toFixed(2))
        })
        .eq('profile_id', profileId)

      if (updateError) throw updateError
    } catch (err) {
      console.error('Failed to recalculate employee details stats:', err)
    }
  }

  async function undoLastScan() {
    if (!lastScanAction) return
    try {
      // Calling the same toggle function again reverses the last action
      const { data, error } = await supabase.rpc(lastScanAction.rpcName, { p_profile_id: lastScanAction.profileId })
      if (error) throw error
      toast.success(`Undone — ${data.full_name} reverted`)

      if (lastScanAction.rpcName === 'toggle_attendance_by_qr') {
        await recalculateEmployeeStats(lastScanAction.profileId)
      }

      setLastScanAction(null)
      setLastScanResult(null)
      await fetchAll()
    } catch (err) {
      toast.error('Failed to undo')
    }
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

      {/* ── Attendance Scanner ── */}
      <div style={{
        background: '#FFFFFF', borderRadius: 16, border: '1px solid #DBEAFE',
        boxShadow: '0 2px 8px rgba(0,174,239,0.06)', padding: 20, marginBottom: 24,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: '0 0 4px' }}>
          Attendance Scanner
        </h2>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 16px' }}>
          Scan employee ID cards to mark attendance or breaks
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => startScanner('attendance')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 20px', background: '#00AEEF', color: '#FFFFFF',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <ScanLine size={16}/> Scan Attendance
          </button>

          <button
            onClick={() => startScanner('break')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 20px', background: '#D97706', color: '#FFFFFF',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Coffee size={16}/> Break Scan
          </button>
        </div>

        {lastScanResult && (
          <div style={{
            marginTop: 16, padding: '12px 16px', background: '#F0FFF4',
            border: '1px solid #BBF7D0', borderRadius: 10,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
              {lastScanResult.name} — {lastScanResult.action} at {lastScanResult.time}
              {lastScanResult.hours != null && ` (${lastScanResult.hours} hrs)`}
            </span>
            <button
              onClick={undoLastScan}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', color: '#D97706',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Undo2 size={13}/> Undo
            </button>
          </div>
        )}
      </div>

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

      {scannerOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 16, padding: 20,
            width: '90%', maxWidth: 420,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>
                {scanMode === 'break' ? 'Break Scan' : 'Attendance Scan'}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {cameras.length > 1 && (
                  <button
                    onClick={switchCamera}
                    title="Switch Camera"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: '#00AEEF',
                      fontSize: 13,
                      fontWeight: 600
                    }}
                  >
                    <RefreshCw size={16} />
                    <span>Switch</span>
                  </button>
                )}
                <button onClick={stopScanner} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <X size={20} color="#6B7280"/>
                </button>
              </div>
            </div>
            {!selectedCameraId && cameras.length > 1 ? (
              <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1B3A6B', marginBottom: 16 }}>
                  Select Camera to Use:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cameras.map((cam, idx) => (
                    <button
                      key={cam.id}
                      onClick={() => handleCameraSelect(cam.id, idx)}
                      style={{
                        background: '#00AEEF',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                      }}
                    >
                      {cam.label || `Camera ${idx + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div 
              id={scannerDivId} 
              style={{ 
                width: '100%', 
                borderRadius: 10, 
                overflow: 'hidden',
                display: selectedCameraId || cameras.length <= 1 ? 'block' : 'none'
              }} 
            />
            {(selectedCameraId || cameras.length <= 1) && (
              <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 12 }}>
                Point camera at employee's QR card
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
