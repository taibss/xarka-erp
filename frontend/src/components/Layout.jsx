import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { HiHome, HiClipboardDocumentCheck, HiCheckCircle, HiCalendarDays, HiMegaphone, HiCalendar, HiUserGroup, HiUser, HiBell, HiArrowRightOnRectangle, HiCog6Tooth, HiBriefcase, HiDocumentChartBar } from 'react-icons/hi2'
import { HiChartPie } from 'react-icons/hi'

import API from '../api'

const navItems = [
  { icon: HiClipboardDocumentCheck, label: 'Attendance', route: '/attendance' },
  { icon: HiCheckCircle, label: 'Tasks', route: '/kanban' },
  { icon: HiCalendarDays, label: 'Leave', route: '/leave' },
  { icon: HiMegaphone, label: 'Announcements', route: '/announcements' },
  { icon: HiCalendar, label: 'Meetings', route: '/meetings' },
  { icon: HiUserGroup, label: 'Directory', route: '/directory' },
  { icon: HiUser, label: 'My Profile', route: '/profile' },
  { icon: HiBriefcase, label: 'Designations', route: '/designations', adminOnly: true },
  { icon: HiDocumentChartBar, label: 'Reports', route: '/reports', adminOnly: true },
  { icon: HiCog6Tooth, label: 'Settings', route: '/settings', adminOnly: true },
]

const homeItem = { icon: HiHome, label: 'Home', route: '/dashboard' }
const teamDashItem = { icon: HiChartPie, label: 'Team Dashboard', route: '/admin' }
const employeeMgmtItem = { icon: HiUserGroup, label: 'Manage Employees', route: '/employees', adminOnly: true }

export default function Layout({ children, user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    API.get('/notifications/unread').then(r => setUnreadCount(r.data.count)).catch(() => { })
  }, [location.pathname])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-width)',
        background: 'var(--bg-dark)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 12px',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        borderRadius: '0 24px 24px 0',
      }}>
        {/* Logo */}
        <div style={{
          width: '60px',
          height: '40px',
          borderRadius: '12px',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: '700',
          color: '#fff',
          marginBottom: '32px',
          cursor: 'pointer',
          marginLeft: '6px',
        }} onClick={() => navigate('/dashboard')}>
          XARKA
        </div>

        {/* Nav Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {[user?.role === 'admin' ? teamDashItem : homeItem, ...(user?.role === 'admin' ? [employeeMgmtItem] : []), ...navItems].filter(item => !item.adminOnly || user?.role === 'admin').map((item) => {
            const active = location.pathname === item.route
            return (
              <div
                key={item.route}
                onClick={() => navigate(item.route)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  transition: 'background 0.2s',
                  position: 'relative',
                  color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                {active && (
                  <div style={{
                    position: 'absolute',
                    left: '-12px',
                    width: '4px',
                    height: '20px',
                    borderRadius: '0 4px 4px 0',
                    background: 'var(--accent)',
                  }} />
                )}
                <span style={{ fontSize: '18px', width: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><item.icon size={18} /></span>
                <span style={{ fontSize: '14px', fontWeight: active ? '600' : '400', whiteSpace: 'nowrap' }}>{item.label}</span>
              </div>
            )
          })}
        </div>

        {/* Bottom section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Notification Bell */}
          <div
            onClick={() => navigate('/notifications')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'background 0.2s',
              position: 'relative',
              color: location.pathname === '/notifications' ? '#fff' : 'rgba(255,255,255,0.5)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HiBell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-8px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'var(--error)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span style={{ fontSize: '14px' }}>Notifications</span>
          </div>

          {/* Logout */}
          <div
            onClick={() => { if (window.confirm('Are you sure you want to logout?')) onLogout() }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'background 0.2s',
              color: 'rgba(255,255,255,0.5)',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: '18px', width: '24px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HiArrowRightOnRectangle size={18} /></span>
            <span style={{ fontSize: '14px' }}>Logout</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        marginLeft: 'var(--sidebar-width)',
        minHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  )
}
