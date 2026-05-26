import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  User,
  Phone,
  Mail,
  Briefcase,
  Calendar,
  Clock,
  KeyRound,
  Trash2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Edit,
  Save,
  X,
  History,
  Info,
  CheckCircle,
  FileSpreadsheet,
  Upload,
  Eye,
  FileText,
  DollarSign,
  ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { adminSupabase } from '../../lib/supabaseAdmin'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Avatar from '../../components/shared/Avatar'
import { getSignedUrl } from '../../utils/storageHelpers'

const HISTORY_PAGE_SIZE = 10
const DEPARTMENTS = ['Operations', 'Sales', 'Finance', 'IT', 'HR', 'Logistics']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP']

// Document slot definitions (name, storage filename, employee-visible)
const DOCUMENT_SLOTS = [
  { key: 'offer_letter',   label: 'Offer Letter',      filename: 'offer_letter.pdf',   accept: '.pdf,.doc,.docx', employeeVisible: true },
  { key: 'joining_letter', label: 'Joining Letter',     filename: 'joining_letter.pdf', accept: '.pdf,.doc,.docx', employeeVisible: true },
  { key: 'aadhar_front',   label: 'Aadhar Card (Front)',filename: 'aadhar_front.jpg',   accept: 'image/*,.pdf',    employeeVisible: false },
  { key: 'aadhar_back',    label: 'Aadhar Card (Back)', filename: 'aadhar_back.jpg',    accept: 'image/*,.pdf',    employeeVisible: false },
  { key: 'pan_front',      label: 'PAN Card (Front)',   filename: 'pan_front.jpg',      accept: 'image/*,.pdf',    employeeVisible: false },
  { key: 'pan_back',       label: 'PAN Card (Back)',    filename: 'pan_back.jpg',       accept: 'image/*,.pdf',    employeeVisible: false },
]

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentAdminUser, profile: currentAdminProfile } = useAuth()

  // ── Core State ──────────────────────────────────────────────────────────────
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [analytics, setAnalytics] = useState({ totalDays: 0, totalHours: 0 })

  // Login History
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyCount, setHistoryCount] = useState(0)
  const [historyPage, setHistoryPage] = useState(0)

  // Modals
  const [showResetModal, setShowResetModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // ── Edit Form State ──────────────────────────────────────────────────────────
  const [editForm, setEditForm] = useState({
    employee_id: '',
    full_name: '',
    email: '',
    phone: '',
    blood_group: '',
    aadhar_number: '',
    pan_number: '',
    is_active: true,
    department: 'Operations',
    designation: '',
    employment_type: 'Full-time',
    date_of_joining: '',
  })
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ── Salary State ─────────────────────────────────────────────────────────────
  const [salaryEditMode, setSalaryEditMode] = useState(false)
  const [salaryForm, setSalaryForm] = useState({
    salary_amount: '',
    salary_currency: 'INR',
    salary_effective_date: '',
  })
  const [salarySaving, setSalarySaving] = useState(false)

  // ── Documents State ──────────────────────────────────────────────────────────
  const [docSignedUrls, setDocSignedUrls] = useState({})
  const [docUploading, setDocUploading] = useState({})
  const [docDeleting, setDocDeleting] = useState({})
  const [docsChecked, setDocsChecked] = useState(false)
  const fileInputRefs = useRef({})

  // Modal refs
  const resetModalRef = useRef(null)
  const deleteModalRef = useRef(null)

  // ── Fetch Employee Data ──────────────────────────────────────────────────────
  const fetchEmployeeData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select(`
          id, employee_id, full_name, email, phone, role, is_active, is_online,
          avatar_url, must_change_password, created_at,
          blood_group, aadhar_number, pan_number,
          details:employee_details!profile_id(
            department, designation, date_of_joining, employment_type,
            total_working_days, total_working_hours,
            salary_amount, salary_currency, salary_effective_date
          )
        `)
        .eq('id', id)
        .single()

      if (fetchErr) throw fetchErr
      if (!data) throw new Error('Employee profile not found.')
      if (data.role !== 'employee') throw new Error('This profile is not an employee.')

      setEmployee(data)

      const detailObj = (Array.isArray(data.details) ? data.details[0] : data.details) || {}

      // Calculate statistics dynamically from raw successful login records
      const { data: allHistory, error: allHistErr } = await supabase
        .from('login_history')
        .select('login_at, logout_at, hours_worked')
        .eq('profile_id', id)
        .eq('status', 'success')

      let computedTotalDays = 0
      let computedTotalHours = 0

      if (!allHistErr && allHistory) {
        // Count distinct calendar dates (extract YYYY-MM-DD)
        const uniqueDates = new Set((allHistory ?? []).map(r => r.login_at?.split('T')[0]).filter(Boolean))
        computedTotalDays = uniqueDates.size

        // Calculate hours worked (sum finished + running active session calculated live)
        computedTotalHours = (allHistory ?? []).reduce((sum, r) => {
          if (r.logout_at) {
            return sum + parseFloat(r.hours_worked ?? 0)
          } else {
            // Running session: live duration in hours up to current time
            const loginTime = new Date(r.login_at).getTime()
            const nowTime = new Date().getTime()
            const diffMs = nowTime - loginTime
            const diffMins = Math.max(0, Math.round(diffMs / (1000 * 60)))
            const activeHrs = parseFloat((diffMins / 60).toFixed(2))
            return sum + activeHrs
          }
        }, 0)
      }

      setAnalytics({
        totalDays: computedTotalDays,
        totalHours: computedTotalHours
      })

      setEditForm({
        employee_id: data.employee_id || '',
        full_name: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        blood_group: data.blood_group || '',
        aadhar_number: data.aadhar_number || '',
        pan_number: data.pan_number || '',
        is_active: data.is_active ?? true,
        department: detailObj.department ?? 'Operations',
        designation: detailObj.designation ?? '',
        employment_type: detailObj.employment_type ?? 'Full-time',
        date_of_joining: detailObj.date_of_joining ?? '',
      })

      setSalaryForm({
        salary_amount: detailObj.salary_amount ?? '',
        salary_currency: detailObj.salary_currency ?? 'INR',
        salary_effective_date: detailObj.salary_effective_date ?? '',
      })
    } catch (err) {
      setError(err.message ?? 'Failed to load employee details.')
    } finally {
      setLoading(false)
    }
  }, [id])

  // ── Fetch Login History ──────────────────────────────────────────────────────
  const fetchLoginHistory = useCallback(async (pg = 0) => {
    setHistoryLoading(true)
    try {
      const { data, count, error: histErr } = await supabase
        .from('login_history')
        .select('id, session_id, event_type, login_at, logout_at, session_duration_minutes, hours_worked, status, daily_code_used', { count: 'exact' })
        .eq('profile_id', id)
        .order('login_at', { ascending: false })
        .range(pg * HISTORY_PAGE_SIZE, (pg + 1) * HISTORY_PAGE_SIZE - 1)

      if (histErr) throw histErr
      setHistory(data ?? [])
      setHistoryCount(count ?? 0)
      setHistoryPage(pg)
    } catch (err) {
      console.error('Failed to load login history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [id])

  // ── Fetch Documents (check which slots have files via signed URLs) ────────────
  const fetchDocumentUrls = useCallback(async () => {
    const urls = {}
    await Promise.all(
      DOCUMENT_SLOTS.map(async (slot) => {
        const path = `${id}/${slot.filename}`
        const url = await getSignedUrl(supabase, path, 3600)
        urls[slot.key] = url // null if not found
      })
    )
    setDocSignedUrls(urls)
    setDocsChecked(true)
  }, [id])

  useEffect(() => {
    fetchEmployeeData()
    fetchLoginHistory(0)
    fetchDocumentUrls()
  }, [fetchEmployeeData, fetchLoginHistory, fetchDocumentUrls])

  // ── Edit Form Handler ────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setEditForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  // ── Save Profile ─────────────────────────────────────────────────────────────
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)

    const {
      employee_id, full_name, email, phone,
      blood_group, aadhar_number, pan_number,
      is_active, department, designation, employment_type, date_of_joining,
    } = editForm

    if (!employee_id.trim() || !full_name.trim() || !email.trim() || !department || !designation.trim() || !date_of_joining) {
      toast.error('All required fields must be completed.')
      setSaving(false)
      return
    }

    // Validate aadhar (12 digits if provided)
    if (aadhar_number.trim() && !/^\d{12}$/.test(aadhar_number.trim())) {
      toast.error('Aadhar number must be exactly 12 digits.')
      setSaving(false)
      return
    }

    // Validate PAN (10 alphanumeric chars if provided)
    if (pan_number.trim() && !/^[A-Z0-9]{10}$/i.test(pan_number.trim())) {
      toast.error('PAN number must be exactly 10 alphanumeric characters.')
      setSaving(false)
      return
    }

    try {
      const isIdChanged = employee_id.trim().toUpperCase() !== employee.employee_id
      if (isIdChanged) {
        const { data: existingId } = await supabase.from('profiles').select('id').eq('employee_id', employee_id.trim().toUpperCase()).limit(1)
        if (existingId && existingId.length > 0) throw new Error(`Employee ID "${employee_id.trim().toUpperCase()}" is already assigned.`)
      }

      const isEmailChanged = email.trim().toLowerCase() !== employee.email
      if (isEmailChanged) {
        const { data: existingEmail } = await supabase.from('profiles').select('id').eq('email', email.trim().toLowerCase()).limit(1)
        if (existingEmail && existingEmail.length > 0) throw new Error(`Email "${email.trim().toLowerCase()}" is already in use.`)
        const { error: authUpdateErr } = await adminSupabase.auth.admin.updateUserById(id, { email: email.trim().toLowerCase() })
        if (authUpdateErr) throw authUpdateErr
      }

      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          employee_id: employee_id.trim().toUpperCase(),
          full_name: full_name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          blood_group: blood_group || null,
          aadhar_number: aadhar_number.trim() || null,
          pan_number: pan_number.trim().toUpperCase() || null,
          is_active,
        })
        .eq('id', id)

      if (profileErr) throw profileErr

      const { error: detailsErr } = await supabase
        .from('employee_details')
        .update({ department, designation: designation.trim(), employment_type, date_of_joining })
        .eq('profile_id', id)

      if (detailsErr) throw detailsErr

      // Audit log
      const changedFields = {}
      if (isIdChanged) { changedFields.employee_id = { old: employee.employee_id, new: employee_id.trim().toUpperCase() } }
      if (isEmailChanged) { changedFields.email = { old: employee.email, new: email.trim().toLowerCase() } }
      if (full_name.trim() !== employee.full_name) { changedFields.full_name = { old: employee.full_name, new: full_name.trim() } }
      if (is_active !== employee.is_active) { changedFields.is_active = { old: employee.is_active, new: is_active } }

      supabase.from('admin_audit_log').insert({
        admin_id: currentAdminUser.id,
        admin_employee_id: currentAdminProfile?.employee_id || 'System',
        action_type: isIdChanged ? 'employee_id_changed' : 'profile_updated',
        target_profile_id: id,
        target_employee_id: employee_id.trim().toUpperCase(),
        action_details: changedFields,
      }).then(() => {})

      toast.success('Employee profile updated successfully')
      setEditMode(false)
      await fetchEmployeeData()
    } catch (err) {
      toast.error(err.message ?? 'Failed to update employee details.')
    } finally {
      setSaving(false)
    }
  }

  // ── Save Salary ──────────────────────────────────────────────────────────────
  const handleSaveSalary = async (e) => {
    e.preventDefault()
    setSalarySaving(true)
    const { salary_amount, salary_currency, salary_effective_date } = salaryForm

    try {
      const detailObj = (Array.isArray(employee.details) ? employee.details[0] : employee.details) || {}
      const oldAmount = detailObj.salary_amount

      const { error: salaryErr } = await supabase
        .from('employee_details')
        .update({
          salary_amount: salary_amount !== '' ? parseFloat(salary_amount) : null,
          salary_currency,
          salary_effective_date: salary_effective_date || null,
        })
        .eq('profile_id', id)

      if (salaryErr) throw salaryErr

      supabase.from('admin_audit_log').insert({
        admin_id: currentAdminUser.id,
        admin_employee_id: currentAdminProfile?.employee_id || 'System',
        action_type: 'salary_updated',
        target_profile_id: id,
        target_employee_id: employee.employee_id,
        action_details: {
          old_amount: oldAmount,
          new_amount: salary_amount !== '' ? parseFloat(salary_amount) : null,
          effective_date: salary_effective_date || null,
          currency: salary_currency,
        },
      }).then(() => {})

      toast.success('Salary information updated')
      setSalaryEditMode(false)
      await fetchEmployeeData()
    } catch (err) {
      toast.error(err.message ?? 'Failed to update salary.')
    } finally {
      setSalarySaving(false)
    }
  }

  // ── Document Upload ──────────────────────────────────────────────────────────
  const handleDocumentUpload = async (slot, file) => {
    if (!file) return
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      toast.error('File must be smaller than 10 MB.')
      return
    }

    const path = `${id}/${slot.filename}`
    setDocUploading(prev => ({ ...prev, [slot.key]: true }))

    try {
      const { error: uploadErr } = await supabase.storage
        .from('employee-documents')
        .upload(path, file, { upsert: true })

      if (uploadErr) throw uploadErr

      // Get new signed URL
      const newUrl = await getSignedUrl(supabase, path, 3600)
      setDocSignedUrls(prev => ({ ...prev, [slot.key]: newUrl }))

      supabase.from('admin_audit_log').insert({
        admin_id: currentAdminUser.id,
        admin_employee_id: currentAdminProfile?.employee_id || 'System',
        action_type: 'document_uploaded',
        target_profile_id: id,
        target_employee_id: employee.employee_id,
        action_details: { document_type: slot.key, employee_id: employee.employee_id },
      }).then(() => {})

      toast.success(`${slot.label} uploaded successfully`)
    } catch (err) {
      toast.error(err.message ?? `Failed to upload ${slot.label}.`)
    } finally {
      setDocUploading(prev => ({ ...prev, [slot.key]: false }))
      // Reset input
      if (fileInputRefs.current[slot.key]) fileInputRefs.current[slot.key].value = ''
    }
  }

  // ── Document Delete ──────────────────────────────────────────────────────────
  const handleDocumentDelete = async (slot) => {
    const path = `${id}/${slot.filename}`
    setDocDeleting(prev => ({ ...prev, [slot.key]: true }))

    try {
      const { error: deleteErr } = await supabase.storage
        .from('employee-documents')
        .remove([path])

      if (deleteErr) throw deleteErr

      setDocSignedUrls(prev => ({ ...prev, [slot.key]: null }))

      supabase.from('admin_audit_log').insert({
        admin_id: currentAdminUser.id,
        admin_employee_id: currentAdminProfile?.employee_id || 'System',
        action_type: 'document_deleted',
        target_profile_id: id,
        target_employee_id: employee.employee_id,
        action_details: { document_type: slot.key, employee_id: employee.employee_id },
      }).then(() => {})

      toast.success(`${slot.label} deleted`)
    } catch (err) {
      toast.error(err.message ?? `Failed to delete ${slot.label}.`)
    } finally {
      setDocDeleting(prev => ({ ...prev, [slot.key]: false }))
    }
  }

  // ── Document View ─────────────────────────────────────────────────────────────
  const handleDocumentView = async (slot) => {
    const path = `${id}/${slot.filename}`
    // Refresh signed URL before opening (avoid expired URLs)
    const freshUrl = await getSignedUrl(supabase, path, 3600)
    if (!freshUrl) {
      toast.error('Could not generate document link. File may not exist.')
      return
    }
    setDocSignedUrls(prev => ({ ...prev, [slot.key]: freshUrl }))
    window.open(freshUrl, '_blank', 'noopener,noreferrer')
  }

  // ── Reset Password ────────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    setResetting(true)
    try {
      const { error: authResetErr } = await adminSupabase.auth.admin.updateUserById(id, { password: 'Fueltracks@1234' })
      if (authResetErr) throw authResetErr

      const { error: profileResetErr } = await supabase.from('profiles').update({ must_change_password: true }).eq('id', id)
      if (profileResetErr) throw profileResetErr

      supabase.from('admin_audit_log').insert({
        admin_id: currentAdminUser.id,
        admin_employee_id: currentAdminProfile?.employee_id || 'System',
        action_type: 'password_reset',
        target_profile_id: id,
        target_employee_id: employee.employee_id,
        action_details: { reset_by: currentAdminProfile?.employee_id || currentAdminUser.email },
      }).then(() => {})

      toast.success('Password reset to Fueltracks@1234')
      setShowResetModal(false)
      await fetchEmployeeData()
    } catch (err) {
      toast.error(err.message ?? 'Failed to reset password.')
    } finally {
      setResetting(false)
    }
  }

  // ── Delete Employee ──────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      // Step 1: Delete storage files (fire and forget — files may not exist)
      const filePaths = [
        `${id}/offer_letter.pdf`,
        `${id}/joining_letter.pdf`,
        `${id}/aadhar_front.jpg`,
        `${id}/aadhar_back.jpg`,
        `${id}/pan_front.jpg`,
        `${id}/pan_back.jpg`,
      ]
      supabase.storage.from('employee-documents').remove(filePaths).then(() => {})
      supabase.storage.from('avatars').remove([`avatars/${id}`]).then(() => {})

      // Step 2: Use atomic RPC to delete all DB records in one transaction
      // This also writes the audit log only on success
      const { data: deleteResult, error: rpcError } = await supabase.rpc(
        'delete_employee_complete',
        {
          p_employee_profile_id: id,
          p_admin_id: currentAdminUser.id,
          p_admin_employee_id: currentAdminProfile?.employee_id || 'System',
          p_employee_name: employee.full_name,
          p_employee_id_str: employee.employee_id,
        }
      )

      if (rpcError) throw rpcError
      if (!deleteResult?.success) throw new Error(deleteResult?.message || 'Delete failed')

      // Step 3: Delete auth user AFTER DB records are gone
      const { error: authDelErr } = await adminSupabase.auth.admin.deleteUser(id)
      if (authDelErr) {
        // Auth user deletion failed but DB is already clean
        // Log warning but don't fail — user can no longer login anyway (profile gone)
        console.warn('[Delete] Auth user deletion failed:', authDelErr.message)
      }

      toast.success('Employee deleted successfully')
      navigate('/admin/employees')
    } catch (err) {
      toast.error(err.message ?? 'Failed to delete employee.')
    } finally {
      setDeleting(false)
    }
  }

  // ── Focus Trap ───────────────────────────────────────────────────────────────
  const trapFocus = (e, modalRef) => {
    if (!modalRef.current) return
    const focusable = modalRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.key === 'Tab') {
      if (e.shiftKey) { if (document.activeElement === first) { last.focus(); e.preventDefault() } }
      else { if (document.activeElement === last) { first.focus(); e.preventDefault() } }
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showResetModal) setShowResetModal(false)
        if (showDeleteModal) setShowDeleteModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showResetModal, showDeleteModal])

  useEffect(() => {
    if (showResetModal && resetModalRef.current) {
      setTimeout(() => { const c = resetModalRef.current?.querySelector('#cancel-reset-btn'); c?.focus() }, 50)
    }
  }, [showResetModal])

  useEffect(() => {
    if (showDeleteModal && deleteModalRef.current) {
      setTimeout(() => { const c = deleteModalRef.current?.querySelector('#cancel-delete-btn'); c?.focus() }, 50)
    }
  }, [showDeleteModal])

  // ── Format Helpers ───────────────────────────────────────────────────────────
  const fmtJoinedDate = (d) => { if (!d) return '—'; try { return format(parseISO(d), 'd MMM yyyy') } catch { return d } }
  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) return '—'
    const hrs = Math.floor(minutes / 60); const mins = minutes % 60
    if (hrs === 0) return `${mins} mins`
    if (mins === 0) return `${hrs} hrs`
    return `${hrs} hrs ${mins} mins`
  }
  const formatHours = (hrs) => { if (hrs === null || hrs === undefined) return '0.00 hrs'; return `${parseFloat(hrs).toFixed(2)} hrs` }
  const fmtLogTime = (ts) => { if (!ts) return '—'; try { return format(parseISO(ts), 'h:mm a') } catch { return ts } }
  const fmtLogDate = (ts) => { if (!ts) return '—'; try { return format(parseISO(ts), 'd MMM yyyy') } catch { return ts } }

  // ── Render Guards ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 32, textAlign: 'center', boxShadow: '0 2px 12px rgba(0,174,239,0.08)' }}>
        <AlertCircle size={40} color="#E8192C" style={{ marginBottom: 12 }} />
        <h2 style={{ fontSize: 18, color: '#1B3A6B', margin: '0 0 8px' }}>Error Loading Profile</h2>
        <p style={{ color: '#6B7280', margin: '0 0 20px' }}>{error || 'Employee details could not be retrieved.'}</p>
        <Link to="/admin/employees" className="btn-navy" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Back to Directory
        </Link>
      </div>
    )
  }

  const detailObj = (Array.isArray(employee.details) ? employee.details[0] : employee.details) || {}
  const totalDays = analytics.totalDays
  const totalHours = analytics.totalHours
  const averageHours = totalDays > 0 ? (totalHours / totalDays).toFixed(2) : '0.00'
  const historyTotalPages = Math.ceil(historyCount / HISTORY_PAGE_SIZE)

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link to="/admin/employees" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#00AEEF', fontWeight: 600, textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Employee Directory
        </Link>
      </div>

      {/* Two-Column Grid */}
      <div className="admin-two-col" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, marginBottom: 24 }}>

        {/* ── Left Column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Card 1: Personal Information */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #DBEAFE', paddingBottom: 16, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar src={employee.avatar_url} name={employee.full_name} size="md" online={employee.is_online && employee.is_active} />
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>{employee.full_name}</h2>
                  <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>ID: {employee.employee_id}</p>
                </div>
              </div>
              {!editMode && (
                <button onClick={() => setEditMode(true)} className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  id="edit-profile-btn">
                  <Edit size={12} /> Edit Profile
                </button>
              )}
            </div>

            {editMode ? (
              <form onSubmit={handleSaveProfile}>
                {/* Row 1: Employee ID + Full Name */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label htmlFor="edit_employee_id" style={labelStyle}>Employee ID *</label>
                    <input id="edit_employee_id" name="employee_id" type="text" required value={editForm.employee_id} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }} />
                    <span style={{ display: 'block', fontSize: 10, color: '#E8192C', marginTop: 4, fontWeight: 500 }}>⚠️ Changing this affects login credentials</span>
                  </div>
                  <div>
                    <label htmlFor="edit_full_name" style={labelStyle}>Full Name *</label>
                    <input id="edit_full_name" name="full_name" type="text" required value={editForm.full_name} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }} />
                  </div>
                </div>

                {/* Row 2: Email + Phone */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label htmlFor="edit_email" style={labelStyle}>Email Address *</label>
                    <input id="edit_email" name="email" type="email" required value={editForm.email} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }} />
                  </div>
                  <div>
                    <label htmlFor="edit_phone" style={labelStyle}>Phone Number</label>
                    <input id="edit_phone" name="phone" type="text" value={editForm.phone} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }} />
                  </div>
                </div>

                {/* Row 3: Blood Group + Aadhar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label htmlFor="edit_blood_group" style={labelStyle}>Blood Group</label>
                    <select id="edit_blood_group" name="blood_group" value={editForm.blood_group} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }}>
                      <option value="">— Not specified —</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="edit_aadhar_number" style={labelStyle}>Aadhar Number</label>
                    <input id="edit_aadhar_number" name="aadhar_number" type="text" maxLength={12} placeholder="12-digit Aadhar" value={editForm.aadhar_number} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }} />
                  </div>
                </div>

                {/* Row 4: PAN */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label htmlFor="edit_pan_number" style={labelStyle}>PAN Number</label>
                    <input id="edit_pan_number" name="pan_number" type="text" maxLength={10} placeholder="10-char PAN" value={editForm.pan_number} onChange={handleInputChange} className="input-field" style={{ fontSize: 13, textTransform: 'uppercase' }} />
                  </div>
                  <div>
                    <label htmlFor="edit_department" style={labelStyle}>Department *</label>
                    <select id="edit_department" name="department" value={editForm.department} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }}>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 5: Designation + Employment Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label htmlFor="edit_designation" style={labelStyle}>Designation *</label>
                    <input id="edit_designation" name="designation" type="text" required value={editForm.designation} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }} />
                  </div>
                  <div>
                    <label htmlFor="edit_employment_type" style={labelStyle}>Employment Type *</label>
                    <select id="edit_employment_type" name="employment_type" value={editForm.employment_type} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }}>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                </div>

                {/* Row 6: Date of Joining */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label htmlFor="edit_date_of_joining" style={labelStyle}>Date of Joining *</label>
                    <input id="edit_date_of_joining" name="date_of_joining" type="date" required value={editForm.date_of_joining} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }} />
                  </div>
                </div>

                {/* Active checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <input id="edit_is_active" name="is_active" type="checkbox" checked={editForm.is_active} onChange={handleInputChange} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <label htmlFor="edit_is_active" style={{ fontSize: 13, fontWeight: 600, color: '#1B3A6B', cursor: 'pointer' }}>Account Active</label>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #F0F7FF', paddingTop: 14 }}>
                  <button type="button" onClick={() => setEditMode(false)} disabled={saving} className="btn-secondary" style={{ fontSize: 13 }}>Cancel</button>
                  <button type="submit" disabled={saving} className="btn-primary" style={{ fontSize: 13 }} id="save-profile-submit">
                    {saving ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</> : <><Save size={14} /> Save Changes</>}
                  </button>
                </div>
              </form>
            ) : (
              /* View Mode */
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, rowGap: 14 }}>
                  <InfoRow label="Email Address" icon={<Mail size={13} color="#00AEEF" />} value={employee.email} />
                  <InfoRow label="Phone Number" icon={<Phone size={13} color="#00AEEF" />} value={employee.phone || '—'} />
                  <InfoRow label="Department" icon={<Briefcase size={13} color="#00AEEF" />} value={detailObj.department ?? '—'} />
                  <InfoRow label="Designation" value={detailObj.designation ?? '—'} />
                  <InfoRow label="Employment Type" value={<span className="badge badge-navy">{detailObj.employment_type ?? 'Full-time'}</span>} />
                  <InfoRow label="Date of Joining" icon={<Calendar size={13} color="#00AEEF" />} value={fmtJoinedDate(detailObj.date_of_joining)} />
                  <InfoRow label="Blood Group" value={employee.blood_group || '—'} />
                  <InfoRow label="Aadhar Number" value={employee.aadhar_number ? `**** **** ${employee.aadhar_number.slice(-4)}` : '—'} />
                  <InfoRow label="PAN Number" value={employee.pan_number || '—'} />
                </div>

                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #F0F7FF', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Account Status</span>
                    <span className={`badge ${employee.is_active ? 'badge-green' : 'badge-red'}`}>{employee.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Presence Status</span>
                    <span className={`badge ${employee.is_online && employee.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {employee.is_online && employee.is_active ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Access Mode</span>
                    <span className="badge badge-blue">{employee.must_change_password ? 'Must Reset Password' : 'Password Validated'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Attendance Summary */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={16} color="#00AEEF" /> Attendance Summary
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { label: 'Total Working Days', value: totalDays },
                { label: 'Total Working Hours', value: formatHours(totalHours) },
                { label: 'Avg Hours/Day', value: `${averageHours} hrs` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#F8FBFF', border: '1px solid #DBEAFE', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{label}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, color: '#1B3A6B' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Document Management */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color="#00AEEF" /> Document Management
            </h2>
            <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 16px' }}>
              Upload and manage employee documents. All files are stored securely and accessed via signed URLs.
            </p>

            {!docsChecked ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <LoadingSpinner size="sm" />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {DOCUMENT_SLOTS.map(slot => {
                  const exists = !!docSignedUrls[slot.key]
                  const isUploading = !!docUploading[slot.key]
                  const isDeleting = !!docDeleting[slot.key]

                  return (
                    <div key={slot.key} style={{
                      border: `1.5px solid ${exists ? '#DBEAFE' : '#E5E7EB'}`,
                      borderRadius: 10, padding: 14,
                      background: exists ? '#F8FBFF' : '#FAFAFA',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: exists ? 'rgba(0,174,239,0.1)' : 'rgba(107,114,128,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <FileText size={15} color={exists ? '#00AEEF' : '#9CA3AF'} />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1B3A6B' }}>{slot.label}</p>
                          <p style={{ margin: 0, fontSize: 10, color: exists ? '#16A34A' : '#9CA3AF' }}>
                            {exists ? '✓ Uploaded' : 'Not uploaded'}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        {/* Upload */}
                        <input
                          type="file"
                          accept={slot.accept}
                          ref={el => fileInputRefs.current[slot.key] = el}
                          style={{ display: 'none' }}
                          onChange={e => handleDocumentUpload(slot, e.target.files?.[0])}
                          id={`doc-upload-${slot.key}`}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[slot.key]?.click()}
                          disabled={isUploading || isDeleting}
                          style={{
                            flex: 1, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            padding: '6px 8px', borderRadius: 6, border: '1px solid #DBEAFE',
                            background: '#FFFFFF', color: '#1B3A6B',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            opacity: isUploading ? 0.6 : 1,
                          }}
                        >
                          {isUploading ? <Loader2 size={11} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Upload size={11} />}
                          {exists ? 'Replace' : 'Upload'}
                        </button>

                        {/* View */}
                        {exists && (
                          <button
                            type="button"
                            onClick={() => handleDocumentView(slot)}
                            disabled={isDeleting}
                            style={{
                              fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              padding: '6px 8px', borderRadius: 6, border: '1px solid #00AEEF',
                              background: 'rgba(0,174,239,0.08)', color: '#00AEEF',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                            title="Open document"
                          >
                            <Eye size={11} /> View
                          </button>
                        )}

                        {/* Delete */}
                        {exists && (
                          <button
                            type="button"
                            onClick={() => handleDocumentDelete(slot)}
                            disabled={isUploading || isDeleting}
                            style={{
                              fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              padding: '6px 8px', borderRadius: 6, border: '1px solid #FCA5A5',
                              background: 'rgba(239,68,68,0.06)', color: '#E8192C',
                              display: 'flex', alignItems: 'center', gap: 4,
                              opacity: isDeleting ? 0.6 : 1,
                            }}
                            title="Delete document"
                          >
                            {isDeleting ? <Loader2 size={11} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Trash2 size={11} />}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ marginTop: 12, padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={13} color="#D97706" />
              <p style={{ margin: 0, fontSize: 11, color: '#92400E' }}>
                Documents are stored privately. Employees can only view Offer Letter and Joining Letter via secure signed links.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Card 4: Admin Controls */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={16} color="#00AEEF" /> Admin Controls
            </h2>

            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                Reset this employee's password to the default temporary credential. This forces a password change on their next sign-in.
              </p>
              <button onClick={() => setShowResetModal(true)} className="btn-navy"
                style={{ width: '100%', fontSize: 13, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                id="reset-password-trigger">
                <KeyRound size={14} /> Reset Employee Password
              </button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid #DBEAFE', margin: '20px 0' }} />

            {/* Danger Zone */}
            <div style={{ border: '1.5px solid #FCA5A5', borderRadius: 8, padding: 16, background: 'rgba(239,68,68,0.02)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#E8192C', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={14} /> Danger Zone
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
                Permanently delete this user account, their details profile, and all login history logs from the database.
              </p>
              <button onClick={() => setShowDeleteModal(true)} className="btn-danger"
                style={{ width: '100%', fontSize: 13, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                id="delete-employee-trigger">
                <Trash2 size={14} /> Delete Employee Account
              </button>
            </div>
          </div>

          {/* Card 5: Salary Information (Admin Only) */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={16} color="#00AEEF" /> Salary Information
              </h2>
              {!salaryEditMode && (
                <button onClick={() => setSalaryEditMode(true)} className="btn-secondary"
                  style={{ padding: '5px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Edit size={11} /> Edit
                </button>
              )}
            </div>

            <div style={{ padding: '8px 10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <ShieldAlert size={13} color="#D97706" />
              <p style={{ margin: 0, fontSize: 11, color: '#92400E' }}>Admin-only. This data is never shown to employees.</p>
            </div>

            {salaryEditMode ? (
              <form onSubmit={handleSaveSalary}>
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="salary_amount" style={labelStyle}>Salary Amount</label>
                  <input
                    id="salary_amount" type="number" step="0.01" min="0"
                    placeholder="e.g. 50000"
                    value={salaryForm.salary_amount}
                    onChange={e => setSalaryForm(p => ({ ...p, salary_amount: e.target.value }))}
                    className="input-field" style={{ fontSize: 13 }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label htmlFor="salary_currency" style={labelStyle}>Currency</label>
                  <select id="salary_currency" value={salaryForm.salary_currency}
                    onChange={e => setSalaryForm(p => ({ ...p, salary_currency: e.target.value }))}
                    className="input-field" style={{ fontSize: 13 }}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="salary_effective_date" style={labelStyle}>Effective Date</label>
                  <input
                    id="salary_effective_date" type="date"
                    value={salaryForm.salary_effective_date}
                    onChange={e => setSalaryForm(p => ({ ...p, salary_effective_date: e.target.value }))}
                    className="input-field" style={{ fontSize: 13 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setSalaryEditMode(false)} disabled={salarySaving} className="btn-secondary" style={{ flex: 1, fontSize: 12 }}>Cancel</button>
                  <button type="submit" disabled={salarySaving} className="btn-primary" style={{ flex: 1, fontSize: 12 }} id="save-salary-btn">
                    {salarySaving ? <><Loader2 size={12} style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</> : <><Save size={12} /> Save</>}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SalaryRow label="Salary Amount"
                  value={detailObj.salary_amount != null ? `${detailObj.salary_currency || 'INR'} ${parseFloat(detailObj.salary_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'} />
                <SalaryRow label="Currency" value={detailObj.salary_currency || '—'} />
                <SalaryRow label="Effective Date" value={fmtJoinedDate(detailObj.salary_effective_date)} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card 6: Login & Logout History (Full Width) */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={16} color="#00AEEF" /> Login & Logout History
          </h2>
        </div>

        {historyLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>
        ) : history.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <FileSpreadsheet size={36} color="#DBEAFE" style={{ marginBottom: 10 }} />
            <p style={{ margin: 0, fontSize: 14, color: '#6B7280' }}>No login history found for this employee</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FBFF' }}>
                  {['Date', 'Login Time', 'Logout Time', 'Duration', 'Hours Worked', 'Auth Code Used', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #DBEAFE', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={row.id ?? i} style={{ borderBottom: '1px solid #F0F7FF' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FBFF'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, color: '#1B3A6B', whiteSpace: 'nowrap' }}>{fmtLogDate(row.login_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280' }}>{fmtLogTime(row.login_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280' }}>{fmtLogTime(row.logout_at)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{formatDuration(row.session_duration_minutes)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#1B3A6B', whiteSpace: 'nowrap' }}>{formatHours(row.hours_worked)}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', fontFamily: 'monospace' }}>{row.daily_code_used || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {row.status === 'success'
                        ? <span className="badge badge-green">Success</span>
                        : row.status === 'expired'
                          ? <span className="badge" style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316', fontWeight: 600 }}>Expired</span>
                          : <span className="badge badge-red">Failed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {historyTotalPages > 1 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>Page {historyPage + 1} of {historyTotalPages} ({historyCount} total)</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => fetchLoginHistory(historyPage - 1)} disabled={historyPage === 0 || historyLoading}
                className="btn-secondary" style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                id="history-pagination-prev">
                <ChevronLeft size={14} /> Prev
              </button>
              <button onClick={() => fetchLoginHistory(historyPage + 1)} disabled={historyPage >= historyTotalPages - 1 || historyLoading}
                className="btn-secondary" style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                id="history-pagination-next">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Reset Password Modal ── */}
      {showResetModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onKeyDown={e => trapFocus(e, resetModalRef)} ref={resetModalRef}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, maxWidth: 420, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <KeyRound size={24} color="#00AEEF" style={{ flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1B3A6B' }}>Reset Employee Password</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  Are you sure you want to reset <strong>{employee.full_name}</strong>'s password?
                  Their password will be reset to <strong>Fueltracks@1234</strong>, and they will be forced to change it on next login.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setShowResetModal(false)} disabled={resetting} className="btn-secondary" id="cancel-reset-btn" style={{ fontSize: 13 }}>Cancel</button>
              <button type="button" onClick={handleResetPassword} disabled={resetting} className="btn-primary" id="confirm-reset-btn" style={{ fontSize: 13 }}>
                {resetting ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Resetting…</> : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onKeyDown={e => trapFocus(e, deleteModalRef)} ref={deleteModalRef}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, maxWidth: 420, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <AlertCircle size={24} color="#E8192C" style={{ flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1B3A6B' }}>Delete Account & Data</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete <strong>{employee.full_name}</strong>'s account?
                  All profile info, work details, and login history will be removed. This cannot be undone.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setShowDeleteModal(false)} disabled={deleting} className="btn-secondary" id="cancel-delete-btn" style={{ fontSize: 13 }}>Cancel</button>
              <button type="button" onClick={handleDeleteConfirm} disabled={deleting} className="btn-danger" id="confirm-delete-btn" style={{ fontSize: 13 }}>
                {deleting ? <><Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Deleting…</> : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .admin-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ── Helper sub-components ──────────────────────────────────────────────────────
function InfoRow({ label, icon, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: '#1B3A6B', display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}{value}
      </p>
    </div>
  )
}

function SalaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F0F7FF' }}>
      <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1B3A6B' }}>{value}</span>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: '#1B3A6B', marginBottom: 4 }
