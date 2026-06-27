import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Attendance from './pages/Attendance'
import Kanban from './pages/Kanban'
import Productivity from './pages/Productivity'
import Leave from './pages/Leave'
import Notifications from './pages/Notifications'
import AdminDashboard from './pages/AdminDashboard'
import Directory from './pages/Directory'
import Profile from './pages/Profile'
import Announcements from './pages/Announcements'
import Meetings from './pages/Meetings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/productivity" element={<Productivity />} />
        <Route path="/leave" element={<Leave />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/meetings" element={<Meetings />} />
      </Routes>
    </BrowserRouter>
  )
}
