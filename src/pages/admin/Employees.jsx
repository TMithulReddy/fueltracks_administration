import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Trash2,
  Eye,
  X,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  Plus
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { adminSupabase } from '../../lib/supabaseAdmin'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Avatar from '../../components/shared/Avatar'

const PAGE_SIZE = 10
const DEPARTMENTS = ['Operations', 'Sales', 'Finance', 'IT', 'HR', 'Logistics']
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

export default function Employees() {
  const { user: currentAdminUser, profile: currentAdminProfile } = useAuth()

  // State
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  // Form State for Add Employee
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    email: '',
    phone: '',
    department: 'Operations',
    designation: '',
    employment_type: 'Full-time',
    date_of_joining: new Date().toISOString().split('T')[0],
    blood_group: '',
    aadhar_number: '',
    pan_number: '',
  })
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  // Refs for focus trapping
  const addModalRef = useRef(null)
  const deleteModalRef = useRef(null)

  // Fetch employees
  const fetchEmployees = useCallback(async (pg = 0) => {
    setLoading(true)
    setError('')
    try {
      // We need to fetch profiles and join with employee_details
      let query = supabase
        .from('profiles')
        .select(`
          id, employee_id, full_name, email, phone, role, is_active, is_online, avatar_url, created_at,
          details:employee_details!profile_id(department, designation, date_of_joining, employment_type)
        `, { count: 'exact' })
        .eq('role', 'employee')
        .order('employee_id', { ascending: true })

      // Apply Filters
      if (search.trim()) {
        query = query.or(
          `full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,employee_id.ilike.%${search.trim()}%`
        )
      }

      if (statusFilter !== '') {
        query = query.eq('is_active', statusFilter === 'active')
      }

      // Range for pagination
      query = query.range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1)

      const { data, count, error: fetchErr } = await query
      if (fetchErr) throw fetchErr

      // Wait, Department filter is inside joined table, so we filter programmatically if selected
      // But if there is pagination, filtering programmatically on client side messes up counts.
      // So let's handle department filtering on Supabase if possible.
      // In Supabase JS, to filter on joined table, we can query employee_details first and get profile IDs, OR
      // we can do: `query.eq('employee_details.department', deptFilter)` but that still returns the profile if detail doesn't match unless we filter it out.
      // Let's filter by department if selected.
      if (deptFilter) {
        // Fetch profiles matching department first
        const { data: detailData, error: detailErr } = await supabase
          .from('employee_details')
          .select('profile_id')
          .eq('department', deptFilter)
        
        if (detailErr) throw detailErr
        const matchingIds = (detailData ?? []).map(d => d.profile_id)
        
        // Fetch with ID filter
        if (matchingIds.length === 0) {
          setEmployees([])
          setTotalCount(0)
          setPage(0)
          return
        }
        
        let filteredQuery = supabase
          .from('profiles')
          .select(`
            id, employee_id, full_name, email, phone, role, is_active, is_online, avatar_url, created_at,
            details:employee_details!profile_id(department, designation, date_of_joining, employment_type)
          `, { count: 'exact' })
          .eq('role', 'employee')
          .in('id', matchingIds)
          .order('employee_id', { ascending: true })

        if (search.trim()) {
          filteredQuery = filteredQuery.or(
            `full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,employee_id.ilike.%${search.trim()}%`
          )
        }
        if (statusFilter !== '') {
          filteredQuery = filteredQuery.eq('is_active', statusFilter === 'active')
        }
        
        filteredQuery = filteredQuery.range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1)
        
        const { data: fData, count: fCount, error: fErr } = await filteredQuery
        if (fErr) throw fErr
        
        setEmployees(fData ?? [])
        setTotalCount(fCount ?? 0)
      } else {
        setEmployees(data ?? [])
        setTotalCount(count ?? 0)
      }

      setPage(pg)
    } catch (err) {
      setError(err.message ?? 'Failed to load employees.')
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }, [search, deptFilter, statusFilter])

  useEffect(() => {
    fetchEmployees(0)
  }, [fetchEmployees])

  // Handle Input Changes for Add Form
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Escape key and focus trap handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showAddModal) setShowAddModal(false)
        if (showDeleteModal) setShowDeleteModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAddModal, showDeleteModal])

  // Focus trap implementation
  const trapFocus = (e, modalRef) => {
    if (!modalRef.current) return
    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus()
          e.preventDefault()
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus()
          e.preventDefault()
        }
      }
    }
  }

  // Open add modal and focus first field
  useEffect(() => {
    if (showAddModal && addModalRef.current) {
      setTimeout(() => {
        const firstInput = addModalRef.current.querySelector('input')
        if (firstInput) firstInput.focus()
      }, 50)
    }
  }, [showAddModal])

  // Open delete modal and focus cancel button
  useEffect(() => {
    if (showDeleteModal && deleteModalRef.current) {
      setTimeout(() => {
        const cancelBtn = deleteModalRef.current.querySelector('#cancel-delete-btn')
        if (cancelBtn) cancelBtn.focus()
      }, 50)
    }
  }, [showDeleteModal])

  // Reset Add Form
  const resetAddForm = () => {
    setFormData({
      employee_id: '',
      full_name: '',
      email: '',
      phone: '',
      department: 'Operations',
      designation: '',
      employment_type: 'Full-time',
      date_of_joining: new Date().toISOString().split('T')[0],
      blood_group: '',
      aadhar_number: '',
      pan_number: '',
    })
  }

  // Handle Add Employee Submit
  const handleAddEmployee = async (e) => {
    e.preventDefault()
    setFormSubmitting(true)
    
    const {
      employee_id,
      full_name,
      email,
      phone,
      department,
      designation,
      employment_type,
      date_of_joining,
      blood_group,
      aadhar_number,
      pan_number,
    } = formData

    // Validate optional fields
    if (aadhar_number.trim() && !/^\d{12}$/.test(aadhar_number.trim())) {
      toast.error('Aadhar number must be exactly 12 digits.')
      setFormSubmitting(false)
      return
    }
    if (pan_number.trim() && !/^[A-Z0-9]{10}$/i.test(pan_number.trim())) {
      toast.error('PAN number must be exactly 10 alphanumeric characters.')
      setFormSubmitting(false)
      return
    }

    // Basic validation
    if (!employee_id.trim() || !full_name.trim() || !email.trim() || !department || !designation.trim() || !date_of_joining) {
      toast.error('Please fill in all required fields.')
      setFormSubmitting(false)
      return
    }

    try {
      // 1. Check if employee_id already exists in profiles
      const { data: existingId, error: checkIdErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('employee_id', employee_id.trim())
        .limit(1)
      
      if (checkIdErr) throw checkIdErr
      if (existingId && existingId.length > 0) {
        toast.error(`Employee ID "${employee_id}" is already assigned to another profile.`)
        setFormSubmitting(false)
        return
      }

      // 2. Check if email already exists in profiles
      const { data: existingEmail, error: checkEmailErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .limit(1)

      if (checkEmailErr) throw checkEmailErr
      if (existingEmail && existingEmail.length > 0) {
        toast.error(`Email "${email}" is already in use.`)
        setFormSubmitting(false)
        return
      }

      // 3. Create auth user in Supabase
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: 'Fueltracks@1234',
        email_confirm: true,
        user_metadata: { role: 'employee' }
      })

      if (authError) throw authError
      const newUserId = authData.user.id

      // 4. Create profile entry
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          employee_id: employee_id.trim().toUpperCase(),
          full_name: full_name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          role: 'employee',
          is_active: true,
          must_change_password: true,
          created_by: currentAdminUser.id,
          blood_group: blood_group || null,
          aadhar_number: aadhar_number.trim() || null,
          pan_number: pan_number.trim().toUpperCase() || null,
        })

      if (profileError) {
        // Rollback user creation
        await adminSupabase.auth.admin.deleteUser(newUserId)
        throw profileError
      }

      // 5. Create employee details entry
      const { error: detailsError } = await supabase
        .from('employee_details')
        .insert({
          profile_id: newUserId,
          department,
          designation: designation.trim(),
          date_of_joining,
          employment_type,
          total_working_days: 0,
          total_working_hours: 0.0
        })

      if (detailsError) {
        // Rollback profile and user creation
        await supabase.from('profiles').delete().eq('id', newUserId)
        await adminSupabase.auth.admin.deleteUser(newUserId)
        throw detailsError
      }

      // 6. Write admin audit log
      supabase
        .from('admin_audit_log')
        .insert({
          admin_id: currentAdminUser.id,
          admin_employee_id: currentAdminProfile?.employee_id || 'System',
          action_type: 'employee_created',
          target_profile_id: newUserId,
          target_employee_id: employee_id.trim().toUpperCase(),
          action_details: {
            full_name: full_name.trim(),
            email: email.trim().toLowerCase(),
            department,
            designation: designation.trim(),
            employment_type
          }
        })
        .then(({ error }) => {
          if (error) console.error('[Audit Log] Failed to write:', error)
        })

      toast.success('Employee created successfully with temporary password "Fueltracks@1234"')
      setShowAddModal(false)
      resetAddForm()
      await fetchEmployees(0)
    } catch (err) {
      toast.error(err.message ?? 'Failed to create employee.')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Handle Delete Employee Click
  const handleDeleteClick = (emp) => {
    setSelectedEmployee(emp)
    setShowDeleteModal(true)
  }

  // Handle Delete Confirm
  const handleDeleteConfirm = async () => {
    if (!selectedEmployee) return
    setDeleteSubmitting(true)

    const empId = selectedEmployee.employee_id
    const profileId = selectedEmployee.id
    const fullName = selectedEmployee.full_name

    try {
      // Step 1: Delete storage files (fire and forget)
      const filePaths = [
        `${profileId}/offer_letter.pdf`,
        `${profileId}/joining_letter.pdf`,
        `${profileId}/aadhar_front.jpg`,
        `${profileId}/aadhar_back.jpg`,
        `${profileId}/pan_front.jpg`,
        `${profileId}/pan_back.jpg`,
      ]
      supabase.storage.from('employee-documents').remove(filePaths).then(() => {})
      supabase.storage.from('avatars').remove([`avatars/${profileId}`]).then(() => {})

      // Step 2: Atomic RPC delete — handles DB records + audit log in one transaction
      const { data: deleteResult, error: rpcError } = await supabase.rpc(
        'delete_employee_complete',
        {
          p_employee_profile_id: profileId,
          p_admin_id: currentAdminUser.id,
          p_admin_employee_id: currentAdminProfile?.employee_id || 'System',
          p_employee_name: fullName,
          p_employee_id_str: empId,
        }
      )

      if (rpcError) throw rpcError
      if (!deleteResult?.success) throw new Error(deleteResult?.message || 'Delete failed')

      // Step 3: Delete auth user AFTER DB cleanup succeeded
      const { error: authDelErr } = await adminSupabase.auth.admin.deleteUser(profileId)
      if (authDelErr) {
        console.warn('[Delete] Auth user deletion failed:', authDelErr.message)
      }

      toast.success(`Employee ${fullName} deleted successfully.`)
      setShowDeleteModal(false)
      setSelectedEmployee(null)

      const isPageEmptyAfterDelete = employees.length === 1 && page > 0
      await fetchEmployees(isPageEmptyAfterDelete ? page - 1 : page)
    } catch (err) {
      toast.error(err.message ?? 'Failed to delete employee.')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  // Format joined date helper
  const fmtJoinedDate = (d) => {
    if (!d) return '—'
    try {
      return format(parseISO(d), 'd MMM yyyy')
    } catch {
      return d
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const hasFilters = search || deptFilter || statusFilter

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Employee Management</h1>
          <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0 0' }}>
            Manage employee directories, credentials, and access records.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          id="add-employee-trigger"
        >
          <UserPlus size={16} />
          Add Employee
        </button>
      </div>

      {/* Filters Card */}
      <div style={{
        background: '#FFFFFF', borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,174,239,0.08)',
        padding: 16, marginBottom: 16
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Search bar */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                id="employee-search"
                type="text"
                placeholder="Name, Email, or Employee ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field"
                style={{ paddingLeft: 32, fontSize: 13 }}
              />
            </div>
          </div>

          {/* Department Filter */}
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>Department</label>
            <select
              id="dept-filter"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="input-field"
              style={{ fontSize: 13 }}
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 5 }}>Status</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="input-field"
              style={{ fontSize: 13 }}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Clear Filters */}
          {hasFilters && (
            <div>
              <button
                onClick={() => { setSearch(''); setDeptFilter(''); setStatusFilter(''); }}
                className="btn-secondary"
                style={{ fontSize: 13, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                id="clear-filters-btn"
              >
                <X size={13} />
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Employee Table/List */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,174,239,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>
            Employees{!loading && <span style={{ fontWeight: 400, color: '#6B7280', fontSize: 13 }}> — {totalCount} records</span>}
          </h2>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#E8192C' }}>
            <AlertCircle size={32} style={{ marginBottom: 8 }} />
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        ) : employees.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center' }}>
            <Users size={40} color="#DBEAFE" style={{ marginBottom: 12 }} />
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: '#1B3A6B' }}>
              No employees found
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>
              {hasFilters ? 'Try adjusting your filters or search terms' : 'Get started by creating your first employee profile'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FBFF' }}>
                  {['Employee', 'Employee ID', 'Department & Designation', 'Joined Date', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 12, fontWeight: 600, color: '#6B7280',
                      borderBottom: '1px solid #DBEAFE', whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((row, i) => {
                  const detailsObj = (Array.isArray(row.details) ? row.details[0] : row.details) || {}
                  return (
                    <tr
                      key={row.id ?? i}
                      style={{ borderBottom: '1px solid #F0F7FF' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FBFF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Employee Profile Name, Email */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar src={row.avatar_url} name={row.full_name} size="sm" online={row.is_online && row.is_active} />
                          <div style={{ overflow: 'hidden' }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1B3A6B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.full_name}
                            </p>
                            <p style={{ margin: 0, fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Employee ID */}
                      <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 500, color: '#1B3A6B' }}>
                        {row.employee_id}
                      </td>

                      {/* Dept & Designation */}
                      <td style={{ padding: '12px 16px' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1B3A6B' }}>
                          {detailsObj.department ?? '—'}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: '#6B7280' }}>
                          {detailsObj.designation ?? '—'}
                        </p>
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {fmtJoinedDate(detailsObj.date_of_joining)}
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge ${row.is_active ? 'badge-green' : 'badge-gray'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {row.is_active ? <UserCheck size={10} /> : <UserX size={10} />}
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Link
                            to={`/admin/employees/${row.id}`}
                            className="btn-secondary"
                            style={{ padding: '5px 8px', fontSize: 11, border: '1px solid #00AEEF' }}
                          >
                            <Eye size={12} />
                            Details
                          </Link>
                          <button
                            onClick={() => handleDeleteClick(row)}
                            className="btn-danger"
                            style={{ padding: '5px 8px', fontSize: 11 }}
                            title="Delete Employee"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div style={{
            padding: '14px 20px', borderTop: '1px solid #DBEAFE',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
              Page {page + 1} of {totalPages} ({totalCount} total)
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => fetchEmployees(page - 1)}
                disabled={page === 0 || loading}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                id="pagination-prev"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                onClick={() => fetchEmployees(page + 1)}
                disabled={page >= totalPages - 1 || loading}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
                id="pagination-next"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add Employee Modal ── */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
          onKeyDown={(e) => trapFocus(e, addModalRef)}
          ref={addModalRef}
        >
          <div style={{
            background: '#FFFFFF', borderRadius: 16,
            maxWidth: 500, width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #DBEAFE', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1B3A6B', margin: 0 }}>Add New Employee</h2>
              <button
                onClick={() => { setShowAddModal(false); resetAddForm(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleAddEmployee} style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label htmlFor="employee_id" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>Employee ID *</label>
                  <input
                    id="employee_id"
                    name="employee_id"
                    type="text"
                    required
                    placeholder="EMP0001"
                    value={formData.employee_id}
                    onChange={handleInputChange}
                    className="input-field"
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div>
                  <label htmlFor="full_name" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>Full Name *</label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    required
                    placeholder="John Doe"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    className="input-field"
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label htmlFor="email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>Email Address *</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="input-field"
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div>
                  <label htmlFor="phone" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>Phone Number</label>
                  <input
                    id="phone"
                    name="phone"
                    type="text"
                    placeholder="+91 99999 99999"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input-field"
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label htmlFor="department" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>Department *</label>
                  <select
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="input-field"
                    style={{ fontSize: 13 }}
                  >
                    {DEPARTMENTS.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="designation" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>Designation *</label>
                  <input
                    id="designation"
                    name="designation"
                    type="text"
                    required
                    placeholder="Fuel Station Operator"
                    value={formData.designation}
                    onChange={handleInputChange}
                    className="input-field"
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label htmlFor="employment_type" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>Employment Type *</label>
                  <select
                    id="employment_type"
                    name="employment_type"
                    value={formData.employment_type}
                    onChange={handleInputChange}
                    className="input-field"
                    style={{ fontSize: 13 }}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="date_of_joining" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>Date of Joining *</label>
                  <input
                    id="date_of_joining"
                    name="date_of_joining"
                    type="date"
                    required
                    value={formData.date_of_joining}
                    onChange={handleInputChange}
                    className="input-field"
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>

              {/* Optional fields divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 14px' }}>
                <div style={{ flex: 1, height: 1, background: '#F0F7FF' }} />
                <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500, whiteSpace: 'nowrap' }}>Optional Details</span>
                <div style={{ flex: 1, height: 1, background: '#F0F7FF' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div>
                  <label htmlFor="blood_group" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>Blood Group</label>
                  <select id="blood_group" name="blood_group" value={formData.blood_group} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }}>
                    <option value="">— Select —</option>
                    {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="aadhar_number" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>Aadhar No.</label>
                  <input id="aadhar_number" name="aadhar_number" type="text" maxLength={12} placeholder="12 digits" value={formData.aadhar_number} onChange={handleInputChange} className="input-field" style={{ fontSize: 13 }} />
                </div>
                <div>
                  <label htmlFor="pan_number" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1B3A6B', marginBottom: 5 }}>PAN No.</label>
                  <input id="pan_number" name="pan_number" type="text" maxLength={10} placeholder="10 chars" value={formData.pan_number} onChange={handleInputChange} className="input-field" style={{ fontSize: 13, textTransform: 'uppercase' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, background: '#EFF6FF', border: '1px solid #DBEAFE', padding: '10px 14px', borderRadius: 8, marginBottom: 20 }}>
                <AlertCircle size={16} color="#00AEEF" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 11, color: '#1B3A6B', lineHeight: 1.5 }}>
                  The employee will be created with a default password of <strong>Fueltracks@1234</strong>.
                  They will be forced to change it on their first login attempt.
                </p>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #F0F7FF', paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetAddForm(); }}
                  disabled={formSubmitting}
                  className="btn-secondary"
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="btn-primary"
                  style={{ fontSize: 13 }}
                  id="add-employee-submit"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Create Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && selectedEmployee && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
          onKeyDown={(e) => trapFocus(e, deleteModalRef)}
          ref={deleteModalRef}
        >
          <div style={{
            background: '#FFFFFF', borderRadius: 16,
            maxWidth: 420, width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            padding: 24
          }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <AlertCircle size={24} color="#E8192C" style={{ flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1B3A6B' }}>
                  Confirm Deletion
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete <strong>{selectedEmployee.full_name}</strong> ({selectedEmployee.employee_id})? 
                  This will delete their profile, employee details, and login history. This action cannot be undone.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setSelectedEmployee(null); }}
                disabled={deleteSubmitting}
                className="btn-secondary"
                id="cancel-delete-btn"
                style={{ fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteSubmitting}
                className="btn-danger"
                style={{ fontSize: 13 }}
                id="confirm-delete-btn"
              >
                {deleteSubmitting ? (
                  <>
                    <Loader2 size={14} style={{ animation: 'spin 0.7s linear infinite' }} />
                    Deleting…
                  </>
                ) : (
                  'Permanently Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
