import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe } from '../api'
import Layout from '../components/Layout'
import { HiClipboardDocumentCheck, HiCheckCircle, HiCalendarDays } from 'react-icons/hi2'

const cards = [
  { name: 'Attendance', icon: HiClipboardDocumentCheck, route: '/attendance', color: '#22c55e', desc: 'Track your daily hours' },
  { name: 'Tasks', icon: HiCheckCircle, route: '/kanban', color: '#3b82f6', desc: 'Manage your workflow' },
  { name: 'Leave', icon: HiCalendarDays, route: '/leave', color: '#8b5cf6', desc: 'Apply for time off' },
]

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/'); return }
    getMe()
      .then((res) => {
        setUser(res.data)
        if (res.data.role === 'admin') navigate('/admin')
      })
      .catch(() => { localStorage.removeItem('token'); navigate('/') })
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/')
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <Layout user={user} onLogout={handleLogout}>
      <div style={{ padding: '40px 48px' }}>
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>
            {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Let's take a look at your activity today
          </p>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Role', value: user?.role || '—', color: 'var(--accent)' },
            { label: 'Department', value: user?.department || 'General', color: 'var(--info)' },
            { label: 'Status', value: 'Active', color: 'var(--success)' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--border-light)',
            }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>
                {stat.label}
              </p>
              <p style={{ fontSize: '22px', fontWeight: '700', color: stat.color }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Module Cards */}
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: 'var(--text)' }}>Modules</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {cards.map((card) => (
            <div
              key={card.name}
              onClick={() => navigate(card.route)}
              style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
                padding: '28px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border-light)',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: card.color + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                flexShrink: 0,
              }}>
                <card.icon size={24} color={card.color} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>{card.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
