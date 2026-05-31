import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/shared/ProtectedRoute'
import LoadingSpinner from './components/shared/LoadingSpinner'
import Navbar from './components/shared/Navbar'

// Layouts (not lazy — needed immediately)
import AdminLayout   from './components/admin/AdminLayout'
import EmployeeLayout from './components/employee/EmployeeLayout'

// Pages — Public (lazy)
const Home           = lazy(() => import('./pages/Home'))
const EmployeeLogin  = lazy(() => import('./pages/auth/EmployeeLogin'))
const AdminLogin     = lazy(() => import('./pages/auth/AdminLogin'))
const ChangePassword = lazy(() => import('./pages/auth/ChangePassword'))
const NotFound       = lazy(() => import('./pages/NotFound'))

// Pages — Admin (lazy)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminProfile   = lazy(() => import('./pages/admin/AdminProfile'))
const Employees      = lazy(() => import('./pages/admin/Employees'))
const EmployeeDetail = lazy(() => import('./pages/admin/EmployeeDetail'))
const DailyCode      = lazy(() => import('./pages/admin/DailyCode'))
const AuditLog       = lazy(() => import('./pages/admin/AuditLog'))
const AddAdmin       = lazy(() => import('./pages/admin/AddAdmin'))
const DataExport     = lazy(() => import('./pages/admin/DataExport'))
const AdminChangePassword = lazy(() => import('./pages/admin/AdminChangePassword'))
const EmployeeProgress = lazy(() => import('./pages/admin/EmployeeProgress'))

// Pages — Employee (lazy)
const EmployeeDashboard  = lazy(() => import('./pages/employee/EmployeeDashboard'))
const EmployeeProfile    = lazy(() => import('./pages/employee/EmployeeProfile'))
const EmployeeHistory    = lazy(() => import('./pages/employee/EmployeeHistory'))
const ChangePasswordPage = lazy(() => import('./pages/employee/ChangePasswordPage'))
const DailyWorkUpdate    = lazy(() => import('./pages/employee/DailyWorkUpdate'))

const ADMIN_ROLES    = ['admin', 'super_admin']
const EMPLOYEE_ROLES = ['employee']

// Suspense fallback — centered spinner
function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <LoadingSpinner size="lg" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* ── Global Toast Notifications ── */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#fff',
              color: '#1B3A6B',
              border: '1px solid #DBEAFE',
              borderRadius: '12px',
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 4px 20px rgba(0,174,239,0.12)',
            },
            success: {
              iconTheme: { primary: '#16A34A', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#E8192C', secondary: '#fff' },
            },
          }}
        />

        {/* ── Global Navbar ── */}
        <Navbar />

        {/* ── Routes ── */}
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/"                element={<Home />} />
            <Route path="/login/employee"  element={<EmployeeLogin />} />
            <Route path="/login/admin"     element={<AdminLogin />} />
            <Route path="/change-password" element={<ChangePassword />} />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={ADMIN_ROLES}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index              element={<AdminDashboard />} />
              <Route path="profile"     element={<AdminProfile />} />
              <Route path="employees"   element={<Employees />} />
              <Route path="employees/:id" element={<EmployeeDetail />} />
              <Route path="daily-code"  element={<DailyCode />} />
              <Route path="audit-log"   element={<AuditLog />} />
              <Route path="export"      element={<DataExport />} />
              <Route path="progress"    element={<EmployeeProgress />} />
              <Route path="change-password" element={<AdminChangePassword />} />
              <Route
                path="add-admin"
                element={
                  <ProtectedRoute allowedRoles={['super_admin']}>
                    <AddAdmin />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Employee routes */}
            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRoles={EMPLOYEE_ROLES}>
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route index              element={<EmployeeDashboard />} />
              <Route path="profile"     element={<EmployeeProfile />} />
              <Route path="history"     element={<EmployeeHistory />} />
              <Route path="password"    element={<ChangePasswordPage />} />
              <Route path="work-update" element={<DailyWorkUpdate />} />
            </Route>

            {/* 404 catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
