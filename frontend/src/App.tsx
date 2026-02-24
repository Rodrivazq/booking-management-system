import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ProfilePage from './pages/ProfilePage'
import UserDashboard from './pages/UserDashboard'
import AdminDashboard from './pages/AdminDashboard'
import PrintPage from './pages/PrintPage'
import ReportsPage from './pages/ReportsPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import MaintenancePage from './pages/MaintenancePage'
import { useAuthStore } from './hooks/useAuthStore'
import { useSettings } from './context/SettingsContext'
import './styles/theme.css'
import './styles/global.css'
import LoadingScreen from './components/LoadingScreen'

function PrivateRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/login" />
  if (adminOnly && user.role === 'user') return <Navigate to="/" />
  return <>{children}</>
}

export default function App() {
  const { user, loading } = useAuthStore();
  const { settings, loading: settingsLoading } = useSettings();
  const location = useLocation();

  if (loading || settingsLoading) {
    return <LoadingScreen />
  }

  // Maintenance Mode Check
  if (settings.maintenanceMode && (!user || (user.role !== 'admin' && user.role !== 'superadmin'))) {
    if (location.pathname !== '/login') {
      return <MaintenancePage />;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />
      <Route path="/reset" element={<ResetPasswordPage />} />

      {/* Protected Routes */}
      <Route path="/" element={
        <PrivateRoute>
          <UserDashboard />
        </PrivateRoute>
      } />
      <Route path="/profile" element={
        <PrivateRoute>
          <ProfilePage />
        </PrivateRoute>
      } />
      <Route path="/admin" element={
        <PrivateRoute adminOnly>
          <AdminDashboard />
        </PrivateRoute>
      } />
      <Route path="/print" element={
        <PrivateRoute adminOnly>
          <PrintPage />
        </PrivateRoute>
      } />
      <Route path="/admin/reports" element={
        <PrivateRoute adminOnly>
          <ReportsPage />
        </PrivateRoute>
      } />
      <Route path="/admin/settings" element={
        <PrivateRoute adminOnly>
          <AdminSettingsPage />
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
