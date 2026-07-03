import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { HiHome, HiClipboardDocumentCheck, HiCheckCircle, HiCalendarDays, HiMegaphone, HiCalendar, HiUserGroup, HiUser, HiBell, HiArrowRightOnRectangle, HiBriefcase, HiDocumentChartBar, HiBars3 } from 'react-icons/hi2'
import { HiChartPie } from 'react-icons/hi'

import API from '../api'

const navItems = [
  { icon: HiClipboardDocumentCheck, label: 'Attendance', route: '/attendance' },
  { icon: HiCheckCircle, label: 'Tasks', route: '/kanban' },
  { icon: HiCalendarDays, label: 'Leave', route: '/leave' },
  { icon: HiMegaphone, label: 'Announcements', route: '/announcements' },
  { icon: HiCalendar, label: 'Meetings', route: '/meetings' },
  { icon: HiUserGroup, label: 'Directory', route: '/directory' },
  { icon: HiBriefcase, label: 'Designations', route: '/designations', adminOnly: true },
  { icon: HiDocumentChartBar, label: 'Reports', route: '/reports', adminOnly: true },
  { icon: HiUser, label: 'My Profile', route: '/profile' },
]

const homeItem = { icon: HiHome, label: 'Home', route: '/admin' }
const teamDashItem = { icon: HiChartPie, label: 'Team Dashboard', route: '/admin' }
const employeeMgmtItem = { icon: HiUserGroup, label: 'Manage Employees', route: '/employees', adminOnly: true }

const isMobile = () => window.innerWidth <= 768

export default function Layout({ children, user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768)

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    API.get('/notifications/unread').then(r => setUnreadCount(r.data.count)).catch(() => { })
  }, [location.pathname])

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  const navClick = (route) => {
    navigate(route)
    setSidebarOpen(false)
  }

  const navList = [user?.role === 'admin' ? teamDashItem : homeItem, ...(user?.role === 'admin' ? [employeeMgmtItem] : []), ...navItems].filter(item => !item.adminOnly || user?.role === 'admin')

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Hamburger — inside sidebar top-right when open, top-left when closed */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed',
          top: '16px',
          left: sidebarOpen ? 'calc(var(--sidebar-width) - 44px)' : '16px',
          zIndex: 110,
          width: '36px', height: '36px', borderRadius: '10px',
          border: 'none',
          background: sidebarOpen ? 'rgba(255,255,255,0.08)' : 'var(--bg-dark)',
          color: sidebarOpen ? 'rgba(255,255,255,0.6)' : '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.25s ease',
          boxShadow: sidebarOpen ? 'none' : 'var(--shadow)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = sidebarOpen ? 'rgba(255,255,255,0.15)' : '#333'}
        onMouseLeave={e => e.currentTarget.style.background = sidebarOpen ? 'rgba(255,255,255,0.08)' : 'var(--bg-dark)'}
      >
        <HiBars3 size={18} />
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`app-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}
        style={{
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
          transition: 'transform 0.25s ease',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
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
        }} onClick={() => navClick('/admin')}>
          XARKA
        </div>

        {/* Nav Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          {[user?.role === 'admin' ? teamDashItem : homeItem, ...(user?.role === 'admin' ? [employeeMgmtItem] : []), ...navItems].filter(item => !item.adminOnly || user?.role === 'admin').map((item) => {
            const active = location.pathname === item.route
            return (
              <div
                key={item.route}
                onClick={() => navClick(item.route)}
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
            onClick={() => navClick('/notifications')}
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
            onClick={() => setShowLogoutConfirm(true)}
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
        marginLeft: sidebarOpen ? 'var(--sidebar-width)' : '0',
        minHeight: '100vh',
        transition: 'margin-left 0.25s ease',
        paddingTop: '16px',
      }}>
        {children}
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={() => setShowLogoutConfirm(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '28px', width: '100%', maxWidth: '360px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-light)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text)', margin: '0 0 8px' }}>Logout</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px' }}>Are you sure you want to logout?</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowLogoutConfirm(false)} style={{ padding: '9px 18px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Cancel</button>
              <button onClick={() => { setShowLogoutConfirm(false); onLogout() }} style={{ padding: '9px 18px', borderRadius: 'var(--radius-xs)', border: 'none', background: 'var(--bg-dark)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
