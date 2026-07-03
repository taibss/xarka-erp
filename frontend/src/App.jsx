import { BrowserRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Attendance from './pages/Attendance'
import Kanban from './pages/Kanban'
import Leave from './pages/Leave'
import Notifications from './pages/Notifications'
import AdminDashboard from './pages/AdminDashboard'
import Directory from './pages/Directory'
import Profile from './pages/Profile'
import Announcements from './pages/Announcements'
import Meetings from './pages/Meetings'
import EmployeeManagement from './pages/EmployeeManagement'
import DesignationManagement from './pages/DesignationManagement'
import Reports from './pages/Reports'
import AuthCallback from './pages/AuthCallback'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
        <Route path="/kanban" element={<ProtectedRoute><Kanban /></ProtectedRoute>} />
        <Route path="/leave" element={<ProtectedRoute><Leave /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="/directory" element={<ProtectedRoute><Directory /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
        <Route path="/meetings" element={<ProtectedRoute><Meetings /></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute adminOnly><EmployeeManagement /></ProtectedRoute>} />
        <Route path="/designations" element={<ProtectedRoute adminOnly><DesignationManagement /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
